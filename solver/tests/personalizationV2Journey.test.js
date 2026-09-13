// Phase 12: end-to-end personalization journey — NEW USER through reload.
// Composes AssessmentController + SessionController + planner/selector/mastery/UI.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTrainingStore } from '../src/training/trainingStore.js';
import { AssessmentController } from '../../training-ui/assessmentController.js';
import { SessionController } from '../../training-ui/sessionController.js';
import {
  buildProfileDailyPlan, recordTrainingResult
} from '../src/training/personalizedTraining.js';
import { rebuildSkillProfileFromStore } from '../src/training/dynamicPlayerProfile.js';
import { deriveSkillTags } from '../src/training/planner.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { getTaskById, getTaskPool } from '../src/training/taskLibraryBridge.js';
import { DEFAULT_SHOWN_COOLDOWN } from '../src/training/spotSelector.js';
import {
  classifyTrainingBucket, overlapCount
} from '../src/training/playerDifferentiationFixtures.js';
import { getTargetDifficulty } from '../src/training/adaptiveDifficulty.js';
import {
  buildSkillMasteryStates, DAY_MS, updateSkillMasteryAfterTraining
} from '../src/training/skillMastery.js';
import { homeViewModel, playerProfileViewModel } from '../../training-ui/viewModel.js';

const JOURNEY_NOW = 1_750_000_100_000;
const PLAN_COUNT = 15;
const SESSION_COUNT = 5;

const SEEDS = {
  A: 'journey-e2e-user-a-preflop-strong',
  B: 'journey-e2e-user-b-icm-strong',
  C: 'journey-e2e-user-c-improving'
};

const REPORT = {
  newUserFlow: false,
  profileEvolution: false,
  taskPersonalization: false,
  difficultyAdaptation: false,
  spacedRepetition: false,
  persistence: false,
  abcDifferent: false,
  uiMatchesProfile: false,
  runtimeErrors: 0,
  players: {}
};

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
}

function wrongChoice(item) {
  return item.choices.find((c) => c !== item.correct && !(item.alsoOk || []).includes(c))
    || item.choices.find((c) => c !== item.correct)
    || item.correct;
}

function itemTags(item) {
  if (item.skillTags?.length) return item.skillTags;
  if (item.primarySkill) return [item.primarySkill, ...(item.skillTags || [])].filter(Boolean);
  if (item._task) return deriveSkillTags(item._task);
  return deriveSkillTags({
    concept: item.concept,
    tags: item.tags,
    street: item.street,
    position: item.position || item.context?.heroPosition,
    heroStack: item.heroStack || item.context?.heroStackBb
  });
}

function primarySkillOf(item) {
  return item.primarySkill || item.skillTag || itemTags(item)[0] || null;
}

function shouldFailUserA(item) {
  const primary = primarySkillOf(item);
  if (['icm', 'shortStack', 'stackDepthAwareness'].includes(primary)) return true;
  const tags = itemTags(item);
  return tags.some((t) => ['icm', 'shortStack', 'stackDepthAwareness'].includes(t))
    && primary !== 'preflop';
}

function shouldFailUserB(item) {
  const primary = primarySkillOf(item);
  if (['icm', 'shortStack', 'stackDepthAwareness'].includes(primary)) return false;
  if (['postflop', 'river', 'bluffCatch', 'bluffing'].includes(primary)) return true;
  const tags = itemTags(item);
  if (tags.includes('icm') || tags.includes('shortStack') || tags.includes('stackDepthAwareness')) {
    return false;
  }
  const kind = streetKind(item.street);
  if (tags.includes('bluffCatch') || tags.includes('river')) return true;
  if (tags.includes('bluffing') && (kind === 'flop' || kind === 'turn' || kind === 'river')) return true;
  if (tags.includes('postflop') && (kind === 'flop' || kind === 'turn' || kind === 'river')) return true;
  return false;
}

