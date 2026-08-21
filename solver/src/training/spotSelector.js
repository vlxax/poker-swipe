// Spot Selection Engine (requirement P0). Picks which spots to show next from a
// candidate pool, driven by the user's skill/leak profile, per-concept mastery
// and drill history. Pure & deterministic given the same inputs, so it is unit
// testable without a solver.

import { clamp, round } from './util.js';
import {
  leakBoostForSpot, weakSkillBoost, maintenanceSkillMatch, conceptLabelForPlan,
  spotMatchesLeakConcept
} from './leakSpotMapping.js';
import { computePriority } from './priority.js';
import { diversityPenalty, sessionRepetitionPenalty, contentFingerprint, recentFingerprints } from './sessionDiversity.js';
import {
  adaptiveDifficulty as computeAdaptiveDifficulty,
  recentAccuracy,
  spotDifficultyScore,
  difficultyFit as difficultyFitForTarget,
  scoreToBaseDifficulty
} from './adaptiveDifficulty.js';
import { buildSkillMasteryStates, masteryBoostForSpot } from './skillMastery.js';
import { dynamicWeaknessBoost, computeDynamicSkillTargets } from './dynamicPlayerProfile.js';

export { recentAccuracy } from './adaptiveDifficulty.js';

export const DEFAULT_SHOWN_COOLDOWN = 30;
const DEFAULT_MASTERY_GATE = 78;
const WEAKNESS_SHARE = 0.65;
const MAINTENANCE_SHARE = 0.25;
const EXPLORATION_SHARE = 0.10;
const CHALLENGE_WEIGHT = 0.12;
const CONTROL_EVERY = 8;
const MAX_WEAK_PER_SKILL_SHARE = 0.4;

export const SPOT_KINDS = ['weakness', 'maintenance', 'exploration', 'challenge', 'control'];

export function normalizeSpot(spot) {
  return {
    id: spot.id,
    concept: spot.concept,
    street: spot.street || null,
    difficulty: clamp(Number(spot.difficulty) || 1, 1, 5),
    skillTags: Array.isArray(spot.skillTags) ? spot.skillTags : [],
    format: spot.format || null,
    stage: spot.stage || null,
    positions: spot.positions || (spot.position ? { hero: spot.position } : null),
    stackDepth: spot.stackDepth || null,
    decisionType: spot.decisionType || null,
    theoryOrExploit: spot.theoryOrExploit || 'theory',
    icmPressure: spot.icmPressure || 0,
    opponentType: spot.opponentType || null
  };
}

export function masteryOf(progress) {
  return progress && progress.masteryScore != null ? progress.masteryScore : null;
}

export function isMastered(progress, gate = DEFAULT_MASTERY_GATE) {
  const m = masteryOf(progress);
  return m != null && m >= gate;
}

export function adaptiveDifficulty(opts = {}) {
  return computeAdaptiveDifficulty(opts);
}

function spotDifficultyFit(spot, ctx, slotKind = null) {
  if (ctx && ctx.skillProfile) {
    let effectiveSlot = slotKind;
    if (challengesHigh(ctx) && (slotKind === 'maintenance_medium' || slotKind === 'maintenance_strong')) {
      effectiveSlot = 'exploration';
    }
    const perSkill = spotDifficultyScore(spot, ctx.skillProfile, ctx.recentResults || [], { slotKind: effectiveSlot });
    if (slotKind === 'exploration' && challengesHigh(ctx)) {
      const overall = difficultyFitForTarget(spot, ctx.targetDiff);
      return Math.max(perSkill, overall);
    }
    return perSkill;
  }
  return difficultyFitForTarget(spot, ctx.targetDiff);
}

function focusSkillsFromTiers(tiers) {
  return [...(tiers.primary || []), ...(tiers.secondary || []), ...(tiers.medium || [])];
}

function dynamicFocusSkills(ctx) {
  const targets = computeDynamicSkillTargets(ctx.dynamicProfile, 7);
  if (!targets) return [];
  const ranked = Object.entries(targets).sort((a, b) => b[1] - a[1]);
  const skills = ranked.filter(([, n]) => n >= 2).map(([skill]) => skill);
  return skills.length ? skills : ranked.slice(0, 1).map(([skill]) => skill);
}

function acutePrimaryWeaknesses(tiers, ctx, scoreGap = 3) {
  const skills = ctx.skillProfile?.skills;
  if (!skills || !tiers?.primary?.length) return [];
  const primary = tiers.primary.filter((skill) => {
    const sk = skills[skill];
    return sk && sk.score != null && sk.score < 55;
  });
  if (!primary.length) return [...(tiers.primary || [])];
  const min = Math.min(...primary.map((s) => skills[s].score));
  return primary.filter((s) => skills[s].score <= min + scoreGap);
}

function weaknessFilterSkills(tiers, ctx) {
  if (!tiers) return [];
  if (profileHasClearWeakness(ctx)) {
    if (ctx.dynamicProfile) {
      const dynamic = dynamicFocusSkills(ctx);
      if (dynamic.length) return dynamic;
    }
    const acute = acutePrimaryWeaknesses(tiers, ctx);
    if (acute.length) return acute;
    return [...(tiers.primary || [])];
  }
  return focusSkillsFromTiers(tiers);
}

function profileHasClearWeakness(ctx) {
  const tiers = ctx.tiers;
  if (!tiers || !ctx.skillProfile?.skills) return false;
  const focus = [...(tiers.primary || []), ...(tiers.secondary || [])];
  return focus.some((skill) => {
    const sk = ctx.skillProfile.skills[skill];
    return sk && sk.score != null && sk.score < 55;
  });
}

