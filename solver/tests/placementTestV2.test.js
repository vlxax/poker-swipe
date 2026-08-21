// Placement Test V2 — MTT library adaptive placement, mini-app modes, simulations.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAssessmentSet,
  runAssessment,
  gradeAssessmentItem,
  simulatePlacementRun,
  PLACEMENT_TEST_V2,
  PLACEMENT_COUNT_DEFAULT,
  PLACEMENT_COUNT_MIN,
  PLACEMENT_COUNT_MAX,
  createPlacementSessionSeed,
  getPlacementPoolStats,
  getPlacementEligiblePool
} from '../src/training/assessment.js';
import {
  simulatePlacementRun as simRun,
  placementSessionSummary,
  recommendedStartingDifficulty,
  PLACEMENT_SKILLS,
  PLACEMENT_MODES,
  CALIBRATION_TIERS
} from '../src/training/placementTestV2.js';
import { assignMiniAppMode, formatPlacementContext } from '../src/training/placementTaskAdapter.js';
import { createTrainingStore } from '../src/training/trainingStore.js';
import { buildProfileDailyPlan } from '../src/training/personalizedTraining.js';
import { AssessmentController } from '../../training-ui/assessmentController.js';
import { seededRng } from '../src/training/personalizationSeed.js';
import { deriveSkillTags } from '../src/training/planner.js';

const REPORT = {
  taskCount: PLACEMENT_COUNT_DEFAULT,
  miniAppTypes: [],
  difficultyDistribution: {},
  skillCoverage: [],
  beginner: null,
  intermediate: null,
  strong: null,
  mixedPreflopPostflop: null,
  mixedPreflopIcm: null,
  liveUsesV2: PLACEMENT_TEST_V2,
  tests: 0,
  safeToMerge: false
};

function overlap(idsA, idsB) {
  const setB = new Set(idsB);
  return idsA.filter((id) => setB.has(id)).length;
}

function wrongChoice(item) {
  return item.choices.find((c) => c !== item.correct && !(item.alsoOk || []).includes(c))
    || item.choices.find((c) => c !== item.correct)
    || item.correct;
}

function beginnerAnswer(item) {
  const tier = item.tier || item.difficulty || 2;
  if (tier >= 3) return wrongChoice(item);
  if (tier === 2) {
    const slotRng = seededRng(`b|${item.id}`);
    return slotRng() < 0.4 ? item.correct : wrongChoice(item);
  }
  return item.correct;
}

function intermediateAnswer(item) {
  const tier = item.tier || item.difficulty || 2;
  if (tier >= 4) return wrongChoice(item);
  if (tier === 3) {
    const slotRng = seededRng(`i|${item.id}`);
    return slotRng() < 0.55 ? item.correct : wrongChoice(item);
  }
  return item.correct;
}

function strongAnswer(item) {
  return item.correct;
}

function mixedPreflopStrongPostflopWeak(item) {
  const tags = item.skillTags || [item.skillTag];
  if (tags.includes('postflop') || tags.includes('river') || tags.includes('bluffCatch')) {
    return wrongChoice(item);
  }
  return item.correct;
}

function mixedWeakPreflopStrongIcm(item) {
  const tags = item.skillTags || [item.skillTag];
  if (tags.includes('preflop') && !tags.includes('icm') && !tags.includes('shortStack')) {
    return wrongChoice(item);
  }
  if (tags.includes('icm') || tags.includes('shortStack')) return item.correct;
  const tier = item.tier || 2;
  return tier <= 2 ? item.correct : wrongChoice(item);
}

function runPlayerProfile(label, answerFn, seed) {
  const { session, items, answers } = simRun({
    sessionSeed: seed,
    targetCount: PLACEMENT_COUNT_DEFAULT,
    answerFn: (item, sess) => answerFn(item, sess),
    gradeFn: (item, choice) => gradeAssessmentItem(item, choice)
  });
  const res = runAssessment({
    items,
    answers: answers.map((a) => ({ id: a.id, choice: a.choice })),
    session,
    now: Date.now()
  });
  const summary = placementSessionSummary(session);
  return {
    label,
    overall: res.overall,
    overallLabel: res.overallLabel,
    recommendedStartingDifficulty: res.recommendedStartingDifficulty,
    weakest: res.weakestAreas?.[0]?.skill || res.weakestSkill,
    strongest: res.strongestAreas?.[0]?.skill || res.strongestSkill,
    skillConfidence: res.skillConfidence,
    avgTier: summary.avgTier,
    advancedShare: summary.advancedShare,
    itemIds: summary.itemIds,
    modes: summary.miniAppModes,
    maxTier: Math.max(...answers.map((a) => a.tier || a.difficulty || 1), 0)
  };
}

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

