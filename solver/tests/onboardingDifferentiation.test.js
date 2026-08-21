// Phase 4 E2E: real onboarding diagnostic → skillProfile → personalization.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTrainingStore } from '../src/training/trainingStore.js';
import { AssessmentController } from '../../training-ui/assessmentController.js';
import { buildProfileDailyPlan, recordTrainingResult } from '../src/training/personalizedTraining.js';
import { deriveSkillTags } from '../src/training/planner.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { getTaskById } from '../src/training/taskLibraryBridge.js';
import { DEFAULT_SHOWN_COOLDOWN } from '../src/training/spotSelector.js';
import { classifyTrainingBucket, overlapCount } from '../src/training/playerDifferentiationFixtures.js';

const PLAN_COUNT = 20;
const PLAN_NOW = 1_700_000_100_000;

const USER_A_SEED = 'onboarding-e2e-user-a';
const USER_B_SEED = 'onboarding-e2e-user-b';

const REPORT = { A: null, B: null };

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
  if (item.skillTags && item.skillTags.length) return item.skillTags;
  return deriveSkillTags({
    concept: item.concept,
    tags: item.tags,
    street: item.street,
    position: item.position,
    heroStack: item.heroStack
  });
}

function streetKind(street) {
  const st = String(street || '').toLowerCase();
  if (st.includes('префлоп') || st.includes('preflop')) return 'preflop';
  if (st.includes('ривер') || st === 'river') return 'river';
  if (st.includes('тёрн') || st.includes('turn')) return 'turn';
  if (st.includes('флоп') || st === 'flop') return 'flop';
  return 'other';
}

// User A: miss ICM / push-fold / stack-depth diagnostic items only.
function shouldFailUserA(tags) {
  return tags.some((t) => ['icm', 'shortStack', 'stackDepthAwareness'].includes(t));
}

// User B: miss postflop / river / bluff-catch items; keep preflop + ICM answers correct.
function shouldFailUserB(item, tags) {
  const kind = streetKind(item.street);
  if (tags.includes('bluffCatch') || tags.includes('river')) return true;
  if (tags.includes('bluffing') && (kind === 'flop' || kind === 'turn' || kind === 'river')) return true;
  if (tags.includes('postflop') && (kind === 'flop' || kind === 'turn' || kind === 'river')) return true;
  if (tags.includes('postflop')
    && !tags.includes('preflop')
    && !tags.includes('shortStack')
    && !tags.includes('icm')) return true;
  return false;
}

function answerForUser(userId) {
  return (item) => {
    const tags = itemTags(item);
    const fail = userId === 'A' ? shouldFailUserA(tags) : shouldFailUserB(item, tags);
    return fail ? wrongChoice(item) : item.correct;
  };
}

function topWeaknesses(store, limit = 3) {
  const profile = store.loadSkillProfile();
  return Object.values(profile.skills || {})
    .filter((s) => s && s.score != null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => `${s.skill}(${s.score})`);
}

function taskDistributionFromPlan(plan) {
  const dist = { icmPush: 0, postRiver: 0, other: 0 };
  for (const spot of plan.spots || []) {
    const bucket = classifyTrainingBucket(spot);
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  return dist;
}

function runOnboardingUser(seed, userId) {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: `onboard_${seed}_` });
  store.savePersonalizationSeed(seed);

  const assessment = new AssessmentController({ store, count: 12 });
  const started = assessment.begin();
  assert.ok(started.started, 'onboarding diagnostic must start');

  const choose = answerForUser(userId);
  while (assessment.state === 'answering') {
    const item = assessment.current();
    assert.ok(item, 'expected assessment question');
    assessment.answer(choose(item));
  }

  assert.equal(assessment.state, 'done');
  assert.ok(assessment.result?.skillProfile, 'onboarding must produce skillProfile');
  assert.ok(store.loadSkillProfile(), 'skillProfile must persist in store');
  assert.ok(store.loadAssessment(), 'assessment result must persist in store');

  const plan = buildProfileDailyPlan({ store, count: PLAN_COUNT, now: PLAN_NOW });
  assert.equal(plan.filled, PLAN_COUNT);
  assert.equal(plan.personalized, true);

  return {
    seed,
    store,
    storage,
    assessment,
    plan,
    weaknesses: topWeaknesses(store),
    distribution: taskDistributionFromPlan(plan),
    taskIds: plan.spotIds,
    profile: store.loadSkillProfile()
  };
}