function spotMatchesSessionFocus(spot, tiers, ctx = null) {
  const focus = ctx ? weaknessFilterSkills(tiers, ctx) : focusSkillsFromTiers(tiers);
  if (!focus.length) return true;
  return (spot.skillTags || []).some((t) => focus.includes(t));
}

function filterPoolToSessionFocus(pool, tiers, ctx) {
  if (!tiers) return pool;
  const focus = weaknessFilterSkills(tiers, ctx);
  if (!focus.length) return profileHasClearWeakness(ctx) ? [] : pool;

  let filtered = pool.filter((x) => (x.spot.skillTags || []).some((t) => focus.includes(t)));
  if (profileHasClearWeakness(ctx) && ctx.dynamicProfile && focus.length > 1) {
    const targets = computeDynamicSkillTargets(ctx.dynamicProfile, 7);
    const topSkill = targets
      ? Object.entries(targets).sort((a, b) => b[1] - a[1])[0]?.[0]
      : null;
    if (topSkill && focus.includes(topSkill)) {
      const topOnly = filtered.filter((x) => (x.spot.skillTags || []).includes(topSkill));
      if (topOnly.length >= 3) filtered = topOnly;
    }
  }

  if (filtered.length) return filtered;
  return pool;
}

function focusedSpotPool(spots, candidates, tiers, ctx, usedIds) {
  const available = candidates.filter((s) => !usedIds.has(s.id));
  const focused = available.filter((s) => spotMatchesSessionFocus(s, tiers, ctx));
  if (focused.length) return focused;
  if (!profileHasClearWeakness(ctx)) return available;
  const strictFromAll = spots.filter((s) => !usedIds.has(s.id) && spotMatchesSessionFocus(s, tiers, ctx));
  if (strictFromAll.length) return strictFromAll;
  return available;
}

function spotMatchesFocus(spot, tiers) {
  const focus = focusSkillsFromTiers(tiers);
  if (!focus.length) return false;
  return (spot.skillTags || []).some((t) => focus.includes(t));
}

function spotMatchesStrongSkillExemption(spot, tiers, ctx) {
  if (hasAcutePrimaryWeakness(ctx, tiers)) return spotMatchesAcuteFocus(spot, tiers);
  return spotMatchesFocus(spot, tiers);
}

function profileChallengesHighDifficulty(ctx, tiers) {
  if (!ctx || ctx.targetDiff < 4) return false;
  const ranked = tiers?.ranked || [];
  if (!ranked.length) return false;
  const lowest = ranked[0]?.score;
  return lowest != null && lowest >= 82;
}

function challengesHigh(ctx, tiers = null) {
  if (ctx.challengeHighDifficulty != null) return ctx.challengeHighDifficulty;
  if (tiers) return profileChallengesHighDifficulty(ctx, tiers);
  return ctx.targetDiff >= 4;
}

function prefersLowDifficulty(ctx) {
  if (!ctx || ctx.targetDiff == null) return false;
  if (ctx.targetDiff < 2.8) return true;
  const overall = ctx.skillProfile?.overall;
  return overall != null && overall < 35 && ctx.targetDiff < 3.4;
}

function hasAcutePrimaryWeakness(ctx, tiers) {
  return tiers.primary.some((s) => (ctx.skillProfile?.skills?.[s]?.score ?? 100) < 20);
}

function acuteWeaknessStrongSkillPenalty(spot, ctx, tiers) {
  if (!hasAcutePrimaryWeakness(ctx, tiers)) return 0;
  if (spotHasStrongSkill(spot, tiers) && !spotMatchesAcuteFocus(spot, tiers)) return -14;
  return 0;
}

function primaryWeaknessTagGuard(spot, ctx, tiers, slotKind) {
  if (slotKind !== 'primary_weakness' || !hasAcutePrimaryWeakness(ctx, tiers)) return 0;
  const tags = spot.skillTags || [];
  if (tiers.primary.some((s) => tags.includes(s))) return 0;
  return -18;
}

function spotMatchesAcuteFocus(spot, tiers) {
  const focus = [...(tiers.primary || []), ...(tiers.secondary || [])];
  if (!focus.length) return false;
  return (spot.skillTags || []).some((t) => focus.includes(t));
}

function spotMatchesWeaknessTiers(spot, ctx) {
  const tiers = ctx.tiers;
  if (!tiers) return false;
  const tags = spot.skillTags || [];
  return tiers.primary.some((s) => tags.includes(s)) || tiers.secondary.some((s) => tags.includes(s));
}

function lowTargetDifficultyAdjust(spot, ctx, slotKind = null) {
  if (!prefersLowDifficulty(ctx)) return 0;
  const weaknessFocus = spotMatchesWeaknessTiers(spot, ctx);
  const df = spotDifficultyFit(spot, ctx, slotKind);
  const fitMult = weaknessFocus ? 0.55 : 1.1;
  if (spot.difficulty >= 5) return weaknessFocus ? -2.4 : -2.8;
  if (spot.difficulty >= 4) return weaknessFocus ? -1.5 : -1.9;
  if (df < 0) return df * fitMult;
  if (spot.difficulty <= 2) return weaknessFocus ? 0.45 : 0.65;
  if (spot.difficulty === 3 && slotKind === 'exploration') return 0.2;
  return 0;
}

