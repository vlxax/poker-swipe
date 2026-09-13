import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialMemoryState,
  updateMemoryState,
  gradeAttempt,
  processAttempts,
  MemoryStore,
  migrateMemoryState,
  EVENT_LOG_LIMIT,
  RECENT_SEVERE_WINDOW_MS,
  createMulberry32,
  buildReviewSession
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P0-1 unified weakness grading', () => {
  it('A: weaknessScore 0.9 → severe, not success', () => {
    let s = createInitialMemoryState('w9');
    s = updateMemoryState(s, {
      itemId: 'w9', timestamp: 1000, weaknessScore: 0.9, attemptId: 'a'
    });
    assert.equal(s.successes, 0);
    assert.equal(s.severeErrors, 1);
    assert.equal(s.lastErrorAt, 1000);
    assert.equal(s.lastSuccessAt, null);
    assert.ok(s.actionMastery < 0.5);
    assert.ok(s.stability <= 10 * 60 * 1000);
  });

  it('B: weaknessScore 0.05 → success', () => {
    let s = createInitialMemoryState('w05');
    s = updateMemoryState(s, {
      itemId: 'w05', timestamp: 1000, weaknessScore: 0.05, attemptId: 'b'
    });
    assert.equal(s.successes, 1);
    assert.equal(s.severeErrors, 0);
    assert.equal(s.lastSuccessAt, 1000);
    assert.equal(s.lastErrorAt, null);
  });

  it('C: classification wins over disagreeing weaknessScore', () => {
    const g = gradeAttempt({ classification: 'PURE_MATCH', weaknessScore: 0.99 });
    assert.equal(g.classification, 'PURE_MATCH');
    assert.equal(g.source, 'classification');
    let s = createInitialMemoryState('prec');
    s = updateMemoryState(s, {
      itemId: 'prec', timestamp: 1000,
      classification: 'PURE_MATCH', weaknessScore: 0.99, attemptId: 'c'
    });
    assert.equal(s.successes, 1);
    assert.equal(s.severeErrors, 0);
  });
});

describe('P0-2 targetProbability does not reset on action change', () => {
  it('70 CALL + 30 FOLD via stable targetDistribution accumulates both', () => {
    let s = createInitialMemoryState('tp');
    const target = { CALL: 0.7, FOLD: 0.3 };
    for (let i = 0; i < 70; i++) {
      s = updateMemoryState(s, {
        itemId: 'tp', timestamp: T0 + i,
        classification: 'IN_MIX', chosenAction: 'CALL',
        context: { targetDistribution: target }, attemptId: `c${i}`
      });
    }
    for (let i = 0; i < 30; i++) {
      s = updateMemoryState(s, {
        itemId: 'tp', timestamp: T0 + 100 + i,
        classification: 'IN_MIX', chosenAction: 'FOLD',
        context: { targetDistribution: target }, attemptId: `f${i}`
      });
    }
    assert.ok(s._frequencyCounters.CALL >= 70);
    assert.ok(s._frequencyCounters.FOLD >= 30);
    assert.ok(s.frequencyMastery > 0.7);
  });

  it('alternating CALL/FOLD does not reset counters', () => {
    let s = createInitialMemoryState('alt');
    const target = { CALL: 0.7, FOLD: 0.3 };
    for (let i = 0; i < 10; i++) {
      const action = i % 2 === 0 ? 'CALL' : 'FOLD';
      s = updateMemoryState(s, {
        itemId: 'alt', timestamp: T0 + i,
        classification: 'IN_MIX', chosenAction: action,
        context: { targetDistribution: target }, attemptId: `a${i}`
      });
    }
    assert.ok((s._frequencyCounters.CALL || 0) + (s._frequencyCounters.FOLD || 0) === 10);
  });
});