test('E2E onboarding: User A weak ICM/push-fold, User B weak postflop/river/bluff-catch', () => {
  const userA = runOnboardingUser(USER_A_SEED, 'A');
  const userB = runOnboardingUser(USER_B_SEED, 'B');

  REPORT.A = userA;
  REPORT.B = userB;

  const weakA = userA.weaknesses.join(', ');
  const weakB = userB.weaknesses.join(', ');

  assert.match(weakA, /icm|shortStack/i, `A weaknesses unexpected: ${weakA}`);
  assert.match(weakB, /postflop|river|bluffCatch|bluffing/i, `B weaknesses unexpected: ${weakB}`);

  assert.notDeepEqual(userA.profile.weakest?.skill, userB.profile.weakest?.skill,
    'profiles should infer different primary weaknesses');

  assert.ok(
    userA.distribution.icmPush > userB.distribution.icmPush,
    `A icmPush ${userA.distribution.icmPush} vs B ${userB.distribution.icmPush}`
  );
  assert.ok(
    userB.distribution.postRiver >= userA.distribution.postRiver,
    `B postRiver ${userB.distribution.postRiver} vs A ${userA.distribution.postRiver}`
  );

  const overlap = overlapCount(userA.taskIds, userB.taskIds);
  assert.ok(overlap < PLAN_COUNT, '20-task plans must not be identical');
  assert.notDeepEqual(userA.taskIds, userB.taskIds);
});

test('E2E onboarding: profile persists after reload', () => {
  const userA = REPORT.A || runOnboardingUser(USER_A_SEED, 'A');
  const reloaded = createTrainingStore({ storage: userA.storage, prefix: `onboard_${USER_A_SEED}_` });
  const profile = reloaded.loadSkillProfile();
  assert.ok(profile, 'reloaded profile missing');
  assert.equal(profile.weakest?.skill, userA.profile.weakest?.skill);

  const plan = buildProfileDailyPlan({ store: reloaded, count: PLAN_COUNT, now: PLAN_NOW });
  assert.deepEqual(plan.spotIds, userA.taskIds, 'reloaded store should produce same personalized plan');
});

test('E2E onboarding: anti-repeat suppresses recent history', () => {
  const userB = REPORT.B || runOnboardingUser(USER_B_SEED, 'B');
  const store = userB.store;
  const history = store.loadHistory() || [];
  const recentIds = history.slice(-DEFAULT_SHOWN_COOLDOWN).map((h) => h.spotId).filter(Boolean);

  let now = PLAN_NOW - 60_000;
  const seedIds = recentIds.length >= 10
    ? recentIds
    : userB.taskIds.slice(0, Math.min(DEFAULT_SHOWN_COOLDOWN, userB.taskIds.length));

  for (const id of seedIds) {
    const task = getTaskById(id);
    if (!task) continue;
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'GOOD', evLossBb: 0.05, now });
    now += 1;
  }

  const plan = buildProfileDailyPlan({ store, count: PLAN_COUNT, now: PLAN_NOW });
  const overlap = overlapCount(plan.spotIds, seedIds);
  assert.equal(overlap, 0, `anti-repeat failed: ${overlap} tasks repeated`);
});

test('report: onboarding differentiation summary', () => {
  const A = REPORT.A;
  const B = REPORT.B;
  assert.ok(A && B, 'run main E2E test first');
  console.log('\nUSER A inferred weaknesses:', A.weaknesses.join(', '));
  console.log('USER B inferred weaknesses:', B.weaknesses.join(', '));
  console.log('A task distribution:', `icmPush=${A.distribution.icmPush} postRiver=${A.distribution.postRiver} other=${A.distribution.other}`);
  console.log('B task distribution:', `icmPush=${B.distribution.icmPush} postRiver=${B.distribution.postRiver} other=${B.distribution.other}`);
  console.log('20-task overlap:', overlapCount(A.taskIds, B.taskIds));
  assert.ok(true);
});
