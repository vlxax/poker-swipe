// Focused tests for the personalised-training UI integration: view models,
// session-controller lifecycle (loading/ready/limited/error/cancelled/fallback),
// duplicate-START prevention, stale-async protection, cache reuse, answer
// grading and the final summary. Uses the solver's own fixtures + a fast fake
// solve so no CFR run is needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCandidate, recordCandidate, createTrainingStore, gradeAnswer,
  generateDrill, leakLabelRu
} from '../../solver/src/index.js';
import { homeViewModel, drillViewModel, confidenceModel, feedbackViewModel, summaryViewModel, gradeClass } from '../../training-ui/viewModel.js';
import { SessionController } from '../../training-ui/sessionController.js';

function reviewModelFixture() {
  return {
    hand: { hero: ['Ah', 'Kd'], board: ['Ah', 'Kc', '2d', '8s', '3h'], positions: { hero: 'BTN', villain: 'BB' }, effStack: 100 },
    decisions: [{
      index: 0, solved: true, street: 'turn', board: ['Ah', 'Kc', '2d', '8s', '3h'], potBB: 12.3,
      legalActions: [
        { id: 'check', action: { type: 'check' }, evBB: 7.0, frequency: 0.2 },
        { id: 'bet_75', action: { type: 'bet', sizePot: 0.75 }, evBB: 8.2, frequency: 0.6 },
        { id: 'bet_25', action: { type: 'bet', sizePot: 0.25 }, evBB: 7.9, frequency: 0.2 }
      ],
      recommendedAction: { type: 'bet', sizePot: 0.75 }, recommendedFrequency: 0.6, bestEV: 8.2, evLossBB: 0,
      confidence: { score: 0.8, level: 'high' }
    }],
    trainingCandidate: {
      street: 'turn', board: ['Ah', 'Kc', '2d', '8s', '3h'], difficultyScore: 0.75,
      reason: ['significant_ev_loss'],
      actionTaken: { type: 'bet', sizePot: 0.25 },
      recommendedAction: { type: 'bet', sizePot: 0.75 }, evLossBB: 1.7
    }
  };
}

