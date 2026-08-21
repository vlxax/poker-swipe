#!/usr/bin/env node
// Phase 13: Training Quality Audit — 100 sessions across player profiles.
// AUDIT ONLY. Does not modify production logic.

import { buildLibrary } from '../../task-context/library.js';
import { validateLibrary, validateTask } from '../../task-context/validator.js';
import { STREETS } from '../../task-context/schema.js';
import {
  buildPlayerStore, topWeaknesses, classifyTrainingBucket,
  overlapCount, uniqueSkillCount
} from '../src/training/playerDifferentiationFixtures.js';
import {
  buildDynamicPlayerStore, DYNAMIC_PLAN_NOW
} from '../src/training/dynamicPlayerFixtures.js';
import {
  buildProfileDailyPlan, recordTrainingResult
} from '../src/training/personalizedTraining.js';
import { rebuildSkillProfileFromStore, SKILL_DIAGNOSES } from '../src/training/dynamicPlayerProfile.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { getTaskById, getTaskPool, auditTaskMetadata } from '../src/training/taskLibraryBridge.js';
import { contentFingerprint, isTooSimilar } from '../src/training/sessionDiversity.js';
import {
  getTargetDifficulty, pickRelevantSkillForSpot
} from '../src/training/adaptiveDifficulty.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { seededRng } from '../src/training/personalizationSeed.js';
import { buildTaskFeedback } from '../src/training/taskFeedback.js';

export const AUDIT_CONFIG = {
  sessionsPerProfile: 34,
  profiles: ['A', 'B', 'C'],
  tasksPerSession: 15,
  baseNow: 1_760_000_000_000,
  simulateAnswersBetweenSessions: 3
};

const CYRILLIC = /[а-яА-ЯёЁ]/;
const RU_OPTIONS = new Set(['ФОЛД', 'КОЛЛ', 'ЧЕК', 'РЕЙЗ', 'СТАВКА', 'ОЛЛ-ИН', '3-БЕТ', '4-БЕТ']);
const FOCUS_DIAGNOSES = new Set([
  SKILL_DIAGNOSES.TRUE_WEAKNESS,
  SKILL_DIAGNOSES.DECAYING,
  SKILL_DIAGNOSES.TEMPORARY_MISTAKE,
  SKILL_DIAGNOSES.LEARNING
]);

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function hasCyrillic(text) {
  return CYRILLIC.test(String(text || ''));
}

function taskContextComplete(task) {
  if (!task) return false;
  const required = [
    task.id, task.street, task.format, task.stage, task.table,
    task.position, task.villain, task.question, task.explain, task.concept,
    Array.isArray(task.hero) && task.hero.length === 2,
    Array.isArray(task.options) && task.options.length >= 2,
    Array.isArray(task.history),
    task.pot > 0, task.heroStack > 0, task.effStack > 0,
    Array.isArray(task.blinds) && task.blinds.length === 2
  ];
  return required.every(Boolean);
}

function pokerBrainContextOk(task) {
  return taskContextComplete(task)
    && STREETS.includes(task.street)
    && hasCyrillic(task.question)
    && hasCyrillic(task.explain)
    && (task.options || []).every((o) => RU_OPTIONS.has(o) || hasCyrillic(o));
}

function answerExplanationOk(task) {
  const gen = drillFromLibraryTask(task);
  if (!gen.ok) return { ok: false, reason: gen.reason };
  const drill = gen.drill;
  const rec = drill.options.find((o) => o.labelRu === task.correct);
  if (!rec) return { ok: false, reason: 'correct_missing_in_drill' };
  const grade = gradeAnswer({ drill, chosenId: rec.id });
  const fb = buildTaskFeedback({
    task,
    chosenLabel: task.correct,
    recommendedLabel: task.correct,
    grade: grade.grade,
    evLossBb: grade.evLossBb,
    concept: drill.concept
  });
  const ok = fb && fb.verdict && fb.why && hasCyrillic(fb.why);
  return { ok, grade: grade.grade, verdict: fb?.verdict };
}

