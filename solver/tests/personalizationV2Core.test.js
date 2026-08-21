// P0 personalization core loop: diverse assessment, profile learning, anti-repeat.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTrainingStore } from '../src/training/trainingStore.js';
import {
  buildAssessmentSet, getAssessmentEligiblePool, runAssessment, ASSESSMENT_POOL
} from '../src/training/assessment.js';
import { createPersonalizationSeed, seededRng } from '../src/training/personalizationSeed.js';
import {
  buildSkillProfile, seedSkillEvidenceFromAssessment, updateSkillProfileInStore
} from '../src/training/skillProfile.js';
import { deriveSkillTags } from '../src/training/planner.js';
import { getTaskPool, getTaskById } from '../src/training/taskLibraryBridge.js';
import {
  recordTrainingResult, buildProfileDailyPlan, skillTagsForDrill
} from '../src/training/personalizedTraining.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { contentFingerprint } from '../src/training/sessionDiversity.js';
import { DEFAULT_SHOWN_COOLDOWN } from '../src/training/spotSelector.js';

const POOL = getTaskPool();

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

function freshStore(seed = null) {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: `test_${seed || Math.random()}_` });
  if (seed) store.savePersonalizationSeed(seed);
  else store.getOrCreatePersonalizationSeed();
  return store;
}

function simulateAssessment(store, answerFn, seed) {
  const set = buildAssessmentSet({ personalizationSeed: seed || store.getOrCreatePersonalizationSeed(), count: 12 });
  const answers = set.map((item) => ({
    id: item.id,
    choice: answerFn(item),
    confidence: 70
  }));
  const res = runAssessment({ items: set, answers, now: Date.now() });
  store.saveAssessment(res);
  seedSkillEvidenceFromAssessment(store, res, Date.now());
  const profile = buildSkillProfile({ storedEvidence: store.loadSkillEvidence(), now: Date.now() });
  store.saveSkillProfile(profile);
  for (const [concept, prof] of Object.entries(res.leakProfiles || {})) {
    store.saveProfile(prof);
  }
  return { set, res, profile };
}

function icmTask() {
  return POOL.find((t) => deriveSkillTags(t).includes('icm')) || getTaskById('TOUR_BUBBLE_A7O');
}

// ---- A: two fresh users get different assessment IDs -----------------------

test('A: two fresh users receive different 12-question assessment sets', () => {
  const storeA = freshStore(createPersonalizationSeed());
  const storeB = freshStore(createPersonalizationSeed());
  const seedA = storeA.getOrCreatePersonalizationSeed();
  const seedB = storeB.getOrCreatePersonalizationSeed();
  assert.notEqual(seedA, seedB);

  const setA = buildAssessmentSet({ personalizationSeed: seedA, count: 12 });
  const setB = buildAssessmentSet({ personalizationSeed: seedB, count: 12 });
  assert.equal(setA.length, 12);
  assert.equal(setB.length, 12);

  const idsA = setA.map((x) => x.id);
  const idsB = setB.map((x) => x.id);
  assert.notDeepEqual(idsA, idsB, 'fresh users should not get identical diagnostic IDs');
});

// ---- B: different answers → different training focus -----------------------

test('B: different assessment answers produce different skill focus and task IDs', () => {
  const storeA = freshStore('user-a-seed-111');
  const storeB = freshStore('user-b-seed-222');

  const { profile: profileA } = simulateAssessment(storeA, (item) => {
    if (deriveSkillTags({ concept: item.concept, tags: item.tags, street: item.street }).includes('icm')) return item.choices.find((c) => c !== item.correct) || item.correct;
    if (/rfi|open|preflop|префлоп/i.test(item.concept + item.street)) return item.correct;
    return item.correct;
  }, 'user-a-seed-111');

  const { profile: profileB } = simulateAssessment(storeB, (item) => {
    if (/rfi|open|preflop|префлоп/i.test(item.concept + item.street)) return item.choices.find((c) => c !== item.correct) || item.correct;
    if (/flop|флоп|turn|тёрн|river|ривер/i.test(item.street)) return item.correct;
    if (deriveSkillTags({ concept: item.concept, tags: item.tags, street: item.street }).includes('icm')) return item.correct;
    return item.correct;
  }, 'user-b-seed-222');

  const weakA = profileA.weakest?.skill;
  const weakB = profileB.weakest?.skill;
  assert.ok(weakA, 'user A should have weakest skill');
  assert.ok(weakB, 'user B should have weakest skill');

  const planA = buildProfileDailyPlan({ store: storeA, count: 7, now: 1000 });
  const planB = buildProfileDailyPlan({ store: storeB, count: 7, now: 1000 });
  assert.ok(planA && planA.filled > 0);
  assert.ok(planB && planB.filled > 0);

  const overlap = (planA.spotIds || []).filter((id) => (planB.spotIds || []).includes(id));
  assert.ok(
    weakA !== weakB || overlap.length < (planA.spotIds || []).length,
    'profiles should differ in focus or task selection'
  );
});

// ---- C: profile learning from ICM training answers -----------------------

