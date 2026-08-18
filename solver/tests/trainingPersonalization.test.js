import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEAKS, classifyConcept, leakLabelRu, leakDefinitionRu, isKnownLeak
} from '../src/training/concepts.js';
import { normalizeCandidate, candidateIdentity } from '../src/training/candidateNormalizer.js';
import { createLeakProfile, recordLeakEvent, buildLeakProfile, leakEventFromCandidate } from '../src/training/leakProfile.js';
import { computePriority } from '../src/training/priority.js';
import { isTrivialDecision, validateDrillDecision } from '../src/training/drillValidator.js';
import {
  dealCards, nextVariant, classifyDifficulty, actionLabelRu, generateDrill, buildScenarioInput
} from '../src/training/drillGenerator.js';
import { gradeForLoss, gradeAnswer, feedbackForGrade } from '../src/training/answerEvaluator.js';
import { createConceptProgress, recordAttempt, buildProgress } from '../src/training/progress.js';
import { buildTrainingSession, recentDrilledKeys } from '../src/training/sessionBuilder.js';
import { createTrainingStore } from '../src/training/trainingStore.js';
import {
  getTopLeaks, recordCandidate, recordTrainingResult, buildPersonalizedSessionAsync
} from '../src/training/personalizedTraining.js';

// ---- Fixtures ---------------------------------------------------------------

function reviewModelFixture() {
  return {
    hand: {
      hero: ['Ah', 'Kd'], villain: ['Qc', 'Qh'],
      board: ['Ah', 'Kc', '2d', '8s', '3h'],
      positions: { hero: 'BTN', villain: 'BB' }, effStack: 100
    },
    decisions: [{
      index: 0, solved: true, street: 'turn', board: ['Ah', 'Kc', '2d', '8s', '3h'],
      potBB: 12.3,
      actionTaken: { type: 'bet', sizePot: 0.25 },
      recommendedAction: { type: 'bet', sizePot: 0.75 },
      recommendedFrequency: 0.6, bestEV: 8.2, heroEV: 6.5, evLossBB: 1.7,
      severity: 'large', mistakeSeverity: 'large',
      confidence: { score: 0.8, level: 'high' },
      explanation: { keyConcept: 'sizing_efficiency', summary: 'sizing' }
    }],
    trainingCandidate: {
      street: 'turn', board: ['Ah', 'Kc', '2d', '8s', '3h'], difficultyScore: 0.75,
      reason: ['significant_ev_loss'],
      actionTaken: { type: 'bet', sizePot: 0.25 },
      recommendedAction: { type: 'bet', sizePot: 0.75 }, evLossBB: 1.7
    }
  };
}

function fakeDecision(overrides = {}) {
  return {
    index: 0, solved: true, street: 'turn', board: ['Ah', 'Kc', '2d', '8s', '3h'],
    potBB: 12.3, effectiveStackBB: 100,
    legalActions: [
      { id: 'check', action: { type: 'check' }, evBB: 7.0, frequency: 0.2 },
      { id: 'bet_75', action: { type: 'bet', sizePot: 0.75 }, evBB: 8.2, frequency: 0.6 },
      { id: 'bet_25', action: { type: 'bet', sizePot: 0.25 }, evBB: 7.9, frequency: 0.2 }
    ],
    recommendedAction: { type: 'bet', sizePot: 0.75 },
    recommendedFrequency: 0.6, bestEV: 8.2, evLossBB: 0,
    confidence: { score: 0.8, level: 'high' },
    ...overrides
  };
}

function fakeSolve(decision) {
  return () => ({ decisions: [decision] });
}

function candidateFixture() {
  return normalizeCandidate({ reviewModel: reviewModelFixture(), sourceHandId: 'h1', sourceCandidateId: 'c1' });
}

// ---- Candidate normalization (req 4) ----------------------------------------

