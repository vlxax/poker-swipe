// Public, orchestration-level API for the personalised-training layer. It wires
// the pure modules (candidates, leak profile, priority, session plan, drill
// generation, grading, progress) to the persistent store and provides the
// "Ты" connection (getTopLeaks), candidate recording (My Hands), result
// recording, and the daily session (requirement 17) with async, cancellable,
// budgeted, de-duplicated drill generation (requirement 21) and a general-drill
// fallback (requirement 22). No ML anywhere — deterministic.

import { computePriority, rankLeaks } from './priority.js';
import { createLeakProfile, recordLeakEvent, leakEventFromCandidate } from './leakProfile.js';
import { createConceptProgress, recordAttempt } from './progress.js';
import { buildTrainingSession } from './sessionBuilder.js';
import { generateDrill } from './drillGenerator.js';
import { leakLabelRu, leakDefinitionRu, LEAKS } from './concepts.js';

// ---- "Ты" connection (requirement 19) ---------------------------------------

export function getTopLeaks(store, { now = Date.now(), limit = 5 } = {}) {
  const profiles = (store.listProfiles() || [])
    .map((p) => ({ ...p, priorityScore: computePriority(p, { now }) }))
    .filter((p) => p.priorityScore > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
  return profiles.map((p) => ({
    concept: p.concept,
    label: leakLabelRu(p.concept),
    definition: leakDefinitionRu(p.concept),
    priority: p.priorityScore,
    sampleSize: p.sampleSize,
    avgEvLossBb: p.avgEvLossBb,
    trend: p.trend,
    evidence: `Анализ ${p.sampleSize} решённых решений, средняя потеря EV ${(p.avgEvLossBb || 0).toFixed(2)} BB`
  }));
}

// ---- Recording ---------------------------------------------------------------

// Record a normalised candidate from "My Hands" into the store + leak profile,
// deduped by candidate identity (requirement 18).
export function recordCandidate(store, candidate, { now = Date.now() } = {}) {
  if (!candidate) return { recorded: false, reason: 'no_candidate' };
  if (store.hasCandidate(candidate)) return { recorded: false, reason: 'duplicate', deduped: true };

  store.saveCandidate(candidate);
  const event = leakEventFromCandidate(candidate, now);
  const profile = store.loadProfile(candidate.concept) || createLeakProfile({ concept: candidate.concept, now });
  recordLeakEvent(profile, event);
  store.saveProfile(profile);
  return { recorded: true, concept: candidate.concept, profile, event };
}

// Record a graded drill answer into concept progress + drill history.
export function recordTrainingResult(store, { drill, grade, evLossBb, now = Date.now() } = {}) {
  if (!drill) return { recorded: false, reason: 'no_drill' };
  const concept = drill.concept;
  const progress = store.loadProgress(concept) || createConceptProgress({ concept, now });
  recordAttempt(progress, { grade, evLossBb, now });
  store.saveProgress(progress);
  store.addHistoryEntry({ concept, street: drill.street, drillId: drill.drillId, grade, evLossBb, at: now });
  return { recorded: true, concept, progress };
}

// ---- Daily session (requirement 17, planner) ---------------------------------

export function getDailyPersonalizedTraining({ store, profiles, recentCandidates, history, count = 7, now = Date.now() } = {}) {
  const profs = profiles || store.listProfiles() || [];
  const plan = buildTrainingSession({
    profiles: profs,
    recentCandidates: recentCandidates || store.listCandidates() || [],
    history: history || store.loadHistory() || [],
    count,
    now,
    leakSet: LEAKS
  });
  return {
    sessionId: plan.sessionId,
    primaryConcept: plan.primaryConcept,
    personalized: plan.personalized,
    plan
  };
}

// ---- Async, cancellable, budgeted drill generation (requirement 21) ----------

const inflight = new Map();

export async function buildPersonalizedSessionAsync({
  store,
  profiles,
  recentCandidates,
  history,
  count = 7,
  solve,
  solveOpts = {},
  config = {},
  signal = null,
  now = Date.now(),
  jobKey
} = {}) {
  const plan = buildTrainingSession({
    profiles: profiles || store.listProfiles() || [],
    recentCandidates: recentCandidates || store.listCandidates() || [],
    history: history || store.loadHistory() || [],
    count,
    now,
    leakSet: LEAKS
  });

  const key = jobKey || plan.sessionId;
  if (inflight.has(key)) return inflight.get(key);

  const job = runGeneration({ plan, store, solve, solveOpts, config, signal, now });
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

async function runGeneration({ plan, store, solve, solveOpts, config, signal, now }) {
  const maxAttempts = config.maxAttempts || 8;
  const timeBudgetMs = config.timeBudgetMs || 20000;
  const started = Date.now();
  const seenDrillIds = new Set();
  const drills = [];
  const failures = [];

  const candidates = store.listCandidates() || [];

  for (const item of plan.drills) {
    if (signal && signal.aborted) { failures.push({ concept: item.concept, reason: 'cancelled' }); break; }
    if (Date.now() - started > timeBudgetMs) { failures.push({ concept: item.concept, reason: 'time_budget' }); break; }

    const candidate = candidates.find((c) => c.concept === item.concept) || null;
    let generated = false;
    for (let attempt = 0; attempt < maxAttempts && !generated; attempt++) {
      if (signal && signal.aborted) break;
      const gen = generateDrill({
        candidate,
        solve,
        solveOpts,
        ranges: config.ranges ? config.ranges(item.concept) : null,
        rng: config.rng
      });
      if (gen.ok && !seenDrillIds.has(gen.drill.drillId)) {
        seenDrillIds.add(gen.drill.drillId);
        drills.push(gen.drill);
        generated = true;
      } else if (gen.ok && seenDrillIds.has(gen.drill.drillId)) {
        // exact repeat — try again
      } else {
        failures.push({ concept: item.concept, reason: gen.reason, attempt });
      }
    }
  }

  // Fallback: fill shortfall with validated general drills (requirement 22).
  if (drills.length < plan.total && typeof config.generalDrill === 'function') {
    while (drills.length < plan.total) {
      if (signal && signal.aborted) break;
      if (Date.now() - started > timeBudgetMs) break;
      const g = config.generalDrill({ solve, solveOpts, rng: config.rng });
      if (g && g.ok && !seenDrillIds.has(g.drill.drillId)) {
        seenDrillIds.add(g.drill.drillId);
        drills.push(g.drill);
      } else if (g && !g.ok) {
        break; // general provider is failing — stop rather than loop
      }
    }
  }

  return {
    sessionId: plan.sessionId,
    primaryConcept: plan.primaryConcept,
    personalized: plan.personalized,
    plan,
    drills,
    failures,
    filled: drills.length,
    elapsedMs: Date.now() - started
  };
}

// Convenience: build the daily plan + generate the drills in one async call.
export async function getDailyPersonalizedTrainingAsync(opts = {}) {
  return buildPersonalizedSessionAsync(opts);
}

// Convenience re-export of the pure ranker for callers that already have profiles.
export { rankLeaks };