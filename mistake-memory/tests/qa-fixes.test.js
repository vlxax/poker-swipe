/**
 * QA fix verification tests (P0-1 … P1-7 + contract tests)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialMemoryState,
  updateMemoryState,
  isMastered,
  deriveStatus,
  hasFrequencyTarget,
  updateStability,
  classifySeverity,
  computeFrequencyMastery,
  MemoryStore,
  processAttempts,
  adaptRangeIntelligence,
  SEEN_ATTEMPT_ID_LIMIT
} from '../index.js';

const T0 = 1_700_000_000_000;

function att(id, ts, extra = {}) {
  return {
    itemId: id,
    timestamp: ts,
    classification: 'PURE_MATCH',
    chosenAction: 'CALL',
    ...extra
  };
}

describe('P0-1: no frequency target does not block mastery', () => {
  it('after 100 PURE_MATCH without target → high confidence, can be MASTERED', () => {
    let state = createInitialMemoryState('pure100');
    for (let i = 0; i < 100; i++) {
      state = updateMemoryState(state, att('pure100', T0 + i * 1000, {
        classification: 'PURE_MATCH',
        chosenAction: 'CALL'
        // no targetDistribution
      }));
    }
    assert.equal(state.hasFrequencyTarget, false);
    assert.equal(state.frequencyMastery, null);
    assert.equal(state.frequencyConfidence, 1);
    assert.ok(state.actionMastery > 0.9);
    assert.ok(state.combinedMastery > 0.88);
    assert.ok(state.confidence > 0.8);
    assert.equal(isMastered(state), true);
    assert.equal(deriveStatus(state), 'MASTERED');
  });

  it('hasFrequencyTarget false when only counters exist without target', () => {
    let state = createInitialMemoryState('cnt');
    state = updateMemoryState(state, att('cnt', T0, { chosenAction: 'CALL' }));
    assert.equal(hasFrequencyTarget(state), false);
    assert.equal(state.frequencyMastery, null);
  });

  it('isMastered ignores frequency when no target', () => {
    const state = {
      ...createInitialMemoryState('m'),
      attempts: 20,
      combinedMastery: 0.92,
      confidence: 0.8,
      frequencyMastery: null,
      hasFrequencyTarget: false,
      _targetDistribution: null
    };
    assert.equal(isMastered(state), true);
  });
});

describe('P0-2: stability severity ordering', () => {
  it('OUT_OF_STRATEGY penalty >= IN_MIX >= PURE_MATCH for same previousState', () => {
    const base = createInitialMemoryState('ord');
    // first attempt — low confidence
    const success = updateStability(base, att('ord', T0, { classification: 'PURE_MATCH' }));
    const mild = updateStability(base, att('ord', T0, { classification: 'IN_MIX' }));
    const severe = updateStability(base, att('ord', T0, { classification: 'OUT_OF_STRATEGY' }));

    assert.ok(
      severe.stabilityAfter <= mild.stabilityAfter,
      `severe ${severe.stabilityAfter} should be <= mild ${mild.stabilityAfter}`
    );
    assert.ok(
      mild.stabilityAfter <= success.stabilityAfter,
      `mild ${mild.stabilityAfter} should be <= success ${success.stabilityAfter}`
    );
  });

  it('ordering holds after many prior successes (high conf)', () => {
    let built = createInitialMemoryState('ord2');
    for (let i = 0; i < 20; i++) {
      built = updateMemoryState(built, att('ord2', T0 + i * 1000));
    }
    const success = updateStability(built, att('ord2', T0 + 30000, { classification: 'PURE_MATCH' }));
    const mild = updateStability(built, att('ord2', T0 + 30000, { classification: 'RARE_MIX' }));
    const severe = updateStability(built, att('ord2', T0 + 30000, { classification: 'OUT_OF_STRATEGY' }));

    assert.ok(severe.stabilityAfter <= mild.stabilityAfter);
    assert.ok(mild.stabilityAfter <= success.stabilityAfter);
  });

  it('isolated severe does not destroy high stability floor', () => {
    let state = createInitialMemoryState('floor');
    for (let i = 0; i < 30; i++) {
      state = updateMemoryState(state, att('floor', T0 + i * 10000));
    }
    const high = state.stability;
    state = updateMemoryState(state, att('floor', T0 + 400000, {
      classification: 'OUT_OF_STRATEGY'
    }));
    assert.ok(state.stability > high * 0.3);
  });
});

describe('P1-3: frequency calibration', () => {
  const target = { CALL: 0.7, FOLD: 0.3 };

  it('70/30 exact → strong frequency mastery', () => {
    const counters = { CALL: 70, FOLD: 30 };
    const r = computeFrequencyMastery(counters, target);
    assert.ok(r.frequencyMastery > 0.75);
    assert.ok(r.hasFrequencyTarget);
  });

  it('100/0 vs 70/30 → frequency mistake, not strong', () => {
    const counters = { CALL: 100 };
    const r = computeFrequencyMastery(counters, target);
    assert.ok(r.frequencyMastery < 0.70, `got ${r.frequencyMastery}`);
    assert.ok(r.frequencyDeviation >= 0.25);
  });

  it('50/50 vs 70/30 → moderate deviation', () => {
    const counters = { CALL: 50, FOLD: 50 };
    const r = computeFrequencyMastery(counters, target);
    assert.ok(r.frequencyMastery < 0.75);
    assert.ok(r.frequencyMastery > 0.2);
  });

  it('7/3 vs 70/30 → good match but lower confidence than 70/30', () => {
    const small = computeFrequencyMastery({ CALL: 7, FOLD: 3 }, target);
    const large = computeFrequencyMastery({ CALL: 70, FOLD: 30 }, target);
    assert.ok(small.frequencyConfidence < large.frequencyConfidence);
    assert.ok(small.frequencyMastery < large.frequencyMastery);
  });

  it('1/0 vs 70/30 → very low confidence', () => {
    const r = computeFrequencyMastery({ CALL: 1 }, target);
    assert.ok(r.frequencyConfidence < 0.3);
  });

  it('integrated 100 CALL against 70/30 does not yield STABLE/MASTERED frequency', () => {
    let state = createInitialMemoryState('cal100');
    for (let i = 0; i < 100; i++) {
      state = updateMemoryState(state, att('cal100', T0 + i, {
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        context: { targetDistribution: target }
      }));
    }
    assert.ok(state.frequencyMastery < 0.70);
    assert.equal(state.hasFrequencyTarget, true);
    // Should not be MASTERED because frequency is wrong
    assert.equal(isMastered(state), false);
  });
});

describe('P1-4: frequency target persistence', () => {
  it('target persists; later attempt without target keeps frequency judgment', () => {
    let state = createInitialMemoryState('persist');
    const target = { CALL: 0.7, FOLD: 0.3 };

    // First attempts establish target
    for (let i = 0; i < 10; i++) {
      state = updateMemoryState(state, att('persist', T0 + i, {
        chosenAction: 'CALL',
        classification: 'PURE_MATCH',
        context: { targetDistribution: target }
      }));
    }
    assert.equal(state.hasFrequencyTarget, true);
    assert.ok(state._targetDistribution);

    // Later attempt WITHOUT target
    state = updateMemoryState(state, att('persist', T0 + 100, {
      chosenAction: 'CALL',
      classification: 'PURE_MATCH'
      // no context.targetDistribution
    }));

    assert.equal(state.hasFrequencyTarget, true);
    assert.notEqual(state.frequencyMastery, null);
    // Still judged against persisted 70/30 → all CALL is a deviation
    assert.ok(state.frequencyMastery < 0.7);
  });
});

describe('P1-5: Range Intelligence adapter contract', () => {
  it('does not override existing classification', () => {
    const base = {
      itemId: 'ri1',
      timestamp: T0,
      classification: 'PURE_MATCH',
      chosenAction: 'CALL'
    };
    const out = adaptRangeIntelligence({
      weaknessScore: 0.95,
      components: { actionError: 0.99 }
    }, base);
    assert.equal(out.classification, 'PURE_MATCH');
    assert.ok(out.weaknessScore > 0.9);
  });

  it('fills classification only when absent', () => {
    const base = { itemId: 'ri2', timestamp: T0, chosenAction: 'RAISE' };
    const out = adaptRangeIntelligence({
      components: { actionError: 0.9 }
    }, base);
    assert.equal(out.classification, 'OUT_OF_STRATEGY');
  });

  it('null payload returns base unchanged', () => {
    const base = { itemId: 'ri3', timestamp: T0, classification: 'IN_MIX' };
    const out = adaptRangeIntelligence(null, base);
    assert.equal(out.classification, 'IN_MIX');
  });

  it('requires itemId and timestamp', () => {
    assert.throws(() => adaptRangeIntelligence({}, {}));
    assert.throws(() => adaptRangeIntelligence({}, { itemId: 'x' }));
  });
});

describe('P1-6: idempotency window', () => {
  it('duplicate attemptId within window is ignored', () => {
    let state = createInitialMemoryState('dup');
    state = updateMemoryState(state, att('dup', T0, { attemptId: 'A1' }));
    const after = updateMemoryState(state, att('dup', T0 + 1, { attemptId: 'A1' }));
    assert.equal(after.attempts, 1);
  });

  it('duplicate older than window can be re-applied (documented bound)', async () => {
    const { EVENT_LOG_LIMIT } = await import('../index.js');
    let state = createInitialMemoryState('win');
    // Fill event log beyond limit so OLD falls out of the log
    state = updateMemoryState(state, att('win', T0, { attemptId: 'OLD' }));
    for (let i = 0; i < EVENT_LOG_LIMIT; i++) {
      state = updateMemoryState(state, att('win', T0 + 1 + i, {
        attemptId: `id_${i}`
      }));
    }
    // OLD should have been shifted out of event log
    assert.ok(!state._eventLog.some(e => e.id === 'OLD'));
    state = updateMemoryState(state, att('win', T0 + 999999, { attemptId: 'OLD' }));
    // OLD is accepted again because it fell out of the bounded event log
    assert.ok(state._eventLog.some(e => e.id === 'OLD'));
  });
});

describe('P1-7: cross-batch out-of-order', () => {
  it('later batch with older timestamp does not rewind lastSeenAt', () => {
    const store = new MemoryStore();

    // Batch 1: timestamp 2000
    processAttempts(store, [att('ooo', T0 + 2000, { attemptId: 'late' })]);
    const mid = store.get('ooo');
    assert.equal(mid.lastSeenAt, T0 + 2000);
    assert.equal(mid.attempts, 1);
    const stabMid = mid.stability;

    // Batch 2: older timestamp 1000
    processAttempts(store, [att('ooo', T0 + 1000, { attemptId: 'early' })]);
    const final = store.get('ooo');

    assert.equal(final.attempts, 2);
    // lastSeenAt must not go backwards
    assert.equal(final.lastSeenAt, T0 + 2000);
    // stability should still be a finite positive number
    assert.ok(Number.isFinite(final.stability) && final.stability > 0);
    // dueAt should remain based on the newer event path (not corrupted to ancient)
    assert.ok(final.dueAt == null || final.dueAt >= T0 + 2000);
  });

  it('out-of-order still updates mastery counts', () => {
    const store = new MemoryStore();
    processAttempts(store, [att('ooo2', T0 + 5000)]);
    processAttempts(store, [
      att('ooo2', T0 + 1000, { classification: 'OUT_OF_STRATEGY', chosenAction: 'RAISE' })
    ]);
    const s = store.get('ooo2');
    assert.equal(s.attempts, 2);
    assert.equal(s.severeErrors, 1);
    assert.equal(s.lastSeenAt, T0 + 5000);
  });
});
