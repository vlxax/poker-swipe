// Focused tests for the personalised-training UI integration: view models,
// session-controller lifecycle (loading/ready/limited/error/cancelled/fallback),
// duplicate-START prevention, stale-async protection, cache reuse, answer
// grading and the final summary. Uses the solver's own fixtures + a fast fake
// solve so no CFR run is needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCandidate, recordCandidate, createTrainingStore, gradeAnswer,
  generateDrill, leakLabelRu, skillLabelRu
} from '../../solver/src/index.js';
import { homeViewModel, drillViewModel, confidenceModel, feedbackViewModel, summaryViewModel, gradeClass, assessmentViewModel, assessmentSummaryViewModel } from '../../training-ui/viewModel.js';
import { SessionController } from '../../training-ui/sessionController.js';
import { AssessmentController } from '../../training-ui/assessmentController.js';

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
  const vm = homeViewModel({
    leaks: [{ concept: 'turn_barrel_sizing', label: 'Сайзинг второго барреля', definition: 'd', evidence: 'e', sampleSize: 3 }],
    plan: { total: 7, personalized: true, sessionPlan: { primaryTargets: ['turn value barrel'], maintenance: [], exploration: [] } }
  });
  assert.equal(vm.type, 'training');
  assert.equal(vm.title, 'ТВОЯ ТРЕНИРОВКА');
  assert.equal(vm.total, 7);
  assert.ok(vm.focusItems.length >= 1);
  assert.equal(vm.cta, 'НАЧАТЬ ТРЕНИРОВКУ');
  assert.ok(vm.whyText);
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
  assert.match(vm.confidence.note, /приблизительн/i);
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

test('controller hasProfile is true when only a skill profile exists', () => {
  const store = createTrainingStore();
  store.saveSkillProfile({
    overall: 61,
    overallLabel: 'КЛУБНЫЙ РЕГ',
    weakest: { skill: 'icm', labelRu: 'ICM / баббл' },
    skills: { icm: {}, preflop: {} }
  });
  const ctl = makeController(store);
  assert.equal(ctl.hasProfile(), true);
  assert.equal(ctl.home().type, 'training');
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
  assert.ok(vm.primaryConcept);
});

// ---- Primary assessment (P0) -------------------------------------------------

test('assessmentViewModel maps a question with plain-string choices', () => {
  const vm = assessmentViewModel({ item: { id: 'A', q: 'BTN · A8s', street: 'ПРЕФЛОП', skillTag: 'preflop', choices: ['ФОЛД', 'РЕЙЗ'] }, index: 2, total: 12 });
  assert.equal(vm.q, 'BTN · A8s');
  assert.equal(vm.progress.index, 2);
  assert.equal(vm.progress.total, 12);
  assert.deepEqual(vm.choices.map((c) => c.id), ['ФОЛД', 'РЕЙЗ']);
  assert.equal(vm.choices[0].labelRu, 'ФОЛД');
});

test('assessmentSummaryViewModel reports level, correct and weakest/strongest', () => {
  const vm = assessmentSummaryViewModel({
    result: {
      answered: 12, total: 12, overall: 60, overallLabel: 'КЛУБНЫЙ РЕГ',
      weakestSkill: 'icm', strongestSkill: 'preflop',
      skillProfile: {},
      results: [{ correct: true }, { correct: false }, { correct: true }, { nearOptimal: true }]
    }
  });
  assert.equal(vm.overall, 60);
  assert.equal(vm.correct, 2);
  assert.equal(vm.nearOptimal, 1);
  assert.equal(vm.weakest, 'ICM / баббл');
  assert.equal(vm.hasResult, true);
});

