// Public, orchestration-level API for the personalised-training layer.

import { computePriority, rankLeaks } from './priority.js';
import { createLeakProfile, recordLeakEvent, leakEventFromCandidate } from './leakProfile.js';
import { createConceptProgress, recordAttempt } from './progress.js';
import { buildTrainingSession } from './sessionBuilder.js';
import { generateDrill } from './drillGenerator.js';
import { leakLabelRu, leakDefinitionRu, LEAKS } from './concepts.js';
import { buildDailyPlan, deriveSkillTags } from './planner.js';
import { getTaskPool, getTaskById, hasUsablePlayerProfile } from './taskLibraryBridge.js';
import { drillFromLibraryTask } from './libraryDrill.js';
import { mapLeakConceptForTask } from './planner.js';
import { skillsForConcept, updateSkillProfileInStore } from './skillProfile.js';
import { contentFingerprint } from './sessionDiversity.js';
import { seededRng } from './personalizationSeed.js';
import { updateSkillMasteryAfterTraining, buildSkillMasteryStates } from './skillMastery.js';

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

export function skillTagsForDrill(drill) {
  const taskId = drill.sourceTaskId || drill.metadata?.taskId || drill.spotId || null;
  if (taskId) {
    const task = getTaskById(taskId);
    if (task) return deriveSkillTags(task);
  }
  return skillsForConcept(drill.concept);
}

export function recordTrainingResult(store, { drill, grade, evLossBb, now = Date.now() } = {}) {
  if (!drill) return { recorded: false, reason: 'no_drill' };
  const concept = drill.concept;
  const progress = store.loadProgress(concept) || createConceptProgress({ concept, now });
  recordAttempt(progress, { grade, evLossBb, now });
  store.saveProgress(progress);

  const taskId = drill.sourceTaskId || drill.metadata?.taskId || null;
  const fingerprint = taskId ? contentFingerprint(getTaskById(taskId) || drill.scenario || drill) : contentFingerprint(drill.scenario || drill);
  const skillTags = skillTagsForDrill(drill);

  store.addHistoryEntry({
    concept,
    street: drill.street,
    drillId: drill.drillId,
    spotId: taskId,
    contentFingerprint: fingerprint,
    grade,
    evLossBb,
    skillTags,
    at: now
  });

  const skillProfile = updateSkillProfileInStore(store, {
    skillTags,
    evLossBb: evLossBb != null ? evLossBb : 0,
    grade,
    now
  });

  updateSkillMasteryAfterTraining(store, {
    skillTags,
    skillProfile,
    grade,
    now
  });

  return { recorded: true, concept, progress, skillProfile, skillTags };
}

function buildProgressMap(store) {
  const progressByConcept = {};
  for (const p of store.listProgress() || []) {
    if (p && p.concept) progressByConcept[p.concept] = p;
  }
  return progressByConcept;
}

function buildRecentResults(history) {
  return (history || []).map((h) => ({
    concept: h.concept,
    grade: h.grade,
    nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD',
    skillTags: h.skillTags || []
  }));
}

export function buildProfileDailyPlan({
  store,
  profiles,
  history,
  count = 7,
  now = Date.now(),
  rng = Math.random,
  pool = null
} = {}) {
  const skillProfile = typeof store.loadSkillProfile === 'function' ? store.loadSkillProfile() : null;
  const leakProfiles = profiles || store.listProfiles() || [];
  const hist = history || store.loadHistory() || [];
  const taskPool = pool || getTaskPool();
  const seed = typeof store.getOrCreatePersonalizationSeed === 'function'
    ? store.getOrCreatePersonalizationSeed()
    : null;
  const seeded = seed != null ? seededRng(`${seed}|plan|${now}`) : rng;
  const recentResults = buildRecentResults(hist);
  const masteryStore = typeof store.loadSkillMastery === 'function' ? store.loadSkillMastery() : {};
  const skillMasteryStates = buildSkillMasteryStates({
    skillProfile,
    masteryStore,
    recentResults,
    now
  });

  if (!hasUsablePlayerProfile(store) && !leakProfiles.length) {
    return null;
  }

  return buildDailyPlan({
    pool: taskPool,
    progressByConcept: buildProgressMap(store),
    history: hist,
    recentResults,
    skillProfile,
    leakProfiles,
    skillMasteryStates,
    count,
    now,
    rng: seeded
  });
}