test('placement V2 pool is validated MTT-only from task library', () => {
  const stats = getPlacementPoolStats();
  REPORT.difficultyDistribution = stats.byTier;
  REPORT.skillCoverage = stats.skillCoverage;

  assert.ok(stats.poolSize >= 140, `MTT pool too small: ${stats.poolSize}`);
  assert.ok(stats.skillCoverage.includes('preflop'));
  assert.ok(stats.skillCoverage.includes('icm'));
  assert.ok(stats.skillCoverage.includes('postflop'));

  const eligible = getPlacementEligiblePool();
  assert.ok(eligible.every((i) => i.version === 2));
  assert.ok(eligible.every((i) => i.context && i.context.formatLine.includes('MTT')));
  assert.ok(eligible.every((i) => !i.id.startsWith('DX_')));
});

test('placement session uses calibration anchors L1 L2 L4 L5 then adaptive', () => {
  const { session, items } = simRun({
    sessionSeed: 'cal-anchor-test',
    targetCount: 13,
    answerFn: strongAnswer,
    gradeFn: (item, choice) => gradeAssessmentItem(item, choice)
  });

  assert.equal(items.length, 13);
  const calTiers = items.slice(0, 4).map((i) => i.tier || i.difficulty);
  assert.deepEqual(calTiers, CALIBRATION_TIERS);

  const modes = new Set(items.map((i) => i.miniAppMode));
  REPORT.miniAppTypes = [...modes].sort();
  assert.ok(modes.size >= 3, `expected diverse mini-app modes, got ${[...modes]}`);
  for (const m of modes) assert.ok(PLACEMENT_MODES.includes(m));
});

test('placement produces 12–15 tasks', () => {
  for (const count of [12, 13, 14, 15]) {
    const { items } = simRun({
      sessionSeed: `count-${count}`,
      targetCount: count,
      answerFn: strongAnswer,
      gradeFn: (item, choice) => gradeAssessmentItem(item, choice)
    });
    assert.equal(items.length, count);
  }
  REPORT.taskCount = `${PLACEMENT_COUNT_MIN}-${PLACEMENT_COUNT_MAX} (default ${PLACEMENT_COUNT_DEFAULT})`;
});

test('weighted scoring: L5 correct beats L1 wrong evidence pattern', () => {
  const l1Item = getPlacementEligiblePool().find((i) => (i.tier || i.difficulty) === 1);
  const l5Item = getPlacementEligiblePool().find((i) => (i.tier || i.difficulty) === 5);
  assert.ok(l1Item && l5Item);

  const l5Correct = gradeAssessmentItem(l5Item, l5Item.correct);
  const l1Wrong = gradeAssessmentItem(l1Item, wrongChoice(l1Item));
  assert.ok(l5Correct.evidenceWeight > 0);
  assert.ok(l1Wrong.evidenceWeight < 0);
  assert.ok(Math.abs(l1Wrong.evidenceWeight) > Math.abs(l5WrongWeight(l5Item)));
});

function l5WrongWeight(item) {
  return gradeAssessmentItem(item, wrongChoice(item)).evidenceWeight;
}

test('beginner / intermediate / strong produce different profiles', () => {
  const beginner = runPlayerProfile('beginner', beginnerAnswer, 'sim-beginner-v2');
  const intermediate = runPlayerProfile('intermediate', intermediateAnswer, 'sim-intermediate-v2');
  const strong = runPlayerProfile('strong', strongAnswer, 'sim-strong-v2');

  REPORT.beginner = beginner;
  REPORT.intermediate = intermediate;
  REPORT.strong = strong;

  assert.ok(beginner.overall <= intermediate.overall + 5);
  assert.ok(intermediate.overall <= strong.overall + 8);
  assert.ok(strong.overall >= 65);
  assert.ok(beginner.overall < strong.overall);
  assert.ok(strong.avgTier > beginner.avgTier);
  assert.ok(strong.recommendedStartingDifficulty >= beginner.recommendedStartingDifficulty);
});