function lowDifficultyPoolPreference(pool, slotKind, ctx) {
  if (!prefersLowDifficulty(ctx) || !pool.length) return pool;
  if (slotKind === 'exploration') {
    const easy = pool.filter((x) => (x.spot.difficulty || 1) <= 3);
    const stretch = pool.filter((x) => (x.spot.difficulty || 1) <= 4);
    return easy.length >= 2 ? easy : (stretch.length ? stretch : pool);
  }
  const easy = pool.filter((x) => (x.spot.difficulty || 1) <= 3);
  if (easy.length >= 2) return easy;
  const stretch = pool.filter((x) => (x.spot.difficulty || 1) <= 4);
  return stretch.length >= 2 ? stretch : pool;
}

function highTargetDifficultyBoost(spot, ctx, slotKind = null) {
  if (!challengesHigh(ctx)) return 0;
  const df = spotDifficultyFit(spot, ctx, slotKind);
  if (df > 0) return df * 0.35;
  if (spot.difficulty >= 4) return 0.25;
  if (spot.difficulty <= 2) return -0.4;
  return 0;
}

export function spacedInterval({ lastSeenAt = null, mastery = null, now = Date.now(), baseDays = 1.5, masteryFactor = 3 } = {}) {
  const days = lastSeenAt == null
    ? 0
    : baseDays * (1 + (mastery != null ? (mastery / 100) * masteryFactor : 0));
  return Math.round(days * 24 * 60 * 60 * 1000);
}

export function conceptDue({ lastSeenAt = null, mastery = null, now = Date.now(), baseDays = 1.5 } = {}) {
  if (lastSeenAt == null) return true;
  return now - lastSeenAt >= spacedInterval({ lastSeenAt, mastery, now, baseDays });
}

export function spotEligible(spot, shownAt = {}, cooldown = DEFAULT_SHOWN_COOLDOWN, recentFingerprintsSet = null) {
  const last = shownAt[spot.id];
  if (last != null && last.countAgo < cooldown) return false;
  if (recentFingerprintsSet && recentFingerprintsSet.has(contentFingerprint(spot))) return false;
  return true;
}

export function sessionGoal({ weakestSkill = null, concept = null, overall = null } = {}) {
  if (weakestSkill) {
    return {
      type: 'skill',
      focus: weakestSkill,
      copyRu: `Фокус: твой слабый навык — ${weakestSkill}. Добиваем его на этой сессии.`
    };
  }
  if (concept) {
    return {
      type: 'concept',
      focus: concept,
      copyRu: `Фокус: концепция «${concept}». Доводим до уверенного решения.`
    };
  }
  return { type: 'general', focus: null, copyRu: 'Поддерживаем общую форму и ищем слабые места.' };
}

export function earliestMeaningful({ concepts = [], masteryByConcept = {}, recentResultsByConcept = {} } = {}) {
  const candidates = concepts.filter((c) => {
    const m = masteryByConcept[c];
    return m == null || m < DEFAULT_MASTERY_GATE;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const aM = masteryByConcept[a] == null ? -1 : masteryByConcept[a];
    const bM = masteryByConcept[b] == null ? -1 : masteryByConcept[b];
    return aM - bM;
  });
  return candidates[0];
}

function difficultyFit(spot, targetDiff, ctx = null, slotKind = null) {
  if (ctx && ctx.skillProfile) {
    return spotDifficultyFit(spot, ctx, slotKind);
  }
  return difficultyFitForTarget(spot, targetDiff);
}

function bucketForSpot(spot, ctx) {
  const { masteredConcepts, weakConcepts, weakestSkillConcepts, history, targetDiff } = ctx;
  if (masteredConcepts.has(spot.concept) && spot.difficulty >= targetDiff + 1) return 'challenge';
  if (weakConcepts.has(spot.concept)) return 'weakness';
  if (weakestSkillConcepts && weakestSkillConcepts.has(spot.concept)) return 'weakness';
  if (maintenanceSkillMatch(spot, ctx.skillProfile)) return 'maintenance';
  if (!history.some((h) => h.concept === spot.concept)) return 'exploration';
  return 'maintenance';
}

export const SESSION_SLOT_KINDS = [
  'primary_weakness', 'secondary_weakness', 'maintenance_medium',
  'maintenance_strong', 'exploration'
];

const SLOT_MIX_10 = {
  primary_weakness: 4,
  secondary_weakness: 2,
  maintenance_medium: 2,
  maintenance_strong: 1,
  exploration: 1
};

export function buildSkillTiers(skillProfile) {
  if (!skillProfile || !skillProfile.skills) {
    return { primary: [], secondary: [], medium: [], strong: [], ranked: [] };
  }
  const STRONG_THRESHOLD = 82;
  const ranked = Object.values(skillProfile.skills)
    .filter((s) => s && s.score != null)
    .sort((a, b) => a.score - b.score);
  const strong = ranked.filter((s) => s.score >= STRONG_THRESHOLD).map((s) => s.skill);
  const nonStrong = ranked.filter((s) => s.score < STRONG_THRESHOLD);
  let primary = nonStrong.slice(0, 2).map((s) => s.skill);
  let secondary = nonStrong.slice(2, 4).map((s) => s.skill);
  let medium = ranked
    .filter((s) => s.score >= 45 && s.score <= 75 && !primary.includes(s.skill) && !secondary.includes(s.skill))
    .map((s) => s.skill);
  if (!medium.length) {
    medium = ranked
      .filter((s) => s.score >= 30 && s.score < STRONG_THRESHOLD && !primary.includes(s.skill) && !secondary.includes(s.skill))
      .map((s) => s.skill);
  }
  if (!medium.length && strong.length) {
    medium = ranked
      .filter((s) => s.score >= 70 && s.score < STRONG_THRESHOLD)
      .map((s) => s.skill);
  }
  // Uniformly strong profile: assign relative tiers so slots still target
  // the comparatively weakest skills instead of falling back to easy filler.
  if (!primary.length && !secondary.length && ranked.length >= 2) {
    primary = ranked.slice(0, 2).map((s) => s.skill);
    secondary = ranked.length > 2 ? ranked.slice(2, 4).map((s) => s.skill) : [];
    if (!medium.length && ranked.length > 4) {
      medium = ranked.slice(4, Math.min(6, ranked.length)).map((s) => s.skill);
    }
  }
  return { primary, secondary, medium, strong, ranked };
}

