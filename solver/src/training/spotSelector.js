// Spot Selection Engine (requirement P0). Picks which spots to show next from a
// candidate pool, driven by the user's skill/leak profile, per-concept mastery
// and drill history. Pure & deterministic given the same inputs, so it is unit
// testable without a solver.

import { clamp, round } from './util.js';
import {
  leakBoostForSpot, weakSkillBoost, maintenanceSkillMatch, conceptLabelForPlan
} from './leakSpotMapping.js';
import { computePriority } from './priority.js';
import { diversityPenalty } from './sessionDiversity.js';

const DEFAULT_SHOWN_COOLDOWN = 60;
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

export function recentAccuracy(results = [], window = 10) {
  const recent = results.slice(-window);
  if (!recent.length) return null;
  const ok = recent.filter((r) => r.grade === 'EXCELLENT' || r.grade === 'GOOD' || (r.nearOptimal === true)).length;
  return ok / recent.length;
}

export function adaptiveDifficulty({ current = 3, recentResults = [], window = 10, skillProfile = null } = {}) {
  const acc = recentAccuracy(recentResults, window);
  let d = current;
  if (acc != null) {
    if (acc >= 0.85) d += 0.35;
    else if (acc <= 0.4) d -= 0.5;
    else if (acc <= 0.55) d -= 0.2;
    d = 0.8 * d + 0.2 * current;
  }
  if (skillProfile && skillProfile.overall != null) {
    const overall = skillProfile.overall;
    if (overall < 50) d -= 0.4;
    else if (overall < 60) d -= 0.2;
    else if (overall > 82) d += 0.25;
  }
  return clamp(round(d, 2), 1, 5);
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

export function spotEligible(spot, shownAt = {}, cooldown = DEFAULT_SHOWN_COOLDOWN) {
  const last = shownAt[spot.id];
  if (last == null) return true;
  return last.countAgo >= cooldown;
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

function difficultyFit(spot, targetDiff) {
  const dist = Math.abs(spot.difficulty - targetDiff);
  if (dist <= 0.5) return 1;
  if (dist <= 1) return 0.5;
  if (dist <= 1.5) return 0;
  return -1;
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

function weaknessScore(spot, ctx) {
  let score = weakSkillBoost(spot, ctx.skillProfile) * 2;
  score += leakBoostForSpot(spot, ctx.leakPriorities) * 4;
  if (ctx.weakConcepts.has(spot.concept)) score += 2;
  if (ctx.weakestSkillConcepts && ctx.weakestSkillConcepts.has(spot.concept)) score += 1.5;
  score += difficultyFit(spot, ctx.targetDiff);
  if (ctx.skillTargets) {
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
    else if (bucket === 'challenge') base.score = difficultyFit(s, ctx.targetDiff + 1) + 1;
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
  leakProfiles = [],
  count = 7,
  adaptiveCurrent = 3,
  now = Date.now(),
  shownCooldown = DEFAULT_SHOWN_COOLDOWN,
  masteryGate = DEFAULT_MASTERY_GATE,
  skillTargets = null,
  rng = Math.random
} = {}) {
  const spots = (pool || []).map(normalizeSpot).filter((s) => s.id);
  if (!spots.length) return { ok: false, reason: 'empty_pool', selected: [] };

  const targetDiff = adaptiveDifficulty({ current: adaptiveCurrent, recentResults, skillProfile });

  const leakPriorities = (leakProfiles || [])
    .map((p) => ({ concept: p.concept, priority: computePriority(p, { now }) }))
    .filter((p) => p.priority > 0)
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

  const ctx = {
    skillProfile,
    leakPriorities,
    weakConcepts,
    masteredConcepts,
    weakestSkillConcepts,
    history,
    targetDiff,
    skillTargets,
    skillCounts: {},
    picked: []
  };

  const recentIds = new Set((history || []).slice(0, shownCooldown).map((h) => h.spotId).filter(Boolean));
  const eligible = spots.filter((s) => spotEligible(s, shownAt, shownCooldown) && !recentIds.has(s.id));
  const softEligible = spots.filter((s) => !recentIds.has(s.id));
  const candidates = eligible.length >= count ? eligible : (softEligible.length >= count ? softEligible : spots);

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
  const picked = [];

  const take = (arr, want, cap) => {
    const got = weightedPick(arr, want, rng, usedIds, cap, skillCounts, ctx);
    for (const g of got) picked.push({ ...g, bucket: g.bucket || bucketForSpot(g.spot, ctx) });
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
      .map((s) => ({ spot: s, score: 0.5 - diversityPenalty(s, picked, history), bucket: bucketForSpot(s, ctx) }));
    take(rest, count - picked.length, null);
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

  return {
    ok: true,
    targetDifficulty: targetDiff,
    selected: selectedSpots.map((s) => s.id),
    buckets: bucketLabels,
    goal,
    earliestMeaningful: earliest,
    sessionPlan: { primaryTargets, maintenance, exploration },
    reason: {
      weakConcepts: [...weakConcepts],
      mastered: [...masteredConcepts],
      leakPriorities: leakPriorities.slice(0, 5),
      exploration: explorationWant,
      challenge: challengeWant,
      control: controlWant,
      weakness: weaknessWant,
      maintenance: maintenanceWant
    }
  };
}

function unique(arr) {
  return [...new Set(arr)];
}