function focusSkillsFromProfile(profile) {
  const tracks = profile?.tracks || profile?.dynamic?.tracks || {};
  const fromTracks = Object.values(tracks)
    .filter((t) => t && FOCUS_DIAGNOSES.has(t.diagnosis))
    .map((t) => t.skill);
  if (fromTracks.length) return [...new Set(fromTracks)];
  const weak = profile?.weakest?.skill;
  return weak ? [weak] : topWeaknesses({ loadSkillProfile: () => profile }).map((w) => w.skill);
}

function spotMatchesWeakness(spot, weakSkills) {
  if (!weakSkills.length) return true;
  return (spot.skillTags || []).some((t) => weakSkills.includes(t));
}

function difficultyMatchesSpot(spot, profile, recentResults) {
  const skill = pickRelevantSkillForSpot(spot, profile);
  if (!skill || spot.difficulty == null) return true;
  const band = getTargetDifficulty(profile, skill, { recentResults });
  return spot.difficulty >= band.min - 0.6 && spot.difficulty <= band.max + 0.6;
}

function sessionNearDuplicatePairs(spots) {
  let pairs = 0;
  let total = 0;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      total++;
      if (isTooSimilar(spots[i], spots[j])) pairs++;
    }
  }
  return { pairs, total };
}

function auditSession(store, profileId, sessionIndex, config = AUDIT_CONFIG) {
  const now = config.baseNow + sessionIndex * 120_000;
  const seed = store.loadPersonalizationSeed()?.seed || profileId;
  const rng = seededRng(`${seed}|audit|${sessionIndex}`);
  const profile = rebuildSkillProfileFromStore(store, { now, history: store.loadHistory() });
  const recentResults = (store.loadHistory() || []).map((h) => ({
    grade: h.grade,
    skillTags: h.skillTags || [],
    nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD'
  }));

  const plan = buildProfileDailyPlan({
    store,
    count: config.tasksPerSession,
    now,
    rng
  });

  const spots = plan?.spots || [];
  const spotIds = plan?.spotIds || spots.map((s) => s.id);
  const tasks = spotIds.map((id) => getTaskById(id)).filter(Boolean);

  let invalidSpots = 0;
  let pokerLogicFails = 0;
  let answerFails = 0;
  let contextFails = 0;
  let ruTermFails = 0;
  let diffMismatch = 0;
  let profileMismatch = 0;
  let primaryWeakSlots = 0;
  let advancedTasks = 0;

  const weakSkills = focusSkillsFromProfile(profile);

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const task = tasks[i] || getTaskById(spot.id);
    if (!task) {
      invalidSpots++;
      continue;
    }

    const val = validateTask(task);
    if (val.errors.length) invalidSpots++;

    if (!pokerBrainContextOk(task)) contextFails++;
    if (!hasCyrillic(task.question) || !hasCyrillic(task.explain)) ruTermFails++;
    if (!(task.options || []).includes(task.correct)) pokerLogicFails++;

    const ans = answerExplanationOk(task);
    if (!ans.ok) answerFails++;

    if (!difficultyMatchesSpot(spot, profile, recentResults)) diffMismatch++;

    if (task.difficulty >= 4) advancedTasks++;

    const slot = (plan.slotKinds || [])[i] || '';
    if (slot.includes('weakness')) {
      primaryWeakSlots++;
      if (!spotMatchesWeakness(spot, weakSkills)) profileMismatch++;
    }
  }

  const dupIds = spotIds.length - new Set(spotIds).size;
  const { pairs: nearDupPairs, total: nearDupTotal } = sessionNearDuplicatePairs(spots);

  return {
    profileId,
    sessionIndex,
    personalized: !!plan?.personalized,
    filled: plan?.filled || 0,
    spotCount: spots.length,
    duplicateIds: dupIds,
    nearDupPairs,
    nearDupTotal,
    skillCoverage: uniqueSkillCount(spots),
    difficultyMean: spots.length
      ? Math.round(spots.reduce((s, x) => s + (x.difficulty || 0), 0) / spots.length * 100) / 100
      : 0,
    advancedTasks,
    invalidSpots,
    pokerLogicFails,
    answerFails,
    contextFails,
    ruTermFails,
    diffMismatch,
    profileMismatch,
    primaryWeakSlots,
    weakSkills,
    distribution: classifyTrainingBucket,
    bucketCounts: (() => {
      const d = { icmPush: 0, postRiver: 0, other: 0 };
      for (const spot of spots) {
        const b = classifyTrainingBucket(spot);
        d[b] = (d[b] || 0) + 1;
      }
      return d;
    })(),
    targetDifficulty: plan?.targetDifficulty ?? null
  };
}