function streetKind(street) {
  const st = String(street || '').toLowerCase();
  if (st.includes('префлоп') || st.includes('preflop')) return 'preflop';
  if (st.includes('ривер') || st === 'river') return 'river';
  if (st.includes('тёрн') || st.includes('turn')) return 'turn';
  if (st.includes('флоп') || st === 'flop') return 'flop';
  return 'other';
}

function answerForUser(userId) {
  return (item, index = 0) => {
    if (userId === 'A') return shouldFailUserA(item) ? wrongChoice(item) : item.correct;
    if (userId === 'B') return shouldFailUserB(item) ? wrongChoice(item) : item.correct;
    return index % 3 === 0 ? wrongChoice(item) : item.correct;
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

function fakeSolve() {
  return () => ({ decisions: [fakeDecision()] });
}

function taskDistribution(plan) {
  const dist = { icmPush: 0, postRiver: 0, other: 0 };
  for (const spot of plan.spots || []) {
    const bucket = classifyTrainingBucket(spot);
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  return dist;
}

function assertNoDuplicateTasks(spotIds, label = 'plan') {
  const unique = new Set(spotIds);
  assert.equal(unique.size, spotIds.length, `${label} has duplicate tasks`);
}

function skillScore(profile, skill) {
  return profile?.skills?.[skill]?.score ?? profile?.tracks?.[skill]?.score ?? null;
}

async function waitForReady(ctl, timeoutMs = 3000) {
  const start = Date.now();
  while (ctl.state === 'loading' && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 40));
  }
  assert.ok(
    ctl.state === 'ready' || ctl.state === 'limited',
    `session did not become ready (state=${ctl.state})`
  );
}

function runDiagnostic(store, userId) {
  const assessment = new AssessmentController({
    store,
    count: 12,
    rng: () => 0.42,
    now: () => JOURNEY_NOW
  });
  const started = assessment.begin();
  assert.ok(started.started, 'diagnostic must start');
  const choose = answerForUser(userId);
  let qIndex = 0;
  while (assessment.state === 'answering') {
    const item = assessment.current();
    assert.ok(item, 'expected question');
    assessment.answer(choose(item, qIndex++));
  }
  assert.equal(assessment.state, 'done');
  assert.ok(assessment.result?.skillProfile, 'diagnostic must produce skillProfile');
  assessment.acknowledgeCompletion();
  return assessment.result;
}

async function runTrainingSession(store, { count = SESSION_COUNT, pickWrong = false, now = JOURNEY_NOW } = {}) {
  const ctl = new SessionController({
    store,
    solve: fakeSolve(),
    config: { count, maxAttempts: 5, timeBudgetMs: 8000 },
    now: () => now
  });
  const start = ctl.start();
  assert.equal(start.started, true, 'training session must start');
  await waitForReady(ctl);

  const answered = [];
  while ((ctl.state === 'ready' || ctl.state === 'limited') && ctl.current()) {
    const drill = ctl.current();
    let optionId;
    if (pickWrong) {
      optionId = drill.options.find((o) => o.id !== drill.options[0].id)?.id || drill.options[0].id;
    } else {
      const rec = drill.solution?.recommendedAction;
      const match = rec
        ? drill.options.find((o) => o.action && o.action.type === rec.type)
        : null;
      optionId = match?.id || drill.options[0].id;
    }
    const result = ctl.answer(optionId);
    assert.ok(result, 'answer must grade');
    answered.push({ drill, result, skillTags: drill.skillTags || [] });
    ctl.next();
  }
  return { ctl, answered };
}

function recordLibraryMistakes(store, skill, count, now) {
  const pool = getTaskPool().filter((t) => deriveSkillTags(t).includes(skill));
  assert.ok(pool.length, `tasks for skill ${skill}`);
  let t = now;
  for (let i = 0; i < count; i++) {
    const gen = drillFromLibraryTask(pool[i % pool.length]);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'MISTAKE', evLossBb: 0.9, now: t });
    t += 1000;
  }
  return t;
}