export function sessionSlotOrder(count = 10) {
  if (count <= 0) return [];
  const scale = count / 10;
  const quotas = {};
  let assigned = 0;
  for (const [kind, base] of Object.entries(SLOT_MIX_10)) {
    const n = kind === 'exploration'
      ? Math.max(1, Math.round(base * scale))
      : Math.round(base * scale);
    quotas[kind] = Math.max(0, n);
    assigned += quotas[kind];
  }
  while (assigned < count) {
    quotas.primary_weakness = (quotas.primary_weakness || 0) + 1;
    assigned++;
  }
  while (assigned > count && quotas.maintenance_medium > 0) {
    quotas.maintenance_medium--;
    assigned--;
  }
  const order = [];
  for (const kind of SESSION_SLOT_KINDS) {
    for (let i = 0; i < (quotas[kind] || 0); i++) order.push(kind);
  }
  return order.slice(0, count);
}

function slotToLegacyBucket(slotKind) {
  if (slotKind === 'primary_weakness' || slotKind === 'secondary_weakness') return 'weakness';
  if (slotKind === 'exploration') return 'exploration';
  return 'maintenance';
}

function spotHasSkill(spot, skill) {
  return skill && (spot.skillTags || []).includes(skill);
}

function spotHasStrongSkill(spot, tiers) {
  return (spot.skillTags || []).some((t) => tiers.strong.includes(t));
}

