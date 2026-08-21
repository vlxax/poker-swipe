// Phase 6: per-skill mastery + spaced repetition lifecycle tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTrainingStore } from '../src/training/trainingStore.js';
import {
  buildSkillMasteryStates,
  applySkillMasteryTraining,
  applyTrainingToMasteryStore,
  deriveMasteryState,
  updateSkillMasteryAfterTraining,
  reviewIntervalDays,
  DAY_MS,
  MASTERY_STATES
} from '../src/training/skillMastery.js';
import { recordTrainingResult, buildProfileDailyPlan } from '../src/training/personalizedTraining.js';
import { getTargetDifficulty } from '../src/training/adaptiveDifficulty.js';
import { overlapCount, buildDifferentiationReport } from '../src/training/playerDifferentiationFixtures.js';
import { DEFAULT_SHOWN_COOLDOWN } from '../src/training/spotSelector.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { getTaskById } from '../src/training/taskLibraryBridge.js';

const SKILL = 'river';
const T0 = 1_700_000_000_000;

const REPORT = {
  successPath: false,
  failPath: false,
  persistence: false,
  antiRepeat: false,
  adaptiveDifficulty: false,
  personalization: false,
  intervals: []
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

function entry(score, sampleSize, confidence = 0.6) {
  return { skill: SKILL, score, sampleSize, confidence };
}

function profile(score, sampleSize, confidence = 0.6) {
  return {
    overall: score,
    skills: { [SKILL]: entry(score, sampleSize, confidence) }
  };
}

function recentGrades(grades) {
  return grades.map((grade) => ({ grade, skillTags: [SKILL], nearOptimal: grade === 'EXCELLENT' || grade === 'GOOD' }));
}

test('mastery states cover required lifecycle values', () => {
  for (const s of ['NEW', 'LEARNING', 'PRACTICING', 'MASTERED', 'REVIEW_DUE']) {
    assert.ok(MASTERY_STATES.includes(s));
  }
});

test('SUCCESS PATH: NEW → LEARNING → PRACTICING → MASTERED → REVIEW_DUE → MASTERED', () => {
  let now = T0;
  let masteryStore = {};
  let skillProfile = null;
  let recentResults = [];

  let state = deriveMasteryState({ skill: SKILL, entry: null, record: null, recentResults, now });
  assert.equal(state, 'NEW');

  skillProfile = profile(38, 2, 0.2);
  recentResults = recentGrades(['GOOD', 'INACCURACY']);
  ({ store: masteryStore } = applySkillMasteryTraining({
    masteryStore, skill: SKILL, entry: skillProfile.skills[SKILL], recentResults, grade: 'INACCURACY', now
  }));
  state = deriveMasteryState({ skill: SKILL, entry: skillProfile.skills[SKILL], record: masteryStore[SKILL], recentResults, now });
  assert.equal(state, 'LEARNING');

  now += 1;
  skillProfile = profile(62, 6, 0.45);
  recentResults = recentGrades(Array(6).fill('GOOD'));
  ({ store: masteryStore } = applySkillMasteryTraining({
    masteryStore, skill: SKILL, entry: skillProfile.skills[SKILL], recentResults, grade: 'GOOD', now
  }));
  state = deriveMasteryState({ skill: SKILL, entry: skillProfile.skills[SKILL], record: masteryStore[SKILL], recentResults, now });
  assert.equal(state, 'PRACTICING');

  now += 1;
  skillProfile = profile(88, 10, 0.72);
  recentResults = recentGrades(Array(10).fill('EXCELLENT'));
  ({ store: masteryStore, record: masteryStore[SKILL] } = applySkillMasteryTraining({
    masteryStore, skill: SKILL, entry: skillProfile.skills[SKILL], recentResults, grade: 'EXCELLENT', now
  }));
  state = deriveMasteryState({ skill: SKILL, entry: skillProfile.skills[SKILL], record: masteryStore[SKILL], recentResults, now });
  assert.equal(state, 'MASTERED');
  assert.equal(reviewIntervalDays(masteryStore[SKILL].intervalIndex), 1);
  assert.ok(masteryStore[SKILL].nextReviewAt >= now);

  now = masteryStore[SKILL].nextReviewAt + 1;
  state = deriveMasteryState({ skill: SKILL, entry: skillProfile.skills[SKILL], record: masteryStore[SKILL], recentResults, now });
  assert.equal(state, 'REVIEW_DUE');

  now += 1;
  const reviewResult = applySkillMasteryTraining({
    masteryStore,
    skill: SKILL,
    entry: skillProfile.skills[SKILL],
    recentResults: [...recentResults, { grade: 'EXCELLENT', skillTags: [SKILL], nearOptimal: true }],
    grade: 'EXCELLENT',
    now
  });
  masteryStore = reviewResult.store;
  state = deriveMasteryState({
    skill: SKILL,
    entry: skillProfile.skills[SKILL],
    record: masteryStore[SKILL],
    recentResults,
    now
  });
  assert.equal(reviewResult.state, 'MASTERED');
  assert.equal(state, 'MASTERED');
  assert.equal(reviewIntervalDays(masteryStore[SKILL].intervalIndex), 3);
  REPORT.successPath = true;
  REPORT.intervals = [1, 3];
});

test('FAIL PATH: MASTERED → REVIEW_DUE → PRACTICING', () => {
  let now = T0;
  const skillProfile = profile(88, 10, 0.72);
  const recentResults = recentGrades(Array(10).fill('EXCELLENT'));
  let masteryStore = {};
  ({ store: masteryStore } = applySkillMasteryTraining({
    masteryStore,
    skill: SKILL,
    entry: skillProfile.skills[SKILL],
    recentResults,
    grade: 'EXCELLENT',
    now
  }));
  assert.equal(masteryStore[SKILL].state, 'MASTERED');

  now = masteryStore[SKILL].nextReviewAt + 1;
  let state = deriveMasteryState({
    skill: SKILL,
    entry: skillProfile.skills[SKILL],
    record: masteryStore[SKILL],
    recentResults,
    now
  });
  assert.equal(state, 'REVIEW_DUE');

  const failResult = applySkillMasteryTraining({
    masteryStore,
    skill: SKILL,
    entry: skillProfile.skills[SKILL],
    recentResults: [...recentResults, { grade: 'MISTAKE', skillTags: [SKILL], nearOptimal: false }],
    grade: 'MISTAKE',
    now: now + 1
  });
  assert.equal(failResult.state, 'PRACTICING');
  assert.equal(failResult.record.nextReviewAt, null);
  REPORT.failPath = true;
});

test('persistence: mastery/review state survives store reload', () => {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: 'mastery_persist_' });
  const skillProfile = profile(88, 10, 0.72);
  store.saveSkillProfile(skillProfile);
  updateSkillMasteryAfterTraining(store, {
    skillTags: [SKILL],
    skillProfile,
    grade: 'EXCELLENT',
    recentResults: recentGrades(Array(10).fill('EXCELLENT')),
    now: T0
  });

  const reloaded = createTrainingStore({ storage, prefix: 'mastery_persist_' });
  const masteryStore = reloaded.loadSkillMastery();
  assert.ok(masteryStore[SKILL]);
  assert.equal(masteryStore[SKILL].state, 'MASTERED');
  assert.ok(masteryStore[SKILL].nextReviewAt != null);

  const states = buildSkillMasteryStates({
    skillProfile: reloaded.loadSkillProfile(),
    masteryStore,
    recentResults: recentGrades(Array(10).fill('EXCELLENT')),
    now: T0
  });
  assert.equal(states[SKILL].state, 'MASTERED');
  REPORT.persistence = true;
});