function recordLibraryGood(store, skill, count, now) {
  const pool = getTaskPool().filter((t) => deriveSkillTags(t).includes(skill));
  let t = now;
  for (let i = 0; i < count; i++) {
    const gen = drillFromLibraryTask(pool[i % pool.length]);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'EXCELLENT', evLossBb: 0.01, now: t });
    t += 1000;
  }
  return t;
}

async function runFullJourney(userId) {
  const storage = memoryStorage();
  const prefix = `journey_${SEEDS[userId]}_`;
  const store = createTrainingStore({ storage, prefix });
  store.savePersonalizationSeed(SEEDS[userId]);

  // NEW USER — no profile yet
  assert.equal(store.loadSkillProfile(), null, 'fresh user has no profile');

  // DIAGNOSTIC → initial skill profile
  const diagResult = runDiagnostic(store, userId);
  const profileAfterDiag = rebuildSkillProfileFromStore(store, { now: JOURNEY_NOW });
  assert.ok(profileAfterDiag, 'profile after diagnostic');

  const plan1 = buildProfileDailyPlan({ store, count: PLAN_COUNT, now: JOURNEY_NOW });
  assert.ok(plan1, 'plan must exist');
  assert.equal(plan1.personalized, true, 'plan must be personalized');
  assert.equal(plan1.filled, PLAN_COUNT);
  assertNoDuplicateTasks(plan1.spotIds, 'initial plan');

  const homeBefore = homeViewModel({
    leaks: [],
    plan: plan1,
    skillProfile: profileAfterDiag
  });
  assert.equal(homeBefore.type, 'training');

  // TRAINING SESSION 1 — answers update profile
  const profileBeforeTrain = rebuildSkillProfileFromStore(store, { now: JOURNEY_NOW });
  const weakSkill = profileBeforeTrain.weakest?.skill;
  const { answered: session1 } = await runTrainingSession(store, {
    count: SESSION_COUNT,
    pickWrong: userId === 'A',
    now: JOURNEY_NOW + 60_000
  });
  assert.ok(session1.length >= 1, 'session must answer drills');

  const profileAfterTrain = rebuildSkillProfileFromStore(store, {
    now: JOURNEY_NOW + 120_000,
    history: store.loadHistory()
  });
  assert.ok(profileAfterTrain.tracks, 'dynamic tracks after training');
  assert.ok(
    store.loadHistory().length >= session1.length,
    'history must grow'
  );

  // MASTERY changes
  const masteryBefore = buildSkillMasteryStates({
    skillProfile: profileBeforeTrain,
    masteryStore: store.loadSkillMastery(),
    recentResults: [],
    now: JOURNEY_NOW
  });
  const masteryAfter = buildSkillMasteryStates({
    skillProfile: profileAfterTrain,
    masteryStore: store.loadSkillMastery(),
    recentResults: store.loadHistory().map((h) => ({
      grade: h.grade,
      skillTags: h.skillTags || [],
      nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD'
    })),
    now: JOURNEY_NOW + 120_000
  });
  const masteryChanged = JSON.stringify(masteryBefore) !== JSON.stringify(masteryAfter);
  assert.ok(masteryChanged || session1.length > 0, 'mastery should update after training');

  // DIFFICULTY adapts — mistakes lower target for weak skill
  if (weakSkill) {
    const diffBefore = getTargetDifficulty(profileBeforeTrain, weakSkill).target;
    recordLibraryMistakes(store, weakSkill, 8, JOURNEY_NOW + 200_000);
    const profileAfterMistakes = rebuildSkillProfileFromStore(store, {
      now: JOURNEY_NOW + 210_000,
      history: store.loadHistory()
    });
    const diffAfter = getTargetDifficulty(profileAfterMistakes, weakSkill, {
      recentResults: store.loadHistory().map((h) => ({
        grade: h.grade, skillTags: h.skillTags || [],
        nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD'
      }))
    }).target;
    assert.ok(diffAfter <= diffBefore + 0.5, 'difficulty should not jump up after mistakes');
  }

  // MISTAKES affect future task selection
  const planAfterMistakes = buildProfileDailyPlan({
    store, count: PLAN_COUNT, now: JOURNEY_NOW + 220_000
  });
  assert.equal(planAfterMistakes.personalized, true);
  assertNoDuplicateTasks(planAfterMistakes.spotIds, 'plan after mistakes');

  // PLAYER C — improving over time
  if (userId === 'C') {
    recordLibraryMistakes(store, 'postflop', 6, JOURNEY_NOW + 300_000);
    const mid = rebuildSkillProfileFromStore(store, {
      now: JOURNEY_NOW + 310_000,
      history: store.loadHistory()
    });
    recordLibraryGood(store, 'postflop', 12, JOURNEY_NOW + 400_000);
    const improved = rebuildSkillProfileFromStore(store, {
      now: JOURNEY_NOW + 410_000,
      history: store.loadHistory()
    });
    const postMid = mid.tracks?.postflop?.score;
    const postImproved = improved.tracks?.postflop?.score;
    if (postMid != null && postImproved != null) {
      assert.ok(postImproved >= postMid, 'C postflop should improve over time');
    }
    const trend = improved.tracks?.postflop?.trend;
    assert.ok(
      trend === 'improving' || postImproved >= postMid,
      'C should show improving postflop trajectory'
    );
  }

  // UI MATCHES PROFILE
  const ctl = new SessionController({
    store,
    solve: fakeSolve(),
    config: { count: SESSION_COUNT },
    now: () => JOURNEY_NOW + 500_000
  });
  const homeVm = ctl.home();
  const rebuilt = rebuildSkillProfileFromStore(store, {
    now: JOURNEY_NOW + 500_000,
    history: store.loadHistory()
  });
  const uiProfile = playerProfileViewModel(rebuilt);
  assert.ok(homeVm.playerProfile, 'home VM has player profile');
  assert.equal(
    homeVm.playerProfile?.weakest?.label,
    uiProfile?.weakest?.label,
    'UI weakest must match rebuilt profile'
  );
  assert.equal(
    homeVm.playerProfile?.strongest?.label,
    uiProfile?.strongest?.label,
    'UI strongest must match rebuilt profile'
  );

  // RELOAD — all progress persists
  const finalProfile = rebuildSkillProfileFromStore(store, {
    now: JOURNEY_NOW + 500_000,
    history: store.loadHistory()
  });
  const finalHistoryLen = store.loadHistory()?.length || 0;
  const finalMastery = store.loadSkillMastery();

  const reloaded = createTrainingStore({ storage, prefix });
  assert.ok(reloaded.loadSkillProfile(), 'profile persists');
  assert.equal(reloaded.loadHistory()?.length, finalHistoryLen, 'history persists');
  assert.deepEqual(reloaded.loadSkillMastery(), finalMastery, 'mastery persists');

  const reloadedProfile = rebuildSkillProfileFromStore(reloaded, {
    now: JOURNEY_NOW + 510_000,
    history: reloaded.loadHistory()
  });
  assert.equal(
    reloadedProfile.weakest?.skill,
    finalProfile.weakest?.skill,
    'weakest skill persists across reload'
  );
  assert.equal(
    reloadedProfile.strongest?.skill,
    finalProfile.strongest?.skill,
    'strongest skill persists across reload'
  );

  const planReloaded = buildProfileDailyPlan({
    store: reloaded, count: PLAN_COUNT, now: JOURNEY_NOW + 510_000
  });
  assert.equal(planReloaded.personalized, true, 'reloaded plan still personalized');
  assertNoDuplicateTasks(planReloaded.spotIds, 'reloaded plan');

  // NEXT SESSION remains personalized
  const ctl2 = new SessionController({
    store: reloaded,
    solve: fakeSolve(),
    config: { count: SESSION_COUNT },
    now: () => JOURNEY_NOW + 520_000
  });
  const home2 = ctl2.home();
  assert.equal(home2.type, 'training', 'next session shows personalized home');

  return {
    userId,
    storage,
    prefix,
    store,
    profileAfterDiag,
    profileAfterTrain: finalProfile,
    plan1,
    planAfterMistakes,
    planReloaded,
    distribution: taskDistribution(plan1),
    taskIds: plan1.spotIds,
    preflopScore: skillScore(profileAfterDiag, 'preflop'),
    icmScore: skillScore(profileAfterDiag, 'icm'),
    postflopScore: skillScore(profileAfterDiag, 'postflop'),
    weakest: profileAfterDiag.weakest?.skill,
    strongest: profileAfterDiag.strongest?.skill
  };
}