function scoreForSessionSlot(spot, slotKind, ctx) {
  const { tiers, skillProfile, leakPriorities, targetDiff, picked, strongMaintUsed, strongSkillSpotCount, repeatAllow } = ctx;
  const highChallenge = challengesHigh(ctx, tiers);
  let score = 0.5;
  if (repeatAllow && repeatAllow.has(spot.id)) score += 50;
  const tags = spot.skillTags || [];

  const icmSkill = ctx.skillProfile?.skills?.icm;
  if (icmSkill && icmSkill.score != null && icmSkill.score >= 80
      && tags.includes('icm')
      && slotKind !== 'primary_weakness' && slotKind !== 'secondary_weakness') {
    score -= 6;
  }

  if (slotKind === 'primary_weakness') {
    if (tiers.primary.some((s) => tags.includes(s))) score += 6;
    for (const { concept, priority } of (leakPriorities || []).slice(0, 3)) {
      if (concept && spotMatchesLeakConcept(spot, concept)) score += 5 + (priority || 0) * 6;
    }
    score += weaknessScore(spot, ctx, { useSkillTargets: true }) * 0.6;
    if (ctx.dynamicProfile) score += dynamicWeaknessBoost(spot, ctx.dynamicProfile) * 0.5;
    score += leakBoostForSpot(spot, leakPriorities) * 3;
    const diffFit = spotDifficultyFit(spot, ctx, slotKind);
    if (highChallenge && diffFit < 0) score += diffFit * 0.75;
    score += lowTargetDifficultyAdjust(spot, ctx, slotKind);
    score += highTargetDifficultyBoost(spot, ctx, slotKind);
    score += acuteWeaknessStrongSkillPenalty(spot, ctx, tiers);
    score += primaryWeaknessTagGuard(spot, ctx, tiers, slotKind);
  } else if (slotKind === 'secondary_weakness') {
    if (tiers.secondary.some((s) => tags.includes(s))) score += 5;
    else if (tiers.primary.some((s) => tags.includes(s))) score += 4;
    else if (spotHasStrongSkill(spot, tiers) && !spotMatchesStrongSkillExemption(spot, tiers, ctx)) score -= 10;
    for (const { concept, priority } of (leakPriorities || []).slice(0, 3)) {
      if (concept && spotMatchesLeakConcept(spot, concept)) score += 3 + (priority || 0) * 4;
    }
    score += leakBoostForSpot(spot, leakPriorities) * 2.5;
    score += weakSkillBoost(spot, skillProfile) * 1.5;
    if (strongSkillSpotCount > 0 && spotHasStrongSkill(spot, tiers)) score -= 8;
    score += lowTargetDifficultyAdjust(spot, ctx, slotKind);
    score += highTargetDifficultyBoost(spot, ctx, slotKind);
    score += acuteWeaknessStrongSkillPenalty(spot, ctx, tiers);
  } else if (slotKind === 'maintenance_medium') {
    if (tiers.medium.some((s) => tags.includes(s))) score += 5;
    if (profileHasClearWeakness(ctx)) {
      if (tiers.primary.some((s) => tags.includes(s))) score += 3;
      if (tiers.secondary.some((s) => tags.includes(s))) score += 2;
    } else {
      if (spotHasStrongSkill(spot, tiers) && !spotMatchesStrongSkillExemption(spot, tiers, ctx)) score -= 10;
      if (tiers.primary.some((s) => tags.includes(s))) score -= 5;
      if (tiers.secondary.some((s) => tags.includes(s))) score -= 3;
    }
    if (!tags.some((t) => tiers.strong.includes(t) || tiers.primary.includes(t))) {
      if (ctx.targetDiff < 4) score += 2;
      else if (!highChallenge) score -= 1.5;
    }
    if (strongSkillSpotCount > 0 && spotHasStrongSkill(spot, tiers) && !spotMatchesStrongSkillExemption(spot, tiers, ctx)) score -= 12;
    if (highChallenge) {
      const df = spotDifficultyFit(spot, ctx, slotKind);
      score += df * 0.9;
      if (spot.difficulty <= 2 && df < 0) score += df * 0.4;
    }
    score += lowTargetDifficultyAdjust(spot, ctx, slotKind);
    score += highTargetDifficultyBoost(spot, ctx, slotKind);
    score += acuteWeaknessStrongSkillPenalty(spot, ctx, tiers);
  } else if (slotKind === 'maintenance_strong') {
    if (strongMaintUsed) return -10;
    if (profileHasClearWeakness(ctx)) {
      if (tiers.medium.some((s) => tags.includes(s))) score += 5;
      if (tiers.secondary.some((s) => tags.includes(s))) score += 4;
      if (tiers.primary.some((s) => tags.includes(s))) score += 3;
    } else {
      const top = tiers.ranked.length ? tiers.ranked[tiers.ranked.length - 1].skill : null;
      if (top && tags.includes(top)) score += 4;
      else if (tiers.strong.some((s) => tags.includes(s))) score += 2;
    }
    if (tiers.primary.some((s) => tags.includes(s)) && !profileHasClearWeakness(ctx)) score -= 5;
    if (highChallenge) score += spotDifficultyFit(spot, ctx, 'exploration') * 0.85;
    score += highTargetDifficultyBoost(spot, ctx, slotKind);
  } else if (slotKind === 'exploration') {
    const focus = focusSkillsFromTiers(tiers);
    if (focus.some((s) => tags.includes(s))) score += 3;
    const diffWeight = highChallenge ? 1.55 : (prefersLowDifficulty(ctx) ? 0.35 : 0.5);
    score += spotDifficultyFit(spot, ctx, slotKind) * diffWeight + 0.5;
    score += lowTargetDifficultyAdjust(spot, ctx, slotKind);
    score += highTargetDifficultyBoost(spot, ctx, slotKind);
    score += acuteWeaknessStrongSkillPenalty(spot, ctx, tiers);
    if (spot.theoryOrExploit === 'exploit') score += 0.4;
    if (!ctx.history.some((h) => h.concept === spot.concept)) score += 1;
    if (spotHasStrongSkill(spot, tiers) && focus.length && !spotMatchesStrongSkillExemption(spot, tiers, ctx)) {
      score -= tiers.primary.length && tiers.primary.some((s) => (ctx.skillProfile?.skills?.[s]?.score ?? 100) < 45) ? 9 : 3;
    }
  }

  let diversity = diversityPenalty(spot, picked, ctx.history);
  const topLeak = (leakPriorities || [])[0]?.concept;
  if (topLeak && (slotKind === 'primary_weakness' || slotKind === 'secondary_weakness')
      && spotMatchesLeakConcept(spot, topLeak)) {
    diversity *= 0.25;
  }
  score += masteryBoostForSpot(spot, ctx.skillMasteryStates, ctx.skillProfile, {
    allowMasteredPenalty: slotKind === 'maintenance_medium'
      || slotKind === 'maintenance_strong'
      || slotKind === 'exploration'
  }) * 0.85;
  score -= diversity;
  return score;
}

function pickOneSlot(candidates, slotKind, ctx, rng, usedIds) {
  const tiers = ctx.tiers;
  let pool = candidates
    .filter((s) => !usedIds.has(s.id))
    .map((s) => ({
      spot: s,
      score: scoreForSessionSlot(s, slotKind, ctx),
      bucket: slotToLegacyBucket(slotKind),
      slotKind
    }))
    .filter((x) => x.score > -5);

  if (slotKind === 'primary_weakness' || slotKind === 'secondary_weakness') {
    pool = filterPoolToSessionFocus(pool, tiers, ctx);
  } else if (profileHasClearWeakness(ctx)) {
    pool = filterPoolToSessionFocus(pool, tiers, ctx);
  }

  pool.sort((a, b) => b.score - a.score);

  const topLeak = (ctx.leakPriorities || [])[0]?.concept;
  if (topLeak && (slotKind === 'primary_weakness' || slotKind === 'secondary_weakness')) {
    const leakPool = pool.filter((x) => spotMatchesLeakConcept(x.spot, topLeak));
    const minLeak = slotKind === 'primary_weakness' ? 1 : 2;
    if (leakPool.length >= minLeak) pool = leakPool;
  }

  pool = lowDifficultyPoolPreference(pool, slotKind, ctx);

  if (!pool.length) return null;

  const top = pool.slice(0, Math.min(10, pool.length));
  const total = top.reduce((s, x) => s + Math.max(0.01, x.score), 0);
  let r = rng() * total;
  let pick = top[0];
  for (const item of top) {
    r -= Math.max(0.01, item.score);
    if (r <= 0) { pick = item; break; }
  }
  return pick;
}