test('two users can differ in mastery state for the same skill', () => {
  const storageA = memoryStorage();
  const storageB = memoryStorage();
  const storeA = createTrainingStore({ storage: storageA, prefix: 'user_a_' });
  const storeB = createTrainingStore({ storage: storageB, prefix: 'user_b_' });

  storeA.saveSkillProfile(profile(88, 10, 0.75));
  storeB.saveSkillProfile(profile(42, 4, 0.25));

  updateSkillMasteryAfterTraining(storeA, {
    skillTags: [SKILL], skillProfile: storeA.loadSkillProfile(), grade: 'EXCELLENT',
    recentResults: recentGrades(Array(10).fill('EXCELLENT')), now: T0
  });
  updateSkillMasteryAfterTraining(storeB, {
    skillTags: [SKILL], skillProfile: storeB.loadSkillProfile(), grade: 'INACCURACY',
    recentResults: recentGrades(['INACCURACY', 'MISTAKE', 'INACCURACY']), now: T0
  });

  const stateA = buildSkillMasteryStates({
    skillProfile: storeA.loadSkillProfile(),
    masteryStore: storeA.loadSkillMastery(),
    recentResults: recentGrades(Array(10).fill('EXCELLENT')),
    now: T0
  })[SKILL].state;
  const stateB = buildSkillMasteryStates({
    skillProfile: storeB.loadSkillProfile(),
    masteryStore: storeB.loadSkillMastery(),
    recentResults: recentGrades(['INACCURACY', 'MISTAKE', 'INACCURACY']),
    now: T0
  })[SKILL].state;

  assert.equal(stateA, 'MASTERED');
  assert.ok(['NEW', 'LEARNING', 'PRACTICING'].includes(stateB));
  assert.notEqual(stateA, stateB);
});