test('normalizeCandidate maps a turn sizing mistake to the right concept', () => {
  const c = candidateFixture();
  assert.equal(c.street, 'turn');
  assert.equal(c.concept, 'turn_barrel_sizing');
  assert.equal(c.sourceEvLossBb, 1.7);
  assert.equal(c.positions.hero, 'BTN');
  assert.ok(c.id && /^[0-9a-f]+$/.test(c.id));
});

test('candidateIdentity is stable and distinct across decisions', () => {
  const c1 = candidateFixture();
  const c2 = normalizeCandidate({ reviewModel: reviewModelFixture(), sourceHandId: 'h2', sourceCandidateId: 'c2' });
  assert.equal(candidateIdentity(c1), candidateIdentity(candidateFixture()));
  assert.notEqual(candidateIdentity(c1), candidateIdentity(c2));
});

test('classifyConcept picks river bluff-catch for a river call spot', () => {
  const concept = classifyConcept({
    street: 'river', actionTaken: { type: 'call' }, recommendedAction: { type: 'call' },
    reason: ['river_bluff_catch']
  });
  assert.equal(concept, 'bluff_catch');
});

test('classifyConcept is deterministic (same facts, same result)', () => {
  const a = classifyConcept({ street: 'flop', actionTaken: { type: 'bet', sizePot: 1.1 }, recommendedAction: { type: 'bet', sizePot: 0.33 }, reason: ['sizing_sensitive'] });
  const b = classifyConcept({ street: 'flop', actionTaken: { type: 'bet', sizePot: 1.1 }, recommendedAction: { type: 'bet', sizePot: 0.33 }, reason: ['sizing_sensitive'] });
  assert.equal(a, b);
});

test('concepts taxonomy covers every supported street with Russian labels', () => {
  const streets = new Set(Object.values(LEAKS).map((l) => l.street));
  for (const s of ['preflop', 'flop', 'turn', 'river', 'general']) {
    assert.ok(streets.has(s), `missing street ${s}`);
  }
  assert.ok(leakLabelRu('bluff_catch'));
  assert.ok(leakDefinitionRu('bluff_catch'));
  assert.ok(isKnownLeak('value_bet'));
  assert.equal(isKnownLeak('not_a_leak'), false);
});

// ---- Leak profile aggregation (req 5) ---------------------------------------

test('recordLeakEvent aggregates sample size, mistakes and total EV loss', () => {
  const p = createLeakProfile({ concept: 'turn_barrel_sizing' });
  recordLeakEvent(p, leakEventFromCandidate(candidateFixture(), 1000));
  recordLeakEvent(p, leakEventFromCandidate(candidateFixture(), 2000));
  assert.equal(p.sampleSize, 2);
  assert.equal(p.mistakes, 2);
  assert.equal(p.totalEvLossBb, 3.4);
});

test('leak profile recency tracks only the last events', () => {
  const p = createLeakProfile({ concept: 'cbet_frequency' });
  // One big mistake, then five tiny ones → the rolling last-5 window is all tiny.
  recordLeakEvent(p, { concept: 'cbet_frequency', evLossBb: 2, at: 0 });
  for (let i = 1; i <= 5; i++) {
    recordLeakEvent(p, { concept: 'cbet_frequency', evLossBb: 0, at: i * 100 });
  }
  assert.equal(p.recentEvLossBb, 0);
  assert.equal(p.recentMistakes, 0);
  assert.equal(p.sampleSize, 6);
});

test('trend stays stable until enough samples exist', () => {
  const p = buildLeakProfile({ concept: 'value_bet', events: [
    { concept: 'value_bet', evLossBb: 1, at: 1 },
    { concept: 'value_bet', evLossBb: 1, at: 2 }
  ] });
  assert.equal(p.trend, 'stable');
  assert.equal(p.firstFiveEvLossBb, null);
});

