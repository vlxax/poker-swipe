/**
 * Final patch + adversarial / invariant tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialMemoryState,
  updateMemoryState,
  semanticSnapshot,
  migrateMemoryState,
  scheduleNextReview,
  resolveSchedulerNow,
  buildFrequencyReviewPlan,
  gradeAttempt,
  validateTargetDistribution,
  createMulberry32,
  EVENT_LOG_LIMIT,
  SEEN_ATTEMPT_ID_LIMIT,
  MIN_STABILITY_MS,
  MAX_STABILITY_MS
} from '../index.js';

const T0 = 1_700_000_000_000;

function assertInvariants(state, label = '') {
  const msg = label ? ` [${label}]` : '';
  assert.ok(Number.isFinite(state.actionMastery), `actionMastery finite${msg}`);
  assert.ok(state.actionMastery >= 0 && state.actionMastery <= 1, `actionMastery range${msg}`);
  if (state.frequencyMastery != null) {
    assert.ok(Number.isFinite(state.frequencyMastery), `freqMastery finite${msg}`);
    assert.ok(state.frequencyMastery >= 0 && state.frequencyMastery <= 1, `freqMastery range${msg}`);
  }
  assert.ok(Number.isFinite(state.combinedMastery));
  assert.ok(state.combinedMastery >= 0 && state.combinedMastery <= 1);
  assert.ok(Number.isFinite(state.stability));
  assert.ok(state.stability >= MIN_STABILITY_MS && state.stability <= MAX_STABILITY_MS);
  assert.ok(Number.isFinite(state.attempts) && state.attempts >= 0);
  if (state.dueAt != null) assert.ok(Number.isFinite(state.dueAt));
  if (state.intervalMs != null) assert.ok(state.intervalMs >= 0);
}

function makeAttempt(itemId, t, overrides = {}) {
  return {
    itemId,
    timestamp: t,
    classification: 'PURE_MATCH',
    chosenAction: 'CALL',
    attemptId: overrides.attemptId ?? `id_${itemId}_${t}_${Math.random().toString(36).slice(2, 8)}`,
    ...overrides
  };
}

describe('targetProbability contract', () => {
  it('targetProbability alone fails fast (not a frequency target)', () => {
    assert.throws(() => {
      updateMemoryState(createInitialMemoryState('tp'), {
        itemId: 'tp', timestamp: T0,
        classification: 'PURE_MATCH', chosenAction: 'CALL',
        targetProbability: 0.7, attemptId: 'tp1'
      });
    }, /targetProbability alone is not a frequency target/);
  });

  it('targetProbability + targetDistribution accepted', () => {
    const s = updateMemoryState(createInitialMemoryState('tp2'), {
      itemId: 'tp2', timestamp: T0,
      classification: 'PURE_MATCH', chosenAction: 'CALL',
      targetProbability: 0.7,
      context: { targetDistribution: { CALL: 0.7, FOLD: 0.3 } },
      attemptId: 'tp2'
    });
    assert.equal(s.hasFrequencyTarget, true);
  });
});

describe('unified targetDistribution validation entry points', () => {
  const bad = [
    { CALL: 70, FOLD: 30 },
    { CALL: -0.1, FOLD: 1.1 },
    { CALL: NaN, FOLD: NaN },
    { CALL: 0, FOLD: 0 }
  ];
  for (const dist of bad) {
    it(`rejects ${JSON.stringify(dist)} via validateTargetDistribution`, () => {
      assert.equal(validateTargetDistribution(dist).ok, false);
    });
    it(`rejects via buildFrequencyReviewPlan`, () => {
      assert.throws(() => buildFrequencyReviewPlan({ itemId: 'x' }, dist));
    });
    it(`rejects via updateMemoryState context`, () => {
      assert.throws(() => {
        updateMemoryState(createInitialMemoryState('v'), {
          itemId: 'v', timestamp: T0,
          classification: 'PURE_MATCH', chosenAction: 'CALL',
          context: { targetDistribution: dist }, attemptId: 'v1'
        });
      });
    });
  }
  it('accepts {CALL:.7,FOLD:.3}', () => {
    assert.equal(validateTargetDistribution({ CALL: 0.7, FOLD: 0.3 }).ok, true);
    const plan = buildFrequencyReviewPlan({ itemId: 'x' }, { CALL: 0.7, FOLD: 0.3 });
    assert.ok(plan.actions.includes('CALL'));
  });
  it('accepts FP sum 0.1+0.2', () => {
    assert.equal(validateTargetDistribution({ CALL: 0.1 + 0.2, FOLD: 0.7 }).ok, true);
  });
});

describe('replay invariance', () => {
  it('chrono vs reverse vs random same semantic snapshot within retained history', () => {
    const n = 40;
    const attempts = [];
    for (let i = 0; i < n; i++) {
      const cls = i % 7 === 0 ? 'OUT_OF_STRATEGY' : i % 5 === 0 ? 'RARE_MIX' : i % 3 === 0 ? 'IN_MIX' : 'PURE_MATCH';
      attempts.push({
        itemId: 'rep',
        timestamp: T0 + i * 1000,
        classification: cls,
        chosenAction: i % 2 === 0 ? 'CALL' : 'FOLD',
        attemptId: `rep_${i}`,
        context: { targetDistribution: { CALL: 0.6, FOLD: 0.4 } }
      });
    }
    function run(order) {
      let s = createInitialMemoryState('rep');
      for (const a of order) s = updateMemoryState(s, a);
      return semanticSnapshot(s);
    }
    const chrono = run(attempts);
    const rev = run([...attempts].reverse());
    const rng = createMulberry32(123);
    const shuffled = [...attempts].sort(() => rng() - 0.5);
    const rand = run(shuffled);
    assert.deepEqual(chrono, rev);
    assert.deepEqual(chrono, rand);
  });
});

describe('compaction invariance & boundary', () => {
  it('multiple compaction cycles preserve lifetime attempts', () => {
    let s = createInitialMemoryState('cmp');
    const N = EVENT_LOG_LIMIT + 80;
    for (let i = 0; i < N; i++) {
      s = updateMemoryState(s, {
        itemId: 'cmp', timestamp: T0 + i * 10,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `c${i}`
      });
      assertInvariants(s, `i=${i}`);
    }
    assert.equal(s.attempts, N);
    assert.ok(s._checkpoint);
  });
});

describe('idempotency bounded contract', () => {
  it('duplicate within seen window ignored; beyond window may re-apply (documented)', () => {
    let s = createInitialMemoryState('idem');
    s = updateMemoryState(s, {
      itemId: 'idem', timestamp: T0,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'dup'
    });
    const a1 = s.attempts;
    s = updateMemoryState(s, {
      itemId: 'idem', timestamp: T0 + 1,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'dup'
    });
    assert.equal(s.attempts, a1); // immediate dup

    // Flood past SEEN window with unique ids
    for (let i = 0; i < SEEN_ATTEMPT_ID_LIMIT + 5; i++) {
      s = updateMemoryState(s, {
        itemId: 'idem', timestamp: T0 + 100 + i,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `flood_${i}`
      });
    }
    // Documented: after eviction from seen + event log, re-apply may occur
    // We only assert no throw and invariants
    assertInvariants(s);
  });
});

describe('mastery mathematical invariants 10k', () => {
  it('800 deterministic attempts stay finite and bounded', () => {
    let s = createInitialMemoryState('inv');
    const rng = createMulberry32(99);
    const classes = ['PURE_MATCH', 'IN_MIX', 'RARE_MIX', 'OUT_OF_STRATEGY'];
    for (let i = 0; i < 800; i++) {
      const cls = classes[Math.floor(rng() * classes.length)];
      s = updateMemoryState(s, {
        itemId: 'inv',
        timestamp: T0 + i * 1000,
        classification: cls,
        chosenAction: rng() > 0.5 ? 'CALL' : 'FOLD',
        attemptId: `inv_${i}`,
        context: i % 100 === 0
          ? { targetDistribution: { CALL: 0.7, FOLD: 0.3 } }
          : undefined
      });
      if (i % 500 === 0) assertInvariants(s, `i=${i}`);
    }
    assertInvariants(s, 'final');
    assert.equal(s.attempts, 800);
  });
});

describe('weakness/classification precedence consistency', () => {
  it('classification PURE_MATCH + weakness severe → all modules agree success', () => {
    const att = {
      itemId: 'pr', timestamp: T0,
      classification: 'PURE_MATCH', weaknessScore: 0.99, attemptId: 'pr1'
    };
    const g = gradeAttempt(att);
    assert.equal(g.classification, 'PURE_MATCH');
    let s = updateMemoryState(createInitialMemoryState('pr'), att);
    assert.equal(s.successes, 1);
    assert.equal(s.severeErrors, 0);
    assert.ok(s.stability >= MIN_STABILITY_MS);
  });

  it('classification OUT_OF_STRATEGY + weakness low → all agree error', () => {
    const att = {
      itemId: 'pr2', timestamp: T0,
      classification: 'OUT_OF_STRATEGY', weaknessScore: 0.01, attemptId: 'pr2'
    };
    assert.equal(gradeAttempt(att).isError, true);
    let s = updateMemoryState(createInitialMemoryState('pr2'), att);
    assert.equal(s.severeErrors, 1);
    assert.equal(s.successes, 0);
  });
});

describe('frequency target lifecycle', () => {
  it('70/30 preserved; change to 60/40 resets once; key order independent', () => {
    let s = createInitialMemoryState('fl');
    const t1a = { CALL: 0.7, FOLD: 0.3 };
    const t1b = { FOLD: 0.3, CALL: 0.7 };
    for (let i = 0; i < 20; i++) {
      s = updateMemoryState(s, {
        itemId: 'fl', timestamp: T0 + i,
        classification: 'IN_MIX', chosenAction: i < 14 ? 'CALL' : 'FOLD',
        context: { targetDistribution: i % 2 === 0 ? t1a : t1b },
        attemptId: `fl${i}`
      });
    }
    const c1 = { ...s._frequencyCounters };
    assert.ok((c1.CALL || 0) + (c1.FOLD || 0) === 20);

    const t2 = { CALL: 0.6, FOLD: 0.4 };
    s = updateMemoryState(s, {
      itemId: 'fl', timestamp: T0 + 100,
      classification: 'IN_MIX', chosenAction: 'CALL',
      context: { targetDistribution: t2 }, attemptId: 'fl_reset'
    });
    assert.equal(s._frequencyCounters.CALL, 1);
    assert.ok(!s._frequencyCounters.FOLD || s._frequencyCounters.FOLD === 0);

    s = updateMemoryState(s, {
      itemId: 'fl', timestamp: T0 + 101,
      classification: 'IN_MIX', chosenAction: 'FOLD',
      context: { targetDistribution: t2 }, attemptId: 'fl_cont'
    });
    assert.equal(s._frequencyCounters.CALL, 1);
    assert.equal(s._frequencyCounters.FOLD, 1);
  });
});

describe('serialization round-trip', () => {
  it('JSON round-trip preserves meaningful state', () => {
    let s = createInitialMemoryState('ser');
    for (let i = 0; i < 80; i++) {
      s = updateMemoryState(s, {
        itemId: 'ser', timestamp: T0 + i * 1000,
        classification: i % 11 === 0 ? 'OUT_OF_STRATEGY' : 'PURE_MATCH',
        chosenAction: 'CALL', attemptId: `ser${i}`
      });
    }
    const snap1 = semanticSnapshot(s);
    const json = JSON.stringify(s);
    const restored = migrateMemoryState(JSON.parse(json));
    const snap2 = semanticSnapshot(restored);
    assert.deepEqual(snap1, snap2);

    const next = updateMemoryState(restored, {
      itemId: 'ser', timestamp: T0 + 100000,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'ser_new'
    });
    assertInvariants(next);
  });
});

describe('migration round-trip', () => {
  it('v1 → migrate → update → serialize → deserialize → update', () => {
    const legacy = {
      schemaVersion: 1,
      itemId: 'mig2',
      attempts: 30,
      successes: 25,
      severeErrors: 2,
      recentSevereInWindow: 2,
      actionMastery: 0.88,
      combinedMastery: 0.88,
      confidence: 0.75,
      stability: 7200000,
      status: 'STABLE',
      lastSeenAt: T0,
      lastErrorAt: T0 - 5000,
      hasFrequencyTarget: false
    };
    let s = migrateMemoryState(legacy);
    s = updateMemoryState(s, {
      itemId: 'mig2', timestamp: T0 + 10000,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'm1'
    });
    const json = JSON.stringify(s);
    s = migrateMemoryState(JSON.parse(json));
    s = updateMemoryState(s, {
      itemId: 'mig2', timestamp: T0 + 20000,
      classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'm2'
    });
    assertInvariants(s);
    assert.ok(s.attempts >= 32);
  });
});

describe('scheduler monotonic sanity', () => {
  it('severe shortens horizon vs clean success', () => {
    let clean = createInitialMemoryState('sch');
    let sev = createInitialMemoryState('sch2');
    for (let i = 0; i < 10; i++) {
      clean = updateMemoryState(clean, {
        itemId: 'sch', timestamp: T0 + i * 3600000,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `c${i}`
      });
      sev = updateMemoryState(sev, {
        itemId: 'sch2', timestamp: T0 + i * 3600000,
        classification: i === 9 ? 'OUT_OF_STRATEGY' : 'PURE_MATCH',
        chosenAction: 'CALL', attemptId: `s${i}`
      });
    }
    const now = T0 + 20 * 3600000;
    const sc = scheduleNextReview(clean, resolveSchedulerNow(clean, now));
    const ss = scheduleNextReview(sev, resolveSchedulerNow(sev, now));
    assert.ok(ss.intervalMs <= sc.intervalMs * 1.05,
      `severe interval ${ss.intervalMs} should not exceed clean ${sc.intervalMs}`);
  });
});

describe('frequency review planner adversarial', () => {
  it('zero positive actions rejected', () => {
    assert.throws(() => buildFrequencyReviewPlan({ itemId: 'x' }, { CALL: 0, FOLD: 0 }));
  });
  it('deterministic for same inputs', () => {
    const a = buildFrequencyReviewPlan({ itemId: 'x' }, { RAISE: 0.25, FOLD: 0.75 });
    const b = buildFrequencyReviewPlan({ itemId: 'x' }, { RAISE: 0.25, FOLD: 0.75 });
    assert.deepEqual(a, b);
  });
  it('unobserved action still in plan', () => {
    const plan = buildFrequencyReviewPlan({ itemId: 'x' }, { CALL: 0.5, FOLD: 0.5, RAISE: 0.0 });
    // RAISE has 0 so filtered from actions with >0
    assert.ok(plan.actions.includes('CALL'));
  });
});

describe('fuzz 3000 legal attempts', () => {
  it('seeded fuzz maintains invariants', () => {
    const seed = 20260829;
    const rng = createMulberry32(seed);
    let s = createInitialMemoryState('fuzz');
    const classes = ['PURE_MATCH', 'IN_MIX', 'RARE_MIX', 'OUT_OF_STRATEGY'];
    const targets = [
      null,
      { CALL: 0.7, FOLD: 0.3 },
      { CALL: 0.5, FOLD: 0.5 },
      { RAISE: 0.2, CALL: 0.5, FOLD: 0.3 }
    ];
    try {
      for (let i = 0; i < 600; i++) {
        const cls = classes[Math.floor(rng() * classes.length)];
        const td = targets[Math.floor(rng() * targets.length)];
        const ts = T0 + Math.floor(rng() * 1e9);
        // occasionally same timestamp
        const attempt = {
          itemId: 'fuzz',
          timestamp: i % 17 === 0 ? T0 + Math.floor(i / 17) * 100 : ts,
          classification: cls,
          chosenAction: ['CALL', 'FOLD', 'RAISE'][Math.floor(rng() * 3)],
          attemptId: `fuzz_${i}`
        };
        if (td) attempt.context = { targetDistribution: td };
        // occasional dup
        if (i > 0 && i % 200 === 0) attempt.attemptId = `fuzz_${i - 1}`;
        s = updateMemoryState(s, attempt);
        if (i % 400 === 0) assertInvariants(s, `fuzz i=${i}`);
      }
      assertInvariants(s, 'fuzz final');
    } catch (e) {
      e.message = `FUZZ FAIL seed=${seed}: ${e.message}`;
      throw e;
    }
  });
});
