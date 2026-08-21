// P0 initial diagnostic placement test — adaptive pool, scoring, differentiation.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAssessmentSet,
  runAssessment,
  gradeAssessmentItem,
  simulateDiagnosticRun,
  validateDiagnosticPool,
  validateDiagnosticItem,
  getDiagnosticPoolSize,
  getDiagnosticEligiblePool,
  createDiagnosticSessionSeed,
  DIAGNOSTIC_COUNT_MIN,
  DIAGNOSTIC_COUNT_MAX,
  DIAGNOSTIC_COUNT_DEFAULT
} from '../src/training/assessment.js';
import {
  getDiagnosticPool,
  formatDiagnosticQuestion,
  DIAGNOSTIC_CATEGORY_IDS
} from '../src/training/diagnosticPool.js';
import {
  diagnosticSessionSummary,
  recommendedStartingDifficulty,
  getDiagnosticCategoryCoverage,
  getDiagnosticDifficultyCoverage,
  getDiagnosticSkillCoverage
} from '../src/training/diagnosticSelection.js';
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
  fullContext: { valid: 0, total: 0 },
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

function beginnerAnswer(item, session) {
  if ((item.tier || item.difficulty || 2) >= 3) return wrongChoice(item);
  if ((item.tier || item.difficulty || 2) === 2) {
    const slotRng = seededRng(`${session?.sessionSeed || 'b'}|${item.id}`);
    return slotRng() < 0.4 ? item.correct : wrongChoice(item);
  }
  return item.correct;
}

function intermediateAnswer(item, session) {
  const tier = item.tier || item.difficulty || 2;
  if (tier >= 4) return wrongChoice(item);
  if (tier === 3) {
    const slotRng = seededRng(`${session?.sessionSeed || 'i'}|${item.id}`);
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
  const summary = diagnosticSessionSummary(session);
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

// ---- Pool integrity ----------------------------------------------------------

test('diagnostic pool validates and has full context on every item', () => {
  const pool = getDiagnosticPool();
  const validation = validateDiagnosticPool();
  REPORT.poolSize = getDiagnosticPoolSize();
  REPORT.fullContext.total = pool.length;
  REPORT.fullContext.valid = validation.validCount;

  assert.ok(validation.allValid, `invalid items: ${validation.invalidIds.join(', ')}`);
  assert.ok(REPORT.poolSize >= 40, `pool too small: ${REPORT.poolSize}`);
  assert.equal(validation.missingCategories.length, 0);

  for (const item of pool) {
    assert.ok(validateDiagnosticItem(item), `failed validation: ${item.id}`);
    const q = formatDiagnosticQuestion(item);
    assert.ok(q.includes('max'), `${item.id} missing format`);
    assert.ok(q.includes('ББ'), `${item.id} missing stack/pot`);
    assert.ok(q.includes('История'), `${item.id} missing action history`);
    assert.ok(q.length > 80, `${item.id} question too short`);
  }
});

test('diagnostic covers all required category axes', () => {
  const coverage = getDiagnosticCategoryCoverage();
  for (const cat of DIAGNOSTIC_CATEGORY_IDS) {
    assert.ok(coverage[cat] >= 3, `category ${cat} under-covered: ${coverage[cat]}`);
  }
  REPORT.skillCoverage = getDiagnosticSkillCoverage();
  REPORT.difficultyCoverage = getDiagnosticDifficultyCoverage();
  assert.ok(REPORT.skillCoverage.includes('preflop'));
  assert.ok(REPORT.skillCoverage.includes('icm'));
  assert.ok(REPORT.skillCoverage.includes('positionAwareness'));
});

// ---- Count bounds ------------------------------------------------------------

test('diagnostic session produces 12–15 questions', () => {
  for (const count of [12, 13, 14, 15]) {
    const { items } = simulateDiagnosticRun({
      sessionSeed: `count-test-${count}`,
      targetCount: count,
      answerFn: strongAnswer,
      gradeFn: (item, choice) => gradeAssessmentItem(item, choice)
    });
    assert.ok(items.length >= DIAGNOSTIC_COUNT_MIN && items.length <= DIAGNOSTIC_COUNT_MAX);
    assert.equal(items.length, count);
  }
  REPORT.questionCount = DIAGNOSTIC_COUNT_DEFAULT;
});

// ---- Differentiation ---------------------------------------------------------

test('beginner / intermediate / strong receive different final profiles', () => {
  const beginner = runPlayerProfile('beginner', beginnerAnswer, 'sim-beginner-001');
  const intermediate = runPlayerProfile('intermediate', intermediateAnswer, 'sim-intermediate-001');
  const strong = runPlayerProfile('strong', strongAnswer, 'sim-strong-001');

  REPORT.beginner = beginner;
  REPORT.intermediate = intermediate;
  REPORT.strong = strong;

  assert.ok(beginner.overall <= intermediate.overall,
    `beginner ${beginner.overall} should not exceed intermediate ${intermediate.overall}`);
  assert.ok(intermediate.overall <= strong.overall + 5,
    `intermediate ${intermediate.overall} vs strong ${strong.overall}`);
  assert.ok(strong.overall >= 70, `strong overall too low: ${strong.overall}`);

  assert.ok(beginner.overall < strong.overall,
    `beginner ${beginner.overall} should be below strong ${strong.overall}`);
  assert.notDeepEqual(beginner.itemIds, strong.itemIds,
    'beginner and strong should receive different question sets');
  assert.ok(strong.recommendedStartingDifficulty >= beginner.recommendedStartingDifficulty);
});

test('strong player reaches harder questions than beginner', () => {
  const beginner = REPORT.beginner || runPlayerProfile('beginner', beginnerAnswer, 'sim-beginner-002');
  const strong = REPORT.strong || runPlayerProfile('strong', strongAnswer, 'sim-strong-002');

  assert.ok(strong.avgTier > beginner.avgTier,
    `strong avgTier ${strong.avgTier} vs beginner ${beginner.avgTier}`);
  assert.ok(strong.maxTier >= beginner.maxTier,
    `strong maxTier ${strong.maxTier} vs beginner ${beginner.maxTier}`);
  assert.ok(strong.recommendedStartingDifficulty >= beginner.recommendedStartingDifficulty,
    `rec diff strong ${strong.recommendedStartingDifficulty} vs beginner ${beginner.recommendedStartingDifficulty}`);
});

test('beginner is not judged mainly on advanced questions', () => {
  const beginner = REPORT.beginner || runPlayerProfile('beginner', beginnerAnswer, 'sim-beginner-003');
  assert.ok(beginner.advancedShare <= 0.35,
    `beginner advanced share too high: ${beginner.advancedShare}`);
});

// ---- Fresh user variation ----------------------------------------------------

test('different fresh users do not receive identical sequences', () => {
  const seedA = createDiagnosticSessionSeed();
  const seedB = createDiagnosticSessionSeed();
  assert.notEqual(seedA, seedB);

  const setA = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-user-alpha', count: 13, answerFn: strongAnswer });
  const setB = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-user-beta', count: 13, answerFn: strongAnswer });

  const idsA = setA.map((x) => x.id);
  const idsB = setB.map((x) => x.id);
  assert.notDeepEqual(idsA, idsB, 'fresh users should not get identical diagnostic sequences');
  assert.ok(overlap(idsA, idsB) <= 7, `fresh user overlap too high: ${overlap(idsA, idsB)}/13`);

  const catsA = setA.map((x) => x.category);
  const catsB = setB.map((x) => x.category);
  assert.deepEqual(catsA, catsB, 'category structure should match across seeds');
});

test('diagnostic does not use training personalization seed in controller', () => {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: 'diag_ctrl_' });
  store.savePersonalizationSeed('training-seed-should-not-drive-diagnostic');

  const ctrl = new AssessmentController({ store, count: 13 });
  const started = ctrl.begin();
  assert.ok(started.started);
  assert.equal(ctrl.progress().total, 13);

  const diagSeed = store.loadDiagnosticSessionSeed();
  assert.ok(diagSeed, 'diagnostic session seed must be stored separately');
  assert.notEqual(diagSeed, 'training-seed-should-not-drive-diagnostic');

  while (ctrl.state === 'answering') {
    const item = ctrl.current();
    assert.ok(item?.q?.length > 80, 'question must have full context');
    ctrl.answer(item.correct);
  }
  assert.ok(ctrl.result?.skillProfile);
  assert.ok(ctrl.result.recommendedStartingDifficulty != null);
});