function simulateAnswers(store, plan, { count = 3, now, pickWrong = false } = {}) {
  let t = now;
  const spots = (plan?.spots || []).slice(0, count);
  for (const spot of spots) {
    const task = getTaskById(spot.id);
    if (!task) continue;
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    const drill = gen.drill;
    let chosenId;
    if (pickWrong) {
      chosenId = drill.options.find((o) => o.labelRu !== task.correct)?.id || drill.options[0].id;
    } else {
      chosenId = drill.options.find((o) => o.labelRu === task.correct)?.id || drill.options[0].id;
    }
    recordTrainingResult(store, {
      drill,
      grade: pickWrong ? 'MISTAKE' : 'GOOD',
      evLossBb: pickWrong ? 0.85 : 0.03,
      now: t
    });
    t += 5000;
  }
  return t;
}

export function runTrainingQualityAudit(config = AUDIT_CONFIG) {
  const lib = buildLibrary();
  const libVal = validateLibrary(lib);
  const meta = auditTaskMetadata(lib);

  const profileBuilders = {
    A: () => buildPlayerStore('A'),
    B: () => buildPlayerStore('B'),
    C: () => buildPlayerStore('C')
  };

  const sessions = [];
  const profileSummaries = {};

  for (const profileId of config.profiles) {
    const store = profileBuilders[profileId]();
    const profileSessions = [];

    for (let i = 0; i < config.sessionsPerProfile; i++) {
      const report = auditSession(store, profileId, i, config);
      profileSessions.push(report);
      sessions.push(report);

      if (config.simulateAnswersBetweenSessions > 0) {
        const now = config.baseNow + i * 120_000;
        const plan = buildProfileDailyPlan({
          store,
          count: config.tasksPerSession,
          now,
          rng: seededRng(`${store.loadPersonalizationSeed()?.seed}|audit|${i}`)
        });
        simulateAnswers(store, plan, {
          count: config.simulateAnswersBetweenSessions,
          now: now + 1000,
          pickWrong: i % 4 === 0
        });
      }
    }

    const allIds = profileSessions.flatMap((s) => Array(s.spotCount).fill(0).map((_, idx) => idx));
    profileSummaries[profileId] = {
      sessions: profileSessions.length,
      avgIcmPush: pct(
        profileSessions.reduce((n, s) => n + s.bucketCounts.icmPush, 0),
        profileSessions.reduce((n, s) => n + s.spotCount, 0)
      ),
      avgPostRiver: pct(
        profileSessions.reduce((n, s) => n + s.bucketCounts.postRiver, 0),
        profileSessions.reduce((n, s) => n + s.spotCount, 0)
      ),
      avgSkillCoverage: Math.round(
        profileSessions.reduce((n, s) => n + s.skillCoverage, 0) / profileSessions.length * 10
      ) / 10,
      avgDifficulty: Math.round(
        profileSessions.reduce((n, s) => n + s.difficultyMean, 0) / profileSessions.length * 100
      ) / 100,
      avgAdvancedRate: pct(
        profileSessions.reduce((n, s) => n + s.advancedTasks, 0),
        profileSessions.reduce((n, s) => n + s.spotCount, 0)
      ),
      weakest: topWeaknesses(store).map((w) => w.skill)
    };
  }

  // Trim to exactly 100 sessions if 34*3=102
  const trimmed = sessions.slice(0, 100);

  // Session-0 differentiation on clean profiles (before longitudinal drift)
  const session0Stores = {
    A: buildPlayerStore('A'),
    B: buildPlayerStore('B'),
    C: buildPlayerStore('C')
  };
  const plan0 = {};
  for (const id of config.profiles) {
    const plan = buildProfileDailyPlan({
      store: session0Stores[id],
      count: config.tasksPerSession,
      now: config.baseNow,
      rng: seededRng(`${session0Stores[id].loadPersonalizationSeed()?.seed}|audit|0`)
    });
    const dist = { icmPush: 0, postRiver: 0, other: 0 };
    for (const spot of plan.spots || []) {
      const b = classifyTrainingBucket(spot);
      dist[b] = (dist[b] || 0) + 1;
    }
    plan0[id] = { distribution: dist, spotIds: plan.spotIds, spots: plan.spots || [] };
  }

  const totalTasks = trimmed.reduce((n, s) => n + s.spotCount, 0);
  const totalDuplicates = trimmed.reduce((n, s) => n + s.duplicateIds, 0);
  const totalNearDupPairs = trimmed.reduce((n, s) => n + s.nearDupPairs, 0);
  const totalNearDupTotal = trimmed.reduce((n, s) => n + s.nearDupTotal, 0);
  const totalInvalid = trimmed.reduce((n, s) => n + s.invalidSpots, 0);
  const totalProfileMismatch = trimmed.reduce((n, s) => n + s.profileMismatch, 0);
  const totalPrimaryWeak = trimmed.reduce((n, s) => n + s.primaryWeakSlots, 0);
  const totalDiffMismatch = trimmed.reduce((n, s) => n + s.diffMismatch, 0);
  const totalAnswerFails = trimmed.reduce((n, s) => n + s.answerFails, 0);
  const totalContextFails = trimmed.reduce((n, s) => n + s.contextFails, 0);
  const totalRuFails = trimmed.reduce((n, s) => n + s.ruTermFails, 0);
  const personalizedCount = trimmed.filter((s) => s.personalized).length;
  const crossOverlap = overlapCount(plan0.A.spotIds, plan0.B.spotIds);

  const session0Rates = {
    A: {
      icmPush: pct(plan0.A.distribution.icmPush, config.tasksPerSession),
      postRiver: pct(plan0.A.distribution.postRiver, config.tasksPerSession)
    },
    B: {
      icmPush: pct(plan0.B.distribution.icmPush, config.tasksPerSession),
      postRiver: pct(plan0.B.distribution.postRiver, config.tasksPerSession)
    },
    C: {
      icmPush: pct(plan0.C.distribution.icmPush, config.tasksPerSession),
      postRiver: pct(plan0.C.distribution.postRiver, config.tasksPerSession),
      advancedRate: pct(plan0.C.spots.filter((s) => s.difficulty >= 4).length, config.tasksPerSession)
    }
  };

  const metrics = {
    sessionsAudited: trimmed.length,
    totalTasks,
    duplicateRate: pct(totalDuplicates, totalTasks),
    nearDuplicateRate: pct(totalNearDupPairs, totalNearDupTotal),
    skillCoverageAvg: Math.round(trimmed.reduce((n, s) => n + s.skillCoverage, 0) / trimmed.length * 10) / 10,
    difficultyDistribution: (() => {
      const hist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const s of trimmed) {
        const weight = s.spotCount;
        const bucket = Math.max(1, Math.min(5, Math.round(s.difficultyMean)));
        hist[bucket] = (hist[bucket] || 0) + weight;
      }
      return hist;
    })(),
    profileMismatchRate: pct(totalProfileMismatch, totalPrimaryWeak),
    invalidSpotCount: totalInvalid,
    invalidSpotRate: pct(totalInvalid, totalTasks),
    answerFailCount: totalAnswerFails,
    contextFailCount: totalContextFails,
    ruTermFailCount: totalRuFails,
    diffMismatchRate: pct(totalDiffMismatch, totalTasks),
    personalizedRate: pct(personalizedCount, trimmed.length),
    crossProfileOverlap: crossOverlap,
    session0Rates,
    libraryValid: libVal.ok,
    libraryTaskCount: lib.length,
    metadataFullyUsable: meta.fullyUsable,
    metadataTotal: meta.total
  };

  const thresholds = {
    maxDuplicateRate: 1,
    maxNearDuplicateRate: 12,
    maxProfileMismatchRate: 30,
    maxInvalidSpots: 0,
    maxAnswerFailRate: 0,
    minPersonalizedRate: 95,
    minCrossProfileDiff: 1,
    minAdvancedRateC: 25
  };

  const verdict = {
    trainingQuality: metrics.duplicateRate <= thresholds.maxDuplicateRate
      && metrics.nearDuplicateRate <= thresholds.maxNearDuplicateRate
      && metrics.invalidSpotCount <= thresholds.maxInvalidSpots
      && metrics.answerFailCount === 0
      && metrics.personalizedRate >= thresholds.minPersonalizedRate,
    pokerLogic: libVal.ok
      && metrics.invalidSpotCount <= thresholds.maxInvalidSpots
      && metrics.answerFailCount === 0
      && metrics.contextFailCount === 0,
    personalizationQuality: metrics.profileMismatchRate <= thresholds.maxProfileMismatchRate
      && metrics.crossProfileOverlap < config.tasksPerSession
      && session0Rates.A.icmPush > session0Rates.B.icmPush
      && session0Rates.B.postRiver >= session0Rates.A.postRiver
      && metrics.personalizedRate >= thresholds.minPersonalizedRate
      && session0Rates.C.advancedRate >= thresholds.minAdvancedRateC
  };

  const nextP0Fixes = [];
  if (metrics.duplicateRate > 0) nextP0Fixes.push('Intra-session duplicate task IDs detected');
  if (metrics.nearDuplicateRate > thresholds.maxNearDuplicateRate) {
    nextP0Fixes.push('Near-duplicate spot rate above threshold — tighten sessionDiversity penalties');
  }
  if (metrics.profileMismatchRate > thresholds.maxProfileMismatchRate) {
    nextP0Fixes.push('Primary weakness slots sometimes miss diagnosed weak skills');
  }
  if (metrics.diffMismatchRate > 20) {
    nextP0Fixes.push('Task difficulty often outside adaptive band for player level');
  }
  if (metrics.contextFailCount > 0) nextP0Fixes.push('Some tasks missing Poker Brain / task-context fields');
  if (metrics.ruTermFailCount > 0) nextP0Fixes.push('Russian terminology gaps in task copy');
  if (session0Rates.C.advancedRate < thresholds.minAdvancedRateC) {
    nextP0Fixes.push('Strong profile C receives insufficient difficulty 4–5 tasks on session 0');
  }
  if (!session0Rates.A.icmPush > session0Rates.B.icmPush) {
    nextP0Fixes.push('Profile A (weak ICM) session-0 plan does not prioritize ICM over profile B');
  }
  if (session0Rates.B.postRiver < session0Rates.A.postRiver) {
    nextP0Fixes.push('Profile B (weak postflop) session-0 plan under-targets postflop/river vs profile A');
  }
  if (nextP0Fixes.length === 0) nextP0Fixes.push('No P0 issues — monitor near-duplicate rate on long sessions');

  return {
    config,
    metrics,
    thresholds,
    verdict,
    profileSummaries,
    session0Rates,
    nextP0Fixes,
    sessions: trimmed
  };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const report = runTrainingQualityAudit();
  console.log(JSON.stringify({
    metrics: report.metrics,
    verdict: report.verdict,
    profileSummaries: report.profileSummaries,
    session0Rates: report.session0Rates,
    nextP0Fixes: report.nextP0Fixes
  }, null, 2));
}