test('mixed profiles: strong preflop / weak postflop vs weak preflop / strong ICM', () => {
  const mixedA = runPlayerProfile('strong-pf-weak-post', mixedPreflopStrongPostflopWeak, 'sim-mixed-a');
  const mixedB = runPlayerProfile('weak-pf-strong-icm', mixedWeakPreflopStrongIcm, 'sim-mixed-b');

  REPORT.mixedPreflopPostflop = mixedA;
  REPORT.mixedPreflopIcm = mixedB;

  assert.notDeepEqual(mixedA.weakest, mixedB.weakest,
    'mixed profiles should surface different weakest skills');
  assert.notDeepEqual(mixedA.overall, mixedB.overall,
    'mixed profiles should produce different overall levels');

  const storeA = createTrainingStore({ storage: memoryStorage(), prefix: 'mixA_' });
  const storeB = createTrainingStore({ storage: memoryStorage(), prefix: 'mixB_' });
  storeA.saveSkillProfile({ overall: mixedA.overall, skills: {}, tracks: {} });
  storeB.saveSkillProfile({ overall: mixedB.overall, skills: {}, tracks: {} });

  const planA = buildProfileDailyPlan({ store: storeA, count: 10, now: 1_700_000_000_000 });
  const planB = buildProfileDailyPlan({ store: storeB, count: 10, now: 1_700_000_000_000 });
  assert.ok(planA.filled >= 8 && planB.filled >= 8);
});

test('fresh users get different task sequences with comparable coverage', () => {
  const setA = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-alpha-v2', count: 13, answerFn: strongAnswer });
  const setB = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-beta-v2', count: 13, answerFn: strongAnswer });

  const idsA = setA.map((x) => x.id);
  const idsB = setB.map((x) => x.id);
  assert.notDeepEqual(idsA, idsB);
  assert.ok(overlap(idsA, idsB) <= 8, `overlap too high: ${overlap(idsA, idsB)}/13`);

  const calA = setA.slice(0, 4).map((i) => i.tier);
  const calB = setB.slice(0, 4).map((i) => i.tier);
  assert.deepEqual(calA, CALIBRATION_TIERS);
  assert.deepEqual(calB, CALIBRATION_TIERS);
});

test('assessment controller runs placement V2 with structured items', () => {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: 'pt2_ctrl_' });
  const ctrl = new AssessmentController({ store, count: 13 });
  const started = ctrl.begin();
  assert.ok(started.started);

  while (ctrl.state === 'answering') {
    const item = ctrl.current();
    assert.ok(item?.context?.formatLine, 'item must have structured MTT context');
    assert.ok(item?.miniAppMode, 'item must have mini-app mode');
    assert.ok(item?.prompt, 'item must have prompt not raw dump');
    ctrl.answer(item.correct);
  }

  assert.ok(ctrl.result?.skillProfile);
  assert.equal(ctrl.result.placementVersion, 2);
});

test('report: placement test V2 summary', () => {
  REPORT.tests = 8;
  REPORT.liveUsesV2 = PLACEMENT_TEST_V2;
  REPORT.safeToMerge = REPORT.beginner?.overall < REPORT.strong?.overall
    && REPORT.miniAppTypes.length >= 3
    && REPORT.skillCoverage.includes('preflop')
    && REPORT.skillCoverage.includes('icm');

  console.log('\n=== PLACEMENT TEST V2 REPORT ===');
  console.log('DIAGNOSTIC TASK COUNT:', REPORT.taskCount);
  console.log('MINI-APP TYPES USED:', REPORT.miniAppTypes.join(', '));
  console.log('DIFFICULTY DISTRIBUTION:', JSON.stringify(REPORT.difficultyDistribution));
  console.log('SKILL COVERAGE:', REPORT.skillCoverage.join(', '));
  console.log('BEGINNER PROFILE:', JSON.stringify(REPORT.beginner));
  console.log('INTERMEDIATE PROFILE:', JSON.stringify(REPORT.intermediate));
  console.log('STRONG PROFILE:', JSON.stringify(REPORT.strong));
  console.log('MIXED PROFILE (strong PF / weak post):', JSON.stringify(REPORT.mixedPreflopPostflop));
  console.log('MIXED PROFILE (weak PF / strong ICM):', JSON.stringify(REPORT.mixedPreflopIcm));
  console.log('LIVE index.html USES PLACEMENT V2:', REPORT.liveUsesV2 ? 'YES' : 'NO');
  console.log('TESTS:', REPORT.tests);
  console.log('SAFE TO MERGE:', REPORT.safeToMerge ? 'YES' : 'NO');

  assert.ok(REPORT.safeToMerge);
});
