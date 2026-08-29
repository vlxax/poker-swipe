/**
 * Strategy Map engine assertion suite — required before main merge.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StrategyMapEngine, buildRangeFingerprint, fingerprintIsFinite, createTransitionLesson, analyzeVolatility, findDuplicateStrategies } from '../strategy-map/index.js';
import { createRange, createHandActions } from '../strategy-map/tests/helpers.js';
import { MATCH_STATUS } from '../trainer-knowledge/status.js';
import {
  lookupTrainerSpot,
  getChartById,
  resetTrainerCache,
  canonicalRangeId,
  migratePersistedRangeIds,
  loadB2AliasTable,
  listCharts
} from '../trainer-knowledge/index.js';
import {
  adaptTrainerChartById,
  getTrainerStrategyMap,
  getReferenceStrategyMap,
  resetProductionStrategyMap,
  neighborsForRange,
  readStructuralCache,
  cacheMatchesVersion,
  CACHE_SCHEMA,
  attemptFromTrainerCell,
  attemptFromBattleshipTap,
  recordCanonicalAttempts,
  PersistentLearnerMemory,
  createMemoryStorage,
  finalReviewPriority,
  strategyMapSignalsForHand,
  signalsForItem
} from '../range-learning/index.js';
import { resetLearnerMemorySingleton } from '../range-learning/persistence.js';

function pure(id, action, extraHands = {}) {
  return createRange(id, { AA: createHandActions({ [action]: 1 }), ...extraHands }, { family: 't', source: 'trainer', heroPosition: 'BTN' });
}

describe('Strategy Map engine', () => {
  it('1. empty range produces finite values', () => {
    const fp = buildRangeFingerprint({ id: 'empty', hands: {}, metadata: { family: 'x' } });
    assert.equal(fp.numHands, 0);
    assert.ok(fingerprintIsFinite(fp));
    assert.equal(fp.averageEntropy, 0);
    assert.equal(fp.boundaryDensity, 0);
    for (const v of Object.values(fp.actionMass)) assert.ok(Number.isFinite(v));
  });

  it('2. zero-valued action keys are not active actions', () => {
    const fp = buildRangeFingerprint(createRange('z', {
      AA: createHandActions({ CALL: 1, FOLD: 0 })
    }));
    assert.equal(fp.handData.AA.activeActions, 1);
    assert.equal(fp.numPureHands, 1);
    assert.equal(fp.numMixedHands, 0);
  });

  it('3. identical ranges similarity', () => {
    const engine = new StrategyMapEngine();
    const a = pure('a', 'RAISE');
    const b = pure('b', 'RAISE');
    engine.loadLibrary([a, b]);
    const sim = engine.similarity(a, b);
    assert.ok(sim.similarity > 0.99);
  });

  it('4. maximally different pure ranges', () => {
    const engine = new StrategyMapEngine();
    const a = pure('a', 'FOLD');
    const b = pure('b', 'RAISE');
    const sim = engine.similarity(a, b);
    assert.ok(sim.similarity < 0.5, `expected low similarity, got ${sim.similarity}`);
  });

  it('5. mixed distributions', () => {
    const mixed = createRange('m', { AA: createHandActions({ RAISE: 0.6, FOLD: 0.4 }) });
    const fp = buildRangeFingerprint(mixed);
    assert.equal(fp.numMixedHands, 1);
    assert.ok(fp.mixedPercentage > 0);
    assert.ok(fp.averageEntropy > 0);
  });

  it('6. missing-hand semantics stay source-specific', async () => {
    const { MISSING_HAND_SEMANTICS } = await import('../range-learning/rangeAdapter.js');
    assert.equal(MISSING_HAND_SEMANTICS.reference.meaning, 'FOLD_100');
    assert.equal(MISSING_HAND_SEMANTICS.trainer.meaning, 'UNSUPPORTED');
  });

  it('7. index re-add same ID does not duplicate', () => {
    const engine = new StrategyMapEngine();
    const a = createRange('same', { AA: createHandActions({ FOLD: 1 }) }, { family: 'f1', category: 'f1', heroPosition: 'BTN', stack: 20 });
    const b = createRange('same', { AA: createHandActions({ RAISE: 1 }) }, { family: 'f2', category: 'f2', heroPosition: 'CO', stack: 40 });
    engine.loadLibrary([a]);
    engine.index.add(b);
    assert.equal(engine.getStats().totalRanges, 1);
    assert.deepEqual(engine.index.findFamily('same'), ['same']);
    assert.equal(engine.index.getByPosition('BTN').includes('same'), false);
    assert.equal(engine.index.getByPosition('CO').includes('same'), true);
    assert.equal(engine.index.familyIndex.get('f1'), undefined);
  });

  it('8. index update metadata replaces stale indexes', () => {
    const engine = new StrategyMapEngine();
    engine.index.add(createRange('r', { AA: createHandActions({ FOLD: 1 }) }, { family: 'old', category: 'old', stack: 10, heroPosition: 'EP' }));
    engine.index.replace(createRange('r', { AA: createHandActions({ FOLD: 1 }) }, { family: 'new', category: 'new', stack: 20, heroPosition: 'BTN' }));
    assert.equal(engine.index.getByStack(10).includes('r'), false);
    assert.equal(engine.index.getByStack(20).includes('r'), true);
    assert.ok(!engine.index.familyIndex.get('old')?.includes('r'));
    assert.ok(engine.index.familyIndex.get('new')?.includes('r'));
  });

  it('9. no stale metadata indexes after remove', () => {
    const engine = new StrategyMapEngine();
    engine.index.add(createRange('r', { AA: createHandActions({ FOLD: 1 }) }, { family: 'f', category: 'f', stack: 5, heroPosition: 'SB' }));
    engine.index.remove('r');
    assert.equal(engine.getStats().totalRanges, 0);
    assert.equal(engine.index.getByStack(5).length, 0);
  });

  it('10. duplicate clustering does not lose ranges with exact+near', () => {
    const exactA = createRange('A', { AA: createHandActions({ RAISE: 1 }) });
    const exactB = createRange('B', { AA: createHandActions({ RAISE: 1 }) });
    const nearC = createRange('C', { AA: createHandActions({ RAISE: 0.96, FOLD: 0.04 }) });
    const result = findDuplicateStrategies([exactA, exactB, nearC], { exactThreshold: 0.999, nearThreshold: 0.9 });
    const reported = new Set();
    for (const g of result.exactDuplicates) {
      reported.add(g.primary.id);
      for (const d of g.duplicates) reported.add(d.id);
    }
    for (const g of result.nearDuplicates) {
      reported.add(g.primary.id);
      for (const d of g.duplicates) reported.add(d.id);
    }
    assert.ok(reported.has('A'));
    assert.ok(reported.has('B'));
    assert.ok(reported.has('C'), 'near-duplicate C must remain visible when A also has an exact twin');
  });

  it('11. change percentage denominator has no +1 distortion', () => {
    const a = createRange('a', { AA: createHandActions({ FOLD: 1 }), KK: createHandActions({ FOLD: 1 }) });
    const b = createRange('b', { AA: createHandActions({ RAISE: 1 }), KK: createHandActions({ FOLD: 1 }) });
    const lesson = createTransitionLesson(a, b);
    assert.equal(lesson.lessonMetrics.totalHands, 2);
    assert.equal(lesson.lessonMetrics.changePercentage, 50);
  });

  it('12. volatility: consistent large change is not stable', () => {
    const r1 = createRange('s10', { AKs: createHandActions({ FOLD: 1 }) }, { stack: 10 });
    const r2 = createRange('s20', { AKs: createHandActions({ RAISE: 1 }) }, { stack: 20 });
    const r3 = createRange('s30', { AKs: createHandActions({ FOLD: 1 }) }, { stack: 30 });
    const r4 = createRange('s40', { AKs: createHandActions({ RAISE: 1 }) }, { stack: 40 });
    const vol = analyzeVolatility([r1, r2, r3, r4], { volatilityThreshold: 0.3, minRanges: 3 });
    assert.ok(vol.volatileEdge.includes('AKs'), 'oscillating hand must be volatile even if variance of step sizes is modest');
  });

  it('13. deterministic curriculum RNG', () => {
    const library = [
      createRange('a', { AA: createHandActions({ FOLD: 1 }) }, { family: 'f', category: 'f', stack: 10, heroPosition: 'BTN' }),
      createRange('b', { AA: createHandActions({ RAISE: 0.9, FOLD: 0.1 }) }, { family: 'f', category: 'f', stack: 12, heroPosition: 'BTN' }),
      createRange('c', { AA: createHandActions({ RAISE: 0.8, FOLD: 0.2 }) }, { family: 'f', category: 'f', stack: 14, heroPosition: 'BTN' })
    ];
    const engine = new StrategyMapEngine();
    engine.loadLibrary(library);
    const rng = () => 0;
    const p1 = engine.personalPath({ startRange: library[0], maxSteps: 3, options: { rng } });
    const p2 = engine.personalPath({ startRange: library[0], maxSteps: 3, options: { rng } });
    assert.deepEqual(p1.path.map((s) => s.rangeId), p2.path.map((s) => s.rangeId));
  });
});

describe('Strategy Map production adapters', () => {
  it('14. full 1698 adapter smoke test', () => {
    resetTrainerCache();
    const charts = listCharts();
    assert.equal(charts.length, 1698);
    let ok = 0;
    let failed = 0;
    for (const c of charts) {
      const result = adaptTrainerChartById(c.id);
      if (result.ok) ok += 1;
      else failed += 1;
    }
    assert.equal(ok + failed, 1698);
    assert.ok(ok >= 1600, `too many adapter failures: ok=${ok} failed=${failed}`);
  });

  it('15. UO family isolation', () => {
    resetTrainerCache();
    const zip = lookupTrainerSpot({
      sourceMode: 'uo', heroPosition: 'EP', stack: '2-4', sourceGroup: 'UO'
    });
    const bl = lookupTrainerSpot({
      sourceMode: 'uo', heroPosition: 'EP', stack: '2-4', sourceGroup: 'uo'
    });
    const amb = lookupTrainerSpot({
      sourceMode: 'uo', heroPosition: 'EP', stack: '2-4'
    });
    assert.equal(zip.status, MATCH_STATUS.EXACT_TRAINER_MATCH);
    assert.ok(zip.chart.id.startsWith('UO_'));
    assert.ok(bl.chart.id.startsWith('BL_uo'));
    assert.notEqual(zip.chart.id, bl.chart.id);
    assert.equal(amb.status, MATCH_STATUS.AMBIGUOUS_UO_FAMILY);
    assert.equal(amb.chart, null);
  });

  it('16. legacy B2 alias compatibility', () => {
    const table = loadB2AliasTable();
    assert.ok(table.mappedCount >= 1578);
    assert.equal(table.unresolvedCount, 0);
    const canonical = canonicalRangeId('B2_0001');
    assert.equal(canonical, 'BL_vssqueeze-b1d6672fc2d1');
    assert.ok(getChartById('B2_0001'));
    assert.equal(getChartById('B2_0001').id, canonical);
    assert.equal(getChartById(canonical).id, canonical);
    const first = migratePersistedRangeIds({
      rangeMastery: { B2_0001: { overall: 1 } },
      courses: { B2_0001: { chartId: 'B2_0001', courseId: 'B2_0001' } },
      lastChartId: 'B2_0001',
      lastCourseId: 'B2_0001'
    });
    assert.ok(first.changed > 0);
    assert.ok(first.data.rangeMastery[canonical]);
    const second = migratePersistedRangeIds(first.data);
    assert.equal(second.changed, 0);
  });

  it('17-18. cache version invalidation and hydration', () => {
    resetProductionStrategyMap();
    const t0 = performance.now();
    const built = getTrainerStrategyMap({ force: true, persist: true });
    const buildMs = performance.now() - t0;
    assert.equal(built.sourceCount, 1698);
    assert.equal(built.hydrated, false);

    const disk = readStructuralCache();
    assert.ok(disk?.ok);
    assert.equal(disk.payload.schema, CACHE_SCHEMA);
    assert.ok(cacheMatchesVersion(disk.payload, built.version));

    resetProductionStrategyMap();
    const t1 = performance.now();
    const hydrated = getTrainerStrategyMap({ persist: false });
    const hydrateMs = performance.now() - t1;
    assert.equal(hydrated.hydrated, true);
    assert.equal(hydrated.sourceCount, 1698);
    assert.equal(hydrated.version, built.version);
    assert.ok(hydrateMs < buildMs, `hydrate ${hydrateMs} should beat build ${buildMs}`);

    const stale = { ...disk.payload, version: 'strategy-map-index-v1:1:stale:0:' };
    assert.equal(cacheMatchesVersion(stale, built.version), false);

    const ref = getReferenceStrategyMap({ force: true });
    assert.equal(ref.sourceCount, 37);
    assert.equal(ref.library, 'reference');

    const tN0 = performance.now();
    const neighbors = neighborsForRange('UO_2-4_EP', { maxResults: 5, minSimilarity: 0.1 });
    const neighborCold = performance.now() - tN0;
    const tN1 = performance.now();
    neighborsForRange('UO_2-4_EP', { maxResults: 5, minSimilarity: 0.1 });
    const neighborWarm = performance.now() - tN1;
    assert.ok(neighbors.length >= 0);
    assert.ok(neighborCold < 2000, `neighbor cold ${neighborCold}ms`);
    assert.ok(neighborWarm < 500, `neighbor warm ${neighborWarm}ms`);
    console.log(JSON.stringify({
      trainerBuildMs: buildMs,
      trainerHydrateMs: hydrateMs,
      neighborColdMs: neighborCold,
      neighborWarmMs: neighborWarm,
      referenceCount: ref.sourceCount
    }));
  });
});

describe('E2E real ranges → MM → SM', () => {
  it('Bekhtold, UO zip, BL UO, and B2 alias keep stable ids', () => {
    resetLearnerMemorySingleton();
    const mem = new PersistentLearnerMemory({ storage: createMemoryStorage(new Map()), userId: 'e2e' });
    const now = 1_700_000_000_000;
    const cases = [
      { id: 'BL_callpush-009789affc23', family: 'bekhtold' },
      { id: 'UO_2-4_EP', family: 'uo-zip' },
      { id: listCharts().find((c) => c.id.startsWith('BL_uo'))?.id, family: 'bl-uo' },
      { id: 'B2_0001', family: 'legacy-b2' }
    ];
    const ids = [];
    for (const c of cases) {
      assert.ok(c.id, c.family);
      const chart = getChartById(c.id);
      assert.ok(chart, c.family);
      const adapted = adaptTrainerChartById(c.id);
      assert.equal(adapted.ok, true, c.family + ' ' + adapted.error);
      assert.equal(adapted.range.id, chart.id);
      const hand = Object.keys(adapted.range.hands)[0];
      const cell = { actionRaw: Object.keys(adapted.range.hands[hand].actions)[0], gradingAllowed: true };
      const built = attemptFromTrainerCell({
        rangeId: adapted.range.id,
        hand,
        cell,
        chosenAction: cell.actionRaw,
        timestamp: now,
        producer: 'e2e',
        sequence: c.family
      });
      assert.equal(built.ok, true);
      assert.equal(built.attempt.context.rangeId, chart.id);
      recordCanonicalAttempts([built.attempt], { memory: mem, now });
      const sig = signalsForItem(chart.id, hand);
      const state = mem.get(built.attempt.itemId);
      const pri = finalReviewPriority({
        memoryState: state,
        now,
        strategyMapSignals: sig || strategyMapSignalsForHand(adapted.range, hand)
      });
      assert.ok(Number.isFinite(pri.score));
      ids.push({ family: c.family, input: c.id, canonical: chart.id, itemId: built.attempt.itemId });
    }
    const tap = attemptFromBattleshipTap({
      model: { chartId: 'UO_2-4_EP', supported: true },
      mission: { id: 'm1' },
      hand: 'AKo',
      timestamp: now + 1,
      sequence: 1,
      isTarget: false,
      inRange: true
    });
    assert.equal(tap.attempt.context.strategyOk, true);
    assert.equal(tap.attempt.context.missionResult, 'MISSION_OFF_TARGET');
    assert.equal(tap.attempt.classification, 'PURE_MATCH');
    console.log('E2E_IDS', JSON.stringify(ids));
  });
});
