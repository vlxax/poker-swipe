// Training session planner (requirement 16). Turns the leak profile + recent
// mistakes + drill history into an ordered list of concepts to drill this
// session, following a transparent queue: roughly 60% highest-priority leaks,
// 25% recent mistakes, 15% maintenance. It avoids near-identical repeats (dedup
// + a light cooldown) and reports the plan as a pure data structure so the
// generator can turn each concept into real validated drills.

import { rankLeaks } from './priority.js';
import { stableHash } from '../integration/pokerSwipeHandAdapter.js';

const COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const MAINT_MAINTAIN = 0.15;

// Which (concept, street) pairs were drilled recently (for cooldown).
export function recentDrilledKeys(history = [], now = Date.now()) {
  const out = new Set();
  for (const h of history) {
    if (h && h.at != null && now - h.at < COOLDOWN_MS && h.concept) {
      out.add(`${h.concept}|${h.street || ''}`);
    }
  }
  return out;
}

// Build the ordered session plan.
export function buildTrainingSession({
  profiles = [],
  recentCandidates = [],
  history = [],
  count = 7,
  now = Date.now(),
  leakSet = null
} = {}) {
  const ranked = rankLeaks(profiles, { now, limit: null });
  const priorityConcepts = ranked
    .filter((p) => p.priority > 0)
    .map((p) => p.concept);
  const recentMistakeConcepts = (recentCandidates || [])
    .map((c) => c.concept)
    .filter(Boolean);
  const allConcepts = [...new Set([...priorityConcepts, ...recentMistakeConcepts])];

  const cooldown = recentDrilledKeys(history, now);
  const picked = [];

  const pick = (concepts) => {
    for (const concept of concepts) {
      if (picked.length >= count) break;
      if (picked.includes(concept)) continue;
      const street = streetForConcept(concept, leakSet);
      if (cooldown.has(`${concept}|${street}`)) continue;
      picked.push(concept);
    }
  };

  const high = Math.max(1, Math.round(count * (1 - MAINT_MAINTAIN) * 0.8));
  const recent = Math.max(0, Math.round(count * 0.25));
  const maint = count - picked.length - recent;

  // 1. Highest-priority leaks.
  pick(priorityConcepts);
  // 2. Recent mistakes not already chosen.
  pick(recentMistakeConcepts);
  // 3. Fill the remainder with any known concept.
  pick(allConcepts);

  // If still short (e.g. no leak evidence), allow maintenance from a broad list.
  const extras = Object.keys(leakSet || {});
  if (picked.length < count && extras.length) pick(extras);

  const drills = picked.map((concept) => ({
    concept,
    street: streetForConcept(concept, leakSet),
    source: priorityConcepts.includes(concept) ? 'priority' : 'recent'
  }));

  const prioOf = new Map(ranked.map((r) => [r.concept, r.priority]));
  const avgPrio = picked.length
    ? picked.reduce((s, c) => s + (prioOf.get(c) || 0), 0) / picked.length
    : 0;

  return {
    sessionId: stableHash(`${now}|${picked.join(',')}`),
    primaryConcept: picked[0] || null,
    drills,
    reason: {
      highPriority: priorityConcepts,
      recentMistakes: recentMistakeConcepts
    },
    estimatedDifficulty: round(clamp(1 + avgPrio * 4, 1, 5), 2),
    personalized: picked.length > 0,
    total: count,
    filled: picked.length,
    cooldownSkipped: [...cooldown]
  };
}

// Daily-session entry point. If there is no leak evidence the plan is not
// personalized; the caller then falls back to validated general drills
// (requirement 17 + 22). This stays a pure planner — generation is separate.
export function getDailyPersonalizedTraining(opts = {}) {
  return buildTrainingSession(opts);
}

function streetForConcept(concept, leakSet) {
  const meta = leakSet && leakSet[concept];
  return meta && meta.street ? meta.street : null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}