export function getDailyPersonalizedTraining({ store, profiles, recentCandidates, history, count = 7, now = Date.now(), rng = Math.random } = {}) {
  const libraryPlan = buildProfileDailyPlan({ store, profiles, history, count, now, rng });
  if (libraryPlan && libraryPlan.filled > 0) {
    return {
      sessionId: libraryPlan.sessionId,
      primaryConcept: libraryPlan.primaryConcept,
      personalized: libraryPlan.personalized,
      plan: libraryPlan,
      source: 'library'
    };
  }

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
    plan,
    source: 'leak_queue'
  };
}

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
  jobKey,
  rng = Math.random,
  preparedPlan = null
} = {}) {
  let plan;
  let useLibrary = false;

  if (preparedPlan && preparedPlan.filled > 0) {
    plan = preparedPlan;
    useLibrary = !!(plan.drills && plan.drills.some((d) => d.spotId));
  } else {
    const libraryPlan = buildProfileDailyPlan({ store, profiles, history, count, now, rng: config.rng || rng });

    if (libraryPlan && libraryPlan.filled > 0) {
      plan = libraryPlan;
      useLibrary = true;
    } else {
      plan = buildTrainingSession({
        profiles: profiles || store.listProfiles() || [],
        recentCandidates: recentCandidates || store.listCandidates() || [],
        history: history || store.loadHistory() || [],
        count,
        now,
        leakSet: LEAKS
      });
    }
  }

  const key = jobKey || plan.sessionId;
  if (inflight.has(key)) return inflight.get(key);

  const job = runGeneration({
    plan, store, solve, solveOpts, config, signal, now, useLibrary
  });
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

async function runGeneration({ plan, store, solve, solveOpts, config, signal, now, useLibrary }) {
  const maxAttempts = config.maxAttempts || 8;
  const timeBudgetMs = config.timeBudgetMs || 20000;
  const started = Date.now();
  const seenDrillIds = new Set();
  const drills = [];
  const failures = [];

  const candidates = store.listCandidates() || [];
  const items = useLibrary ? (plan.drills || []) : (plan.drills || []);

  for (const item of items) {
    if (signal && signal.aborted) { failures.push({ concept: item.concept, reason: 'cancelled' }); break; }
    if (Date.now() - started > timeBudgetMs) { failures.push({ concept: item.concept, reason: 'time_budget' }); break; }

    if (useLibrary && item.spotId) {
      const task = getTaskById(item.spotId);
      if (task) {
        const leakConcept = mapLeakConceptForTask(task) || item.concept;
        const gen = drillFromLibraryTask(task, { leakConcept });
        if (gen.ok && !seenDrillIds.has(gen.drill.drillId)) {
          seenDrillIds.add(gen.drill.drillId);
          drills.push(gen.drill);
          continue;
        }
      }
      failures.push({ concept: item.concept, spotId: item.spotId, reason: 'library_task_missing' });
      continue;
    }

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
      } else if (!gen.ok) {
        failures.push({ concept: item.concept, reason: gen.reason, attempt });
      }
    }
  }

  if (drills.length < plan.total && typeof config.generalDrill === 'function') {
    while (drills.length < plan.total) {
      if (signal && signal.aborted) break;
      if (Date.now() - started > timeBudgetMs) break;
      const g = config.generalDrill({ solve, solveOpts, rng: config.rng });
      if (g && g.ok && !seenDrillIds.has(g.drill.drillId)) {
        seenDrillIds.add(g.drill.drillId);
        drills.push(g.drill);
      } else if (g && !g.ok) {
        break;
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
    elapsedMs: Date.now() - started,
    source: useLibrary ? 'library' : 'leak_queue'
  };
}

export async function getDailyPersonalizedTrainingAsync(opts = {}) {
  return buildPersonalizedSessionAsync(opts);
}

export { rankLeaks, hasUsablePlayerProfile };
