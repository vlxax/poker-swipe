// Phase 3: mini-apps share one profile, history, and cross-app personalization.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTrainingStore } from '../src/training/trainingStore.js';
import {
  buildAssessmentSet, runAssessment
} from '../src/training/assessment.js';
import {
  buildSkillProfile, seedSkillEvidenceFromAssessment, updateSkillProfileInStore
} from '../src/training/skillProfile.js';
import { deriveSkillTags } from '../src/training/planner.js';
import { getTaskPool, getTaskById } from '../src/training/taskLibraryBridge.js';
import { recordTrainingResult } from '../src/training/personalizedTraining.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { buildMiniAppPlan, MINI_APP_SPECS } from '../src/training/miniAppPlanner.js';
import { legacyXrayToSpot } from '../../training-ui/legacyPoolAdapter.js';
import { createMiniAppBridge } from '../../training-ui/miniAppBridge.js';

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

function freshStore(seed) {
  const store = createTrainingStore({ storage: memoryStorage(), prefix: `miniapp_${seed}_` });
  store.savePersonalizationSeed(seed);
  return store;
}

function simulateAssessment(store, answerFn, seed) {
  const set = buildAssessmentSet({ personalizationSeed: seed, count: 12 });
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
  for (const prof of Object.values(res.leakProfiles || {})) store.saveProfile(prof);
  return profile;
}

function bluffCatchTask() {
  return POOL.find((t) => deriveSkillTags(t).includes('bluffCatch'))
    || getTaskById('POST_RIVER_BLUFFCATCH_KQ');
}

function countSkillInPlan(plan, skill) {
  return (plan.spots || []).reduce((n, spot) => n + ((spot.skillTags || []).includes(skill) ? 1 : 0), 0);
}

test('mini-app specs exist for all home-section trainers', () => {
  for (const app of ['daily', 'swipe', 'sizing', 'review', 'xray', 'quick5', 'memory']) {
    assert.ok(MINI_APP_SPECS[app], `missing spec for ${app}`);
  }
});

test('cross-app: xray mistake updates shared profile used by quick5 selection', () => {
  const seed = 'cross-app-miniapps-001';
  const store = freshStore(seed);
  simulateAssessment(store, (item) => item.correct, seed);

  const task = bluffCatchTask();
  assert.ok(task, 'need a bluffCatch library task');

  const gen = drillFromLibraryTask(task);
  assert.ok(gen.ok);
  recordTrainingResult(store, { drill: gen.drill, grade: 'MISTAKE', evLossBb: 0.85, now: Date.now() + 1 });

  const profile = store.loadSkillProfile();
  assert.ok(profile);
  assert.ok(profile.skills.bluffCatch, 'shared profile should track bluffCatch');
  assert.ok(profile.skills.bluffCatch.score < 75, 'bad xray-style answer should lower bluffCatch');
  assert.equal(profile.weakest.skill, 'bluffCatch', 'mistake should surface bluffCatch as weakest skill');

  const history = store.loadHistory();
  assert.ok(history.length >= 1, 'shared history should record the answer');
  assert.equal(history[history.length - 1].grade, 'MISTAKE');

  const after = buildMiniAppPlan(store, 'quick5', { pool: POOL, count: 5, now: Date.now() + 2 });
  assert.equal(after.filled, 5);
  const weakestHits = after.spots.filter((s) => (s.skillTags || []).includes('bluffCatch')).length;
  assert.ok(weakestHits >= 1, `quick5 should prioritize weakest skill bluffCatch (${weakestHits}/5 spots)`);
});

test('bridge writeback uses same store profile and history', () => {
  const seed = 'bridge-writeback-001';
  const store = freshStore(seed);
  simulateAssessment(store, (item) => item.correct, seed);

  const bridge = createMiniAppBridge(store);
  const legacyXray = [{ title: 'Test spot', ref: [['AA']], board: [], hero: ['As', 'Kd'], line: ['open'] }];
  const spot = legacyXrayToSpot(legacyXray[0], 0);

  bridge.recordLegacyOutcome({
    item: { id: spot.id, concept: 'range narrowing', street: 'river' },
    mode: 'xray',
    gradeLetter: 'r'
  });

  const profile = store.loadSkillProfile();
  const history = store.loadHistory();
  assert.ok(profile.skills.rangeReading || profile.skills.bluffCatch, 'xray answer updates analytical skills');
  assert.equal(history.length, 1);
  assert.equal(history[0].grade, 'MISTAKE');
  assert.equal(store.loadPersonalizationSeed()?.seed, seed);
});

test('sizing plan prioritizes betSizing skill targets', () => {
  const store = freshStore('sizing-focus-001');
  simulateAssessment(store, (item) => item.correct, 'sizing-focus-001');
  const plan = buildMiniAppPlan(store, 'sizing', { pool: POOL, count: 1 });
  assert.equal(plan.filled, 1);
  const tags = plan.spots[0].skillTags || [];
  assert.ok(tags.includes('betSizing') || tags.includes('postflop'), 'sizing mini-app should surface sizing-related skills');
});