test('C: ICM profile changes after bad then good training answers', () => {
  const store = freshStore('icm-learning-seed');
  const task = icmTask();
  assert.ok(task, 'need ICM task');
  const gen = drillFromLibraryTask(task);
  assert.equal(gen.ok, true);

  const icmBefore = buildSkillProfile({ storedEvidence: store.loadSkillEvidence() });
  const icmScoreBefore = icmBefore.skills?.icm?.score;

  for (let i = 0; i < 10; i++) {
    recordTrainingResult(store, { drill: gen.drill, grade: 'BIG MISTAKE', evLossBb: 0.9, now: 100 + i });
  }
  const afterBad = store.loadSkillProfile();
  const icmAfterBad = afterBad?.skills?.icm;
  assert.ok(icmAfterBad, 'ICM skill should exist after bad answers');
  assert.ok(icmAfterBad.sampleSize >= 10);
  assert.ok(icmAfterBad.score != null);

  for (let i = 0; i < 15; i++) {
    recordTrainingResult(store, { drill: gen.drill, grade: 'EXCELLENT', evLossBb: 0, now: 200 + i });
  }
  const afterGood = store.loadSkillProfile();
  const icmAfterGood = afterGood?.skills?.icm;
  assert.ok(icmAfterGood.sampleSize >= 25);
  assert.ok(icmAfterGood.score > icmAfterBad.score, 'ICM score should improve after good answers');
  assert.ok(['improving', 'stable'].includes(icmAfterGood.recentTrend));

  const plan = buildProfileDailyPlan({ store, count: 7, now: 500 });
  assert.ok(plan, 'planner should read updated profile');
});

// ---- D: reload persistence -------------------------------------------------

test('D: profile, history, and personalizationSeed survive store reload', () => {
  const storage = memoryStorage();
  const prefix = 'persist_test_';
  const store1 = createTrainingStore({ storage, prefix });
  const seed = store1.getOrCreatePersonalizationSeed();
  simulateAssessment(store1, (item) => item.correct, seed);
  recordTrainingResult(store1, {
    drill: drillFromLibraryTask(POOL[0]).drill,
    grade: 'GOOD',
    evLossBb: 0.05,
    now: 50
  });

  const store2 = createTrainingStore({ storage, prefix });
  assert.equal(store2.getOrCreatePersonalizationSeed(), seed);
  assert.ok(store2.loadSkillProfile());
  assert.ok(store2.loadHistory().length > 0);
  assert.ok(Object.keys(store2.loadSkillEvidence() || {}).length > 0);
});

// ---- E: anti-repeat across consecutive sessions ----------------------------

test('E: consecutive sessions avoid exact task repeat within cooldown', () => {
  const store = freshStore('anti-repeat-seed');
  simulateAssessment(store, (item) => item.correct, 'anti-repeat-seed');

  const history = [];
  const allIds = [];
  for (let session = 0; session < 3; session++) {
    const plan = buildProfileDailyPlan({ store, history, count: 7, now: 1000 + session * 100 });
    assert.ok(plan && plan.filled > 0);
    for (const id of plan.spotIds) {
      const recent = history.slice(0, DEFAULT_SHOWN_COOLDOWN).map((h) => h.spotId);
      assert.ok(!recent.includes(id), `task ${id} repeated inside cooldown window`);
      const task = getTaskById(id);
      history.unshift({
        spotId: id,
        concept: task?.concept,
        contentFingerprint: contentFingerprint(task || { id }),
        at: 1000 + session * 100
      });
      allIds.push(id);
    }
  }
  assert.equal(new Set(allIds).size, allIds.length, 'no duplicate ids across one multi-session run');
});

// ---- supporting assertions ---------------------------------------------------

test('eligible assessment pool is larger than legacy fixed pool', () => {
  const eligible = getAssessmentEligiblePool();
  assert.ok(eligible.length > ASSESSMENT_POOL.length);
  assert.ok(eligible.length >= 50);
});

test('deriveSkillTags returns multiple skills for RFI tasks', () => {
  const rfi = getTaskById('PRE_RFI_BTN_A8S');
  assert.ok(rfi);
  const tags = deriveSkillTags(rfi);
  assert.ok(tags.includes('preflop'));
  assert.ok(tags.includes('positionAwareness'));
});

test('intentional spaced review can repeat a flagged task', () => {
  const store = freshStore('spaced-review');
  const set = buildAssessmentSet({ personalizationSeed: 'spaced-review', count: 12 });
  const res = runAssessment({ items: set, answers: set.map((i) => ({ id: i.id, choice: i.correct })) });
  seedSkillEvidenceFromAssessment(store, res);
  store.saveSkillProfile(buildSkillProfile({ storedEvidence: store.loadSkillEvidence() }));

  const task = getTaskById('PRE_RFI_BTN_A8S');
  const history = [{
    spotId: task.id,
    concept: task.concept,
    contentFingerprint: contentFingerprint(task),
    at: 1,
    spacedReview: true
  }];
  const plan = buildProfileDailyPlan({ store, history, count: 7, now: 100 });
  assert.ok(plan);
  assert.ok((plan.spotIds || []).includes(task.id));
});

test('recordTrainingResult records all skill tags for a drill', () => {
  const task = getTaskById('PRE_RFI_BTN_A8S');
  const gen = drillFromLibraryTask(task);
  const tags = skillTagsForDrill(gen.drill);
  assert.ok(tags.length >= 2);
  const store = freshStore('multi-skill');
  const res = recordTrainingResult(store, { drill: gen.drill, grade: 'GOOD', evLossBb: 0, now: 1 });
  assert.ok(res.skillTags.length >= 2);
  for (const tag of res.skillTags) {
    assert.ok(store.loadSkillEvidence()[tag], `evidence for ${tag}`);
  }
});