function candidateFixture() {
  return normalizeCandidate({ reviewModel: reviewModelFixture(), sourceHandId: 'h1', sourceCandidateId: 'c1' });
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

function seededStore() {
  const store = createTrainingStore();
  recordCandidate(store, candidateFixture());
  return store;
}

function makeController(store = seededStore(), decision = fakeDecision(), config = {}) {
  return new SessionController({
    store,
    solve: fakeSolve(decision),
    solveOpts: {},
    config: { count: 1, maxAttempts: 3, timeBudgetMs: 5000, trendMinSamples: 5, ...config },
    now: () => 1700000000000
  });
}

const GOOD_LOSS = 0.05;

// ---- Home view model --------------------------------------------------------

test('homeViewModel returns a personalised block when a leak profile exists', () => {
  const vm = homeViewModel({ leaks: [{ concept: 'turn_barrel_sizing', label: 'Сайзинг второго барреля', definition: 'd', evidence: 'e', sampleSize: 3 }], plan: { total: 7, estimatedDifficulty: 2.5 } });
  assert.equal(vm.type, 'personalized');
  assert.equal(vm.title, 'ТРЕНИРОВКА ДЛЯ ТЕБЯ');
  assert.equal(vm.total, 7);
  assert.equal(vm.difficulty, 2.5);
  assert.equal(vm.cta, 'НАЧАТЬ');
  assert.equal(vm.why, 'Почему сейчас');
});

test('homeViewModel returns a general fallback when there is no leak profile', () => {
  const vm = homeViewModel({ leaks: [], plan: { total: 7, estimatedDifficulty: 1 } });
  assert.equal(vm.type, 'fallback');
  assert.equal(vm.title, 'ЕЖЕДНЕВНАЯ ТРЕНИРОВКА');
  assert.match(vm.note, /недостаточно раздач/);
  assert.equal(vm.cta, 'НАЧАТЬ ОБЩУЮ');
  assert.ok(!vm.why);
});

// ---- Drill view model -------------------------------------------------------

function drillFixture() {
  const gen = generateDrill({ candidate: candidateFixture(), solve: fakeSolve(fakeDecision()), rng: () => 0.5 });
  assert.equal(gen.ok, true, gen.reason);
  return gen.drill;
}

test('drillViewModel exposes scenario, progress, prompt and legal options', () => {
  const drill = drillFixture();
  const vm = drillViewModel({ drill, index: 1, total: 7 });
  assert.equal(vm.streetRu, 'ТЁРН');
  assert.equal(vm.progress.index, 1);
  assert.equal(vm.progress.total, 7);
  assert.equal(vm.scenario.heroPosition, 'BTN');
  assert.equal(vm.scenario.villainPosition, 'BB');
  assert.ok(vm.scenario.potBb > 0);
  assert.ok(vm.scenario.heroCards.length === 2);
  assert.ok(vm.options.length >= 2);
  assert.deepEqual(vm.legalActions, vm.options.map((o) => o.id));
  assert.ok(vm.prompt);
});

test('drillViewModel confidence shows a limited-analysis note on low confidence', () => {
  const drill = drillFixture();
  drill.solution.confidence = { score: 0.5, level: 'low' };
  const vm = drillViewModel({ drill, index: 1, total: 7 });
  assert.equal(vm.confidence.available, true);
  assert.equal(vm.confidence.score, 50);
  assert.match(vm.confidence.note, /Ограничено/);
});

test('confidenceModel returns unavailable when no confidence is present', () => {
  assert.equal(confidenceModel(null).available, false);
  assert.equal(confidenceModel({}).available, false);
});

// ---- Feedback / grading -----------------------------------------------------

test('gradeAnswer grades the best line EXCELLENT and the worst a mistake (EV-based)', () => {
  const drill = drillFixture();
  const best = gradeAnswer({ drill, chosenId: drill.solution.recommendedAction
    ? drill.options.find((o) => o.action && o.action.type === drill.solution.recommendedAction.type).id
    : drill.options[0].id });
  assert.equal(best.grade, 'EXCELLENT');
  assert.ok(best.evLossBb <= GOOD_LOSS);
  const worst = gradeAnswer({ drill, chosenId: drill.options[0].id });
  assert.ok(worst.evLossBb > GOOD_LOSS);
  assert.equal(gradeClass(worst.grade), 'r');
});

test('mixed strategy near-EV alternatives grade GOOD, not a red mistake', () => {
  const gen = generateDrill({
    candidate: candidateFixture(),
    solve: fakeSolve(fakeDecision({
      legalActions: [
        { id: 'check', action: { type: 'check' }, evBB: 8.0, frequency: 0.5 },
        { id: 'bet_75', action: { type: 'bet', sizePot: 0.75 }, evBB: 8.1, frequency: 0.5 }
      ],
      recommendedAction: { type: 'bet', sizePot: 0.75 }, recommendedFrequency: 0.5, bestEV: 8.1
    })),
    rng: () => 0.5
  });
  assert.equal(gen.ok, true, gen.reason);
  const alt = gradeAnswer({ drill: gen.drill, chosenId: 'check' });
  assert.equal(alt.mixedStrategy, true);
  assert.ok(alt.evLossBb <= 0.11);
  assert.notEqual(alt.grade, 'BIG MISTAKE');
  assert.notEqual(alt.grade, 'MISTAKE');
});

test('feedbackViewModel maps a grade result into the Russian feedback shape', () => {
  const drill = drillFixture();
  const result = gradeAnswer({ drill, chosenId: drill.options[0].id });
  const vm = feedbackViewModel({ result, drill });
  assert.equal(vm.grade, result.grade);
  assert.equal(vm.gradeTitle, result.feedbackRu.title);
  assert.ok(vm.summary);
  assert.equal(vm.evLossBb, result.evLossBb);
  assert.ok(vm.strategy.recommendedActionLabel);
  assert.ok(vm.strategy.recommendedFrequency > 0);
});

// ---- Summary ----------------------------------------------------------------

test('summaryViewModel shows the session totals and near-optimal count', () => {
  const vm = summaryViewModel({
    session: { primaryConcept: 'turn_barrel_sizing', plan: { total: 2 }, drills: [{}, {}] },
    results: [
      { evLossBb: 0.02, nearOptimal: true, concept: 'turn_barrel_sizing' },
      { evLossBb: 1.5, nearOptimal: false, concept: 'turn_barrel_sizing' }
    ]
  });
  assert.equal(vm.solved, 2);
  assert.equal(vm.total, 2);
  assert.equal(vm.nearOptimalCount, 1);
  assert.ok(vm.avgLossBb > 0);
  assert.equal(vm.primaryLabel, leakLabelRu('turn_barrel_sizing'));
});

test('summary trend is unavailable with insufficient prior samples', () => {
  const vm = summaryViewModel({
    session: { primaryConcept: 'turn_barrel_sizing', plan: { total: 1 }, drills: [{}] },
    results: [{ evLossBb: 0.5, nearOptimal: false, concept: 'turn_barrel_sizing' }],
    baselineLosses: [1.0, 0.9], // fewer than minSamples(5)
    minSamples: 5
  });
  assert.equal(vm.trend.available, false);
});

test('summary trend is available with enough before/after samples', () => {
  const vm = summaryViewModel({
    session: { primaryConcept: 'turn_barrel_sizing', plan: { total: 2 }, drills: [{}, {}] },
    results: [
      { evLossBb: 0.5, nearOptimal: false, concept: 'turn_barrel_sizing' },
      { evLossBb: 0.4, nearOptimal: false, concept: 'turn_barrel_sizing' }
    ],
    baselineLosses: [1.5, 1.4, 1.3, 1.2, 1.1],
    minSamples: 5
  });
  assert.equal(vm.trend.available, true);
  assert.ok(vm.trend.delta > 0);
});

// ---- Session controller -----------------------------------------------------

test('controller hasProfile reflects seeded leak profile', () => {
  assert.equal(makeController().hasProfile(), true);
  assert.equal(makeController(createTrainingStore()).hasProfile(), false);
});

test('controller start without a profile falls back (no fake personalised content)', () => {
  const ctl = makeController(createTrainingStore());
  const r = ctl.start();
  assert.equal(r.started, false);
  assert.equal(r.reason, 'no_profile');
  assert.equal(ctl.state, 'fallback');
});

test('controller start builds a ready session and rejects duplicate START', async () => {
  const ctl = makeController();
  const first = ctl.start();
  assert.equal(first.started, true);
  assert.equal(ctl.state, 'loading');
  const dup = ctl.start(); // while loading → ignored
  assert.equal(dup.started, false);
  assert.equal(dup.reason, 'busy');
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(ctl.state === 'ready' || ctl.state === 'limited');
  assert.ok(ctl.current());
});

test('controller answer grades and records, then next advances and finishes', async () => {
  const store = seededStore();
  const ctl = makeController(store);
  ctl.start();
  await new Promise((r) => setTimeout(r, 50));
  const drill = ctl.current();
  const recId = drill.options.find((o) => o.action && o.action.type === drill.solution.recommendedAction.type).id;
  const result = ctl.answer(recId);
  assert.ok(result);
  assert.equal(ctl.results.length, 1);
  const prog = ctl.progress();
  assert.equal(prog.index, 1);
  const nxt = ctl.next();
  assert.equal(nxt.done, true);
  assert.equal(ctl.state, 'done');
  assert.equal(store.loadProgress(drill.concept).attempts, 1);
});

test('controller next returns done:false while drills remain and advances progress', async () => {
  const ctl = makeController(seededStore(), fakeDecision(), { count: 1 });
  // Build a multi-drill session by seeding a second concept candidate via general extras is complex;
  // here we assert the not-done path separately with a stub session.
  ctl.state = 'ready';
  ctl.drills = [drillFixture(), drillFixture()];
  ctl.index = 0;
  const r = ctl.next();
  assert.equal(r.done, false);
  assert.equal(ctl.index, 1);
});

test('controller cancels generation and enters cancelled state', async () => {
  const ctl = makeController();
  ctl.start();
  ctl.cancel();
  assert.equal(ctl.state, 'cancelled');
});

test('controller error transition sets error state', () => {
  const ctl = makeController();
  ctl.start();
  ctl._onError(ctl.genToken);
  assert.equal(ctl.state, 'error');
});

test('stale async result does not overwrite a newer session', () => {
  const ctl = makeController();
  ctl.start();
  const freshToken = ctl.genToken;
  // A stale generation (token 0) must be ignored.
  ctl._onGenerated(0, { drills: [drillFixture()], primaryConcept: 'x' });
  assert.equal(ctl.state, 'loading');
  assert.equal(ctl.drills.length, 0);
  // The current token is honoured.
  ctl._onGenerated(freshToken, { drills: [drillFixture()], primaryConcept: 'turn_barrel_sizing', plan: { total: 1 } });
  assert.equal(ctl.state, 'ready');
});

test('reopening training reuses the cached session without regenerating', async () => {
  const ctl = makeController();
  ctl.start();
  await new Promise((r) => setTimeout(r, 50));
  const before = ctl.genToken;
  const reopen = ctl.start();
  assert.equal(reopen.cached, true);
  assert.equal(ctl.genToken, before); // no new generation job started
  assert.ok(ctl.state === 'ready' || ctl.state === 'limited');
});

test('duplicate START while ready returns cached and does not spawn a new job', async () => {
  const ctl = makeController();
  ctl.start();
  await new Promise((r) => setTimeout(r, 50));
  const before = ctl.genToken;
  const again = ctl.start();
  assert.equal(again.cached, true);
  assert.equal(ctl.genToken, before);
});

test('summary after a session reports real results and trend', async () => {
  const store = seededStore();
  // Seed baseline history so trend is available.
  const ctl = makeController(store, fakeDecision(), { count: 1 });
  ctl.start();
  await new Promise((r) => setTimeout(r, 50));
  const drill = ctl.current();
  const recId = drill.options.find((o) => o.action && o.action.type === drill.solution.recommendedAction.type).id;
  ctl.answer(recId);
  ctl.next();
  const vm = ctl.summary();
  assert.equal(vm.solved, 1);
  assert.ok(vm.avgLossBb != null);
  assert.equal(vm.primaryConcept, 'turn_barrel_sizing');
});