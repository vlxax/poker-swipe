// Per mini-app personalization specs — reuse Phase 2 planner/selector.

import { buildDailyPlan } from './planner.js';
import { getMttTaskPool } from './taskLibraryBridge.js';
import { seededRng } from './personalizationSeed.js';

export const MINI_APP_SPECS = {
  daily: { count: 7 },
  sizing: {
    count: 1,
    skillTargets: { betSizing: 4, postflop: 2, river: 1 }
  },
  swipe: { count: 10 },
  review: { count: 1, weaknessBias: true, spacedReview: true },
  xray: {
    count: 1,
    skillTargets: { rangeReading: 4, postflop: 2, bluffCatch: 2, betSizing: 1 }
  },
  quick5: { count: 5 },
  memory: { count: 1, weaknessBias: true, spacedReview: true }
};

function buildProgressMap(store) {
  const progressByConcept = {};
  for (const p of store.listProgress() || []) {
    if (p && p.concept) progressByConcept[p.concept] = p;
  }
  return progressByConcept;
}

export function buildMiniAppPlan(store, appId, {
  pool = null,
  history = null,
  count = null,
  now = Date.now(),
  rng = null
} = {}) {
  const spec = MINI_APP_SPECS[appId] || MINI_APP_SPECS.daily;
  const skillProfile = typeof store.loadSkillProfile === 'function' ? store.loadSkillProfile() : null;
  const hist = history || store.loadHistory() || [];
  const taskPool = pool || getMttTaskPool();
  const seed = typeof store.getOrCreatePersonalizationSeed === 'function'
    ? store.getOrCreatePersonalizationSeed()
    : null;
  const random = rng || (seed != null ? seededRng(`${seed}|${appId}|${now}`) : Math.random);

  let skillTargets = spec.skillTargets || null;
  if (spec.weaknessBias && skillProfile && skillProfile.weakest && skillProfile.weakest.skill) {
    skillTargets = { ...(skillTargets || {}), [skillProfile.weakest.skill]: 3 };
  }

  if (spec.spacedReview && skillProfile && skillProfile.weakest) {
    const weakSkill = skillProfile.weakest.skill;
    const weakSpot = hist.find((h) => h.skillTag === weakSkill || h.concept);
    if (weakSpot && weakSpot.spotId) {
      hist.unshift({ ...weakSpot, spacedReview: true, at: now - 1 });
    }
  }

  return buildDailyPlan({
    pool: taskPool,
    progressByConcept: buildProgressMap(store),
    history: hist,
    recentResults: hist.map((h) => ({
      concept: h.concept,
      grade: h.grade,
      nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD' || h.grade === 'g',
      skillTags: h.skillTags || []
    })),
    skillProfile,
    leakProfiles: store.listProfiles() || [],
    count: count != null ? count : spec.count,
    skillTargets,
    now,
    rng: random
  });
}
