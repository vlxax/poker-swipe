// Deterministic player profiles for Phase 4 differentiation testing.
// All history is built through recordTrainingResult (production write path).

import { createTrainingStore } from './trainingStore.js';
import { getTaskPool } from './taskLibraryBridge.js';
import { deriveSkillTags } from './planner.js';
import { recordTrainingResult, buildProfileDailyPlan } from './personalizedTraining.js';
import { drillFromLibraryTask } from './libraryDrill.js';

export const DIFFERENTIATION_PLAN_COUNT = 20;
export const DIFFERENTIATION_PLAN_NOW = 1_700_000_000_000;

export const PLAYER_PROFILE_SEEDS = {
  A: 'player-diff-a-icm-pushfold',
  B: 'player-diff-b-postflop-river',
  C: 'player-diff-c-balanced'
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

function tasksWithSkill(pool, skill) {
  return pool.filter((t) => deriveSkillTags(t).includes(skill));
}

function tasksByStreet(pool, street) {
  return pool.filter((t) => t.street === street);
}

function recordOnTasks(store, tasks, { grade, evLossBb, count, startAt }) {
  let now = startAt;
  if (!tasks.length) return now;
  for (let i = 0; i < count; i++) {
    const task = tasks[i % tasks.length];
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade, evLossBb, now });
    now += 1;
  }
  return now;
}

function buildTaskBuckets(pool) {
  const icm = tasksWithSkill(pool, 'icm');
  const shortStack = tasksWithSkill(pool, 'shortStack').filter((t) => !deriveSkillTags(t).includes('icm'));
  const bluffCatch = tasksWithSkill(pool, 'bluffCatch');
  const river = tasksByStreet(pool, 'river');
  const postflop = pool.filter((t) => t.street === 'flop' || t.street === 'turn');
  const preflop = tasksByStreet(pool, 'preflop');
  const balanced = [...icm, ...shortStack, ...river, ...postflop, ...preflop];
  return { icm, shortStack, bluffCatch, river, postflop, preflop, balanced };
}

export function buildPlayerStore(profileId) {
  const pool = getTaskPool();
  const buckets = buildTaskBuckets(pool);
  const seed = PLAYER_PROFILE_SEEDS[profileId];
  const store = createTrainingStore({ storage: memoryStorage(), prefix: `diff_${profileId}_` });
  store.savePersonalizationSeed(seed);

  let now = 1_000_000_000_000;

  if (profileId === 'A') {
    // Weak ICM / push-fold; strong postflop / river.
    now = recordOnTasks(store, buckets.icm, { grade: 'MISTAKE', evLossBb: 0.95, count: 80, startAt: now });
    now = recordOnTasks(store, buckets.shortStack, { grade: 'MISTAKE', evLossBb: 0.92, count: 60, startAt: now });
    now = recordOnTasks(store, buckets.river, { grade: 'EXCELLENT', evLossBb: 0.01, count: 40, startAt: now });
    now = recordOnTasks(store, buckets.postflop, { grade: 'EXCELLENT', evLossBb: 0.01, count: 35, startAt: now });
  } else if (profileId === 'B') {
    // Weak postflop / bluff-catch / river; strong ICM / push-fold.
    now = recordOnTasks(store, buckets.bluffCatch, { grade: 'MISTAKE', evLossBb: 0.98, count: 100, startAt: now });
    now = recordOnTasks(store, buckets.river, { grade: 'MISTAKE', evLossBb: 0.95, count: 80, startAt: now });
    now = recordOnTasks(store, buckets.postflop, { grade: 'MISTAKE', evLossBb: 0.88, count: 45, startAt: now });
    now = recordOnTasks(store, buckets.icm, { grade: 'EXCELLENT', evLossBb: 0.01, count: 45, startAt: now });
    now = recordOnTasks(store, buckets.shortStack, { grade: 'EXCELLENT', evLossBb: 0.01, count: 35, startAt: now });
  } else if (profileId === 'C') {
    // Balanced strong player — broad good results, no major weakness.
    now = recordOnTasks(store, buckets.balanced, { grade: 'EXCELLENT', evLossBb: 0.02, count: 160, startAt: now });
  } else {
    throw new Error(`Unknown profile: ${profileId}`);
  }

  return store;
}

export function classifyTrainingBucket(spot) {
  const tags = spot.skillTags || [];
  if (tags.includes('icm')) return 'icmPush';
  if (tags.includes('shortStack') && spot.street === 'preflop') return 'icmPush';
  if (tags.includes('bluffCatch')) return 'postRiver';
  if (spot.street === 'river' || tags.includes('river')) return 'postRiver';
  if (spot.street === 'flop' || spot.street === 'turn') return 'postRiver';
  return 'other';
}

export function taskDistribution(spots = []) {
  const dist = { icmPush: 0, postRiver: 0, other: 0 };
  for (const spot of spots) {
    const bucket = classifyTrainingBucket(spot);
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  return dist;
}

export function topWeaknesses(store, limit = 3) {
  const profile = store.loadSkillProfile();
  if (!profile || !profile.skills) return [];
  return Object.values(profile.skills)
    .filter((s) => s && s.score != null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => ({ skill: s.skill, score: s.score }));
}

export function generateDifferentiationPlan(store, {
  count = DIFFERENTIATION_PLAN_COUNT,
  now = DIFFERENTIATION_PLAN_NOW
} = {}) {
  return buildProfileDailyPlan({ store, count, now });
}

export function buildDifferentiationReport(profileId) {
  const store = buildPlayerStore(profileId);
  const plan = generateDifferentiationPlan(store);
  const weaknesses = topWeaknesses(store);
  const distribution = taskDistribution(plan.spots || []);
  return {
    profileId,
    store,
    plan,
    weaknesses,
    distribution,
    taskIds: plan.spotIds || (plan.spots || []).map((s) => s.id),
    skillProfile: store.loadSkillProfile(),
    historyLength: (store.loadHistory() || []).length,
    seed: store.loadPersonalizationSeed()?.seed
  };
}

export function overlapCount(idsA = [], idsB = []) {
  const setB = new Set(idsB);
  return idsA.filter((id) => setB.has(id)).length;
}

export function uniqueSkillCount(spots = []) {
  const skills = new Set();
  for (const spot of spots) {
    for (const tag of spot.skillTags || []) skills.add(tag);
  }
  return skills.size;
}