test('anti-repeat still suppresses recently shown tasks with mastery enabled', () => {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: 'mastery_antirepeat_' });
  store.savePersonalizationSeed('mastery-antirepeat');
  store.saveSkillProfile(profile(55, 8, 0.5));

  const plan = buildProfileDailyPlan({ store, count: 10, now: T0 });
  assert.ok(plan && plan.filled > 0);

  let now = T0;
  for (const id of plan.spotIds.slice(0, DEFAULT_SHOWN_COOLDOWN)) {
    const task = getTaskById(id);
    if (!task) continue;
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'GOOD', evLossBb: 0.05, now });
    now += 1;
  }

  const next = buildProfileDailyPlan({ store, count: 10, now: T0 + 60_000 });
  const overlap = overlapCount(next.spotIds, plan.spotIds.slice(0, DEFAULT_SHOWN_COOLDOWN));
  assert.equal(overlap, 0);
  REPORT.antiRepeat = true;
});

test('adaptive difficulty still works with mastery enabled', () => {
  const prof = profile(40, 8, 0.5);
  const start = getTargetDifficulty(prof, SKILL).target;
  const afterGood = getTargetDifficulty(prof, SKILL, {
    recentResults: recentGrades(Array(10).fill('EXCELLENT'))
  }).target;
  assert.ok(afterGood > start);
  REPORT.adaptiveDifficulty = true;
});

test('personalization still produces differentiated plans with mastery enabled', () => {
  const A = buildDifferentiationReport('A');
  const B = buildDifferentiationReport('B');
  assert.ok(A.distribution.icmPush > B.distribution.icmPush);
  assert.ok(B.distribution.postRiver >= A.distribution.postRiver);
  assert.ok(overlapCount(A.taskIds, B.taskIds) < 20);
  REPORT.personalization = true;
});

test('report: mastery summary', () => {
  assert.ok(REPORT.successPath, 'success path');
  assert.ok(REPORT.failPath, 'fail path');
  assert.ok(REPORT.persistence, 'persistence');
  assert.ok(REPORT.antiRepeat, 'anti-repeat');
  assert.ok(REPORT.adaptiveDifficulty, 'adaptive difficulty');
  assert.ok(REPORT.personalization, 'personalization');
  console.log('\nREVIEW INTERVALS:', REPORT.intervals.join(', '));
});
