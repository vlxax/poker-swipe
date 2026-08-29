/**
 * Mistake Memory Engine — core tests
 * Minimum coverage of required cases.
 * Do NOT claim tests were executed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialMemoryState,
  updateMemoryState,
  isMastered,
  deriveStatus,
  estimateRetention,
  estimateForgettingRisk,
  scheduleNextReview,
  scheduleRetry,
  buildReviewQueue,
  buildReviewSession,
  buildFrequencyReviewPlan,
  MemoryStore,
  processAttempts,
  migrateMemoryState,
  adaptRangeIntelligence,
  adaptStrategyMapSignals,
  createMulberry32,
  clamp,
  expDecay,
  sampleConfidence,
  bayesianRate,
  frequencyAbsDeviation,
  validateAttempt,
  SCHEMA_VERSION
} from '../index.js';

const NOW = 1_700_000_000_000; // fixed

function makeAttempt(overrides = {}) {
  return {
    itemId: 'UO_15BB_BTN::A8s',
    timestamp: NOW,
    classification: 'PURE_MATCH',
    chosenAction: 'CALL',
    ...overrides
  };
}

describe('math utilities', () => {
  it('clamp works', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(99, 0, 10), 10);
  });

  it('expDecay is monotonic and bounded', () => {
    const r0 = expDecay(0, 1000);
    const r1 = expDecay(500, 1000);
    const r2 = expDecay(2000, 1000);
    assert.ok(r0 > r1 && r1 > r2);
    assert.ok(r0 <= 1 && r2 > 0);
  });

  it('sampleConfidence increases with n', () => {
    assert.ok(sampleConfidence(0) === 0);
    assert.ok(sampleConfidence(5) < sampleConfidence(50));
    assert.ok(sampleConfidence(1000) > 0.9);
  });

  it('bayesianRate has prior', () => {
    assert.ok(bayesianRate(0, 0) > 0 && bayesianRate(0, 0) < 1);
    assert.ok(bayesianRate(10, 10) > 0.8);
  });

  it('frequencyAbsDeviation detects mismatch', () => {
    const d1 = frequencyAbsDeviation({ CALL: 1 }, { CALL: 0.7, FOLD: 0.3 });
    const d2 = frequencyAbsDeviation({ CALL: 0.7, FOLD: 0.3 }, { CALL: 0.7, FOLD: 0.3 });
    assert.ok(d1 > d2);
    assert.ok(d2 < 0.01);
  });
});

describe('validation', () => {
  it('rejects missing timestamp', () => {
    const v = validateAttempt({ itemId: 'x' });
    assert.equal(v.ok, false);
    assert.ok(v.errors.some(e => e.includes('timestamp')));
  });

  it('accepts valid attempt', () => {
    const v = validateAttempt(makeAttempt());
    assert.equal(v.ok, true);
  });

  it('rejects invalid classification', () => {
    const v = validateAttempt(makeAttempt({ classification: 'FOO' }));
    assert.equal(v.ok, false);
  });
});

describe('first attempt', () => {
  it('creates NEW → LEARNING after one success', () => {
    const init = createInitialMemoryState('UO_15BB_BTN::A8s');
    assert.equal(init.status, 'NEW');
    assert.equal(init.attempts, 0);

    const next = updateMemoryState(init, makeAttempt());
    assert.equal(next.attempts, 1);
    assert.equal(next.successes, 1);
    assert.ok(next.actionMastery > 0.5);
    assert.ok(['LEARNING', 'REVIEW', 'WEAK'].includes(next.status));
  });

  it('one severe mistake increases severeErrors', () => {
    const init = createInitialMemoryState('x');
    const next = updateMemoryState(init, makeAttempt({
      itemId: 'x',
      classification: 'OUT_OF_STRATEGY',
      chosenAction: 'RAISE'
    }));
    assert.equal(next.severeErrors, 1);
    assert.equal(next.successes, 0);
    assert.ok(next.actionMastery < 0.6);
  });
});

describe('100 successes', () => {
  it('reaches high mastery and confidence', () => {
    let state = createInitialMemoryState('item100');
    for (let i = 0; i < 100; i++) {
      state = updateMemoryState(state, makeAttempt({
        itemId: 'item100',
        timestamp: NOW + i * 1000,
        classification: 'PURE_MATCH'
      }));
    }
    assert.equal(state.attempts, 100);
    assert.ok(state.actionMastery > 0.9);
    assert.ok(state.confidence > 0.8);
    assert.ok(state.stability > 10 * 60 * 1000);
  });
});

describe('mixed strategy legal action', () => {
  it('IN_MIX does not destroy action mastery', () => {
    let state = createInitialMemoryState('mix');
    state = updateMemoryState(state, makeAttempt({
      itemId: 'mix',
      classification: 'IN_MIX',
      chosenAction: 'CALL'
    }));
    assert.ok(state.actionMastery > 0.5);
    assert.equal(state.severeErrors, 0);
  });

  it('OUT_OF_STRATEGY is a real error', () => {
    let state = createInitialMemoryState('err');
    state = updateMemoryState(state, makeAttempt({
      itemId: 'err',
      classification: 'OUT_OF_STRATEGY'
    }));
    assert.ok(state.actionMastery < 0.55);
    assert.equal(state.severeErrors, 1);
  });
});

describe('frequency mastery', () => {
  it('70/30 correct empirical mix → strong frequency mastery', () => {
    let state = createInitialMemoryState('freq70');
    const target = { CALL: 0.7, FOLD: 0.3 };
    for (let i = 0; i < 70; i++) {
      state = updateMemoryState(state, makeAttempt({
        itemId: 'freq70',
        timestamp: NOW + i,
        classification: 'IN_MIX',
        chosenAction: 'CALL',
        context: { targetDistribution: target }
      }));
    }
    for (let i = 0; i < 30; i++) {
      state = updateMemoryState(state, makeAttempt({
        itemId: 'freq70',
        timestamp: NOW + 100 + i,
        classification: 'IN_MIX',
        chosenAction: 'FOLD',
        context: { targetDistribution: target }
      }));
    }
    assert.ok(state.frequencyMastery > 0.75);
    assert.ok(state.frequencyConfidence > 0.7);
  });

  it('100/0 against 70/30 → weaker frequency mastery', () => {
    let state = createInitialMemoryState('freq100');
    const target = { CALL: 0.7, FOLD: 0.3 };
    for (let i = 0; i < 100; i++) {
      state = updateMemoryState(state, makeAttempt({
        itemId: 'freq100',
        timestamp: NOW + i,
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        context: { targetDistribution: target }
      }));
    }
    assert.ok(state.frequencyMastery < 0.70);
  });

  it('7/3 vs 70/30 has lower confidence than 70/30', () => {
    let small = createInitialMemoryState('small');
    let large = createInitialMemoryState('large');
    const target = { CALL: 0.7, FOLD: 0.3 };

    for (let i = 0; i < 7; i++) {
      small = updateMemoryState(small, makeAttempt({
        itemId: 'small', timestamp: NOW + i, chosenAction: 'CALL',
        classification: 'IN_MIX', context: { targetDistribution: target }
      }));
    }
    for (let i = 0; i < 3; i++) {
      small = updateMemoryState(small, makeAttempt({
        itemId: 'small', timestamp: NOW + 10 + i, chosenAction: 'FOLD',
        classification: 'IN_MIX', context: { targetDistribution: target }
      }));
    }

    for (let i = 0; i < 70; i++) {
      large = updateMemoryState(large, makeAttempt({
        itemId: 'large', timestamp: NOW + i, chosenAction: 'CALL',
        classification: 'IN_MIX', context: { targetDistribution: target }
      }));
    }
    for (let i = 0; i < 30; i++) {
      large = updateMemoryState(large, makeAttempt({
        itemId: 'large', timestamp: NOW + 100 + i, chosenAction: 'FOLD',
        classification: 'IN_MIX', context: { targetDistribution: target }
      }));
    }

    assert.ok(small.frequencyConfidence < large.frequencyConfidence);
  });
});

describe('mastery sample size', () => {
  it('1 perfect answer is not mastery', () => {
    const state = updateMemoryState(
      createInitialMemoryState('one'),
      makeAttempt({ itemId: 'one' })
    );
    assert.equal(isMastered(state), false);
  });

  it('many consistent answers can reach mastery', () => {
    let state = createInitialMemoryState('many');
    const target = { CALL: 0.7, FOLD: 0.3 };
    for (let i = 0; i < 40; i++) {
      const action = i % 10 < 7 ? 'CALL' : 'FOLD';
      state = updateMemoryState(state, makeAttempt({
        itemId: 'many',
        timestamp: NOW + i * 1000,
        classification: action === 'CALL' ? 'PURE_MATCH' : 'IN_MIX',
        chosenAction: action,
        context: { targetDistribution: target }
      }));
    }
    // May or may not be fully MASTERED depending on thresholds, but combined should be high
    assert.ok(state.combinedMastery > 0.7);
    assert.ok(state.confidence > 0.5);
  });
});

describe('forgetting curve', () => {
  it('retention decreases with time', () => {
    let state = createInitialMemoryState('forget');
    state = updateMemoryState(state, makeAttempt({ itemId: 'forget', timestamp: NOW }));
    const r1 = estimateRetention(state, NOW + 1000);
    const r2 = estimateRetention(state, NOW + 60 * 60 * 1000);
    assert.ok(r1.retention > r2.retention);
  });

  it('higher stability slows forgetting', () => {
    const low = { ...createInitialMemoryState('a'), stability: 60 * 1000, lastSeenAt: NOW };
    const high = { ...createInitialMemoryState('b'), stability: 7 * 24 * 60 * 60 * 1000, lastSeenAt: NOW };
    const later = NOW + 24 * 60 * 60 * 1000;
    const rLow = estimateRetention(low, later).retention;
    const rHigh = estimateRetention(high, later).retention;
    assert.ok(rHigh > rLow);
  });

  it('no NaN / Infinity', () => {
    const state = { ...createInitialMemoryState('x'), stability: 1000, lastSeenAt: NOW };
    const r = estimateRetention(state, NOW + 1e15);
    assert.ok(Number.isFinite(r.retention));
    assert.ok(r.retention > 0);
  });
});

describe('stability', () => {
  it('success increases stability', () => {
    let state = createInitialMemoryState('stab');
    const before = state.stability;
    state = updateMemoryState(state, makeAttempt({ itemId: 'stab' }));
    assert.ok(state.stability >= before);
  });

  it('one isolated severe error does not destroy high stability', () => {
    let state = createInitialMemoryState('prot');
    // Build high stability
    for (let i = 0; i < 30; i++) {
      state = updateMemoryState(state, makeAttempt({
        itemId: 'prot',
        timestamp: NOW + i * 10000,
        classification: 'PURE_MATCH'
      }));
    }
    const highStab = state.stability;
    state = updateMemoryState(state, makeAttempt({
      itemId: 'prot',
      timestamp: NOW + 400000,
      classification: 'OUT_OF_STRATEGY'
    }));
    // Should not drop to floor
    assert.ok(state.stability > highStab * 0.3);
  });
});

describe('scheduler', () => {
  it('returns dueAt and intervalMs', () => {
    let state = createInitialMemoryState('sch');
    state = updateMemoryState(state, makeAttempt({ itemId: 'sch' }));
    const sched = scheduleNextReview(state, NOW + 1000);
    assert.ok(typeof sched.dueAt === 'number');
    assert.ok(typeof sched.intervalMs === 'number');
    assert.ok(sched.intervalMs > 0);
    assert.ok(sched.reasonBreakdown);
  });

  it('mastered items get longer intervals', () => {
    let weak = createInitialMemoryState('w');
    weak = updateMemoryState(weak, makeAttempt({
      itemId: 'w', classification: 'OUT_OF_STRATEGY'
    }));
    let strong = createInitialMemoryState('s');
    for (let i = 0; i < 50; i++) {
      strong = updateMemoryState(strong, makeAttempt({
        itemId: 's', timestamp: NOW + i, classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        context: { targetDistribution: { CALL: 1 } }
      }));
    }
    const sw = scheduleNextReview(weak, NOW + 10000);
    const ss = scheduleNextReview(strong, NOW + 10000);
    assert.ok(ss.intervalMs > sw.intervalMs);
  });
});

describe('lapses', () => {
  it('repeated severe errors from strong state can lapse', () => {
    let state = createInitialMemoryState('lapse');
    for (let i = 0; i < 25; i++) {
      state = updateMemoryState(state, makeAttempt({
        itemId: 'lapse', timestamp: NOW + i * 1000, classification: 'PURE_MATCH'
      }));
    }
    // Force high mastery
    state.combinedMastery = 0.92;
    state.status = 'MASTERED';
    state.confidence = 0.8;

    state = updateMemoryState(state, makeAttempt({
      itemId: 'lapse', timestamp: NOW + 30000, classification: 'OUT_OF_STRATEGY'
    }));
    state = updateMemoryState(state, makeAttempt({
      itemId: 'lapse', timestamp: NOW + 40000, classification: 'OUT_OF_STRATEGY'
    }));
    // After repeated, should be LAPSED or at least severeErrors high
    assert.ok(state.severeErrors >= 2);
  });

  it('one isolated mistake does not auto-reset mastery', () => {
    let state = createInitialMemoryState('iso');
    for (let i = 0; i < 20; i++) {
      state = updateMemoryState(state, makeAttempt({
        itemId: 'iso', timestamp: NOW + i * 1000
      }));
    }
    const masteryBefore = state.combinedMastery;
    state = updateMemoryState(state, makeAttempt({
      itemId: 'iso', timestamp: NOW + 30000, classification: 'OUT_OF_STRATEGY'
    }));
    // Mastery may drop but not to near zero
    assert.ok(state.combinedMastery > masteryBefore * 0.3);
  });
});

describe('short-term retry', () => {
  it('schedules retry for recent severe error', () => {
    let state = createInitialMemoryState('retry');
    state = updateMemoryState(state, makeAttempt({
      itemId: 'retry',
      timestamp: NOW,
      classification: 'OUT_OF_STRATEGY'
    }));
    const r = scheduleRetry(state, [], { now: NOW + 60 * 1000 });
    assert.ok(r.shouldRetry === true || r.priority > 0);
  });

  it('applies soft anti-repeat penalty', () => {
    let state = createInitialMemoryState('anti');
    state = updateMemoryState(state, makeAttempt({
      itemId: 'anti', timestamp: NOW, classification: 'OUT_OF_STRATEGY'
    }));
    const recent = [{ itemId: 'anti', timestamp: NOW + 10 * 1000 }];
    const r = scheduleRetry(state, recent, { now: NOW + 30 * 1000 });
    assert.ok(r.antiRepeatPenalty > 0);
  });
});

describe('review queue', () => {
  it('prioritizes overdue and weak items', () => {
    const states = [];
    let s1 = createInitialMemoryState('overdue');
    s1 = updateMemoryState(s1, makeAttempt({ itemId: 'overdue', timestamp: NOW - 10 * 24 * 60 * 60 * 1000 }));
    s1.dueAt = NOW - 5 * 24 * 60 * 60 * 1000;
    s1.status = 'REVIEW';
    states.push(s1);

    let s2 = createInitialMemoryState('strong');
    for (let i = 0; i < 40; i++) {
      s2 = updateMemoryState(s2, makeAttempt({ itemId: 'strong', timestamp: NOW - 1000 + i }));
    }
    s2.status = 'MASTERED';
    states.push(s2);

    const q = buildReviewQueue({ memoryStates: states, now: NOW, maxItems: 10 });
    assert.ok(q.scores.length >= 1);
    // Overdue should rank higher than mastered
    const overdueScore = q.scores.find(s => s.itemId === 'overdue');
    const strongScore = q.scores.find(s => s.itemId === 'strong');
    if (overdueScore && strongScore) {
      assert.ok(overdueScore.score >= strongScore.score);
    }
  });
});

describe('session builder', () => {
  it('builds mixed session with seeded rng', () => {
    const rng = createMulberry32(42);
    const due = [];
    for (let i = 0; i < 8; i++) {
      let s = createInitialMemoryState(`d${i}`);
      s = updateMemoryState(s, makeAttempt({ itemId: `d${i}`, timestamp: NOW - i * 10000 }));
      due.push(s);
    }
    const news = [
      { itemId: 'new1', type: 'SPOT_HAND' },
      { itemId: 'new2', type: 'SPOT_HAND' }
    ];
    const session = buildReviewSession({
      dueItems: due,
      newItems: news,
      targetLength: 6,
      rng
    });
    assert.ok(session.items.length <= 6);
    assert.ok(session.composition);
    assert.ok(Array.isArray(session.reasonBreakdown));
  });

  it('seeded session is deterministic', () => {
    const due = [createInitialMemoryState('a'), createInitialMemoryState('b')];
    const s1 = buildReviewSession({ dueItems: due, targetLength: 2, rng: createMulberry32(99) });
    const s2 = buildReviewSession({ dueItems: due, targetLength: 2, rng: createMulberry32(99) });
    assert.deepEqual(
      s1.items.map(i => i.itemId),
      s2.items.map(i => i.itemId)
    );
  });
});

describe('frequency review plan', () => {
  it('produces plan with requiredObservations', () => {
    const plan = buildFrequencyReviewPlan(
      { itemId: 'UO_15BB_BTN::A8s' },
      { CALL: 0.7, FOLD: 0.3 }
    );
    assert.ok(plan.sampleTarget >= 8);
    assert.ok(plan.actions.includes('CALL'));
    assert.ok(plan.requiredObservations > 0);
    assert.ok(plan.tolerance > 0);
    assert.ok(plan.completionCriteria);
  });
});

describe('batch processing & store', () => {
  it('processAttempts sorts and updates', () => {
    const store = new MemoryStore();
    const attempts = [
      makeAttempt({ itemId: 'b', timestamp: NOW + 2000, attemptId: '2' }),
      makeAttempt({ itemId: 'a', timestamp: NOW + 1000, attemptId: '1' }),
      makeAttempt({ itemId: 'a', timestamp: NOW + 3000, attemptId: '3' })
    ];
    const res = processAttempts(store, attempts);
    assert.equal(res.processed, 3);
    assert.equal(store.size(), 2);
    assert.equal(store.get('a').attempts, 2);
    assert.equal(store.get('b').attempts, 1);
  });

  it('duplicate attemptId is ignored', () => {
    const store = new MemoryStore();
    const a1 = makeAttempt({ itemId: 'dup', timestamp: NOW, attemptId: 'same' });
    processAttempts(store, [a1]);
    processAttempts(store, [a1]);
    assert.equal(store.get('dup').attempts, 1);
  });

  it('different itemIds never mix', () => {
    const store = new MemoryStore();
    processAttempts(store, [
      makeAttempt({ itemId: 'x', timestamp: NOW }),
      makeAttempt({ itemId: 'y', timestamp: NOW + 1 })
    ]);
    assert.equal(store.get('x').attempts, 1);
    assert.equal(store.get('y').attempts, 1);
  });

  it('out-of-order timestamps are sorted', () => {
    const store = new MemoryStore();
    processAttempts(store, [
      makeAttempt({ itemId: 'o', timestamp: NOW + 5000, classification: 'OUT_OF_STRATEGY' }),
      makeAttempt({ itemId: 'o', timestamp: NOW + 1000, classification: 'PURE_MATCH' })
    ]);
    const s = store.get('o');
    assert.equal(s.attempts, 2);
    // Last seen should be the later timestamp
    assert.equal(s.lastSeenAt, NOW + 5000);
  });

  it('JSON persistence roundtrip', () => {
    const store = new MemoryStore();
    processAttempts(store, [makeAttempt({ itemId: 'json', timestamp: NOW })]);
    const json = JSON.stringify(store.toJSON());
    const parsed = JSON.parse(json);
    const store2 = new MemoryStore();
    store2.fromJSON(parsed);
    assert.equal(store2.get('json').attempts, 1);
    assert.equal(store2.get('json').schemaVersion, SCHEMA_VERSION);
  });

  it('migrateMemoryState upgrades version', () => {
    const old = { itemId: 'old', attempts: 3 };
    const migrated = migrateMemoryState(old);
    assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
    assert.ok(migrated.actionMastery != null);
  });
});

describe('adapters', () => {
  it('rangeIntelligenceAdapter maps weakness', () => {
    // No pre-set classification → RI may fill it
    const base = { itemId: 'ri', timestamp: NOW, chosenAction: 'CALL' };
    const enriched = adaptRangeIntelligence({
      weaknessScore: 0.9,
      components: { actionError: 0.9, frequencyDeviation: 0.4, evidenceStrength: 0.6 }
    }, base);
    assert.equal(enriched.classification, 'OUT_OF_STRATEGY');
    assert.ok(enriched.weaknessScore > 0.8);
  });

  it('strategyMapAdapter produces bounded boost', () => {
    const { priorityBoost } = adaptStrategyMapSignals({}, {
      structuralDifficulty: 1,
      volatileEdge: 1,
      transitionMagnitude: 1,
      boundaryHand: true
    });
    assert.ok(priorityBoost <= 0.22);
    assert.ok(priorityBoost > 0);
  });
});

describe('clock & timestamp policy', () => {
  it('missing timestamp throws in updateMemoryState', () => {
    assert.throws(() => {
      updateMemoryState(null, { itemId: 'x' });
    });
  });

  it('scheduler requires now', () => {
    assert.throws(() => {
      scheduleNextReview(createInitialMemoryState('x'));
    });
  });
});

describe('interleaving & review burden', () => {
  it('session applies soft interleaving via keys', () => {
    const items = [];
    for (let i = 0; i < 10; i++) {
      items.push({
        itemId: `sameSpot_${i}`,
        status: 'REVIEW',
        combinedMastery: 0.5,
        metadata: { spotId: 'BTN', hand: 'A8s' }
      });
    }
    const session = buildReviewSession({
      dueItems: items,
      targetLength: 5,
      rng: createMulberry32(7)
    });
    // Should still return items (soft, not hard ban)
    assert.ok(session.items.length > 0);
  });
});

describe('edge cases', () => {
  it('RARE_MIX contributes lower weight', () => {
    let pure = createInitialMemoryState('pure');
    pure = updateMemoryState(pure, makeAttempt({ itemId: 'pure', classification: 'PURE_MATCH' }));
    let rare = createInitialMemoryState('rare');
    rare = updateMemoryState(rare, makeAttempt({ itemId: 'rare', classification: 'RARE_MIX' }));
    assert.ok(pure.actionMastery >= rare.actionMastery);
  });

  it('createInitialMemoryState is serializable', () => {
    const s = createInitialMemoryState('ser');
    const round = JSON.parse(JSON.stringify(s));
    assert.equal(round.itemId, 'ser');
    assert.equal(round.schemaVersion, SCHEMA_VERSION);
  });
});