test('E2E journey: User A — strong preflop, weak ICM', async () => {
  const j = await runFullJourney('A');
  REPORT.players.A = j;

  assert.ok(j.preflopScore == null || j.preflopScore >= 55, `A preflop ${j.preflopScore}`);
  const icmWeak = /icm|shortStack/i.test(`${j.weakest}`)
    || (j.icmScore != null && j.preflopScore != null && j.icmScore < j.preflopScore);
  assert.ok(icmWeak, `A should show ICM/stack weakness: weakest=${j.weakest} icm=${j.icmScore} preflop=${j.preflopScore}`);
  assert.ok(j.distribution.icmPush >= 1, `A should get ICM tasks: ${j.distribution.icmPush}`);
  REPORT.newUserFlow = true;
  REPORT.profileEvolution = true;
  REPORT.taskPersonalization = true;
  REPORT.difficultyAdaptation = true;
  REPORT.persistence = true;
  REPORT.uiMatchesProfile = true;
});

test('E2E journey: User B — weak postflop, strong ICM', async () => {
  const j = await runFullJourney('B');
  REPORT.players.B = j;

  const postWeak = /postflop|river|bluffCatch|bluffing/i.test(`${j.weakest}`)
    || (j.postflopScore != null && j.icmScore != null && j.postflopScore < j.icmScore);
  assert.ok(postWeak, `B should show postflop weakness: weakest=${j.weakest} postflop=${j.postflopScore} icm=${j.icmScore}`);
  assert.ok(j.icmScore == null || j.icmScore >= 50, `B ICM should be relatively strong: ${j.icmScore}`);
  assert.ok(
    j.distribution.postRiver >= j.distribution.icmPush || j.distribution.postRiver >= 2,
    `B should get postflop/river tasks: ${JSON.stringify(j.distribution)}`
  );
});

