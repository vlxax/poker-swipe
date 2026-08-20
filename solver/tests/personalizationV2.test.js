// P0 personalization V2: feedback, diversity, skill-targeted plans, no-repeat.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getTaskPool, loadTaskLibrary } from '../src/training/taskLibraryBridge.js';
import { buildDailyPlan, computeSkillTargets } from '../src/training/planner.js';
import { selectSpots } from '../src/training/spotSelector.js';
import { buildSkillProfile } from '../src/training/skillProfile.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { buildTaskFeedback } from '../src/training/taskFeedback.js';
import { diversityPenalty, isTooSimilar } from '../src/training/sessionDiversity.js';
import { createTrainingStore } from '../src/training/trainingStore.js';
import { buildProfileDailyPlan } from '../src/training/personalizedTraining.js';
import { getCatalog } from '../../ranges-ui/catalog.js';

const POOL = getTaskPool();
const rng = () => 0.42;

function profileA() {
  return buildSkillProfile({
    leakProfiles: [
      { concept: 'bluff_catch', attempts: Array(6).fill({ evLossBb: 0.8, at: 1 }) },
      { concept: 'value_bet', attempts: Array(6).fill({ evLossBb: 0.7, at: 2 }) },
      { concept: 'icm_pressure', attempts: Array(6).fill({ evLossBb: 0.9, at: 3 }) },
      { concept: 'open_range', attempts: Array(6).fill({ evLossBb: 0.02, at: 4 }) }
    ],
    assessment: {
      results: [
        { skillTag: 'preflop', concept: 'open_range', correct: true, evLossBb: 0, at: 1 },
        { skillTag: 'river', concept: 'bluff_catch', correct: false, evLossBb: 0.5, at: 2 },
        { skillTag: 'icm', concept: 'icm_pressure', correct: false, evLossBb: 0.6, at: 3 },
        { skillTag: 'postflop', concept: 'cbet_frequency', correct: true, evLossBb: 0.05, at: 4 }
      ]
    }
  });
}

function profileB() {
  return buildSkillProfile({
    leakProfiles: [
      { concept: 'icm_pressure', attempts: Array(6).fill({ evLossBb: 0.15, at: 1 }) },
      { concept: 'open_range', attempts: Array(6).fill({ evLossBb: 0.9, at: 2 }) },
      { concept: 'defend_vs_open', attempts: Array(6).fill({ evLossBb: 0.85, at: 3 }) }
    ],
    assessment: {
      results: [
        { skillTag: 'icm', concept: 'icm_pressure', correct: true, evLossBb: 0, at: 1 },
        { skillTag: 'preflop', concept: 'open_range', correct: false, evLossBb: 0.55, at: 2 },
        { skillTag: 'preflop', concept: 'defend_vs_open', correct: false, evLossBb: 0.5, at: 3 }
      ]
    }
  });
}

test('library has 100+ tasks for personalization', () => {
  const tasks = loadTaskLibrary();
  assert.ok(tasks.length >= 100, `expected >=100 tasks, got ${tasks.length}`);
  assert.equal(POOL.length, tasks.length);
});

test('computeSkillTargets allocates more spots to weakest skills', () => {
  const p = profileA();
  const targets = computeSkillTargets(p, 10);
  assert.ok(targets);
  const weakSkills = Object.entries(p.skills)
    .filter(([, v]) => v.score != null)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 2)
    .map(([k]) => k);
  const weakAlloc = weakSkills.reduce((s, k) => s + (targets[k] || 0), 0);
  assert.ok(weakAlloc >= 5, `weak allocation should dominate, got ${weakAlloc}`);
});

