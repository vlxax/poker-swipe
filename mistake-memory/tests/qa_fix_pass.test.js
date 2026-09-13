/**
 * Regression tests for FIX PASS defects.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialMemoryState,
  updateMemoryState,
  updateStability,
  scheduleRetry,
  processAttempts,
  MemoryStore,
  EVENT_LOG_LIMIT,
  RECENT_SEVERE_WINDOW_MS,
  SAME_SESSION_WINDOW_MS,
  buildReviewSession
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P0-1 IN_MIX does not reduce stability', () => {
  it('A: high-stability + IN_MIX → stabilityAfter >= stabilityBefore', () => {
    let state = createInitialMemoryState('im');
    for (let i = 0; i < 15; i++) {
      state = updateMemoryState(state, {
        itemId: 'im', timestamp: T0 + i * 3600_000,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `p${i}`
      });
    }
    const before = state.stability;
    const res = updateStability(state, {
      itemId: 'im', timestamp: state.lastSeenAt + 3600_000,
      classification: 'IN_MIX', chosenAction: 'CALL'
    });
    assert.ok(res.stabilityAfter >= res.stabilityBefore,
      `IN_MIX reduced stability ${res.stabilityBefore} -> ${res.stabilityAfter}`);
  });

  it('B: PURE_MATCH >= IN_MIX >= RARE_MIX > OUT_OF_STRATEGY growth', () => {
    const base = createInitialMemoryState('ord');
    base.stability = 60 * 60 * 1000;
    base.lastSeenAt = T0;
    base.attempts = 10;
    const ts = T0 + 60 * 60 * 1000;
    const pure = updateStability(base, { classification: 'PURE_MATCH', timestamp: ts });
    const inmix = updateStability(base, { classification: 'IN_MIX', timestamp: ts });
    const rare = updateStability(base, { classification: 'RARE_MIX', timestamp: ts });
    const sev = updateStability(base, { classification: 'OUT_OF_STRATEGY', timestamp: ts });
    assert.ok(pure.stabilityAfter >= inmix.stabilityAfter);
    assert.ok(inmix.stabilityAfter >= rare.stabilityAfter);
    assert.ok(rare.stabilityAfter > sev.stabilityAfter);
  });

  it('C: series of IN_MIX does not destroy stability', () => {
    let state = createInitialMemoryState('series');
    state = updateMemoryState(state, {
      itemId: 'series', timestamp: T0,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 's0'
    });
    const start = state.stability;
    for (let i = 1; i <= 20; i++) {
      state = updateMemoryState(state, {
        itemId: 'series', timestamp: T0 + i * 3600_000,
        classification: 'IN_MIX', chosenAction: 'CALL', attemptId: `s${i}`
      });
    }
    assert.ok(state.stability >= start * 0.9,
      `IN_MIX series destroyed stability ${start} -> ${state.stability}`);
  });
});

describe('P0-2 unscored attempts rejected', () => {
  it('unscored events do not recover LAPSED item', () => {
    let state = createInitialMemoryState('uns');
    // Build strong
    for (let i = 0; i < 20; i++) {
      state = updateMemoryState(state, {
        itemId: 'uns', timestamp: T0 + i * 1000,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `u${i}`
      });
    }
    // Two recent severes to force lapse-ish
    state = updateMemoryState(state, {
      itemId: 'uns', timestamp: T0 + 30000,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 'sev1'
    });
    state = updateMemoryState(state, {
      itemId: 'uns', timestamp: T0 + 31000,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 'sev2'
    });
    // Force LAPSED for recovery test if not already
    if (state.status !== 'LAPSED') {
      state = { ...state, status: 'LAPSED', lapseCount: 1, recoveryProgress: 0.25 };
    }
    const beforeRecovery = state.recoveryProgress;
    const beforeSuccessAt = state.lastSuccessAt;

    // 4 unscored should throw / be rejected
    for (let i = 0; i < 4; i++) {
      assert.throws(() => {
        updateMemoryState(state, {
          itemId: 'uns',
          timestamp: T0 + 40000 + i,
          chosenAction: 'CALL',
          attemptId: `unscored${i}`
        });
      });
    }
    // State unchanged if we never assigned
    assert.equal(state.recoveryProgress, beforeRecovery);
  });

  it('unscored does not update lastSuccessAt when rejected', () => {
    const state = createInitialMemoryState('ls');
    assert.throws(() => {
      updateMemoryState(state, {
        itemId: 'ls', timestamp: T0, chosenAction: 'CALL'
      });
    });
    assert.equal(state.lastSuccessAt, null);
  });
});

describe('P0-3 recentSevere survives compaction', () => {
  it('2 recent severes + compaction → recentSevereInWindow === 2', () => {
    let state = createInitialMemoryState('comp');
    // Strong baseline
    for (let i = 0; i < 5; i++) {
      state = updateMemoryState(state, {
        itemId: 'comp', timestamp: T0 + i * 1000,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `c${i}`
      });
    }
    const sevT0 = T0 + 10000;
    const sevT1 = T0 + 11000;
    state = updateMemoryState(state, {
      itemId: 'comp', timestamp: sevT0,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 'cs0'
    });
    state = updateMemoryState(state, {
      itemId: 'comp', timestamp: sevT1,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 'cs1'
    });
    assert.ok(state.recentSevereInWindow >= 2);

    // Flood log to force compaction (within minutes so severes stay in window)
    for (let i = 0; i < EVENT_LOG_LIMIT + 20; i++) {
      state = updateMemoryState(state, {
        itemId: 'comp',
        timestamp: sevT1 + 1000 + i * 100,
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `flood${i}`
      });
    }
    assert.ok(state._checkpoint);
    assert.equal(state.recentSevereInWindow, 2,
      `after compaction expected 2, got ${state.recentSevereInWindow}`);
  });

  it('after window expires count becomes 0', () => {
    let state = createInitialMemoryState('exp');
    state = updateMemoryState(state, {
      itemId: 'exp', timestamp: T0,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 'e0'
    });
    state = updateMemoryState(state, {
      itemId: 'exp', timestamp: T0 + 1000,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 'e1'
    });
    const far = T0 + RECENT_SEVERE_WINDOW_MS + 60_000;
    state = updateMemoryState(state, {
      itemId: 'exp', timestamp: far,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'efar'
    });
    assert.equal(state.recentSevereInWindow, 0);
  });
});

describe('P1-1 retry uses recent evidence only', () => {
  it('A: ancient severe, healthy status → shouldRetry false', () => {
    const state = {
      ...createInitialMemoryState('rty'),
      severeErrors: 1,
      recentSevereInWindow: 0,
      lastErrorAt: T0,
      status: 'STABLE',
      combinedMastery: 0.8
    };
    const r = scheduleRetry(state, [], {
      now: T0 + 100 * 24 * 60 * 60 * 1000
    });
    assert.equal(r.shouldRetry, false);
  });

  it('B: fresh severe within session window → shouldRetry true', () => {
    const state = {
      ...createInitialMemoryState('rty2'),
      severeErrors: 1,
      recentSevereInWindow: 1,
      lastErrorAt: T0,
      status: 'REVIEW'
    };
    const r = scheduleRetry(state, [], { now: T0 + 60_000 });
    assert.equal(r.shouldRetry, true);
  });

  it('C: LAPSED remains candidate', () => {
    const state = {
      ...createInitialMemoryState('rty3'),
      status: 'LAPSED',
      severeErrors: 0,
      recentSevereInWindow: 0,
      lastErrorAt: null
    };
    const r = scheduleRetry(state, [], { now: T0 });
    assert.ok(r.shouldRetry || r.priority > 0);
  });
});

describe('P1-2 processAttempts telemetry', () => {
  it('applied counts only state mutations', () => {
    const store = new MemoryStore();
    const res = processAttempts(store, [
      { itemId: 't', timestamp: T0, classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'a1' },
      { itemId: 't', timestamp: T0 + 1, classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'a1' }, // dup
      { itemId: 't', timestamp: T0 + 2, classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'a2' }
    ]);
    assert.equal(res.applied, 2);
    assert.equal(res.duplicates, 1);
    assert.equal(res.processed, 2); // backward compat = applied
    assert.ok(res.received >= 3);
  });
});

describe('P2 rng injection required', () => {
  it('buildReviewSession throws without rng', () => {
    assert.throws(() => {
      buildReviewSession({ dueItems: [], targetLength: 1 });
    });
  });
});