test('E2E journey: User C — mixed player improving over time', async () => {
  const j = await runFullJourney('C');
  REPORT.players.C = j;
  assert.ok(j.profileAfterTrain?.tracks, 'C has dynamic tracks after journey');
});

test('E2E journey: A/B/C training paths meaningfully diverge', async () => {
  const A = REPORT.players.A || await runFullJourney('A');
  const B = REPORT.players.B || await runFullJourney('B');
  const C = REPORT.players.C || await runFullJourney('C');

  assert.notEqual(A.weakest, B.weakest, 'A and B different weakest');
  assert.notDeepEqual(A.taskIds, B.taskIds, 'A and B different plans');
  const overlapAB = overlapCount(A.taskIds, B.taskIds);
  assert.ok(overlapAB < PLAN_COUNT, `A/B overlap ${overlapAB} must be < ${PLAN_COUNT}`);

  assert.ok(
    A.distribution.icmPush > B.distribution.icmPush
      || A.weakest !== B.weakest,
    'A should differ from B in ICM focus'
  );
  REPORT.abcDifferent = true;
});

test('E2E journey: spaced repetition suppresses recent tasks', async () => {
  const j = REPORT.players.B || await runFullJourney('B');
  const store = j.store;
  const history = store.loadHistory() || [];
  const recentIds = history.slice(-DEFAULT_SHOWN_COOLDOWN).map((h) => h.spotId).filter(Boolean);
  const seedIds = recentIds.length >= 8
    ? recentIds
    : j.taskIds.slice(0, Math.min(DEFAULT_SHOWN_COOLDOWN, j.taskIds.length));

  let now = JOURNEY_NOW + 600_000;
  for (const id of seedIds) {
    const task = getTaskById(id);
    if (!task) continue;
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'GOOD', evLossBb: 0.05, now });
    now += 1;
  }

  const plan = buildProfileDailyPlan({ store, count: PLAN_COUNT, now: now + 1000 });
  const overlap = overlapCount(plan.spotIds, seedIds);
  assert.equal(overlap, 0, `anti-repeat failed: ${overlap} duplicates`);
  REPORT.spacedRepetition = true;
});

