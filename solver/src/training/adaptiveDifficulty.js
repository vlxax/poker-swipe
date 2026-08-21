// Per-skill adaptive difficulty (Phase 5). Maps skill evidence to task difficulty
// targets (1..5), adjusts gradually from recent performance, and widens the
// band when confidence is low. Shared by the spot selector and tests.

import { clamp, round } from './util.js';

export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;
export const PERFORMANCE_WINDOW = 8;
export const MIN_SAMPLES_FOR_TREND = 3;

export function recentAccuracy(results = [], window = 10) {
  const recent = results.slice(-window);
  if (!recent.length) return null;
  const ok = recent.filter((r) => r.grade === 'EXCELLENT' || r.grade === 'GOOD' || r.nearOptimal === true).length;
  return ok / recent.length;
}

export function scoreToBaseDifficulty(score, prior = 55) {
  const s = score != null ? score : prior;
  return round(DIFFICULTY_MIN + (s / 100) * (DIFFICULTY_MAX - DIFFICULTY_MIN), 2);
}

export function recentResultsForSkill(recentResults = [], skill) {
  if (!skill) return [];
  return (recentResults || []).filter((r) => {
    if (r.skill === skill) return true;
    return Array.isArray(r.skillTags) && r.skillTags.includes(skill);
  });
}

export function adjustDifficultyFromPerformance(base, recentResults = [], skill, { window = PERFORMANCE_WINDOW } = {}) {
  const skillRecent = recentResultsForSkill(recentResults, skill);
  if (skillRecent.length < MIN_SAMPLES_FOR_TREND) return base;

  const acc = recentAccuracy(skillRecent, window);
  if (acc == null) return base;

  let adjusted = base;
  if (acc >= 0.85) adjusted += 0.25;
  else if (acc >= 0.75) adjusted += 0.12;
  else if (acc <= 0.35) adjusted -= 0.25;
  else if (acc <= 0.5) adjusted -= 0.12;

  adjusted = 0.82 * adjusted + 0.18 * base;
  return clamp(round(adjusted, 2), DIFFICULTY_MIN, DIFFICULTY_MAX);
}

export function difficultySpreadForConfidence(confidence = 0, sampleSize = 0) {
  if (confidence >= 0.7 && sampleSize >= 8) return 0.45;
  if (confidence >= 0.4 && sampleSize >= 5) return 0.75;
  return 1.15;
}

export function difficultyRangeForTarget(target, { confidence = 0, sampleSize = 0, spread = null } = {}) {
  const half = spread != null ? spread : difficultySpreadForConfidence(confidence, sampleSize);
  return {
    target: clamp(round(target, 2), DIFFICULTY_MIN, DIFFICULTY_MAX),
    min: clamp(round(target - half, 2), DIFFICULTY_MIN, DIFFICULTY_MAX),
    max: clamp(round(target + half, 2), DIFFICULTY_MIN, DIFFICULTY_MAX)
  };
}

export function preferredDifficulties(target, { confidence = 0, sampleSize = 0, score = null } = {}) {
  const t = clamp(Math.round(target), DIFFICULTY_MIN, DIFFICULTY_MAX);
  const lowConf = confidence < 0.4 || sampleSize < 5;

  let primary;
  if (target >= 4.5) primary = [4, 5];
  else if (target >= 3.5) primary = [3, 4, 5];
  else if (target >= 2.5) primary = [2, 3, 4];
  else if (target >= 1.5) primary = [1, 2, 3];
  else primary = [1, 2];

  if (lowConf) {
    const lo = Math.max(DIFFICULTY_MIN, t - 1);
    const hi = Math.min(DIFFICULTY_MAX, t + 1);
    primary = [...new Set([lo, t, hi])].sort((a, b) => a - b);
  }

  const challenge = [Math.min(DIFFICULTY_MAX, Math.max(...primary) + 1)].filter((d) => d <= DIFFICULTY_MAX);
  const maintenance = [Math.max(DIFFICULTY_MIN, Math.min(...primary) - 1)].filter((d) => d >= DIFFICULTY_MIN);

  if (score != null && score < 50 && !challenge.includes(DIFFICULTY_MAX)) {
    challenge.push(Math.min(DIFFICULTY_MAX, t + 1));
  }
  if (score != null && score >= 82 && !maintenance.includes(DIFFICULTY_MIN)) {
    maintenance.push(Math.max(DIFFICULTY_MIN, t - 1));
  }

  return {
    primary: [...new Set(primary)],
    challenge: [...new Set(challenge)],
    maintenance: [...new Set(maintenance)]
  };
}

