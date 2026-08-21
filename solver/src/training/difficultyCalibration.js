// Phase 8: difficulty calibration for spot selection weighting.
// Among skill-relevant candidates, prefer tasks closest to each skill's
// adaptive target. Weakness-first personalization is preserved — relevance
// scores dominate; difficulty breaks ties and nudges selection within bands.

import { clamp, round } from './util.js';
import {
  getTargetDifficulty,
  pickRelevantSkillForSpot,
  MIN_SAMPLES_FOR_TREND
} from './adaptiveDifficulty.js';

export const DIFFICULTY_CALIBRATION_WEIGHT = 2.8;
export const REVIEW_DIFFICULTY_WEIGHT = 1.6;
export const RELEVANCE_BAND = 0.45;

export function libraryMaxDifficulty(pool = []) {
  if (!pool?.length) return 5;
  return Math.max(...pool.map((s) => clamp(Number(s.difficulty) || 1, 1, 5)));
}

export function effectiveTargetForLibrary(target, poolMax = 5) {
  return clamp(round(target, 2), 1, poolMax);
}

export function difficultyProximityToTarget(spot, targetInfo, { poolMax = 5 } = {}) {
  const d = clamp(Number(spot?.difficulty) || 1, 1, 5);
  const rawTarget = targetInfo?.target ?? 3;
  const target = effectiveTargetForLibrary(rawTarget, poolMax);

  if (rawTarget > poolMax) {
    const dist = poolMax - d;
    if (dist <= 0) return 1;
    if (dist === 1) return 0.65;
    return 0.3;
  }

  if (rawTarget <= 1.5) {
    const dist = d - 1;
    if (dist <= 0) return 1;
    if (dist === 1) return 0.65;
    return 0.25;
  }

  const min = Math.min(targetInfo?.min ?? target - 1, poolMax);
  const max = Math.min(targetInfo?.max ?? target + 1, poolMax);

  if (d >= min && d <= max) {
    const dist = Math.abs(d - target);
    return clamp(1 - dist * 0.4, 0.35, 1);
  }

  const distOutside = d < min ? min - d : d - max;
  if (distOutside <= 0.5) return 0.45;
  if (distOutside <= 1) return 0.15;
  return -0.55;
}

export function spotHasReviewDueSkill(spot, masteryStates = {}) {
  if (!masteryStates) return false;
  for (const tag of spot?.skillTags || []) {
    if (masteryStates[tag]?.state === 'REVIEW_DUE') return true;
  }
  return false;
}

export function reviewDifficultyProximity(spot, targetInfo, { poolMax = 5 } = {}) {
  const d = clamp(Number(spot?.difficulty) || 1, 1, 5);
  // Spaced review favors accessible retrieval tasks; harder spots are not required.
  if (d === 1) return 1;
  if (d === 2) return 0.85;
  if (d === 3 && poolMax >= 3) return 0.55;
  return 0.35;
}

export function difficultyCalibrationBonus(spot, profile, recentResults = [], {
  masteryStates = null,
  slotKind = null,
  sampleDampen = true,
  poolMax = 5
} = {}) {
  if (!profile || !spot) return 0;

  const skill = pickRelevantSkillForSpot(spot, profile);
  const info = getTargetDifficulty(profile, skill, { recentResults });
  const masteryState = masteryStates?.[skill]?.state;

  let proximity;
  if (masteryState === 'REVIEW_DUE' || spotHasReviewDueSkill(spot, masteryStates)) {
    proximity = reviewDifficultyProximity(spot, info, { poolMax });
    return proximity * REVIEW_DIFFICULTY_WEIGHT;
  }

  proximity = difficultyProximityToTarget(spot, info, { poolMax });

  if (slotKind === 'exploration' && info.prefers?.challenge?.includes(spot.difficulty)) {
    proximity += 0.2;
  }
  if ((slotKind === 'maintenance_medium' || slotKind === 'maintenance_strong')
      && info.prefers?.maintenance?.includes(spot.difficulty)) {
    proximity += 0.15;
  }

  if (sampleDampen && (info.sampleSize ?? 0) < MIN_SAMPLES_FOR_TREND) {
    proximity = 0.55 * proximity + 0.2;
  }

  return proximity * DIFFICULTY_CALIBRATION_WEIGHT;
}

export function pickWeightWithDifficultyCalibration(item, poolMax = 5) {
  const relevance = Math.max(0.01, item.relevanceScore ?? item.score);
  const proximity = item.diffBonus ?? difficultyCalibrationBonus(
    item.spot,
    item.ctx?.skillProfile,
    item.ctx?.recentResults,
    {
      masteryStates: item.ctx?.skillMasteryStates,
      slotKind: item.slotKind,
      poolMax
    }
  );
  return relevance + proximity * 3.2;
}

export function pickFromCalibratedPool(pool, rng, poolMax = 5) {
  if (!pool.length) return null;
  const topRelevance = Math.max(...pool.map((x) => x.relevanceScore ?? x.score));
  const band = pool.filter((x) => (x.relevanceScore ?? x.score) >= topRelevance - RELEVANCE_BAND);
  const candidates = band.length ? band : pool.slice(0, Math.min(8, pool.length));

  const weighted = candidates.map((item) => ({
    item,
    weight: pickWeightWithDifficultyCalibration(item, poolMax)
  }));
  const total = weighted.reduce((s, x) => s + Math.max(0.01, x.weight), 0);
  let r = rng() * total;
  for (const entry of weighted) {
    r -= Math.max(0.01, entry.weight);
    if (r <= 0) return entry.item;
  }
  return weighted[0].item;
}

export function averageSelectedDifficulty(spots = []) {
  if (!spots.length) return 0;
  const sum = spots.reduce((s, spot) => s + (Number(spot.difficulty) || 1), 0);
  return round(sum / spots.length, 2);
}

export function averageSpotTargetDifficulty(spots = [], profile, recentResults = [], { poolMax = 5 } = {}) {
  if (!spots.length || !profile) return 0;
  let sum = 0;
  for (const spot of spots) {
    const skill = pickRelevantSkillForSpot(spot, profile);
    const target = getTargetDifficulty(profile, skill, { recentResults }).target;
    sum += effectiveTargetForLibrary(target, poolMax);
  }
  return round(sum / spots.length, 2);
}
