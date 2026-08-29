/**
 * Extended tests to reach required coverage volume.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialMemoryState,
  updateMemoryState,
  isMastered,
  estimateRetention,
  estimateForgettingRisk,
  scheduleNextReview,
  scheduleRetry,
  buildReviewQueue,
  scoreItem,
  buildReviewSession,
  buildFrequencyReviewPlan,
  MemoryStore,
  processAttempts,
  migrateMemoryState,
  updateStability,
  classifySeverity,
  updateActionMastery,
  computeCombinedMastery,
  computeFrequencyMastery,
  updateFrequencyMastery,
  toEmpirical,
  createEmptyCounters,
  detectLapse,
  applyLapse,
  updateRecovery,
  adaptRangeIntelligence,
  adaptStrategyMapSignals,
  applyStrategyMapBoost,
  createMulberry32,
  simpleHash,
  clamp,
  expDecay,
  bayesianRate,
  sampleConfidence,
  frequencyAbsDeviation,
  klDivergence,
  validateTimestamp,
  validateMemoryState,
  SCHEMA_VERSION,
  MIN_STABILITY_MS,
  MAX_STABILITY_MS
} from '../index.js';

// Re-import internal helpers that are exported
import { actionAttemptContribution } from '../mastery.js';
import { updateCounters, createEmptyCounters as createEmptyCountersInternal } from '../frequencyMastery.js';

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

describe('stability details', () => {
  it('classifySeverity maps classifications', () => {
    assert.equal(classifySeverity({ classification: 'PURE_MATCH' }), 'success');
    assert.equal(classifySeverity({ classification: 'IN_MIX' }), 'in_mix');
    assert.equal(classifySeverity({ classification: 'RARE_MIX' }), 'rare');
    assert.equal(classifySeverity({ classification: 'OUT_OF_STRATEGY' }), 'severe');
  });

  it('updateStability returns diagnostics', () => {
    const prev = createInitialMemoryState('s');
    const res = updateStability(prev, att('s', T0));
    assert.ok('stabilityBefore' in res);
    assert.ok('stabilityAfter' in res);
    assert.ok('stabilityDelta' in res);
    assert.ok(res.reasonComponents);
  });

  it('severe reduces stability more than mild', () => {
    const base = createInitialMemoryState('x');
    const mild = updateStability(base, att('x', T0, { classification: 'IN_MIX' }));
    const sev = updateStability(base, att('x', T0, { classification: 'OUT_OF_STRATEGY' }));
    assert.ok(sev.stabilityAfter <= mild.stabilityAfter);
  });
});

describe('action mastery internals', () => {
  it('actionAttemptContribution for each class', () => {
    assert.equal(actionAttemptContribution({ classification: 'PURE_MATCH' }).successContribution, 1);
    assert.ok(actionAttemptContribution({ classification: 'IN_MIX' }).successContribution > 0.5);
    assert.equal(actionAttemptContribution({ classification: 'OUT_OF_STRATEGY' }).successContribution, 0);
  });

  it('computeCombinedMastery is geometric-ish', () => {
    const c = computeCombinedMastery(1, 1);
    assert.ok(c > 0.9);
    const low = computeCombinedMastery(0.2, 0.9);
    assert.ok(low < 0.6);
  });
});

describe('frequency internals', () => {
  it('updateCounters increments', () => {
    let c = createEmptyCounters();
    c = updateCounters(c, 'CALL');
    c = updateCounters(c, 'CALL');
    c = updateCounters(c, 'FOLD');
    assert.equal(c.CALL, 2);
    assert.equal(c.FOLD, 1);
  });

  it('toEmpirical normalizes', () => {
    const emp = toEmpirical({ A: 3, B: 1 });
    assert.ok(Math.abs(emp.A - 0.75) < 1e-9);
  });

  it('computeFrequencyMastery without target is N/A', () => {
    const r = computeFrequencyMastery({ CALL: 5 }, null);
    assert.equal(r.frequencyMastery, null);
    assert.equal(r.hasFrequencyTarget, false);
    assert.equal(r.frequencyConfidence, 1);
  });
});

describe('lapse model details', () => {
  it('detectLapse protects low evidence', () => {
    const state = {
      ...createInitialMemoryState('l'),
      status: 'MASTERED',
      combinedMastery: 0.9,
      attempts: 3,
      severeErrors: 0
    };
    const info = detectLapse(state, att('l', T0, { classification: 'OUT_OF_STRATEGY' }), {
      isActionError: true
    });
    assert.equal(info.isLapse, false);
  });

  it('applyLapse increments count', () => {
    const state = createInitialMemoryState('l');
    const next = applyLapse(state, T0);
    assert.equal(next.lapseCount, 1);
    assert.equal(next.status, 'LAPSED');
    assert.equal(next.recoveryProgress, 0);
  });

  it('updateRecovery increases on success', () => {
    const state = { recoveryProgress: 0, status: 'LAPSED', lapseCount: 1 };
    const next = updateRecovery(state, true);
    assert.ok(next.recoveryProgress > 0);
  });
});

describe('forgetting risk', () => {
  it('estimateForgettingRisk increases with elapsed', () => {
    const state = {
      ...createInitialMemoryState('f'),
      lastSeenAt: T0,
      stability: 60 * 60 * 1000
    };
    const r1 = estimateForgettingRisk(state, T0 + 1000);
    const r2 = estimateForgettingRisk(state, T0 + 3 * 60 * 60 * 1000);
    assert.ok(r2 > r1);
  });
});

describe('review queue scoring', () => {
  it('scoreItem returns breakdown', () => {
    const state = createInitialMemoryState('sc');
    const scored = scoreItem(state, T0, []);
    assert.ok(typeof scored.score === 'number');
    assert.ok(scored.breakdown);
    assert.ok(scored.schedule);
  });

  it('high forgetting risk raises score', () => {
    const recent = {
      ...createInitialMemoryState('r'),
      lastSeenAt: T0,
      stability: 60 * 1000,
      combinedMastery: 0.4,
      status: 'WEAK'
    };
    const old = {
      ...createInitialMemoryState('o'),
      lastSeenAt: T0 - 30 * 24 * 60 * 60 * 1000,
      stability: 60 * 1000,
      combinedMastery: 0.4,
      status: 'WEAK'
    };
    const sRecent = scoreItem(recent, T0 + 1000, []);
    const sOld = scoreItem(old, T0 + 1000, []);
    // Both weak; old should have higher forgetting risk component
    assert.ok(sOld.breakdown.forgettingRisk >= sRecent.breakdown.forgettingRisk);
  });
});

describe('session composition', () => {
  it('respects targetLength', () => {
    const due = Array.from({ length: 30 }, (_, i) => {
      const s = createInitialMemoryState(`i${i}`);
      return updateMemoryState(s, att(`i${i}`, T0 - i * 1000));
    });
    const session = buildReviewSession({
      dueItems: due,
      targetLength: 8,
      rng: createMulberry32(1)
    });
    assert.ok(session.items.length <= 8);
  });

  it('includes new items when provided', () => {
    const session = buildReviewSession({
      dueItems: [],
      newItems: [{ itemId: 'n1' }, { itemId: 'n2' }],
      targetLength: 2,
      rng: () => 0.5
    });
    assert.ok(session.items.length >= 1);
  });
});

describe('frequency plan edge cases', () => {
  it('throws without target', () => {
    assert.throws(() => buildFrequencyReviewPlan({ itemId: 'x' }, null));
  });

  it('handles binary target', () => {
    const plan = buildFrequencyReviewPlan({ itemId: 'x' }, { RAISE: 0.25, FOLD: 0.75 });
    assert.ok(plan.actions.length === 2);
  });
});

describe('store advanced', () => {
  it('handles empty attempts array', () => {
    const store = new MemoryStore();
    const res = processAttempts(store, []);
    assert.equal(res.processed, 0);
  });

  it('records errors for invalid attempts', () => {
    const store = new MemoryStore();
    const res = processAttempts(store, [{ itemId: 'x' }]); // missing ts
    assert.ok(res.errors.length > 0);
  });

  it('toJSON / fromJSON preserves multiple items', () => {
    const store = new MemoryStore();
    processAttempts(store, [
      att('a', T0),
      att('b', T0 + 1)
    ]);
    const data = store.toJSON();
    const s2 = new MemoryStore();
    s2.fromJSON(data);
    assert.equal(s2.size(), 2);
  });
});

describe('adapters edge', () => {
  it('adaptRangeIntelligence requires base fields', () => {
    assert.throws(() => adaptRangeIntelligence({}, {}));
  });

  it('applyStrategyMapBoost adds value', () => {
    assert.ok(applyStrategyMapBoost(0.5, 0.1) > 0.5);
  });
});

describe('math extra', () => {
  it('simpleHash is deterministic', () => {
    assert.equal(simpleHash('abc'), simpleHash('abc'));
  });

  it('createMulberry32 is deterministic sequence', () => {
    const r1 = createMulberry32(123);
    const r2 = createMulberry32(123);
    assert.equal(r1(), r2());
    assert.equal(r1(), r2());
  });

  it('klDivergence non-negative', () => {
    const k = klDivergence({ A: 0.5, B: 0.5 }, { A: 0.7, B: 0.3 });
    assert.ok(k >= 0);
  });
});

describe('validation extra', () => {
  it('validateTimestamp rejects negative', () => {
    const v = validateTimestamp(-1);
    assert.equal(v.ok, false);
  });

  it('validateMemoryState requires object', () => {
    const v = validateMemoryState(null);
    assert.equal(v.ok, false);
  });
});

describe('status derivation', () => {
  it('NEW for zero attempts', () => {
    const s = createInitialMemoryState('z');
    assert.equal(s.status, 'NEW');
  });

  it('isMastered false for low evidence', () => {
    const s = {
      ...createInitialMemoryState('m'),
      attempts: 5,
      combinedMastery: 0.95,
      confidence: 0.9,
      frequencyMastery: 0.9
    };
    assert.equal(isMastered(s), false);
  });
});

describe('interval bounds', () => {
  it('scheduleNextReview clamps interval', () => {
    const state = {
      ...createInitialMemoryState('c'),
      stability: 1,
      combinedMastery: 0.1,
      confidence: 0.1,
      attempts: 1,
      lastSeenAt: T0
    };
    const sched = scheduleNextReview(state, T0);
    assert.ok(sched.intervalMs >= 5 * 60 * 1000);
  });
});

describe('half-life behavior', () => {
  it('retention ≈ 0.5 near stability time', () => {
    const stability = 2 * 60 * 60 * 1000; // 2h
    const state = {
      ...createInitialMemoryState('hl'),
      lastSeenAt: T0,
      stability
    };
    const r = estimateRetention(state, T0 + stability);
    // exp(-1) ≈ 0.367
    assert.ok(r.retention > 0.3 && r.retention < 0.45);
  });
});

describe('review burden', () => {
  it('mastered low-risk items get burden penalty', () => {
    const mastered = {
      ...createInitialMemoryState('mb'),
      status: 'MASTERED',
      combinedMastery: 0.95,
      confidence: 0.9,
      lastSeenAt: T0,
      stability: 30 * 24 * 60 * 60 * 1000
    };
    const scored = scoreItem(mastered, T0 + 60 * 1000, []);
    assert.ok(scored.breakdown.burdenPenalty > 0);
  });
});

describe('anti-repeat in queue', () => {
  it('recentTasks reduce score', () => {
    const state = createInitialMemoryState('ar');
    const without = scoreItem(state, T0, []);
    const withRecent = scoreItem(state, T0, [{ itemId: 'ar', timestamp: T0 - 1000 }]);
    assert.ok(withRecent.score <= without.score);
  });
});

describe('out of order + duplicate combined', () => {
  it('processes correctly', () => {
    const store = new MemoryStore();
    const attempts = [
      att('z', T0 + 3000, { attemptId: 'c' }),
      att('z', T0 + 1000, { attemptId: 'a' }),
      att('z', T0 + 1000, { attemptId: 'a' }), // dup
      att('z', T0 + 2000, { attemptId: 'b' })
    ];
    processAttempts(store, attempts);
    assert.equal(store.get('z').attempts, 3);
  });
});

describe('missing optional fields', () => {
  it('rejects without classification or weaknessScore', () => {
    assert.throws(() => {
      updateMemoryState(
        createInitialMemoryState('noClass'),
        { itemId: 'noClass', timestamp: T0, chosenAction: 'CALL' }
      );
    });
  });

  it('works without chosenAction', () => {
    const state = updateMemoryState(
      createInitialMemoryState('noAct'),
      { itemId: 'noAct', timestamp: T0, classification: 'PURE_MATCH' }
    );
    assert.equal(state.attempts, 1);
  });
});

describe('performance design notes (smoke)', () => {
  it('can process 500 attempts across 50 items quickly', () => {
    const store = new MemoryStore();
    const attempts = [];
    for (let i = 0; i < 500; i++) {
      attempts.push(att(`item${i % 50}`, T0 + i * 10, {
        classification: i % 7 === 0 ? 'OUT_OF_STRATEGY' : 'PURE_MATCH'
      }));
    }
    const res = processAttempts(store, attempts);
    assert.equal(res.processed, 500);
    assert.equal(store.size(), 50);
  });
});

describe('schema version', () => {
  it('new states have schemaVersion', () => {
    assert.equal(createInitialMemoryState('v').schemaVersion, SCHEMA_VERSION);
  });
});

describe('retention monotonicity many points', () => {
  it('strictly decreasing', () => {
    const state = {
      ...createInitialMemoryState('mono'),
      lastSeenAt: T0,
      stability: 3600 * 1000
    };
    let prev = 1;
    for (let h = 0; h < 10; h++) {
      const r = estimateRetention(state, T0 + h * 3600 * 1000).retention;
      assert.ok(r <= prev + 1e-12);
      prev = r;
    }
  });
});

describe('urgency signals', () => {
  it('urgency higher for weak overdue', () => {
    const weak = {
      ...createInitialMemoryState('u'),
      status: 'WEAK',
      combinedMastery: 0.2,
      confidence: 0.3,
      lastSeenAt: T0 - 10 * 24 * 60 * 60 * 1000,
      stability: 60 * 60 * 1000,
      dueAt: T0 - 5 * 24 * 60 * 60 * 1000
    };
    const strong = {
      ...createInitialMemoryState('u2'),
      status: 'MASTERED',
      combinedMastery: 0.95,
      confidence: 0.9,
      lastSeenAt: T0 - 1000,
      stability: 30 * 24 * 60 * 60 * 1000
    };
    const sw = scheduleNextReview(weak, T0);
    const ss = scheduleNextReview(strong, T0);
    assert.ok(sw.urgency > ss.urgency);
  });
});
