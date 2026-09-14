// Canonical weakness skill resolution for session slots (P0).
// Aligns primary_weakness picks with dynamic diagnoses + skill targets + tiers.

import { SKILL_DIAGNOSES, diagnosisPriorityBoost } from './skillDiagnoses.js';
import { computeDynamicSkillTargets } from './dynamicSkillTargets.js';
import { buildSkillTiers } from './skillTiers.js';
import { getTargetDifficulty, pickRelevantSkillForSpot } from './adaptiveDifficulty.js';

const FOCUS_DIAGNOSES = new Set([
  SKILL_DIAGNOSES.TRUE_WEAKNESS,
  SKILL_DIAGNOSES.DECAYING,
  SKILL_DIAGNOSES.TEMPORARY_MISTAKE,
  SKILL_DIAGNOSES.LEARNING
]);

function hasImprovingGap(track) {
  return track.recentAccuracy != null
    && track.longTermAccuracy != null
    && track.recentAccuracy - track.longTermAccuracy >= 0.25;
}

/** Skills flagged by dynamic profile as needing focus (canonical skill IDs). */
export function diagnosedFocusSkills(dynamicProfile, limit = 4) {
  const tracks = dynamicProfile?.tracks;
  if (!tracks) return [];
  return Object.values(tracks)
    .filter((t) => t && (
      FOCUS_DIAGNOSES.has(t.diagnosis)
      || (t.diagnosis === SKILL_DIAGNOSES.IMPROVING && hasImprovingGap(t))
    ))
    .sort((a, b) => {
      const pb = diagnosisPriorityBoost(b.diagnosis) - diagnosisPriorityBoost(a.diagnosis);
      if (pb !== 0) return pb;
      return (a.score ?? 999) - (b.score ?? 999);
    })
    .map((t) => t.skill)
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Ordered chain for primary_weakness slot: primary skill first, then deterministic fallbacks.
 */
export function resolvePrimaryWeaknessChain(ctx = {}) {
  const skillProfile = ctx.skillProfile;
  const dynamicProfile = ctx.dynamicProfile || skillProfile?.dynamic || null;
  const tiers = ctx.tiers || buildSkillTiers(skillProfile);
  const count = ctx.count || 7;

  const diagnosed = diagnosedFocusSkills(dynamicProfile, 4);
  const targets = computeDynamicSkillTargets(dynamicProfile, count);
  const fromTargets = targets
    ? Object.entries(targets).sort((a, b) => b[1] - a[1]).map(([skill]) => skill)
    : [];

  const chain = [];
  const push = (skill) => {
    if (skill && !chain.includes(skill)) chain.push(skill);
  };

  if (fromTargets[0]) push(fromTargets[0]);
  else if (diagnosed[0]) push(diagnosed[0]);
  else if (tiers.primary?.[0]) push(tiers.primary[0]);
  else if (skillProfile?.weakest?.skill) push(skillProfile.weakest.skill);

  for (const s of diagnosed) push(s);
  for (const s of fromTargets.slice(1)) push(s);
  for (const s of tiers.primary || []) push(s);
  for (const s of tiers.secondary || []) push(s);

  return {
    primary: chain[0] || null,
    fallbacks: chain.slice(1),
    diagnosed,
    fromTargets
  };
}

export function spotMatchesSkillId(spot, skillId) {
  if (!skillId) return false;
  return (spot.skillTags || []).includes(skillId);
}

export function spotMatchesAnySkill(spot, skills = []) {
  if (!skills.length) return true;
  return (spot.skillTags || []).some((t) => skills.includes(t));
}

/** Filter weakness-slot pool to primary skill, then documented fallbacks. */
export function filterPoolForPrimaryWeakness(pool, ctx) {
  const { primary, fallbacks } = resolvePrimaryWeaknessChain(ctx);
  if (!primary) return pool;

  const strict = pool.filter((x) => spotMatchesSkillId(x.spot, primary));
  if (strict.length) return strict;

  for (const fb of fallbacks) {
    const next = pool.filter((x) => spotMatchesSkillId(x.spot, fb));
    if (next.length) return next;
  }

  const allFocus = [primary, ...fallbacks];
  const anyFocus = pool.filter((x) => spotMatchesAnySkill(x.spot, allFocus));
  return anyFocus.length ? anyFocus : [];
}

export function filterPoolForSecondaryWeakness(pool, ctx) {
  const { fallbacks, diagnosed } = resolvePrimaryWeaknessChain(ctx);
  const secondarySkills = fallbacks.length
    ? fallbacks
    : (ctx.tiers?.secondary || diagnosed.slice(1));
  if (!secondarySkills.length) return pool;
  const matched = pool.filter((x) => spotMatchesAnySkill(x.spot, secondarySkills));
  return matched.length ? matched : pool;
}

const WEAKNESS_SLOTS = new Set(['primary_weakness', 'secondary_weakness']);

function weaknessSkillsForSlot(ctx, slotKind) {
  const chain = resolvePrimaryWeaknessChain(ctx);
  if (slotKind === 'primary_weakness') {
    return [chain.primary, ...chain.fallbacks].filter(Boolean);
  }
  if (slotKind === 'secondary_weakness') {
    return (chain.fallbacks.length
      ? chain.fallbacks
      : (ctx.tiers?.secondary || chain.diagnosed.slice(1))).filter(Boolean);
  }
  return [];
}

/** Integer difficulties allowed for a weakness slot (prefers.primary ∩ beginner L1–L3 when overall < 35). */
export function weaknessSlotAllowedDifficulties(ctx, skill) {
  const profile = ctx.skillProfile;
  const info = getTargetDifficulty(profile, skill, { recentResults: ctx.recentResults || [] });
  let allowed = [...new Set(info.prefers.primary)].sort((a, b) => a - b);
  const overall = profile?.overall;
  if (overall != null && overall < 35) {
    const capped = allowed.filter((d) => d <= 3);
    allowed = capped.length ? capped : [1, 2, 3];
  }
  return { allowed, info };
}

export function distanceToAllowedDifficulty(d, allowed) {
  if (allowed.includes(d)) return 0;
  let best = Infinity;
  for (const a of allowed) best = Math.min(best, Math.abs(d - a));
  return best;
}

/**
 * Whether a weakness-slot task satisfies the adaptive difficulty contract.
 * Strict: difficulty ∈ prefers.primary (with beginner cap).
 * Nearest (+1): when no library task for skill is strict in-band.
 */
export function weaknessSlotDifficultyMatches(spot, ctx, {
  slotKind = null, taskPool = null, usedIds = null
} = {}) {
  if (!ctx?.skillProfile || spot?.difficulty == null) return true;
  const auditOpts = { usedIds };
  if (slotKind === 'primary_weakness') {
    const chain = resolvePrimaryWeaknessChain(ctx);
    const targets = [chain.primary, ...chain.fallbacks].filter(Boolean);
    const tags = spot.skillTags || [];
    const skill = targets.find((s) => tags.includes(s)) || chain.primary;
    if (!skill) return true;
    return weaknessSlotMatchesForSkill(spot, ctx, skill, taskPool, auditOpts);
  }
  if (slotKind === 'secondary_weakness') {
    const matched = matchedWeaknessSkillsForSpot(spot, ctx, slotKind);
    const skills = matched.length ? matched : [bandSkillForSpot(spot, ctx, { slotKind })];
    return skills.some((skill) => weaknessSlotMatchesForSkill(spot, ctx, skill, taskPool, auditOpts));
  }
  return spotWithinAdaptiveBand(spot, ctx, { relax: 0, slotKind });
}

/** Min distance from spot difficulty to allowed set for this weakness slot. */
export function weaknessBandDistance(spot, ctx, slotKind) {
  if (slotKind === 'primary_weakness') {
    const chain = resolvePrimaryWeaknessChain(ctx);
    const targets = [chain.primary, ...chain.fallbacks].filter(Boolean);
    const tags = spot.skillTags || [];
    const skill = targets.find((s) => tags.includes(s)) || chain.primary;
    if (!skill) return 0;
    const { allowed } = weaknessSlotAllowedDifficulties(ctx, skill);
    return distanceToAllowedDifficulty(spot.difficulty, allowed);
  }
  const matched = matchedWeaknessSkillsForSpot(spot, ctx, slotKind);
  const skills = matched.length ? matched : [bandSkillForSpot(spot, ctx, { slotKind })];
  return Math.min(...skills.map((skill) => {
    const { allowed } = weaknessSlotAllowedDifficulties(ctx, skill);
    return distanceToAllowedDifficulty(spot.difficulty, allowed);
  }));
}

function matchedWeaknessSkillsForSpot(spot, ctx, slotKind) {
  const skills = weaknessSkillsForSlot(ctx, slotKind);
  const tags = spot.skillTags || [];
  const matched = skills.filter((s) => tags.includes(s));
  if (matched.length) return matched;
  const chain = resolvePrimaryWeaknessChain(ctx);
  if (slotKind === 'primary_weakness' && chain.primary) return [chain.primary];
  if (skills[0]) return [skills[0]];
  return [];
}

/** Skill used for adaptive band on a weakness slot (best-matching tag for this difficulty). */
export function bandSkillForSpot(spot, ctx, { slotKind = null, skillOverride = null } = {}) {
  if (skillOverride) return skillOverride;
  if (slotKind === 'primary_weakness' || slotKind === 'secondary_weakness') {
    const matched = matchedWeaknessSkillsForSpot(spot, ctx, slotKind);
    if (!matched.length) return pickRelevantSkillForSpot(spot, ctx.skillProfile);
    const chain = resolvePrimaryWeaknessChain(ctx);
    if (slotKind === 'primary_weakness' && chain.primary && matched.includes(chain.primary)) {
      return chain.primary;
    }
    let best = matched[0];
    let bestDist = Infinity;
    for (const skill of matched) {
      const { allowed } = weaknessSlotAllowedDifficulties(ctx, skill);
      const dist = distanceToAllowedDifficulty(spot.difficulty, allowed);
      if (dist < bestDist) {
        bestDist = dist;
        best = skill;
      }
    }
    return best;
  }
  return pickRelevantSkillForSpot(spot, ctx.skillProfile);
}

function skillTasksForAudit(taskPool, skill, usedIds) {
  return (taskPool || []).filter((t) => {
    if (!(t.skillTags || []).includes(skill)) return false;
    if (usedIds && usedIds.has(t.id)) return false;
    return true;
  });
}

function weaknessSlotMatchesForSkill(spot, ctx, skill, taskPool, { usedIds = null } = {}) {
  const { allowed } = weaknessSlotAllowedDifficulties(ctx, skill);
  const d = spot.difficulty;
  const overall = ctx.skillProfile?.overall;
  const strictBeginner = overall != null && overall < 35;
  if (allowed.includes(d)) return true;
  const dist = distanceToAllowedDifficulty(d, allowed);
  if (strictBeginner) return false;
  if (dist <= 1) return true;
  if (!Array.isArray(taskPool) || !taskPool.length) return false;
  const skillTasks = skillTasksForAudit(taskPool, skill, usedIds);
  if (!skillTasks.length) return dist <= 1.01;
  const bestPool = Math.min(...skillTasks.map((t) => distanceToAllowedDifficulty(t.difficulty, allowed)));
  if (bestPool <= 1 && dist > 1) return false;
  return dist <= bestPool + 0.01;
}

export function spotWithinAdaptiveBand(spot, ctx, { relax = 0, slotKind = null, skillOverride = null } = {}) {
  if (!ctx?.skillProfile || spot?.difficulty == null) return true;
  const skill = bandSkillForSpot(spot, ctx, { slotKind, skillOverride });
  const { allowed, info } = weaknessSlotAllowedDifficulties(ctx, skill);
  const d = spot.difficulty;
  if (allowed.includes(d)) return true;
  if (relax > 0 && distanceToAllowedDifficulty(d, allowed) <= relax) return true;
  const lo = info.min - relax;
  const hi = info.max + relax;
  return d >= lo && d <= hi;
}

function weaknessSkillsForBand(ctx, slotKind, tiers) {
  const chain = resolvePrimaryWeaknessChain({ ...ctx, tiers });
  if (slotKind === 'primary_weakness') {
    return [chain.primary, ...chain.fallbacks].filter(Boolean);
  }
  return (chain.fallbacks.length
    ? chain.fallbacks
    : (tiers?.secondary || chain.diagnosed.slice(1))).filter(Boolean);
}

/** Unused spots in source with strict (distance 0) adaptive band for this weakness slot. */
export function strictInBandSpotsFromSource(source, usedIds, ctx, slotKind, tiers) {
  const skills = weaknessSkillsForBand(ctx, slotKind, tiers);
  if (!skills.length || !Array.isArray(source)) return [];
  const bandCtx = { ...ctx, tiers };
  return source.filter((s) => {
    if (usedIds.has(s.id)) return false;
    const tags = s.skillTags || [];
    const matched = skills.filter((sk) => tags.includes(sk));
    if (!matched.length) return false;
    return matched.some((sk) => {
      const { allowed } = weaknessSlotAllowedDifficulties(bandCtx, sk);
      return allowed.includes(s.difficulty);
    });
  });
}

/**
 * When strict in-band tasks exist in source, pool must only contain those (P0 contract).
 */
export function restrictPoolToStrictInBandWhenAvailable(pool, source, usedIds, ctx, slotKind, tiers, scoreForSlot) {
  const strictSpots = strictInBandSpotsFromSource(source, usedIds, ctx, slotKind, tiers);
  if (!strictSpots.length) return pool;
  const strictIds = new Set(strictSpots.map((s) => s.id));
  let narrowed = pool.filter((x) => strictIds.has(x.spot.id));
  if (!narrowed.length) {
    narrowed = strictSpots.map((s) => ({
      spot: s,
      score: Math.max(scoreForSlot(s, slotKind, ctx), 0.5),
      bucket: slotKind === 'primary_weakness' || slotKind === 'secondary_weakness' ? 'weakness' : 'maintenance',
      slotKind
    }));
  }
  return narrowed.length ? narrowed : pool;
}

/** Prefer in-band tasks; if none, nearest integer difficulty (documented fallback). */
export function filterPoolByAdaptiveBand(pool, ctx, { slotKind = null, minResults = 1, skillOverride = null } = {}) {
  if (!WEAKNESS_SLOTS.has(slotKind) || !pool.length) return pool;

  const scored = pool.map((x) => {
    const skill = bandSkillForSpot(x.spot, ctx, { slotKind, skillOverride });
    const { allowed } = weaknessSlotAllowedDifficulties(ctx, skill);
    const dist = distanceToAllowedDifficulty(x.spot.difficulty, allowed);
    return { item: x, dist };
  });
  const strict = scored.filter((x) => x.dist === 0);
  if (strict.length >= minResults) {
    return strict.sort((a, b) => b.item.score - a.item.score).map((x) => x.item);
  }

  const inBand = pool.filter((x) => spotWithinAdaptiveBand(x.spot, ctx, {
    relax: 0, slotKind, skillOverride
  }));
  if (inBand.length >= minResults) return inBand;

  scored.sort((a, b) => a.dist - b.dist || b.item.score - a.item.score);
  if (!scored.length) return pool;
  const withinOne = scored.filter((x) => x.dist <= 1.001);
  if (withinOne.length) return withinOne.map((x) => x.item);
  const bestDist = scored[0].dist;
  const nearest = scored.filter((x) => x.dist <= bestDist + 0.001).map((x) => x.item);
  return nearest.length ? nearest : [scored[0].item];
}

export function primaryWeaknessSkillsForAudit(profile, count = 7) {
  const dynamic = profile?.dynamic || profile;
  const chain = resolvePrimaryWeaknessChain({
    skillProfile: profile,
    dynamicProfile: dynamic,
    tiers: buildSkillTiers(profile),
    count
  });
  return chain.primary ? [chain.primary, ...chain.fallbacks] : chain.fallbacks;
}