test('two profiles get different 10-spot plans', () => {
  const planA = buildDailyPlan({ pool: POOL, skillProfile: profileA(), count: 10, rng, history: [], progressByConcept: {} });
  const planB = buildDailyPlan({ pool: POOL, skillProfile: profileB(), count: 10, rng: () => 0.17, history: [], progressByConcept: {} });
  const idsA = (planA.spotIds || []).join(',');
  const idsB = (planB.spotIds || []).join(',');
  assert.notEqual(idsA, idsB);
  assert.equal(new Set(planA.spotIds).size, planA.spotIds.length, 'no duplicate taskIds in session A');
  assert.equal(new Set(planB.spotIds).size, planB.spotIds.length, 'no duplicate taskIds in session B');
});

test('session selection penalizes recently shown spots', () => {
  const recent = POOL.slice(0, 8).map((s, i) => ({ spotId: s.id, concept: s.concept, at: 1000 - i }));
  const plan = buildDailyPlan({
    pool: POOL, skillProfile: profileA(), count: 7, rng, history: recent, progressByConcept: {}
  });
  const overlap = (plan.spotIds || []).filter((id) => recent.some((h) => h.spotId === id));
  assert.ok(overlap.length <= 1, `recent overlap ${overlap.length} should be <=1`);
});

test('library drill feedback is task-specific, not generic praise on mistakes', () => {
  const task = loadTaskLibrary().find((t) => t.explain && t.correct);
  assert.ok(task, 'need a task with explain');
  const gen = drillFromLibraryTask(task);
  assert.equal(gen.ok, true);
  const wrong = task.options.find((o) => o !== task.correct && !(task.alsoOk || []).includes(o));
  const result = gradeAnswer({ drill: gen.drill, chosenId: gen.drill.options.find((o) => o.labelRu === wrong).id });
  assert.ok(result.feedbackRu);
  assert.ok(result.feedbackRu.why);
  assert.ok(result.feedbackRu.userMistake);
  assert.ok(!/придраться сложно/i.test(result.feedbackRu.summary || ''));
  if (result.grade === 'MISTAKE' || result.grade === 'BIG MISTAKE') {
    assert.match(result.feedbackRu.verdict || result.feedbackRu.title, /Ошибка|неточность/i);
  }
});

test('buildTaskFeedback includes structured fields for wrong answers', () => {
  const task = loadTaskLibrary().find((t) => t.id === 'PRE_BB_K8S') || loadTaskLibrary()[0];
  const fb = buildTaskFeedback({
    task,
    chosenLabel: 'ФОЛД',
    recommendedLabel: task.correct,
    grade: 'MISTAKE',
    evLossBb: 0.4
  });
  assert.equal(fb.verdict, 'Ошибка');
  assert.ok(fb.why.includes(task.explain) || fb.why.length > 20);
  assert.ok(fb.userMistake.includes('Фолд'));
  assert.ok(fb.detail);
});

test('diversity helpers detect similar spots', () => {
  const a = POOL[0];
  const b = { ...POOL[0] };
  assert.equal(isTooSimilar(a, b), true);
  assert.ok(diversityPenalty(a, [{ spot: a }], []) >= 100);
});

test('9-max catalog exposes extra positions', () => {
  const catalog = getCatalog({ preflop: {} }, '9max');
  assert.ok(catalog.positions.includes('MP'));
  assert.ok(catalog.positions.includes('UTG+1'));
  assert.equal(catalog.formats.length, 2);
});

test('profile persists and drives library plan on reopen', () => {
  const store = createTrainingStore();
  store.saveSkillProfile(profileA());
  const plan1 = buildProfileDailyPlan({ store, count: 7, rng });
  assert.ok(plan1);
  assert.equal(plan1.filled, 7);
  const plan2 = buildProfileDailyPlan({ store, count: 7, rng: () => 0.88, history: store.loadHistory() });
  assert.ok(plan2);
});

test('selectSpots never returns duplicate ids in one batch', () => {
  const res = selectSpots({ pool: POOL, skillProfile: profileA(), count: 10, rng });
  assert.equal(res.ok, true);
  assert.equal(new Set(res.selected).size, res.selected.length);
});