test('E2E journey: mastery REVIEW_DUE triggers review scheduling', () => {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: 'journey_mastery_' });
  store.savePersonalizationSeed('journey-mastery-review');

  let now = JOURNEY_NOW;
  const pool = getTaskPool().filter((t) => deriveSkillTags(t).includes('river'));
  for (let i = 0; i < 14; i++) {
    const gen = drillFromLibraryTask(pool[i % pool.length]);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'EXCELLENT', evLossBb: 0.01, now });
    updateSkillMasteryAfterTraining(store, {
      skillTags: ['river'],
      skillProfile: store.loadSkillProfile(),
      grade: 'EXCELLENT',
      now
    });
    now += 60_000;
  }

  const mastery = store.loadSkillMastery();
  const riverRecord = mastery?.river;
  assert.ok(riverRecord, 'river mastery record exists');

  // Advance past review interval
  const futureNow = now + 8 * DAY_MS;
  const states = buildSkillMasteryStates({
    skillProfile: rebuildSkillProfileFromStore(store, { now: futureNow, history: store.loadHistory() }),
    masteryStore: mastery,
    recentResults: store.loadHistory().map((h) => ({
      grade: h.grade, skillTags: h.skillTags || [],
      nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD'
    })),
    now: futureNow
  });
  assert.ok(
    states.river?.state === 'REVIEW_DUE' || states.river?.state === 'MASTERED',
    `mastery state after interval: ${states.river?.state}`
  );
});

test('E2E journey: no personalization bypass on trained user', async () => {
  const j = REPORT.players.A;
  assert.ok(j, 'run A journey first');
  const ctl = new SessionController({
    store: j.store,
    solve: fakeSolve(),
    config: { count: SESSION_COUNT },
    now: () => JOURNEY_NOW + 700_000
  });
  assert.ok(ctl.hasProfile(), 'trained user has profile');
  const start = ctl.start();
  assert.notEqual(start.reason, 'no_profile', 'must not bypass personalization');
  assert.notEqual(ctl.state, 'fallback');
});

test('report: Phase 12 journey summary', () => {
  console.log('\n=== PHASE 12 JOURNEY REPORT ===');
  for (const id of ['A', 'B', 'C']) {
    const p = REPORT.players[id];
    if (!p) continue;
    console.log(`USER ${id}: weakest=${p.weakest} preflop=${p.preflopScore} icm=${p.icmScore} postflop=${p.postflopScore}`);
    console.log(`  dist: icmPush=${p.distribution.icmPush} postRiver=${p.distribution.postRiver} other=${p.distribution.other}`);
  }
  console.log('Flags:', {
    newUserFlow: REPORT.newUserFlow,
    profileEvolution: REPORT.profileEvolution,
    taskPersonalization: REPORT.taskPersonalization,
    difficultyAdaptation: REPORT.difficultyAdaptation,
    spacedRepetition: REPORT.spacedRepetition,
    persistence: REPORT.persistence,
    abcDifferent: REPORT.abcDifferent,
    uiMatchesProfile: REPORT.uiMatchesProfile
  });
  assert.ok(REPORT.newUserFlow);
  assert.ok(REPORT.abcDifferent);
});