function selectSpotsProfileAware({
  spots, candidates, count, ctx, rng, shownAt, shownCooldown, history
}) {
  const slotOrder = sessionSlotOrder(count);
  const tiers = buildSkillTiers(ctx.skillProfile);
  ctx.tiers = tiers;
  ctx.challengeHighDifficulty = profileChallengesHighDifficulty(ctx, tiers);
  const usedIds = new Set();
  const picked = [];
  let strongMaintUsed = false;
  let strongSkillSpotCount = 0;

  const slotCtx = { ...ctx, tiers, picked, strongMaintUsed: false, strongSkillSpotCount: 0, repeatAllow: ctx.repeatAllow };

  for (const slotKind of slotOrder) {
    if (profileHasClearWeakness(ctx) && slotKind === 'maintenance_strong') continue;
    slotCtx.strongMaintUsed = strongMaintUsed;
    slotCtx.strongSkillSpotCount = strongSkillSpotCount;
    let choice = pickOneSlot(candidates, slotKind, slotCtx, rng, usedIds);

    if (!choice && slotKind === 'maintenance_strong') continue;

    if (!choice) {
      const fallbackKinds = slotKind === 'exploration'
        ? ['maintenance_strong', 'secondary_weakness', 'maintenance_medium']
        : slotKind === 'secondary_weakness'
          ? ['secondary_weakness', 'primary_weakness', 'exploration', 'maintenance_medium']
          : ['maintenance_medium', 'secondary_weakness', 'exploration'];
      for (const fb of fallbackKinds) {
        choice = pickOneSlot(candidates, fb, slotCtx, rng, usedIds);
        if (choice && profileHasClearWeakness(ctx) && !spotMatchesSessionFocus(choice.spot, tiers, ctx)) {
          choice = null;
        }
        if (choice) break;
      }
    }

    if (!choice) {
      const restCandidates = focusedSpotPool(spots, candidates, tiers, slotCtx, usedIds);
      const rest = restCandidates
        .map((s) => ({
          spot: s,
          score: scoreForSessionSlot(s, slotKind, slotCtx) - diversityPenalty(s, picked, history),
          bucket: slotToLegacyBucket(slotKind),
          slotKind
        }))
        .filter((x) => x.score > -5)
        .sort((a, b) => b.score - a.score);
      if (rest.length) choice = rest[0];
    }

    if (!choice) continue;

    usedIds.add(choice.spot.id);
    if (choice.slotKind === 'maintenance_strong') strongMaintUsed = true;
    if (spotHasStrongSkill(choice.spot, tiers) && choice.slotKind !== 'maintenance_strong') {
      strongSkillSpotCount++;
    }
    picked.push(choice);
    slotCtx.picked = picked;
  }

  if (picked.length < count) {
    const highChallenge = challengesHigh(ctx, tiers);
    let restPool = focusedSpotPool(spots, candidates, tiers, ctx, usedIds);
    if (prefersLowDifficulty(ctx)) {
      const easyRest = restPool.filter((s) => (s.difficulty || 1) <= 3);
      if (easyRest.length >= count - picked.length) restPool = easyRest;
    }
    const rest = restPool
      .map((s) => ({
        spot: s,
        score: (highChallenge
          ? 0.5 + spotDifficultyFit(s, ctx, 'exploration') + highTargetDifficultyBoost(s, ctx, 'exploration')
          : 0.4 + lowTargetDifficultyAdjust(s, ctx, 'maintenance_medium')
            + spotDifficultyFit(s, ctx, 'maintenance_medium') * (prefersLowDifficulty(ctx) ? 0.55 : 0.35)
            + ((prefersLowDifficulty(ctx) && (s.difficulty || 1) <= 2) ? 0.35 : 0))
          - diversityPenalty(s, picked, history),
        bucket: bucketForSpot(s, ctx),
        slotKind: highChallenge ? 'exploration' : 'maintenance_medium'
      }));
    while (picked.length < count && rest.length) {
      rest.sort((a, b) => b.score - a.score);
      const choice = rest.shift();
      if (usedIds.has(choice.spot.id)) continue;
      usedIds.add(choice.spot.id);
      picked.push(choice);
    }
    if (picked.length < count) {
      const lastResort = candidates
        .filter((s) => !usedIds.has(s.id))
        .map((s) => ({
          spot: s,
          score: 0.2 + spotDifficultyFit(s, ctx, 'maintenance_medium') * 0.25
            - diversityPenalty(s, picked, history),
          bucket: bucketForSpot(s, ctx),
          slotKind: 'maintenance_medium'
        }))
        .sort((a, b) => b.score - a.score);
      while (picked.length < count && lastResort.length) {
        const choice = lastResort.shift();
        if (usedIds.has(choice.spot.id)) continue;
        usedIds.add(choice.spot.id);
        picked.push(choice);
      }
    }
  }

  return picked;
}