export function pickRelevantSkillForSpot(spot, profile) {
  const tags = (spot && spot.skillTags) || [];
  if (!tags.length) return 'preflop';
  if (!profile || !profile.skills) return tags[0];

  const scored = tags.filter((tag) => {
    const entry = profile.skills[tag];
    return entry && entry.score != null && entry.sampleSize > 0;
  });
  if (!scored.length) return tags[0];

  let relevant = scored[0];
  let lowest = Infinity;
  for (const tag of scored) {
    const score = profile.skills[tag].score;
    if (score < lowest) {
      lowest = score;
      relevant = tag;
    }
  }
  return relevant;
}

export function getTargetDifficulty(profile, skill, { recentResults = [], now = Date.now() } = {}) {
  const entry = profile && profile.skills ? profile.skills[skill] : null;
  const score = entry && entry.score != null ? entry.score : null;
  const confidence = entry && entry.confidence != null ? entry.confidence : 0;
  const sampleSize = entry && entry.sampleSize != null ? entry.sampleSize : 0;

  const baseDifficulty = scoreToBaseDifficulty(score);
  const target = adjustDifficultyFromPerformance(baseDifficulty, recentResults, skill);
  const range = difficultyRangeForTarget(target, { confidence, sampleSize });
  const prefers = preferredDifficulties(range.target, { confidence, sampleSize, score });

  return {
    skill,
    score,
    confidence,
    sampleSize,
    baseDifficulty,
    target: range.target,
    min: range.min,
    max: range.max,
    prefers,
    updatedAt: now
  };
}

export function getSpotTargetDifficulty(spot, profile, recentResults = [], opts = {}) {
  const skill = pickRelevantSkillForSpot(spot, profile);
  return getTargetDifficulty(profile || {}, skill, { recentResults, ...opts }).target;
}

export function difficultyFit(spot, targetDiff, targetInfo = null, { poolMax = DIFFICULTY_MAX } = {}) {
  const d = clamp(Number(spot && spot.difficulty) || 1, DIFFICULTY_MIN, DIFFICULTY_MAX);
  const rawTarget = targetInfo && targetInfo.target != null ? targetInfo.target : targetDiff;
  const target = clamp(rawTarget, DIFFICULTY_MIN, poolMax);

  if (rawTarget > poolMax) {
    const dist = poolMax - d;
    if (dist <= 0) return 1;
    if (dist === 1) return 0.65;
    return 0.3;
  }

  if (rawTarget <= 1.5) {
    const dist = d - DIFFICULTY_MIN;
    if (dist <= 0) return 1;
    if (dist === 1) return 0.65;
    return 0.25;
  }

  if (targetInfo && targetInfo.min != null && targetInfo.max != null) {
    const min = Math.min(targetInfo.min, poolMax);
    const max = Math.min(targetInfo.max, poolMax);
    if (d >= min && d <= max) return 1;
    const dist = d < min ? min - d : d - max;
    if (dist <= 0.5) return 0.65;
    if (dist <= 1) return 0.25;
    return -0.75;
  }

  const dist = Math.abs(d - target);
  if (dist <= 0.5) return 1;
  if (dist <= 1) return 0.5;
  if (dist <= 1.5) return 0;
  return -1;
}

export function spotDifficultyScore(spot, profile, recentResults = [], { slotKind = null, poolMax = DIFFICULTY_MAX } = {}) {
  const skill = pickRelevantSkillForSpot(spot, profile);
  const info = getTargetDifficulty(profile || {}, skill, { recentResults });
  let score = difficultyFit(spot, info.target, info, { poolMax });

  if (slotKind === 'exploration' && info.prefers.challenge.includes(spot.difficulty)) {
    score += 0.35;
  }
  if ((slotKind === 'maintenance_medium' || slotKind === 'maintenance_strong')
      && info.prefers.maintenance.includes(spot.difficulty)) {
    score += 0.25;
  }
  if (info.score != null && info.score < 50 && spot.difficulty === info.prefers.challenge[0]) {
    score += 0.15;
  }
  if (info.score != null && info.score >= 82 && spot.difficulty === info.prefers.maintenance[0]) {
    score += 0.15;
  }

  return score;
}

export function adaptiveDifficulty({
  current = 3,
  recentResults = [],
  window = 10,
  skillProfile = null,
  skill = null
} = {}) {
  if (skillProfile && skill) {
    return getTargetDifficulty(skillProfile, skill, { recentResults }).target;
  }

  const acc = recentAccuracy(recentResults, window);
  let d = current;
  if (acc != null) {
    if (acc >= 0.85) d += 0.35;
    else if (acc <= 0.4) d -= 0.5;
    else if (acc <= 0.55) d -= 0.2;
    d = 0.8 * d + 0.2 * current;
  }
  if (skillProfile && skillProfile.overall != null) {
    const overallTarget = scoreToBaseDifficulty(skillProfile.overall);
    d = 0.65 * d + 0.35 * overallTarget;
  }
  return clamp(round(d, 2), DIFFICULTY_MIN, DIFFICULTY_MAX);
}