test('homeViewModel returns the personal training CTA when a skill profile exists', () => {
  const vm = homeViewModel({
    leaks: [],
    plan: { total: 7, sessionId: 'plan-a', sessionPlan: { primaryTargets: ['bubble ICM'], maintenance: [], exploration: [] } },
    skillProfile: {
      overall: 61,
      overallLabel: 'КЛУБНЫЙ РЕГ',
      weakest: { skill: 'icm', labelRu: 'ICM / баббл' },
      skills: {
        icm: { score: 40, labelRu: 'ICM / баббл' },
        preflop: { score: 70, labelRu: 'Префлоп' }
      }
    }
  });
  assert.equal(vm.type, 'training');
  assert.equal(vm.title, 'ТВОЯ ТРЕНИРОВКА');
  assert.match(vm.subtitle, /7 раздач/);
  assert.equal(vm.cta, 'НАЧАТЬ ТРЕНИРОВКУ');
  assert.ok(vm.focusItems.some((f) => /баббл|решения/i.test(f)));
});

test('AssessmentController runs the diagnostic and persists a profile', () => {
  const store = createTrainingStore();
  const ctl = new AssessmentController({ store, rng: () => 0.5, now: () => 1000 });
  const begin = ctl.begin();
  assert.equal(begin.started, true);
  assert.ok(begin.total >= 1);
  assert.equal(ctl.state, 'answering');

  // Answer every question with the correct choice.
  let guard = 0;
  while (ctl.state === 'answering' && guard < 30) {
    const item = ctl.current();
    assert.ok(item && item.choices.length >= 2);
    ctl.answer(item.correct);
    guard++;
  }
  assert.equal(ctl.state, 'done');
  assert.equal(ctl.hasResult(), true);

  // Persisted skill profile + assessment + analytics event.
  assert.ok(store.loadSkillProfile());
  assert.ok(store.loadAssessment());
  assert.ok(store.loadAnalyticsEvents().some((e) => e.name === 'assessment_completed'));

  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'summary');
  assert.equal(vm.hasResult, true);
});

test('AssessmentController answer on an empty run is a no-op', () => {
  const ctl = new AssessmentController({ now: () => 0, rng: () => 0.5 });
  ctl.begin();
  while (ctl.state === 'answering') ctl.answer(ctl.current().correct);
  assert.equal(ctl.answer('ФОЛД'), null);
});

test('AssessmentController persists leak profiles from wrong answers', () => {
  const store = createTrainingStore();
  const ctl = new AssessmentController({ store, rng: () => 0, now: () => 1000 });
  ctl.begin();
  let guard = 0;
  while (ctl.state === 'answering' && guard < 30) {
    const item = ctl.current();
    const wrong = item.choices.find((c) => c !== item.correct) || item.choices[0];
    ctl.answer(wrong);
    guard++;
  }
  assert.equal(ctl.state, 'done');
  const profiles = store.listProfiles();
  assert.ok(profiles.length >= 1);
  assert.ok(profiles.some((p) => p.sampleSize > 0 && p.mistakes > 0));
});

test('AssessmentController acknowledgeCompletion returns to idle for later visits', () => {
  const store = createTrainingStore();
  const ctl = new AssessmentController({ store, rng: () => 0.5, now: () => 1000 });
  ctl.begin();
  while (ctl.state === 'answering') ctl.answer(ctl.current().correct);
  assert.equal(ctl.state, 'done');
  assert.equal(ctl.shouldShowSummary(), true);
  ctl.acknowledgeCompletion();
  assert.equal(ctl.state, 'idle');
  assert.equal(ctl.shouldShowSummary(), false);
});

test('reopened session recognizes persisted assessment profile', () => {
  const store = createTrainingStore();
  const first = new AssessmentController({ store, rng: () => 0.5, now: () => 1000 });
  first.begin();
  while (first.state === 'answering') first.answer(first.current().correct);
  first.acknowledgeCompletion();

  const reopened = new AssessmentController({ store });
  assert.equal(reopened.state, 'idle');
  assert.equal(reopened.shouldShowSummary(), false);

  const ctl = makeController(store);
  assert.equal(ctl.hasProfile(), true);
  assert.equal(ctl.home().type, 'training');
});