function weaknessScore(spot, ctx, { useSkillTargets = false } = {}) {
  let score = weakSkillBoost(spot, ctx.skillProfile) * 2;
  if (ctx.dynamicProfile) score += dynamicWeaknessBoost(spot, ctx.dynamicProfile) * 1.15;
  score += leakBoostForSpot(spot, ctx.leakPriorities) * 4;
  if (ctx.weakConcepts.has(spot.concept)) score += 2;
  if (ctx.weakestSkillConcepts && ctx.weakestSkillConcepts.has(spot.concept)) score += 1.5;
  const diffBonus = spotDifficultyFit(spot, ctx);
  const highChallenge = challengesHigh(ctx);
  const diffWeight = highChallenge ? 0.85 : 0.4;
  const missWeight = highChallenge ? 0.55 : (prefersLowDifficulty(ctx) ? 0.9 : 0.25);
  if (diffBonus > 0) score += diffBonus * diffWeight;
  else if (diffBonus < 0) score += diffBonus * missWeight;
  score += lowTargetDifficultyAdjust(spot, ctx);
  score += highTargetDifficultyBoost(spot, ctx);
  if (ctx.tiers) score += acuteWeaknessStrongSkillPenalty(spot, ctx, ctx.tiers);
  score += masteryBoostForSpot(spot, ctx.skillMasteryStates, ctx.skillProfile, { allowMasteredPenalty: false }) * 0.85;
  if (useSkillTargets && ctx.skillTargets) {
    for (const tag of spot.skillTags || []) {
      const want = ctx.skillTargets[tag];
      const have = ctx.skillCounts[tag] || 0;
      if (want != null && have < want) score += 3 + (want - have);
    }
  }
  return score;
}

function scoredPool(candidates, ctx, bucket) {
  return candidates.map((s) => {
    const base = { spot: s, score: 1, bucket };
    if (bucket === 'weakness') base.score = weaknessScore(s, ctx);
    else if (bucket === 'exploration') base.score = 1 + (s.theoryOrExploit === 'exploit' ? 0.3 : 0);
    else if (bucket === 'challenge') base.score = spotDifficultyFit(s, ctx, 'exploration') + 1;
    else base.score = maintenanceSkillMatch(s, ctx.skillProfile) ? 1.5 : 1;
    base.score -= diversityPenalty(s, ctx.picked || [], ctx.history || []);
    return base;
  });
}

function weightedPick(scored, want, rng, usedIds, skillCap, skillCounts, ctx) {
  const selected = [];
  const pool = scored.slice().sort((a, b) => b.score - a.score);
  while (selected.length < want && pool.length) {
    const top = pool.slice(0, Math.min(8, pool.length));
    const total = top.reduce((s, x) => s + Math.max(0.01, x.score), 0);
    let r = rng() * total;
    let pick = top[0];
    for (const item of top) {
      r -= Math.max(0.01, item.score);
      if (r <= 0) { pick = item; break; }
    }
    const idx = pool.indexOf(pick);
    pool.splice(idx, 1);
    if (usedIds.has(pick.spot.id)) continue;
    if (skillCap != null) {
      const tags = pick.spot.skillTags || ['_'];
      const blocked = tags.some((t) => (skillCounts[t] || 0) >= skillCap);
      if (blocked) continue;
    }
    usedIds.add(pick.spot.id);
    for (const t of pick.spot.skillTags || ['_']) skillCounts[t] = (skillCounts[t] || 0) + 1;
    if (ctx) ctx.picked = (ctx.picked || []).concat([pick]);
    selected.push(pick);
  }
  return selected;
}

