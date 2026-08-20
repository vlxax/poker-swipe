// Spot Selection Engine (requirement P0). Picks which spots to show next from a
// candidate pool, driven by the user's skill/leak profile, per-concept mastery
// and drill history. Pure & deterministic given the same inputs, so it is unit
// testable without a solver. Responsibilities:
//   • adaptive difficulty 1..5 (smoothly follows recent accuracy),
//   • spaced repetition by CONCEPT (not by hand) with a cooldown,
//   • exploration / challenge / control buckets,
//   • shown-spot cooldown (30–50) to avoid immediate repeats,
//   • mastery gating (stop hammering a mastered concept),
//   • error-chain handling (bias toward the earliest meaningful mistake),
//   • a session goal the UI can surface.

import { clamp, round } from './util.js';

const DEFAULT_SHOWN_COOLDOWN = 40;        // spots before a shown spot may reappear
const DEFAULT_MASTERY_GATE = 78;          // concept mastery % above which we slow down
const EXPLORE_WEIGHT = 0.12;              // exploration share of a session
const CHALLENGE_WEIGHT = 0.15;            // challenge share of a session
const CONTROL_EVERY = 8;                  // one control spot per N drills

export const SPOT_KINDS = ['weakness', 'maintenance', 'exploration', 'challenge', 'control'];

// ---- Input normalisation ------------------------------------------------------

// Every pool entry: { id, concept, street, difficulty (1..5), skillTags[], format,
// stage, positions, stackDepth, decisionType }. Only fields used by selection.
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

// ---- Concept mastery from progress (score 0..100) ------------------------------

export function masteryOf(progress) {
  return progress && progress.masteryScore != null ? progress.masteryScore : null;
}
export function isMastered(progress, gate = DEFAULT_MASTERY_GATE) {
  const m = masteryOf(progress);
  return m != null && m >= gate;
}

// Recent accuracy across a list of graded attempts (EXCELLENT/GOOD = ok).
export function recentAccuracy(results = [], window = 10) {
  const recent = results.slice(-window);
  if (!recent.length) return null;
  const ok = recent.filter((r) => r.grade === 'EXCELLENT' || r.grade === 'GOOD' || (r.nearOptimal === true)).length;
  return ok / recent.length;
}

// ---- Adaptive difficulty (requirement P0) -------------------------------------

// Difficulty drifts toward the user's comfortable level. High recent accuracy
// raises challenge up to +1; repeated failure lowers it down to 1.
export function adaptiveDifficulty({ current = 3, recentResults = [], window = 10 } = {}) {
  const acc = recentAccuracy(recentResults, window);
  if (acc == null) return clamp(current, 1, 5);
  let d = current;
  if (acc >= 0.85) d += 0.35;
  else if (acc <= 0.4) d -= 0.5;
  else if (acc <= 0.55) d -= 0.2;
  // slow creep toward comfort
  d = 0.8 * d + 0.2 * current;
  return clamp(round(d, 2), 1, 5);
}

// ---- Spaced repetition by concept ----------------------------------------------

// Next due time (ms) for a concept given its last-seen time and current mastery.
// Uses an expanding interval so harder concepts come back sooner.
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

// ---- Shown-spot cooldown -------------------------------------------------------

// A spot is eligible if it has not been shown within the cooldown window.
export function spotEligible(spot, shownAt = {}, cooldown = DEFAULT_SHOWN_COOLDOWN) {
  const last = shownAt[spot.id];
  if (last == null) return true;
  // cooldown is measured in "number of shows ago": approximate with a min-gap.
  return last.countAgo >= cooldown;
}

// ---- Session goal --------------------------------------------------------------

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

// ---- Error-chain selection -----------------------------------------------------

// When a concept has repeated errors, we want the earliest meaningful mistake in
// the chain (lowest difficulty that is still being missed) so the user rebuilds
// the foundation before moving on.
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

// ---- The selection engine ------------------------------------------------------