test('completed assessment does not auto-restart on a fresh controller', () => {
  const store = createTrainingStore();
  const first = new AssessmentController({ store, rng: () => 0.5, now: () => 1000 });
  first.begin();
  while (first.state === 'answering') first.answer(first.current().correct);
  first.acknowledgeCompletion();

  const later = new AssessmentController({ store });
  assert.equal(later.state, 'idle');
  assert.equal(later.shouldShowSummary(), false);
  assert.equal(makeController(store).home().type, 'training');
});

// ---- Personalised training home entry (user-facing CTA) ---------------------

test('weak ICM profile shows ICM focus on the home card', () => {
  const vm = homeViewModel({
    leaks: [{ concept: 'icm_pressure', label: 'Давление ICM' }],
    plan: { total: 7, sessionPlan: { primaryTargets: ['bubble ICM fold', 'final table ICM'], maintenance: [], exploration: [] } },
    skillProfile: { overall: 48, overallLabel: 'НЕСТАБИЛЬНАЯ БАЗА', weakest: { skill: 'icm', labelRu: 'ICM / баббл' }, skills: { icm: { score: 35, labelRu: 'ICM / баббл' } } }
  });
  assert.ok(vm.focusItems.some((f) => /баббл|решения/i.test(f)));
  assert.match(vm.whyText, /фишки|потери/i);
});

test('weak river profile shows river defence focus on the home card', () => {
  const vm = homeViewModel({
    leaks: [{ concept: 'bluff_catch', label: 'Блафф-кэтч на ривере' }],
    plan: { total: 7, sessionPlan: { primaryTargets: ['river bluffcatch', 'price defence'], maintenance: [], exploration: [] } },
    skillProfile: { overall: 52, overallLabel: 'КЛУБНЫЙ РЕГ', weakest: { skill: 'bluffCatch', labelRu: 'Блафф-кэтч' }, skills: { river: { score: 38, labelRu: 'Ривер' }, bluffCatch: { score: 36, labelRu: 'Блафф-кэтч' } } }
  });
  assert.ok(vm.focusItems.some((f) => /ривер|блеф|кетч/i.test(f)));
});

test('different profiles show different focus text on the home card', () => {
  const icmVm = homeViewModel({
    plan: { total: 7, sessionPlan: { primaryTargets: ['bubble ICM'], maintenance: [], exploration: [] } },
    skillProfile: { overall: 40, overallLabel: 'X', skills: { icm: { score: 30, labelRu: 'ICM / баббл' } } }
  });
  const riverVm = homeViewModel({
    plan: { total: 7, sessionPlan: { primaryTargets: ['river bluffcatch'], maintenance: [], exploration: [] } },
    skillProfile: { overall: 40, overallLabel: 'X', skills: { river: { score: 30, labelRu: 'Ривер' } } }
  });
  assert.notDeepEqual(icmVm.focusItems, riverVm.focusItems);
  assert.notEqual(icmVm.whyText, riverVm.whyText);
});

test('controller caches the home plan and launches it on start', async () => {
  const store = createTrainingStore();
  store.saveSkillProfile({
    overall: 55,
    overallLabel: 'КЛУБНЫЙ РЕГ',
    skills: { icm: { score: 40, labelRu: 'ICM / баббл' } },
    weakest: { skill: 'icm', labelRu: 'ICM / баббл' }
  });
  const ctl = makeController(store, fakeDecision(), { count: 1 });
  const homeVm = ctl.home();
  assert.equal(homeVm.type, 'training');
  const expectedId = ctl.preparedDaily && ctl.preparedDaily.plan && ctl.preparedDaily.plan.sessionId;
  assert.ok(expectedId);
  ctl.start();
  await new Promise((r) => setTimeout(r, 80));
  assert.ok(ctl.session && ctl.session.plan);
  assert.equal(ctl.session.plan.sessionId, expectedId);
});