describe('P1-1 options.targetDistribution validated', () => {
  it('invalid percentages through options throw', () => {
    assert.throws(() => {
      updateMemoryState(createInitialMemoryState('opt'), {
        itemId: 'opt', timestamp: T0,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'o1'
      }, { targetDistribution: { CALL: 70, FOLD: 30 } });
    });
  });

  it('negative through options throw', () => {
    assert.throws(() => {
      updateMemoryState(createInitialMemoryState('opt2'), {
        itemId: 'opt2', timestamp: T0,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'o2'
      }, { targetDistribution: { CALL: 1.1, FOLD: -0.1 } });
    });
  });

  it('valid through options works', () => {
    let s = updateMemoryState(createInitialMemoryState('opt3'), {
      itemId: 'opt3', timestamp: T0,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'o3'
    }, { targetDistribution: { CALL: 0.7, FOLD: 0.3 } });
    assert.equal(s.hasFrequencyTarget, true);
  });
});

describe('P1-2 migration preserves recent severe evidence', () => {
  it('v2 state with recentSevereInWindow=2 keeps evidence after update', () => {
    const legacy = {
      schemaVersion: 2,
      itemId: 'mig',
      attempts: 25,
      successes: 20,
      severeErrors: 2,
      recentSevereInWindow: 2,
      actionMastery: 0.85,
      combinedMastery: 0.85,
      confidence: 0.7,
      stability: 3600000,
      status: 'STABLE',
      lastSeenAt: T0,
      lastErrorAt: T0 - 1000,
      hasFrequencyTarget: false,
      _eventLog: [],
      _actionWeightedSuccesses: 20,
      _actionTotalWeight: 25
    };
    const mig = migrateMemoryState(legacy);
    assert.ok((mig._recentSevereTimestamps || []).length >= 2 || mig.recentSevereInWindow === 2);

    const next = updateMemoryState(mig, {
      itemId: 'mig', timestamp: T0 + 5000,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'mnew'
    });
    // Must not silently erase all recent severe unless outside window
    assert.ok(
      next.recentSevereInWindow >= 1 ||
      (next._recentSevereTimestamps && next._recentSevereTimestamps.length >= 1),
      `recent severe lost: window=${next.recentSevereInWindow}`
    );
  });
});

describe('P1-3 same-timestamp severe events distinct', () => {
  it('two severe same timestamp different ids → recentSevereInWindow === 2', () => {
    let s = createInitialMemoryState('same');
    s = updateMemoryState(s, {
      itemId: 'same', timestamp: T0,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 's1'
    });
    s = updateMemoryState(s, {
      itemId: 'same', timestamp: T0,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 's2'
    });
    assert.equal(s.severeErrors, 2);
    assert.equal(s.recentSevereInWindow, 2);
  });
});

describe('P1-4 checkpoint boundary cursor with same timestamp', () => {
  it('late arrival same timestamp earlier id after compaction is rejected', () => {
    let s = createInitialMemoryState('bnd');
    // Fill past limit with same-timestamp groups
    for (let i = 0; i < EVENT_LOG_LIMIT + 5; i++) {
      s = updateMemoryState(s, {
        itemId: 'bnd',
        timestamp: T0 + Math.floor(i / 2), // many share timestamps
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `id_${String(i).padStart(4, '0')}`
      });
    }
    assert.ok(s._checkpoint);
    const cursor = s._checkpointCursor;
    assert.ok(cursor);

    // Attempt with same timestamp as cursor but lexicographically smaller id
    // and timestamp equal → should be rejected if id <= cursor.attemptId
    const late = updateMemoryState(s, {
      itemId: 'bnd',
      timestamp: cursor.timestamp,
      classification: 'OUT_OF_STRATEGY',
      chosenAction: 'X',
      attemptId: '' // empty <= any id
    });
    assert.equal(late._lastRejectReason, 'event_older_than_checkpoint_boundary');
  });
});

describe('P2 Fisher-Yates deterministic', () => {
  it('seeded session is deterministic', () => {
    const due = [
      { itemId: 'a', status: 'REVIEW', combinedMastery: 0.5 },
      { itemId: 'b', status: 'REVIEW', combinedMastery: 0.5 },
      { itemId: 'c', status: 'REVIEW', combinedMastery: 0.5 }
    ];
    const s1 = buildReviewSession({ dueItems: due, targetLength: 3, rng: createMulberry32(42) });
    const s2 = buildReviewSession({ dueItems: due, targetLength: 3, rng: createMulberry32(42) });
    assert.deepEqual(s1.items.map(i => i.itemId), s2.items.map(i => i.itemId));
  });
});
