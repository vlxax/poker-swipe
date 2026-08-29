/**
 * Integration tests: production PokerSwipe ranges → Strategy Map + Mistake Memory.
 * Uses real range objects from data/ranges/reference/6max and trainer UO records.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { getReferenceRanges, lookupReferencePolicy } from '../ranges-ui/referenceRanges.js';
import { StrategyMapEngine } from '../strategy-map/index.js';
import { processAttempts, MemoryStore } from '../mistake-memory/memoryStore.js';
import { createInitialMemoryState, isMastered } from '../mistake-memory/memoryState.js';

import {
  ACTION_MAPPING_TABLE,
  mapProductionAction,
  mapProductionDistribution,
  adaptReferenceRange,
  adaptTrainerRange,
  adaptReferenceLibrary,
  MISSING_HAND_SEMANTICS,
  canonicalItemId,
  classifyChosenAction,
  targetDistributionForMemory,
  attemptFromReferencePolicy,
  attemptFromBattleshipTap,
  STRATEGY_VERSION_POLICY,
  PersistentLearnerMemory,
  createMemoryStorage,
  storageKeyForUser,
  resolveLearnerUserId,
  finalReviewPriority,
  strategyMapSignalsForHand,
  loadProductionLibraryInto,
  resetProductionStrategyMap,
  getProductionStrategyMap
} from '../range-learning/index.js';
import { BattleshipController } from '../ranges-ui/battleship/controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REF_DIR = join(ROOT, 'data/ranges/reference/6max/ranges');
const NOW = 1_700_000_000_000;

function loadCanonicalRange(id) {
  return JSON.parse(readFileSync(join(REF_DIR, `${id}.json`), 'utf8'));
}

function groupUoByChart() {
  const records = JSON.parse(
    readFileSync(join(ROOT, 'data/trainer/built/uo-hand-records.json'), 'utf8')
  );
  const by = new Map();
  for (const r of records) {
    if (!by.has(r.chartId)) by.set(r.chartId, []);
    by.get(r.chartId).push(r);
  }
  return by;
}

const perf = {};

describe('range-learning production integration', () => {
  let btnRfi;
  let coVs3betSb;
  let utgRfi;
  let uoByChart;

  before(() => {
    btnRfi = loadCanonicalRange('btn-rfi');
    coVs3betSb = loadCanonicalRange('co-vs-3bet-sb');
    utgRfi = loadCanonicalRange('utg-rfi');
    uoByChart = groupUoByChart();
  });

  it('1. real production range converts correctly', () => {
    const t0 = performance.now();
    const result = adaptReferenceRange(btnRfi);
    perf.adaptOneRangeMs = performance.now() - t0;
    assert.equal(result.ok, true);
    assert.equal(result.range.id, 'btn-rfi');
    assert.ok(result.range.hands.AA.actions.RAISE === 1);
    assert.equal(result.range.metadata.heroPosition, 'BTN');
    assert.equal(result.range.metadata.situation, 'rfi');
    assert.equal(result.range.metadata.source, 'reference');
  });

  it('2. real action names map correctly', () => {
    const rows = Object.fromEntries(ACTION_MAPPING_TABLE.map((r) => [r.production, r]));
    assert.equal(mapProductionAction('FOLD').canonical, 'FOLD');
    assert.equal(mapProductionAction('CALL').canonical, 'CALL');
    assert.equal(mapProductionAction('RAISE').canonical, 'RAISE');
    assert.equal(mapProductionAction('AI').canonical, 'AI');
    assert.equal(mapProductionAction('UNSELECTED').canonical, 'FOLD');
    assert.equal(rows.FOLD.status, 'SAFE');
    assert.equal(rows.RAISE.status, 'SAFE');
    assert.equal(rows.AI.status, 'SAFE');
    assert.equal(rows.nAI.status, 'UNSUPPORTED');
    assert.equal(rows.UO.status, 'UNSUPPORTED');
    assert.equal(mapProductionAction('3BET').status, 'SAFE');
    assert.equal(mapProductionAction('3BET').canonical, '3BET');
  });

  it('3. real frequency representation maps correctly', () => {
    const mixed = coVs3betSb.range.A8s;
    assert.equal(mixed.FOLD, 0.5);
    assert.equal(mixed.RAISE, 0.5);
    const mapped = mapProductionDistribution(mixed);
    assert.equal(mapped.ok, true);
    assert.equal(mapped.distribution.FOLD, 0.5);
    assert.equal(mapped.distribution.RAISE, 0.5);
  });

  it('4. missing-hand semantics: reference absent = 100% fold', () => {
    assert.equal(MISSING_HAND_SEMANTICS.reference.meaning, 'FOLD_100');
    const policy = lookupReferencePolicy(
      { position: 'BTN', situation: 'rfi' },
      '72o'
    );
    assert.deepEqual(policy, { FOLD: 1, CALL: 0, RAISE: 0 });
    const adapted = adaptReferenceRange(btnRfi);
    assert.ok(adapted.range.hands['72o']);
    assert.equal(adapted.range.hands['72o'].actions.FOLD, 1);
    assert.equal(MISSING_HAND_SEMANTICS.trainer.meaning, 'UNSUPPORTED');
    assert.equal(MISSING_HAND_SEMANTICS.atlas.meaning, 'UNSUPPORTED');
  });

  it('5. malformed production range fails safely', () => {
    const noId = adaptReferenceRange({ range: { AA: { FOLD: 1, CALL: 0, RAISE: 0 } } });
    assert.equal(noId.ok, false);
    const badSum = adaptReferenceRange({
      id: 'bad',
      heroPosition: 'BTN',
      situation: 'rfi',
      range: { AA: { FOLD: 2, CALL: 0, RAISE: 0 } }
    });
    assert.equal(badSum.ok, false);
    const negative = mapProductionDistribution({ FOLD: -1, CALL: 1, RAISE: 1 });
    assert.equal(negative.ok, false);
  });

  it('6. identical real ranges ≈ identical', () => {
    const a = adaptReferenceRange(btnRfi).range;
    const b = adaptReferenceRange(loadCanonicalRange('btn-rfi')).range;
    const engine = new StrategyMapEngine();
    const sim = engine.similarity(a, b);
    assert.ok(sim.similarity >= 0.999, `expected ~1, got ${sim.similarity}`);
  });

  it('7. stack transition between real trainer ranges detected', () => {
    const shortId = 'UO_2-4_EP';
    const deepId = [...uoByChart.keys()].find((id) => id.startsWith('UO_18-25_EP') || id.startsWith('UO_25-40_EP'))
      || [...uoByChart.keys()].find((id) => id.includes('EP') && id !== shortId);
    assert.ok(uoByChart.has(shortId), 'missing UO_2-4_EP');
    assert.ok(deepId, 'missing deeper EP UO chart');
    const a = adaptTrainerRange({
      id: shortId,
      sourceMode: 'uo',
      stack: { raw: '2-4' },
      heroPosition: { raw: 'EP' },
      handRecords: uoByChart.get(shortId)
    });
    const b = adaptTrainerRange({
      id: deepId,
      sourceMode: 'uo',
      stack: { raw: uoByChart.get(deepId)[0].stackBand },
      heroPosition: { raw: 'EP' },
      handRecords: uoByChart.get(deepId)
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    const engine = new StrategyMapEngine();
    const tr = engine.transitions([a.range, b.range]);
    assert.ok(tr.transitions.length >= 1);
    assert.ok(typeof tr.transitions[0].transitionMagnitude === 'number');
  });

  it('8. mixed hand boundary detected on real range', async () => {
    const adapted = adaptReferenceRange(coVs3betSb).range;
    const { findBoundaryHands } = await import('../strategy-map/boundaries.js');
    const found = findBoundaryHands(adapted);
    const mixedIds = found.mixedHands.map((h) => h.hand);
    assert.ok(mixedIds.includes('A8s'), `A8s should be mixed, got ${mixedIds.slice(0, 8)}`);
  });

  it('9. nearest ranges make semantic sense', () => {
    const lib = adaptReferenceLibrary(getReferenceRanges()).adapted;
    const engine = new StrategyMapEngine();
    engine.loadLibrary(lib);
    const target = lib.find((r) => r.id === 'btn-rfi');
    const neighbors = engine.neighbors(target, { maxResults: 8, minSimilarity: 0.2 });
    assert.ok(neighbors.length >= 1);
    const ids = neighbors.map((n) => n.rangeId || n.range?.id);
    const situ = neighbors.map((n) => n.range?.metadata?.situation);
    assert.ok(
      situ.some((s) => s === 'rfi') || ids.some((id) => String(id).includes('rfi')),
      `expected an RFI neighbor, got ${ids}`
    );
  });

  it('10. index reload does not duplicate IDs', () => {
    const lib = adaptReferenceLibrary(getReferenceRanges()).adapted;
    const engine = new StrategyMapEngine();
    engine.loadLibrary(lib);
    const first = engine.getStats();
    engine.loadLibrary(lib);
    const second = engine.getStats();
    assert.equal(second.totalRanges, first.totalRanges);
    assert.equal(second.totalRanges, lib.length);
    const family = engine.index.getByMetadata('situation', 'rfi');
    const unique = new Set(family);
    assert.equal(family.length, unique.size);

    const replaced = { ...lib[0], metadata: { ...lib[0].metadata, family: 'replaced-family', category: 'replaced-family' } };
    engine.replaceRange(replaced);
    assert.equal(engine.getStats().totalRanges, lib.length);
    const oldFamily = engine.index.findFamily(lib[0].id);
    engine.clear();
    engine.loadLibrary(lib);
    assert.equal(engine.getStats().totalRanges, lib.length);
  });

  it('11. real correct pure action', () => {
    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'AA',
      policy: btnRfi.range.AA,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    assert.equal(built.attempt.classification, 'PURE_MATCH');
    const store = new MemoryStore();
    const r = processAttempts(store, [built.attempt], { now: NOW });
    assert.equal(r.applied, 1);
    assert.ok(store.get(built.attempt.itemId).actionMastery > 0.5);
  });

  it('12. real valid mixed action', () => {
    const built = attemptFromReferencePolicy({
      rangeId: 'co-vs-3bet-sb',
      hand: 'A8s',
      policy: coVs3betSb.range.A8s,
      chosenAction: 'CALL',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    // A8s is FOLD 0.5 / RAISE 0.5 — CALL is out. Use FOLD as the mixed legal non-primary? both 0.5.
    const fold = attemptFromReferencePolicy({
      rangeId: 'co-vs-3bet-sb',
      hand: 'A8s',
      policy: coVs3betSb.range.A8s,
      chosenAction: 'FOLD',
      timestamp: NOW,
      producer: 'test',
      sequence: 2
    });
    const raise = attemptFromReferencePolicy({
      rangeId: 'co-vs-3bet-sb',
      hand: 'A8s',
      policy: coVs3betSb.range.A8s,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 3
    });
    assert.ok(['IN_MIX', 'PURE_MATCH'].includes(fold.attempt.classification));
    assert.ok(['IN_MIX', 'PURE_MATCH'].includes(raise.attempt.classification));
    assert.notEqual(fold.attempt.classification, 'OUT_OF_STRATEGY');
    assert.equal(built.attempt.classification, 'OUT_OF_STRATEGY');
  });

  it('13. real rare mixed action', () => {
    const policy = { FOLD: 0.05, CALL: 0, RAISE: 0.95 };
    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'A9s',
      policy,
      chosenAction: 'FOLD',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    assert.equal(built.attempt.classification, 'RARE_MIX');
  });

  it('14. real strategy error', () => {
    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'AA',
      policy: btnRfi.range.AA,
      chosenAction: 'FOLD',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    assert.equal(built.attempt.classification, 'OUT_OF_STRATEGY');
  });

  it('15. Battleship mission-only miss does not become strategy error', () => {
    const model = {
      supported: true,
      chartId: 'UO_18-25_BTN',
      openSet: new Set(['AA', 'AKs', 'A5s'])
    };
    const mission = { id: 'suited-ax' };
    const built = attemptFromBattleshipTap({
      model,
      mission,
      hand: 'AA',
      timestamp: NOW,
      sequence: 1,
      isTarget: false,
      inRange: true
    });
    assert.equal(built.attempt.context.missionResult, 'MISSION_OFF_TARGET');
    assert.equal(built.attempt.context.strategyOk, true);
    assert.equal(built.attempt.classification, 'PURE_MATCH');
    assert.notEqual(built.attempt.classification, 'OUT_OF_STRATEGY');
  });

  it('16. duplicate attempt delivery ignored', () => {
    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'KK',
      policy: btnRfi.range.KK,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 99
    });
    const store = new MemoryStore();
    const first = processAttempts(store, [built.attempt], { now: NOW });
    const second = processAttempts(store, [built.attempt], { now: NOW + 1 });
    assert.equal(first.applied, 1);
    assert.equal(second.duplicates, 1);
    assert.equal(store.get(built.attempt.itemId).attempts, 1);
  });

  it('17. out-of-order attempt safe', () => {
    const a1 = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'QQ',
      policy: btnRfi.range.QQ,
      chosenAction: 'RAISE',
      timestamp: NOW + 5000,
      producer: 'test',
      sequence: 'later'
    }).attempt;
    const a2 = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'QQ',
      policy: btnRfi.range.QQ,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 'earlier'
    }).attempt;
    const store = new MemoryStore();
    processAttempts(store, [a1], { now: NOW + 5000 });
    const r = processAttempts(store, [a2], { now: NOW + 6000 });
    assert.ok(r.applied + r.rejected + r.duplicates >= 1);
    const state = store.get(a1.itemId);
    assert.ok(state.attempts >= 1);
  });

  it('18. restart persistence works', () => {
    const storage = createMemoryStorage();
    storage.setItem('pokerSwipeDeviceId', 'dev-a');
    const mem = new PersistentLearnerMemory({ storage, now: () => NOW });
    mem.load();
    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'JJ',
      policy: btnRfi.range.JJ,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    mem.recordAttempts([built.attempt], { now: NOW });
    const itemId = built.attempt.itemId;
    const after = mem.get(itemId);
    assert.ok(after);

    const mem2 = new PersistentLearnerMemory({ storage, now: () => NOW + 10 });
    mem2.load();
    const loaded = mem2.get(itemId);
    assert.ok(loaded);
    assert.equal(loaded.attempts, after.attempts);
  });

  it('19. logout/login isolation works', () => {
    const storage = createMemoryStorage();
    storage.setItem('pokerswipe_auth_session', JSON.stringify({ user: { id: 'user-a' } }));
    const memA = new PersistentLearnerMemory({ storage, now: () => NOW });
    memA.load();
    assert.equal(memA.userId, 'auth:user-a');
    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'TT',
      policy: btnRfi.range.TT,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    memA.recordAttempts([built.attempt], { now: NOW });
    const itemId = built.attempt.itemId;
    assert.ok(memA.get(itemId));

    storage.setItem('pokerswipe_auth_session', JSON.stringify({ user: { id: 'user-b' } }));
    memA.switchUserIfNeeded();
    assert.equal(memA.userId, 'auth:user-b');
    assert.equal(memA.get(itemId), null);

    storage.setItem('pokerswipe_auth_session', JSON.stringify({ user: { id: 'user-a' } }));
    memA.switchUserIfNeeded();
    assert.ok(memA.get(itemId));
    assert.ok(storage.getItem(storageKeyForUser('auth:user-a')));
    assert.ok(storage.getItem(storageKeyForUser('auth:user-b')));
  });

  it('20. weak learner item gets increased review priority', () => {
    const weak = createInitialMemoryState('weak-item');
    weak.combinedMastery = 0.2;
    weak.actionMastery = 0.2;
    weak.status = 'WEAK';
    weak.confidence = 0.4;
    weak.attempts = 8;
    weak.lastSeenAt = NOW - 3 * 60 * 60 * 1000;
    weak.dueAt = NOW - 60 * 60 * 1000;

    const strong = createInitialMemoryState('strong-item');
    strong.combinedMastery = 0.95;
    strong.actionMastery = 0.95;
    strong.status = 'MASTERED';
    strong.confidence = 0.9;
    strong.attempts = 20;
    strong.lastSeenAt = NOW - 1000;
    strong.forgettingRisk = 0.05;
    strong.dueAt = NOW + 86400000;

    const w = finalReviewPriority({ memoryState: weak, now: NOW });
    const s = finalReviewPriority({ memoryState: strong, now: NOW });
    assert.ok(w.score > s.score, `weak ${w.score} vs strong ${s.score}`);
  });

  it('21. mastered item is not spammed because Strategy Map calls it difficult', () => {
    const mastered = createInitialMemoryState('mastered-hard');
    mastered.combinedMastery = 0.96;
    mastered.actionMastery = 0.96;
    mastered.status = 'MASTERED';
    mastered.confidence = 0.95;
    mastered.attempts = 30;
    mastered.forgettingRisk = 0.08;
    mastered.lastSeenAt = NOW - 2000;
    mastered.dueAt = NOW + 86400000;

    const base = finalReviewPriority({ memoryState: mastered, now: NOW, strategyMapSignals: null });
    const boosted = finalReviewPriority({
      memoryState: mastered,
      now: NOW,
      strategyMapSignals: { structuralDifficulty: 1, volatileEdge: 1, boundaryHand: true, transitionMagnitude: 1 }
    });
    assert.equal(boosted.strategyMapBoost, 0);
    assert.ok(Math.abs(boosted.score - base.score) < 1e-9);
  });

  it('22. boundary + learner weakness increases relevance', () => {
    const weak = createInitialMemoryState('weak-boundary');
    weak.combinedMastery = 0.35;
    weak.actionMastery = 0.35;
    weak.status = 'WEAK';
    weak.confidence = 0.5;
    weak.attempts = 6;
    weak.lastSeenAt = NOW - 60 * 60 * 1000;
    weak.dueAt = NOW - 1000;

    const plain = finalReviewPriority({ memoryState: weak, now: NOW });
    const boundary = finalReviewPriority({
      memoryState: weak,
      now: NOW,
      strategyMapSignals: { boundaryHand: true, structuralDifficulty: 0.6 }
    });
    assert.ok(boundary.score > plain.score);
    assert.ok(boundary.strategyMapBoost > 0);
  });

  it('23. frequency target comes from actual range distribution', () => {
    const built = attemptFromReferencePolicy({
      rangeId: 'co-vs-3bet-sb',
      hand: 'A8s',
      policy: coVs3betSb.range.A8s,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    assert.deepEqual(built.attempt.targetDistribution, { FOLD: 0.5, RAISE: 0.5 });
    assert.equal(built.attempt.context.hasFrequencyTarget, true);
    assert.notDeepEqual(built.attempt.targetDistribution, { RAISE: 0.5, CALL: 0.5 });
  });

  it('24. no target means frequency learning is N/A', () => {
    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'AA',
      policy: btnRfi.range.AA,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    });
    assert.equal(built.attempt.targetDistribution, undefined);
    assert.equal(built.attempt.context.hasFrequencyTarget, false);
    const td = targetDistributionForMemory({ RAISE: 1 });
    assert.equal(td, null);
    const store = new MemoryStore();
    processAttempts(store, [built.attempt], { now: NOW });
    const state = store.get(built.attempt.itemId);
    assert.equal(state.hasFrequencyTarget, false);
  });

  it('25. strategy version change follows documented migration policy', () => {
    assert.ok(STRATEGY_VERSION_POLICY.id);
    const oldPolicy = { FOLD: 0.3, CALL: 0, RAISE: 0.7 };
    const newPolicy = { FOLD: 0.6, CALL: 0, RAISE: 0.4 };
    const oldAttempt = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'A5s',
      policy: oldPolicy,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 1
    }).attempt;
    const newAttempt = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'A5s',
      policy: newPolicy,
      chosenAction: 'RAISE',
      timestamp: NOW + 1,
      producer: 'test',
      sequence: 2
    }).attempt;
    assert.notEqual(oldAttempt.itemId, newAttempt.itemId);
    const store = new MemoryStore();
    processAttempts(store, [oldAttempt], { now: NOW });
    processAttempts(store, [newAttempt], { now: NOW + 1 });
    assert.equal(store.get(oldAttempt.itemId).attempts, 1);
    assert.equal(store.get(newAttempt.itemId).attempts, 1);
    assert.deepEqual(store.get(oldAttempt.itemId)._targetDistribution, { FOLD: 0.3, RAISE: 0.7 });
  });

  it('performance: strategy map builds on library load, not per click', () => {
    resetProductionStrategyMap();
    const t0 = performance.now();
    const cache = getProductionStrategyMap({ force: true, library: 'reference' });
    perf.strategyMapBuildMs = performance.now() - t0;
    assert.ok(cache.adapted.length >= 37);

    const t1 = performance.now();
    const again = getProductionStrategyMap({ library: 'reference' });
    perf.strategyMapCacheHitMs = performance.now() - t1;
    assert.equal(again.version, cache.version);
    assert.ok(perf.strategyMapCacheHitMs < perf.strategyMapBuildMs);

    const built = attemptFromReferencePolicy({
      rangeId: 'btn-rfi',
      hand: 'AA',
      policy: btnRfi.range.AA,
      chosenAction: 'RAISE',
      timestamp: NOW,
      producer: 'test',
      sequence: 'perf'
    });
    const store = new MemoryStore();
    const t2 = performance.now();
    processAttempts(store, [built.attempt], { now: NOW });
    perf.oneAttemptMs = performance.now() - t2;
    assert.ok(perf.oneAttemptMs < 50, `attempt too slow: ${perf.oneAttemptMs}`);
    console.log('PERF', JSON.stringify(perf, null, 2));
  });

  it('canonical item ids do not collide across spots/stacks', () => {
    const a = canonicalItemId({ source: 'trainer', rangeId: 'UO_18-25_BTN', hand: 'A5s', distribution: { RAISE: 1 } });
    const b = canonicalItemId({ source: 'trainer', rangeId: 'UO_25-40_BTN', hand: 'A5s', distribution: { RAISE: 1 } });
    const c = canonicalItemId({ source: 'reference', rangeId: 'bb-vs-open-btn', hand: 'A5s', distribution: { CALL: 1 } });
    const d = canonicalItemId({ source: 'reference', rangeId: 'btn-rfi', hand: 'A5s', distribution: { RAISE: 1 } });
    assert.notEqual(a, b);
    assert.notEqual(c, d);
    assert.notEqual(a, d);
  });

  it('loadProductionLibraryInto reload is idempotent', () => {
    const engine = new StrategyMapEngine();
    const first = loadProductionLibraryInto(engine, getReferenceRanges());
    const second = loadProductionLibraryInto(engine, getReferenceRanges());
    assert.equal(engine.getStats().totalRanges, first.adapted.length);
    assert.equal(engine.getStats().totalRanges, second.adapted.length);
    assert.equal(first.adapted.length, 37);
    const rfi = engine.index.getByMetadata('situation', 'rfi');
    assert.equal(rfi.length, new Set(rfi).size);
  });

  it('BattleshipController.handleCellTap records one strategy attempt', () => {
    const storage = createMemoryStorage();
    const mem = new PersistentLearnerMemory({ storage, now: () => NOW });
    mem.load();
    const ctl = new BattleshipController({ storage, learnerMemory: mem });
    ctl.model = {
      supported: true,
      chartId: 'UO_18-25_BTN',
      openSet: new Set(['AA', 'AKs']),
      blockedHands: new Set()
    };
    ctl.course = { courseId: 'uo-18-25-btn', chartId: 'UO_18-25_BTN' };
    ctl.missions = [{
      id: 'pocket-pairs',
      type: 'MATRIX_HUNT',
      getTargetHands: () => ['AA']
    }];
    ctl.state.status = 'playing';
    ctl.state.showMissionIntro = false;
    ctl.state.missionIndex = 0;
    ctl.state.targetTotal = 1;
    ctl.handleCellTap('AKs');
    const ak = mem.allStates().find((s) => s.itemId.includes('AKs'));
    assert.ok(ak, 'mission-off-target tap must still record strategy memory');
    assert.equal(ak.attempts, 1);

    ctl.handleCellTap('AA');
    assert.ok(mem.allStates().length >= 2);
    const hit = attemptFromBattleshipTap({
      model: ctl.model,
      mission: ctl.missions[0],
      hand: 'AKs',
      timestamp: NOW,
      sequence: 9,
      isTarget: false,
      inRange: true
    });
    assert.equal(hit.attempt.context.missionResult, 'MISSION_OFF_TARGET');
    assert.equal(hit.attempt.classification, 'PURE_MATCH');
  });
});
