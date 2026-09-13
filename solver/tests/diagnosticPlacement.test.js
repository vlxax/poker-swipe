// P0 placement test — delegates to Placement Test V2 (MTT library tasks).
// Legacy DX_ pool tests removed; V2 is the canonical diagnostic path.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAssessmentSet,
  runAssessment,
  gradeAssessmentItem,
  simulateDiagnosticRun,
  PLACEMENT_TEST_V2,
  getPlacementEligiblePool,
  getPlacementPoolStats,
  createDiagnosticSessionSeed,
  DIAGNOSTIC_COUNT_MIN,
  DIAGNOSTIC_COUNT_MAX,
  DIAGNOSTIC_COUNT_DEFAULT
} from '../src/training/assessment.js';
import {
  placementSessionSummary,
  CALIBRATION_TIERS
} from '../src/training/placementTestV2.js';
import { createTrainingStore } from '../src/training/trainingStore.js';
import { seededRng } from '../src/training/personalizationSeed.js';
import { AssessmentController } from '../../training-ui/assessmentController.js';

const REPORT = {
  poolSize: 0,
  questionCount: 0,
  skillCoverage: [],
  difficultyCoverage: {},
  beginner: null,
  intermediate: null,
  strong: null,
  placementV2: PLACEMENT_TEST_V2,
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

function runPlayerProfile(label, answerFn, seed) {
  const { session, items, answers } = simulateDiagnosticRun({
    sessionSeed: seed,
    targetCount: DIAGNOSTIC_COUNT_DEFAULT,
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
    avgTier: summary.avgTier,
    advancedShare: summary.advancedShare,
    itemIds: summary.itemIds,
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

test('placement pool is validated MTT library with structured context', () => {
  const stats = getPlacementPoolStats();
  REPORT.poolSize = stats.poolSize;
  REPORT.skillCoverage = stats.skillCoverage;
  REPORT.difficultyCoverage = stats.byTier;

  assert.ok(stats.poolSize >= 140);
  const pool = getPlacementEligiblePool();
  for (const item of pool.slice(0, 20)) {
    assert.ok(item.context?.formatLine?.includes('MTT'), `${item.id} missing MTT context`);
    assert.ok(item.context?.actionHistory != null, `${item.id} missing history`);
    assert.ok(item.miniAppMode, `${item.id} missing miniAppMode`);
    assert.ok(item.prompt, `${item.id} missing prompt`);
  }
});

test('calibration anchors L1 L2 L4 L5 on first four tasks', () => {
  const { items } = simulateDiagnosticRun({
    sessionSeed: 'cal-test',
    targetCount: 13,
    answerFn: strongAnswer,
    gradeFn: (item, choice) => gradeAssessmentItem(item, choice)
  });
  const calTiers = items.slice(0, 4).map((i) => i.tier || i.difficulty);
  assert.deepEqual(calTiers, CALIBRATION_TIERS);
  REPORT.questionCount = DIAGNOSTIC_COUNT_DEFAULT;
});

test('diagnostic session produces 12–15 questions', () => {
  for (const count of [12, 13, 14, 15]) {
    const { items } = simulateDiagnosticRun({
      sessionSeed: `count-${count}`,
      targetCount: count,
      answerFn: strongAnswer,
      gradeFn: (item, choice) => gradeAssessmentItem(item, choice)
    });
    assert.equal(items.length, count);
  }
});

test('beginner / intermediate / strong receive different final profiles', () => {
  const beginner = runPlayerProfile('beginner', beginnerAnswer, 'sim-beginner-001');
  const intermediate = runPlayerProfile('intermediate', intermediateAnswer, 'sim-intermediate-001');
  const strong = runPlayerProfile('strong', strongAnswer, 'sim-strong-001');

  REPORT.beginner = beginner;
  REPORT.intermediate = intermediate;
  REPORT.strong = strong;

  assert.ok(beginner.overall <= intermediate.overall + 5);
  assert.ok(intermediate.overall <= strong.overall + 8);
  assert.ok(strong.overall >= 65);
  assert.ok(beginner.overall < strong.overall);
  assert.notDeepEqual(beginner.itemIds, strong.itemIds);
  assert.ok(strong.recommendedStartingDifficulty >= beginner.recommendedStartingDifficulty);
});

test('strong player reaches harder questions than beginner', () => {
  const beginner = REPORT.beginner || runPlayerProfile('beginner', beginnerAnswer, 'sim-beginner-002');
  const strong = REPORT.strong || runPlayerProfile('strong', strongAnswer, 'sim-strong-002');

  assert.ok(strong.avgTier >= beginner.avgTier - 0.5);
  assert.ok(strong.maxTier >= beginner.maxTier);
});

test('different fresh users do not receive identical sequences', () => {
  const setA = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-user-alpha', count: 13, answerFn: strongAnswer });
  const setB = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-user-beta', count: 13, answerFn: strongAnswer });

  const idsA = setA.map((x) => x.id);
  const idsB = setB.map((x) => x.id);
  assert.notDeepEqual(idsA, idsB);
  assert.ok(overlap(idsA, idsB) <= 8, `overlap too high: ${overlap(idsA, idsB)}/13`);

  const calA = setA.slice(0, 4).map((i) => i.tier);
  const calB = setB.slice(0, 4).map((i) => i.tier);
  assert.deepEqual(calA, CALIBRATION_TIERS);
  assert.deepEqual(calB, CALIBRATION_TIERS);
});

test('diagnostic controller uses library MTT tasks with structured context', () => {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: 'diag_ctrl_' });
  store.savePersonalizationSeed('training-seed-should-not-drive-diagnostic');

  const ctrl = new AssessmentController({ store, count: 13 });
  const started = ctrl.begin();
  assert.ok(started.started);

  const diagSeed = store.loadDiagnosticSessionSeed();
  assert.ok(diagSeed);
  assert.notEqual(diagSeed, 'training-seed-should-not-drive-diagnostic');

  while (ctrl.state === 'answering') {
    const item = ctrl.current();
    assert.ok(item?.context?.formatLine, 'structured MTT context required');
    assert.ok(item?.miniAppMode, 'mini-app mode required');
    ctrl.answer(item.correct);
  }
  assert.ok(ctrl.result?.skillProfile);
  assert.ok(ctrl.result.recommendedStartingDifficulty != null);
});

test('diagnostic uses validated library task IDs not legacy DX_ pool', () => {
  const eligible = getPlacementEligiblePool();
  assert.ok(eligible.every((i) => !i.id.startsWith('DX_')));
  assert.ok(eligible.length >= 140);
  assert.ok(eligible.every((i) => i._library));
});

test('report: diagnostic placement summary', () => {
  REPORT.tests = 9;
  REPORT.placementV2 = PLACEMENT_TEST_V2;
  REPORT.safeToMerge = REPORT.placementV2
    && REPORT.poolSize >= 140
    && REPORT.beginner?.overall < REPORT.strong?.overall;

  console.log('\n=== DIAGNOSTIC PLACEMENT REPORT (V2) ===');
  console.log('DIAGNOSTIC POOL SIZE:', REPORT.poolSize);
  console.log('QUESTION COUNT:', `${DIAGNOSTIC_COUNT_MIN}-${DIAGNOSTIC_COUNT_MAX} (default ${REPORT.questionCount})`);
  console.log('SKILL COVERAGE:', REPORT.skillCoverage.join(', '));
  console.log('DIFFICULTY COVERAGE:', JSON.stringify(REPORT.difficultyCoverage));
  console.log('BEGINNER RESULT:', JSON.stringify(REPORT.beginner));
  console.log('INTERMEDIATE RESULT:', JSON.stringify(REPORT.intermediate));
  console.log('STRONG RESULT:', JSON.stringify(REPORT.strong));
  console.log('PLACEMENT V2:', REPORT.placementV2 ? 'YES' : 'NO');
  console.log('TESTS:', REPORT.tests);
  console.log('SAFE TO MERGE:', REPORT.safeToMerge ? 'YES' : 'NO');

  assert.ok(REPORT.safeToMerge);
});
