// Phase 10: simulated player trajectories for dynamic profile verification.

import { createTrainingStore } from './trainingStore.js';
import { getTaskPool } from './taskLibraryBridge.js';
import { deriveSkillTags } from './planner.js';
import { recordTrainingResult, buildProfileDailyPlan } from './personalizedTraining.js';
import { drillFromLibraryTask } from './libraryDrill.js';
import { rebuildSkillProfileFromStore } from './dynamicPlayerProfile.js';
import { SKILL_DIAGNOSES } from './dynamicPlayerProfile.js';

export const DYNAMIC_PLAN_COUNT = 20;
export const DYNAMIC_PLAN_NOW = 1_750_000_000_000;

export const DYNAMIC_PLAYER_SEEDS = {
  A: 'dynamic-player-a-improving',
  B: 'dynamic-player-b-declining',
  C: 'dynamic-player-c-stable-strong',
  D: 'dynamic-player-d-new-low-confidence'
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

function recordSeries(store, tasks, { grades, evLosses, startAt, stepMs = 1 }) {
  let now = startAt;
  for (let i = 0; i < grades.length; i++) {
    const task = tasks[i % tasks.length];
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, {
      drill: gen.drill,
      grade: grades[i],
      evLossBb: evLosses[i],
      now
    });
    now += stepMs;
  }
  return now;
}

export function buildDynamicPlayerStore(profileId) {
  const pool = getTaskPool();
  const postflop = pool.filter((t) => t.street === 'flop' || t.street === 'turn');
  const icm = tasksWithSkill(pool, 'icm');
  const river = tasksWithSkill(pool, 'river');
  const preflop = tasksWithSkill(pool, 'preflop');
  const balanced = [...icm, ...river, ...postflop, ...preflop];

  const store = createTrainingStore({
    storage: memoryStorage(),
    prefix: `dyn_${profileId}_`
  });
  store.savePersonalizationSeed(DYNAMIC_PLAYER_SEEDS[profileId]);

  let now = 1_000_000_000_000;

  if (profileId === 'A') {
    // Improving postflop: early mistakes → recent excellence.
    const grades = [
      ...Array(18).fill('MISTAKE'),
      ...Array(6).fill('GOOD'),
      ...Array(14).fill('EXCELLENT')
    ];
    const ev = [
      ...Array(18).fill(0.85),
      ...Array(6).fill(0.18),
      ...Array(14).fill(0.02)
    ];
    now = recordSeries(store, postflop, { grades, evLosses: ev, startAt: now });
    recordSeries(store, preflop, {
      grades: Array(12).fill('GOOD'),
      evLosses: Array(12).fill(0.08),
      startAt: now
    });
  } else if (profileId === 'B') {
    // Declining ICM: strong history, recent slump.
    const grades = [
      ...Array(20).fill('EXCELLENT'),
      ...Array(16).fill('MISTAKE')
    ];
    const ev = [
      ...Array(20).fill(0.01),
      ...Array(16).fill(0.92)
    ];
    now = recordSeries(store, icm, { grades, evLosses: ev, startAt: now });
    recordSeries(store, river, {
      grades: Array(10).fill('GOOD'),
      evLosses: Array(10).fill(0.1),
      startAt: now
    });
  } else if (profileId === 'C') {
    // Stable strong across skills.
    recordSeries(store, balanced, {
      grades: Array(60).fill('EXCELLENT'),
      evLosses: Array(60).fill(0.015),
      startAt: now
    });
  } else if (profileId === 'D') {
    // New player: tiny sample, mixed results.
    recordSeries(store, preflop.slice(0, 5), {
      grades: ['GOOD', 'MISTAKE', 'GOOD'],
      evLosses: [0.05, 0.7, 0.12],
      startAt: now
    });
  } else {
    throw new Error(`Unknown dynamic profile: ${profileId}`);
  }

  return store;
}

export function buildDynamicPlayerReport(profileId) {
  const store = buildDynamicPlayerStore(profileId);
  const profile = rebuildSkillProfileFromStore(store, { now: DYNAMIC_PLAN_NOW });
  const plan = buildProfileDailyPlan({ store, count: DYNAMIC_PLAN_COUNT, now: DYNAMIC_PLAN_NOW });
  const tracks = profile?.tracks || {};
  const diagnoses = Object.fromEntries(
    Object.entries(tracks).map(([k, v]) => [k, v.diagnosis])
  );
  const focusSkills = Object.entries(tracks)
    .sort((a, b) => (a[1].score ?? 999) - (b[1].score ?? 999))
    .slice(0, 4)
    .map(([skill, t]) => ({
      skill,
      score: t.score,
      diagnosis: t.diagnosis,
      recentAccuracy: t.recentAccuracy,
      longTermAccuracy: t.longTermAccuracy,
      trend: t.trend
    }));

  const spotSkills = new Set();
  for (const spot of plan?.spots || []) {
    for (const tag of spot.skillTags || []) spotSkills.add(tag);
  }

  return {
    profileId,
    profile,
    plan,
    diagnoses,
    focusSkills,
    taskIds: plan?.spotIds || (plan?.spots || []).map((s) => s.id),
    spotSkills: [...spotSkills],
    overall: profile?.overall,
    confidence: profile?.confidence
  };
}

export function diagnosisCount(report, diagnosis) {
  return Object.values(report.diagnoses).filter((d) => d === diagnosis).length;
}

export function overlapCount(a = [], b = []) {
  const setB = new Set(b);
  return a.filter((id) => setB.has(id)).length;
}

export { SKILL_DIAGNOSES };