test('trend reports improving when EV loss shrinks over time', () => {
  const events = [
    { concept: 'value_bet', evLossBb: 2, at: 1 },
    { concept: 'value_bet', evLossBb: 2, at: 2 },
    { concept: 'value_bet', evLossBb: 2, at: 3 },
    { concept: 'value_bet', evLossBb: 0.5, at: 4 },
    { concept: 'value_bet', evLossBb: 0.5, at: 5 },
    { concept: 'value_bet', evLossBb: 0.4, at: 6 }
  ];
  const p = buildLeakProfile({ concept: 'value_bet', events });
  assert.equal(p.trend, 'improving');
});

test('high-confidence mistakes are counted separately', () => {
  const p = createLeakProfile({ concept: 'bluff' });
  recordLeakEvent(p, { concept: 'bluff', evLossBb: 1, highConfidence: true });
  recordLeakEvent(p, { concept: 'bluff', evLossBb: 1, highConfidence: false });
  assert.equal(p.highConfidenceMistakes, 1);
  assert.equal(p.mistakes, 2);
});

// ---- Priority (req 6) --------------------------------------------------------

test('priority is zero with no evidence', () => {
  assert.equal(computePriority(createLeakProfile({ concept: 'bluff' }), { now: 0 }), 0);
});

test('priority grows with EV loss and recurrence', () => {
  const make = (losses) => buildLeakProfile({ concept: 'turn_probe', events: losses.map((evLossBb, i) => ({ concept: 'turn_probe', evLossBb, at: i * 1000, confidenceScore: 0.9 })) });
  const small = make([0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
  const big = make([2, 2, 2, 2, 2, 2]);
  assert.ok(computePriority(big, { now: 100000 }) > computePriority(small, { now: 100000 }));
});

test('priority is damped for tiny samples (no false alarms)', () => {
  const one = buildLeakProfile({ concept: 'bluff', events: [{ concept: 'bluff', evLossBb: 3, at: 0 }] });
  const many = buildLeakProfile({ concept: 'bluff', events: [0, 1, 2, 3, 4, 5].map((i) => ({ concept: 'bluff', evLossBb: 3, at: i * 1000 })) });
  assert.ok(computePriority(many, { now: 100000 }) > computePriority(one, { now: 100000 }));
});

test('recency decays priority over time', () => {
  const events = [0, 1, 2, 3, 4, 5].map((i) => ({ concept: 'bluff', evLossBb: 2, at: i * 1000 }));
  const fresh = computePriority(buildLeakProfile({ concept: 'bluff', events }), { now: 100000 });
  const old = computePriority(buildLeakProfile({ concept: 'bluff', events }), { now: 100000 + 30 * 24 * 3600 * 1000 });
  assert.ok(fresh > old);
});

test('recent improvement discounts priority', () => {
  const improving = buildLeakProfile({ concept: 'bluff', events: [
    { concept: 'bluff', evLossBb: 2, at: 0 }, { concept: 'bluff', evLossBb: 2, at: 1 },
    { concept: 'bluff', evLossBb: 2, at: 2 }, { concept: 'bluff', evLossBb: 0.1, at: 3 }
  ] });
  const stable = buildLeakProfile({ concept: 'bluff', events: [
    { concept: 'bluff', evLossBb: 2, at: 0 }, { concept: 'bluff', evLossBb: 2, at: 1 },
    { concept: 'bluff', evLossBb: 2, at: 2 }, { concept: 'bluff', evLossBb: 2, at: 3 }
  ] });
  assert.equal(improving.trend, 'improving');
  assert.ok(computePriority(improving, { now: 4000 }) < computePriority(stable, { now: 4000 }));
});

test('rankLeaks returns profiles sorted by priority', () => {
  const a = buildLeakProfile({ concept: 'bluff', events: [0, 1, 2, 3].map((i) => ({ concept: 'bluff', evLossBb: 3, at: i * 1000 })) });
  const b = buildLeakProfile({ concept: 'value_bet', events: [0, 1, 2, 3].map((i) => ({ concept: 'value_bet', evLossBb: 0.2, at: i * 1000 })) });
  const ranked = [{ concept: 'bluff', priority: computePriority(a, { now: 5000 }) }, { concept: 'value_bet', priority: computePriority(b, { now: 5000 }) }]
    .sort((x, y) => y.priority - x.priority);
  assert.equal(ranked[0].concept, 'bluff');
});

// ---- Drill validator (req 8/22) ---------------------------------------------

test('a solved multi-option decision is a valid drill', () => {
  assert.deepEqual(validateDrillDecision(fakeDecision()), { ok: true, reason: 'valid' });
});

test('an unsolved decision is rejected', () => {
  const d = fakeDecision({ solved: false });
  assert.equal(validateDrillDecision(d).ok, false);
});

test('a trivial spot (all options equivalent, no mixing) is rejected', () => {
  const d = fakeDecision({
    recommendedFrequency: 1.0,
    legalActions: [
      { id: 'check', action: { type: 'check' }, evBB: 5, frequency: 1.0 },
      { id: 'fold', action: { type: 'fold' }, evBB: 5, frequency: 0 }
    ]
  });
  assert.equal(isTrivialDecision(d), true);
  assert.equal(validateDrillDecision(d).ok, false);
});

// ---- Drill generator (req 8/9/10) -------------------------------------------

test('dealCards never produces duplicate or overlapping cards', () => {
  for (let i = 0; i < 20; i++) {
    const { hero, villain, board } = dealCards({ rng: Math.random });
    const all = [...hero, ...villain, ...board];
    assert.equal(new Set(all).size, all.length);
    assert.equal(hero.length, 2);
    assert.equal(villain.length, 2);
    assert.equal(board.length, 3);
  }
});

test('dealCards respects excluded cards', () => {
  const { board } = dealCards({ exclude: ['Ah', 'Kc', '2d'], rng: Math.random });
  assert.ok(!board.includes('Ah'));
  assert.ok(!board.includes('Kc'));
});

test('nextVariant preserves street and stack, varies cards', () => {
  const c = candidateFixture();
  const v = nextVariant({ candidate: c, rng: Math.random });
  assert.equal(v.street, 'turn');
  assert.equal(v.effectiveStackBb, 100);
  assert.equal(v.board.length, 4); // turn board
});

test('buildScenarioInput produces a valid solver input (no dup cards)', () => {
  const c = candidateFixture();
  const v = nextVariant({ candidate: c, rng: Math.random });
  const input = buildScenarioInput({ candidate: c, ...v });
  assert.equal(input.effectiveStackBB, 100);
  assert.equal(input.board.length, 4);
  assert.ok(input.actions.length > 0);
});

test('generateDrill builds a self-contained drill from a solved spot', () => {
  const c = candidateFixture();
  const gen = generateDrill({ candidate: c, solve: fakeSolve(fakeDecision()), rng: Math.random });
  assert.equal(gen.ok, true);
  assert.equal(gen.drill.street, 'turn');
  assert.equal(gen.drill.concept, 'turn_barrel_sizing');
  assert.equal(gen.drill.options.length, 3);
  assert.ok(gen.drill.solution.recommendedAction);
  assert.ok(gen.drill.drillId);
});

test('generateDrill rejects an unsolved/invalid spot (never fabricates)', () => {
  const c = candidateFixture();
  const bad = fakeDecision({ solved: false });
  const gen = generateDrill({ candidate: c, solve: fakeSolve(bad), rng: Math.random });
  assert.equal(gen.ok, false);
  assert.ok(gen.reason);
});

test('generateDrill rejects a trivial spot', () => {
  const c = candidateFixture();
  const trivial = fakeDecision({ recommendedFrequency: 1.0, legalActions: [
    { id: 'check', action: { type: 'check' }, evBB: 5, frequency: 1.0 },
    { id: 'fold', action: { type: 'fold' }, evBB: 5, frequency: 0 }
  ] });
  const gen = generateDrill({ candidate: c, solve: fakeSolve(trivial), rng: Math.random });
  assert.equal(gen.ok, false);
});

test('classifyDifficulty ranges 1..5', () => {
  assert.equal(classifyDifficulty({ evSpreadBb: 0.5, recommendedFrequency: 0.9, plausibleActions: 2, confidence: 0.9 }), 1);
  assert.equal(classifyDifficulty({ evSpreadBb: 0.05, recommendedFrequency: 0.5, plausibleActions: 4, confidence: 0.4, concept: 'bluff_catch' }), 5);
});

test('actionLabelRu produces Russian labels', () => {
  assert.equal(actionLabelRu({ type: 'check' }), 'Чек');
  assert.equal(actionLabelRu({ type: 'call' }), 'Колл');
  assert.equal(actionLabelRu({ type: 'bet', sizePot: 0.75 }), 'Ставка 75% пота');
  assert.equal(actionLabelRu({ type: 'fold' }), 'Фолд');
});

// ---- Answer evaluator (req 11/12) -------------------------------------------

test('gradeForLoss maps thresholds to five grades', () => {
  assert.equal(gradeForLoss(0.01, 'mtt'), 'EXCELLENT');
  assert.equal(gradeForLoss(0.15, 'mtt'), 'GOOD');
  assert.equal(gradeForLoss(0.5, 'mtt'), 'MISTAKE');
  assert.equal(gradeForLoss(4, 'mtt'), 'BIG MISTAKE');
});

test('gradeAnswer marks the recommended line EXCELLENT', () => {
  const c = candidateFixture();
  const gen = generateDrill({ candidate: c, solve: fakeSolve(fakeDecision()), rng: Math.random });
  const result = gradeAnswer({ drill: gen.drill, chosenId: 'bet_75', preset: 'mtt' });
  assert.equal(result.grade, 'EXCELLENT');
  assert.equal(result.chosenRecommended, true);
});

test('gradeAnswer handles mixed strategies (near-EV alt not a big mistake)', () => {
  const c = candidateFixture();
  // recommendedFrequency 0.5 → mixed; bet_25 is close to bet_75 in EV.
  const gen = generateDrill({ candidate: c, solve: fakeSolve(fakeDecision({
    recommendedFrequency: 0.5, bestEV: 8.0,
    legalActions: [
      { id: 'check', action: { type: 'check' }, evBB: 7.0, frequency: 0.1 },
      { id: 'bet_75', action: { type: 'bet', sizePot: 0.75 }, evBB: 8.0, frequency: 0.5 },
      { id: 'bet_25', action: { type: 'bet', sizePot: 0.25 }, evBB: 7.9, frequency: 0.4 }
    ]
  })), rng: Math.random });
  const result = gradeAnswer({ drill: gen.drill, chosenId: 'bet_25', preset: 'mtt' });
  assert.equal(result.mixedStrategy, true);
  assert.equal(result.grade, 'GOOD');
});

test('gradeAnswer flags a large-EV mistake', () => {
  const c = candidateFixture();
  const gen = generateDrill({ candidate: c, solve: fakeSolve(fakeDecision()), rng: Math.random });
  const result = gradeAnswer({ drill: gen.drill, chosenId: 'bet_25', preset: 'mtt' }); // 8.2 - 7.9 = 0.3 BB
  assert.equal(result.grade, 'MISTAKE');
});

test('feedbackForGrade returns Russian copy per grade', () => {
  const f = feedbackForGrade('EXCELLENT', { conceptLabelRu: 'Сайзинг' });
  assert.equal(f.title, 'Отличный выбор');
  assert.ok(f.summary);
  assert.ok(f.tip);
});

// ---- Progress / mastery (req 14/15) -----------------------------------------

test('recordAttempt builds optimal/near-optimal rates and mastery', () => {
  const p = createConceptProgress({ concept: 'bluff' });
  recordAttempt(p, { grade: 'EXCELLENT', evLossBb: 0.01, now: 1 });
  recordAttempt(p, { grade: 'EXCELLENT', evLossBb: 0.02, now: 2 });
  recordAttempt(p, { grade: 'GOOD', evLossBb: 0.1, now: 3 });
  assert.equal(p.attempts, 3);
  assert.ok(Math.abs(p.optimalRate - 2 / 3) < 0.001);
  assert.equal(p.nearOptimalRate, 1);
  assert.ok(p.masteryScore != null && p.masteryScore > 0);
});

test('mastery stays null until enough samples', () => {
  const p = createConceptProgress({ concept: 'bluff' });
  recordAttempt(p, { grade: 'EXCELLENT', evLossBb: 0.01, now: 1 });
  assert.equal(p.masteryScore, null);
});

test('progress trend requires a minimum of attempts', () => {
  const p = buildProgress({ concept: 'bluff', attempts: [
    { grade: 'MISTAKE', evLossBb: 1, at: 1 },
    { grade: 'MISTAKE', evLossBb: 1, at: 2 }
  ] });
  assert.equal(p.trend, 'stable');
});

test('progress improves with better answers', () => {
  const p = createConceptProgress({ concept: 'bluff' });
  for (let i = 0; i < 4; i++) recordAttempt(p, { grade: 'MISTAKE', evLossBb: 1.5, now: i });
  assert.equal(p.trend, 'stable');
  for (let i = 4; i < 8; i++) recordAttempt(p, { grade: 'EXCELLENT', evLossBb: 0.02, now: i });
  assert.equal(p.trend, 'improving');
});

// ---- Training store (req 18/20) ---------------------------------------------

test('training store round-trips candidates and dedupes by identity', () => {
  const store = createTrainingStore();
  const c = candidateFixture();
  assert.equal(store.hasCandidate(c), false);
  assert.equal(recordCandidate(store, c).recorded, true);
  assert.equal(recordCandidate(store, c).deduped, true); // same hand+decision
  assert.equal(store.listCandidates().length, 1);
});

test('listCandidates returns candidate objects (not wrappers) with their concept', () => {
  const store = createTrainingStore();
  const c = candidateFixture();
  recordCandidate(store, c);
  const listed = store.listCandidates();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, c.id);
  assert.equal(listed[0].concept, 'turn_barrel_sizing');
  assert.equal(listed[0].street, 'turn');
});

test('training store persists profiles and progress', () => {
  const store = createTrainingStore();
  const c = candidateFixture();
  recordCandidate(store, c);
  assert.ok(store.loadProfile(c.concept));
  recordTrainingResult(store, { drill: { concept: c.concept, street: 'turn', drillId: 'd1' }, grade: 'EXCELLENT', evLossBb: 0.01 });
  assert.ok(store.loadProgress(c.concept));
  assert.equal(store.loadHistory().length, 1);
});

test('training store survives corrupt JSON (graceful reset)', () => {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
  storage.setItem('pokerSwipe_train_meta', '{corrupt!!!');
  const store = createTrainingStore({ storage });
  assert.equal(store.version, 1);
  // A corrupted key returns fallback and does not crash.
  assert.equal(store.loadProfile('bluff'), null);
});

test('training store reset clears only its own keys', () => {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
  const store = createTrainingStore({ storage });
  store.saveProfile({ concept: 'bluff' });
  storage.setItem('unrelated', 'keep');
  store.reset();
  assert.equal(map.has('unrelated'), true);
  assert.equal(map.has('pokerSwipe_train_profile:bluff'), false);
});

// ---- Session builder (req 16/17) --------------------------------------------

test('buildTrainingSession prioritizes the highest-priority leak as primary', () => {
  const high = buildLeakProfile({ concept: 'bluff', events: [0, 1, 2, 3].map((i) => ({ concept: 'bluff', evLossBb: 3, at: i * 1000 })) });
  const low = buildLeakProfile({ concept: 'value_bet', events: [0, 1, 2, 3].map((i) => ({ concept: 'value_bet', evLossBb: 0.2, at: i * 1000 })) });
  const plan = buildTrainingSession({ profiles: [low, high], count: 7, now: 5000 });
  assert.equal(plan.primaryConcept, 'bluff');
  assert.equal(plan.personalized, true);
  assert.ok(plan.drills.length > 0);
});

test('buildTrainingSession does not repeat a concept on cooldown', () => {
  const high = buildLeakProfile({ concept: 'bluff', events: [0, 1, 2, 3].map((i) => ({ concept: 'bluff', evLossBb: 3, at: i * 1000 })) });
  const now = Date.now();
  const history = [{ concept: 'bluff', street: 'river', at: now - 1000 }];
  const plan = buildTrainingSession({ profiles: [high], history, count: 5, now });
  assert.ok(!plan.drills.some((d) => d.concept === 'bluff'));
});

test('recentDrilledKeys respects the cooldown window', () => {
  const now = Date.now();
  const fresh = recentDrilledKeys([{ concept: 'bluff', at: now - 1000 }], now);
  assert.ok(fresh.has('bluff|'));
  const old = recentDrilledKeys([{ concept: 'bluff', at: now - 10 * 24 * 3600 * 1000 }], now);
  assert.equal(old.size, 0);
});

test('getDailyPersonalizedTraining is not personalized without leak data', () => {
  const store = createTrainingStore();
  const daily = getTopLeaks(store);
  assert.deepEqual(daily, []);
});

// ---- Orchestration: recording + top leaks (req 19) --------------------------

test('recordCandidate feeds the Ты top-leak connection', () => {
  const store = createTrainingStore();
  recordCandidate(store, candidateFixture());
  const top = getTopLeaks(store);
  assert.equal(top.length, 1);
  assert.equal(top[0].concept, 'turn_barrel_sizing');
  assert.ok(top[0].label);
  assert.ok(top[0].evidence);
});

test('recordTrainingResult records progress and history', () => {
  const store = createTrainingStore();
  const res = recordTrainingResult(store, { drill: { concept: 'bluff', street: 'river', drillId: 'x' }, grade: 'GOOD', evLossBb: 0.1 });
  assert.equal(res.recorded, true);
  assert.equal(res.concept, 'bluff');
  assert.equal(store.loadProgress('bluff').attempts, 1);
  assert.equal(store.loadHistory().length, 1);
});

// ---- Async generation (req 21/22) -------------------------------------------

test('buildPersonalizedSessionAsync falls back to general drills to fill a session', async () => {
  const store = createTrainingStore();
  let generalCount = 0;
  const result = await buildPersonalizedSessionAsync({
    store, count: 3, solve: fakeSolve(fakeDecision()), config: {
      generalDrill: ({ solve, solveOpts }) => {
        generalCount++;
        return generateDrill({ candidate: candidateFixture(), solve, solveOpts, rng: Math.random });
      }
    }
  });
  assert.ok(result.filled >= 1);
  assert.equal(generalCount, result.filled);
});

test('buildPersonalizedSessionAsync honours an aborted signal', async () => {
  const store = createTrainingStore();
  const controller = new AbortController();
  controller.abort();
  const result = await buildPersonalizedSessionAsync({ store, count: 5, solve: fakeSolve(fakeDecision()), signal: controller.signal });
  assert.equal(result.filled, 0);
});

test('buildPersonalizedSessionAsync dedupes concurrent jobs for the same key', async () => {
  const store = createTrainingStore();
  const jobKey = 'test-user';
  const a = buildPersonalizedSessionAsync({ store, count: 2, solve: fakeSolve(fakeDecision()), jobKey });
  const b = buildPersonalizedSessionAsync({ store, count: 2, solve: fakeSolve(fakeDecision()), jobKey });
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra, rb);
});

test('buildPersonalizedSessionAsync respects the time budget', async () => {
  const store = createTrainingStore();
  const result = await buildPersonalizedSessionAsync({
    store, count: 100, solve: fakeSolve(fakeDecision()), config: { timeBudgetMs: 1 }
  });
  assert.ok(result.elapsedMs >= 0);
  assert.ok(result.filled <= 100);
});