export function selectSpots({
  pool = [],
  shownAt = {},                 // id → { countAgo }
  history = [],                 // [{ concept, street, at }]
  progressByConcept = {},       // concept → progress (masteryScore)
  recentResults = [],           // [{ concept, grade, nearOptimal }]
  skillProfile = null,          // for weakest skill
  count = 7,
  adaptiveCurrent = 3,
  now = Date.now(),
  shownCooldown = DEFAULT_SHOWN_COOLDOWN,
  masteryGate = DEFAULT_MASTERY_GATE,
  rng = Math.random
} = {}) {
  const spots = (pool || []).map(normalizeSpot).filter((s) => s.id);
  if (!spots.length) return { ok: false, reason: 'empty_pool', selected: [] };

  const targetDiff = adaptiveDifficulty({ current: adaptiveCurrent, recentResults });

  const byConcept = {};
  for (const s of spots) (byConcept[s.concept] = byConcept[s.concept] || []).push(s);

  // Which concepts are weak (leak) vs mastered vs fresh.
  const weakConcepts = new Set();
  const masteredConcepts = new Set();
  for (const [concept, prog] of Object.entries(progressByConcept || {})) {
    if (isMastered(prog, masteryGate)) masteredConcepts.add(concept);
    else weakConcepts.add(concept);
  }

  // Favour the weakest skill's concepts when no leak evidence exists yet.
  let weakestSkillConcepts = null;
  if (skillProfile && skillProfile.weakest && skillProfile.weakest.skill) {
    weakestSkillConcepts = new Set(
      spots.filter((s) => (s.skillTags || []).includes(skillProfile.weakest.skill)).map((s) => s.concept)
    );
  }

  const bucket = (spot) => {
    // challenge: mastered concepts at higher difficulty
    if (masteredConcepts.has(spot.concept) && spot.difficulty >= targetDiff + 1) return 'challenge';
    // weakness: low mastery / on weak skill / known leak
    if (weakConcepts.has(spot.concept)) return 'weakness';
    if (weakestSkillConcepts && weakestSkillConcepts.has(spot.concept)) return 'weakness';
    // exploration: brand-new concepts (never drilled) or theory/exploit variety
    if (!history.some((h) => h.concept === spot.concept)) return 'exploration';
    return 'maintenance';
  };

  const eligible = spots.filter((s) => spotEligible(s, shownAt, shownCooldown));

  // If the pool is small we still prefer eligibility but fall back to all spots.
  const candidates = eligible.length >= count ? eligible : spots;

  // Bucket pools.
  const buckets = {
    weakness: [], maintenance: [], exploration: [], challenge: [], control: []
  };
  for (const s of candidates) buckets[bucket(s)].push(s);

  const selected = [];
  const pickFrom = (arr, want) => {
    const list = [...arr];
    for (let i = 0; i < want && list.length; i++) {
      const idx = Math.floor(rng() * list.length);
      const s = list.splice(idx, 1)[0];
      if (selected.some((x) => x.id === s.id)) continue;
      selected.push(s);
    }
  };

  // Composition: weakness + challenge + exploration + control, rest maintenance.
  const explorationWant = Math.max(1, Math.round(count * EXPLORE_WEIGHT));
  const challengeWant = Math.max(1, Math.round(count * CHALLENGE_WEIGHT));
  const controlWant = count >= CONTROL_EVERY ? 1 : 0;
  const weaknessWant = count - explorationWant - challengeWant - controlWant;

  pickFrom(buckets.weakness, weaknessWant);
  pickFrom(buckets.challenge, challengeWant);
  pickFrom(buckets.exploration, explorationWant);
  pickFrom(buckets.control, controlWant);
  // fill any remaining with maintenance then anything
  if (selected.length < count) pickFrom(buckets.maintenance, count - selected.length);
  if (selected.length < count) pickFrom([...buckets.exploration, ...buckets.challenge, ...buckets.weakness], count - selected.length);
  // last resort: any candidate
  if (selected.length < count) {
    const rest = candidates.filter((s) => !selected.some((x) => x.id === s.id));
    pickFrom(rest, count - selected.length);
  }

  const earliest = earliestMeaningful({
    concepts: [...new Set(selected.map((s) => s.concept))],
    masteryByConcept: Object.fromEntries(Object.entries(progressByConcept || {}).map(([k, p]) => [k, masteryOf(p) == null ? -1 : masteryOf(p)]))
  });

  const goal = sessionGoal({
    weakestSkill: skillProfile && skillProfile.weakest ? skillProfile.weakest.skill : null,
    concept: selected[0] ? selected[0].concept : null,
    overall: skillProfile && skillProfile.overall
  });

  return {
    ok: true,
    targetDifficulty: targetDiff,
    selected: selected.map((s) => s.id),
    buckets: selected.map((s) => bucket(s)),
    goal,
    earliestMeaningful: earliest,
    reason: {
      weakConcepts: [...weakConcepts],
      mastered: [...masteredConcepts],
      exploration: explorationWant,
      challenge: challengeWant,
      control: controlWant
    }
  };
}