export function selectSpots({
  pool = [],
  shownAt = {},
  history = [],
  progressByConcept = {},
  recentResults = [],
  skillProfile = null,
  dynamicProfile = null,
  leakProfiles = [],
  count = 7,
  adaptiveCurrent = 3,
  now = Date.now(),
  shownCooldown = DEFAULT_SHOWN_COOLDOWN,
  masteryGate = DEFAULT_MASTERY_GATE,
  skillTargets = null,
  skillMasteryStates = null,
  allowRepeatIds = [],
  rng = Math.random
} = {}) {
  const spots = (pool || []).map(normalizeSpot).filter((s) => s.id);
  if (!spots.length) return { ok: false, reason: 'empty_pool', selected: [] };

  const targetDiff = skillProfile && skillProfile.overall != null
    ? scoreToBaseDifficulty(skillProfile.overall)
    : adaptiveDifficulty({ current: adaptiveCurrent, recentResults, skillProfile });

  const leakPriorities = (leakProfiles || [])
    .map((p) => {
      const priority = computePriority(p, { now });
      const hasEvidence = (p.sampleSize || 0) >= 1 || (Array.isArray(p.attempts) && p.attempts.length >= 1);
      const floor = p.concept && hasEvidence ? 0.15 : 0;
      return { concept: p.concept, priority: Math.max(priority, floor) };
    })
    .filter((p) => p.priority > 0 && p.concept)
    .sort((a, b) => b.priority - a.priority);

  const weakConcepts = new Set();
  const masteredConcepts = new Set();
  for (const [concept, prog] of Object.entries(progressByConcept || {})) {
    if (isMastered(prog, masteryGate)) masteredConcepts.add(concept);
    else weakConcepts.add(concept);
  }

  let weakestSkillConcepts = null;
  if (skillProfile && skillProfile.weakest && skillProfile.weakest.skill) {
    weakestSkillConcepts = new Set(
      spots.filter((s) => (s.skillTags || []).includes(skillProfile.weakest.skill)).map((s) => s.concept)
    );
  }

  const resolvedMasteryStates = buildSkillMasteryStates({
    skillProfile,
    masteryStore: skillMasteryStates || {},
    recentResults,
    now
  });

  const ctx = {
    skillProfile,
    dynamicProfile: dynamicProfile || skillProfile?.dynamic || null,
    leakPriorities,
    weakConcepts,
    masteredConcepts,
    weakestSkillConcepts,
    history,
    recentResults,
    skillMasteryStates: resolvedMasteryStates,
    targetDiff,
    skillTargets,
    skillCounts: {},
    picked: []
  };

  const repeatAllow = new Set(allowRepeatIds || []);
  for (const h of (history || [])) {
    if (h && h.spacedReview && h.spotId) repeatAllow.add(h.spotId);
  }

  const cooldownHistory = (history || []).filter((h) => !h || !h.spacedReview);
  const recentIds = new Set(
    cooldownHistory.slice(0, shownCooldown).map((h) => h.spotId).filter(Boolean)
  );
  const recentFps = recentFingerprints(cooldownHistory, shownCooldown);
  const eligible = spots.filter((s) => {
    if (repeatAllow.has(s.id)) return true;
    return spotEligible(s, shownAt, shownCooldown, recentFps) && !recentIds.has(s.id);
  });
  const softEligible = spots.filter((s) => {
    if (repeatAllow.has(s.id)) return true;
    return !recentIds.has(s.id) && !recentFps.has(contentFingerprint(s));
  });
  const candidates = eligible.length >= count ? eligible : (softEligible.length >= count ? softEligible : spots);

  let picked = [];
  let slotKinds = [];

  const useProfileSlots = skillProfile && skillProfile.skills && Object.keys(skillProfile.skills).length > 0;

  if (useProfileSlots) {
    picked = selectSpotsProfileAware({
      spots, candidates, count, ctx: { ...ctx, repeatAllow }, rng, shownAt, shownCooldown, history
    });
    slotKinds = picked.map((p) => p.slotKind);
  } else {
    const weaknessWant = Math.max(1, Math.round(count * WEAKNESS_SHARE));
    const maintenanceWant = Math.max(1, Math.round(count * MAINTENANCE_SHARE));
    const explorationWant = Math.max(1, Math.round(count * EXPLORATION_SHARE));
    const challengeWant = Math.max(0, Math.round(count * CHALLENGE_WEIGHT));
    const controlWant = count >= CONTROL_EVERY ? 1 : 0;
    const skillCap = Math.max(2, Math.ceil(weaknessWant * MAX_WEAK_PER_SKILL_SHARE));

    const buckets = { weakness: [], maintenance: [], exploration: [], challenge: [], control: [] };
    for (const s of candidates) {
      const b = bucketForSpot(s, ctx);
      buckets[b].push(...scoredPool([s], ctx, b));
    }

    const usedIds = new Set();
    const skillCounts = {};

    const take = (arr, want, cap) => {
      const got = weightedPick(arr, want, rng, usedIds, cap, skillCounts, ctx);
      for (const g of got) picked.push({ ...g, bucket: g.bucket || bucketForSpot(g.spot, ctx), slotKind: null });
    };

    take(buckets.weakness, weaknessWant, skillCap);
    take(buckets.challenge, challengeWant, null);
    take(buckets.exploration, explorationWant, null);
    if (controlWant) take(buckets.control.length ? buckets.control : buckets.maintenance, controlWant, null);

    const remain = count - picked.length;
    if (remain > 0) take(buckets.maintenance, remain, null);
    if (picked.length < count) {
      const rest = candidates
        .filter((s) => !usedIds.has(s.id))
        .map((s) => ({ spot: s, score: 0.5 - diversityPenalty(s, picked, history), bucket: bucketForSpot(s, ctx), slotKind: null }));
      take(rest, count - picked.length, null);
    }
  }

  const selectedSpots = picked.map((p) => p.spot);
  const bucketLabels = picked.map((p) => p.bucket);

  const primaryTargets = unique(
    selectedSpots
      .filter((_, i) => bucketLabels[i] === 'weakness')
      .map(conceptLabelForPlan)
      .filter(Boolean)
  );
  const maintenance = unique(
    selectedSpots
      .filter((_, i) => bucketLabels[i] === 'maintenance')
      .map(conceptLabelForPlan)
      .filter(Boolean)
  );
  const exploration = unique(
    selectedSpots
      .filter((_, i) => bucketLabels[i] === 'exploration' || bucketLabels[i] === 'challenge')
      .map(conceptLabelForPlan)
      .filter(Boolean)
  );

  const earliest = earliestMeaningful({
    concepts: [...new Set(selectedSpots.map((s) => s.concept))],
    masteryByConcept: Object.fromEntries(
      Object.entries(progressByConcept || {}).map(([k, p]) => [k, masteryOf(p) == null ? -1 : masteryOf(p)])
    )
  });

  const goal = sessionGoal({
    weakestSkill: skillProfile && skillProfile.weakest ? skillProfile.weakest.skill : null,
    concept: selectedSpots[0] ? selectedSpots[0].concept : null,
    overall: skillProfile && skillProfile.overall
  });

  const slotMix = useProfileSlots ? sessionSlotOrder(count).reduce((acc, k) => {
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {}) : null;

  return {
    ok: true,
    targetDifficulty: targetDiff,
    selected: selectedSpots.map((s) => s.id),
    buckets: bucketLabels,
    slotKinds,
    goal,
    earliestMeaningful: earliest,
    sessionPlan: { primaryTargets, maintenance, exploration },
    reason: {
      weakConcepts: [...weakConcepts],
      mastered: [...masteredConcepts],
      leakPriorities: leakPriorities.slice(0, 5),
      profileSlots: useProfileSlots,
      slotMix
    }
  };
}

function unique(arr) {
  return [...new Set(arr)];
}
