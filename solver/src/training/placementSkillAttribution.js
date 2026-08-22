// Placement assessment skill attribution — primary vs secondary skills with
// tier-weighted evidence. Fixes multi-skill bleed (e.g. preflop tagged postflop).

import { SKILLS } from './skillProfile.js';
import { deriveSkillTags } from './planner.js';

const SECONDARY_SKILL_WEIGHT = 0.25;

export function taskStreetKind(task) {
  const street = String(task?.street || '').toUpperCase();
  if (street === 'ПРЕФЛОП') return 'preflop';
  if (street === 'ФЛОП') return 'flop';
  if (street === 'ТЁРН') return 'turn';
  if (street === 'РИВЕР') return 'river';
  return null;
}

export function derivePrimarySkill(task) {
  if (!task) return 'postflop';
  const street = taskStreetKind(task);
  const tags = deriveSkillTags(task);
  const heroStack = task.heroStack != null ? Number(task.heroStack) : (task.effStack != null ? Number(task.effStack) : null);
  const stage = String(task.stage || '').toLowerCase();
  const icmStage = /баббл|itm|финальн|bubble|pko/.test(stage);

  if (street === 'preflop') {
    if (tags.includes('icm') && (icmStage || (heroStack != null && heroStack <= 22))) return 'icm';
    if (tags.includes('shortStack') && heroStack != null && heroStack <= 15) return 'shortStack';
    return 'preflop';
  }
  if (street === 'river') {
    if (tags.includes('bluffCatch')) return 'bluffCatch';
    if (tags.includes('bluffing')) return 'bluffing';
    return 'river';
  }
  if (street === 'flop' || street === 'turn') {
    if (tags.includes('rangeReading')) return 'rangeReading';
    return 'postflop';
  }
  return tags.find((t) => SKILLS.includes(t)) || 'postflop';
}

export function assessmentSkillWeights(item) {
  const task = item?._task || item;
  const tags = (item?.skillTags && item.skillTags.length)
    ? item.skillTags.slice()
    : deriveSkillTags(task);
  const primary = item?.primarySkill || derivePrimarySkill(task);
  const seen = new Set();
  const weights = [];

  if (primary && SKILLS.includes(primary)) {
    weights.push({ skill: primary, weight: 1 });
    seen.add(primary);
  }

  for (const tag of tags) {
    if (!tag || seen.has(tag) || !SKILLS.includes(tag)) continue;
    weights.push({ skill: tag, weight: SECONDARY_SKILL_WEIGHT });
    seen.add(tag);
  }

  if (!weights.length && primary) weights.push({ skill: primary, weight: 1 });
  return weights;
}

export function assessmentEvLossBb(result) {
  const tier = clampTier(result?.tier ?? result?.difficulty ?? 2);
  if (result?.correct) return 0;
  if (result?.nearOptimal) return round(0.1 + (6 - tier) * 0.012, 4);
  // Missing fundamentals should hurt the profile more than missing advanced spots.
  return round(0.45 + (6 - tier) * 0.13, 4);
}

const ASSESSMENT_TIER_WEIGHT = { 1: 0.85, 2: 1.0, 3: 1.1, 4: 1.25, 5: 1.4 };

export function assessmentOverallScore(results) {
  if (!results?.length) return null;
  let weightSum = 0;
  let qualitySum = 0;
  for (const result of results) {
    const tier = clampTier(result?.tier ?? result?.difficulty ?? 2);
    const tierWeight = ASSESSMENT_TIER_WEIGHT[tier] || 1;
    const loss = assessmentEvLossBb(result);
    const quality = Math.max(0, Math.min(1, 1 - loss));
    weightSum += tierWeight;
    qualitySum += quality * tierWeight;
  }
  if (!weightSum) return null;
  return compressSkillScore(100 * (qualitySum / weightSum));
}

export function compressSkillScore(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n <= 80) return Math.round(n);
  return Math.round(80 + (n - 80) * 0.6);
}

function clampTier(tier) {
  const n = Number(tier);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