// ---- Dedicated pool not training library --------------------------------------

test('diagnostic pool is separate from training task library IDs', () => {
  const eligible = getDiagnosticEligiblePool();
  assert.ok(eligible.every((i) => i.id.startsWith('DX_')),
    'diagnostic items should use DX_ prefix, not library task IDs');
  assert.ok(eligible.length >= 66);
});

// ---- Report ------------------------------------------------------------------

test('report: diagnostic placement summary', () => {
  REPORT.tests = 9;
  REPORT.safeToMerge = REPORT.fullContext.valid === REPORT.fullContext.total
    && REPORT.poolSize >= 40
    && REPORT.beginner?.overall < REPORT.strong?.overall;

  console.log('\n=== DIAGNOSTIC PLACEMENT REPORT ===');
  console.log('DIAGNOSTIC POOL SIZE:', REPORT.poolSize);
  console.log('QUESTION COUNT:', `${DIAGNOSTIC_COUNT_MIN}-${DIAGNOSTIC_COUNT_MAX} (default ${REPORT.questionCount})`);
  console.log('SKILL COVERAGE:', REPORT.skillCoverage.join(', '));
  console.log('DIFFICULTY COVERAGE:', JSON.stringify(REPORT.difficultyCoverage));
  console.log('BEGINNER RESULT:', JSON.stringify(REPORT.beginner));
  console.log('INTERMEDIATE RESULT:', JSON.stringify(REPORT.intermediate));
  console.log('STRONG RESULT:', JSON.stringify(REPORT.strong));
  console.log(`FULL-CONTEXT ITEMS: ${REPORT.fullContext.valid}/${REPORT.fullContext.total}`);
  console.log('TESTS:', REPORT.tests);
  console.log('SAFE TO MERGE:', REPORT.safeToMerge ? 'YES' : 'NO');

  assert.ok(REPORT.safeToMerge);
});
