// Phase 10: Dynamic Player Profile — evolving per-skill tracks from training history.
// Recent evidence weighs more than old evidence; diagnoses distinguish weakness types.

import { SKILLS, skillLabelRu, scoredSkillFromEvidence, confidenceFromEvidence, trendFromEvidence } from './skillProfile.js';
import { buildSkillMasteryStates, recentAccuracyForSkill } from './skillMastery.js';
import { recentAccuracy as gradeRecentAccuracy } from './adaptiveDifficulty.js';

export const SKILL_DIAGNOSES = {
  TRUE_WEAKNESS: 'true_weakness',
  TEMPORARY_MISTAKE: 'temporary_mistake',
  MASTERED: 'mastered',
  DECAYING: 'decaying',
  IMPROVING: 'improving',
  STABLE: 'stable',
  LEARNING: 'learning'
};

export const PROFILE_VERSION = 2;
const RECENT_WINDOW = 8;
const LONG_WINDOW = 40;
const EMA_HALF_LIFE = 10;
const DECAY_GAP_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n, d = 3) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function isGoodAttempt(a) {
  if (a.grade === 'EXCELLENT' || a.grade === 'GOOD') return true;
  return a.evLossBb != null && a.evLossBb <= 0.05;
}

function attemptQuality(a) {
  if (isGoodAttempt(a)) return 1;
  if (a.evLossBb == null) return 0.45;
  return clamp(1 - a.evLossBb / 1.2, 0, 1);
}

export function accuracyFromAttempts(attempts = [], window = null) {
  const slice = window != null ? attempts.slice(-window) : attempts;
  if (!slice.length) return null;
  const ok = slice.filter(isGoodAttempt).length;
  return round(ok / slice.length, 3);
}

export function emaQualityFromAttempts(attempts = [], halfLife = EMA_HALF_LIFE) {
  if (!attempts.length) return null;
  let weightedSum = 0;
  let weightSum = 0;
  for (let i = 0; i < attempts.length; i++) {
    const age = attempts.length - 1 - i;
    const w = Math.exp(-age / halfLife);
    weightedSum += attemptQuality(attempts[i]) * w;
    weightSum += w;
  }
  return weightSum ? round(weightedSum / weightSum, 3) : null;
}

export function emaScoreFromAttempts(attempts = [], halfLife = EMA_HALF_LIFE) {
  const q = emaQualityFromAttempts(attempts, halfLife);
  return q != null ? Math.round(q * 100) : null;
}

export function normalizeTrend(trend) {
  if (trend === 'worsening') return 'declining';
  if (trend === 'improving') return 'improving';
  return 'stable';
}

export function mistakeFrequencyFromEvidence(ev) {
  const n = ev?.sampleSize || 0;
  if (!n) return 0;
  return round((ev.mistakes || 0) / n, 3);
}

export function daysSince(ts, now = Date.now()) {
  if (ts == null) return null;
  return round((now - ts) / DAY_MS, 2);
}

export function diagnoseSkillTrack({
  score = null,
  confidence = 0,
  sampleSize = 0,
  recentAccuracy = null,
  longTermAccuracy = null,
  trend = 'stable',
  mistakeFrequency = 0,
  masteryState = 'NEW',
  lastPracticedAt = null,
  now = Date.now()
} = {}) {
  const gapDays = daysSince(lastPracticedAt, now);
  const normTrend = normalizeTrend(trend);

  if (sampleSize < 3 || confidence < 0.28) {
    return SKILL_DIAGNOSES.LEARNING;
  }

  if (masteryState === 'REVIEW_DUE') {
    return SKILL_DIAGNOSES.DECAYING;
  }

  if (masteryState === 'MASTERED' && score != null && score >= 80) {
    if (gapDays != null && gapDays >= DECAY_GAP_DAYS && normTrend === 'declining') {
      return SKILL_DIAGNOSES.DECAYING;
    }
    return SKILL_DIAGNOSES.MASTERED;
  }

  if (
    score != null && score >= 68 && gapDays != null && gapDays >= DECAY_GAP_DAYS
    && (normTrend === 'declining' || (recentAccuracy != null && recentAccuracy < 0.55))
  ) {
    return SKILL_DIAGNOSES.DECAYING;
  }

  if (
    longTermAccuracy != null && recentAccuracy != null
    && longTermAccuracy >= 0.62 && longTermAccuracy - recentAccuracy >= 0.22
    && score != null && score >= 55
  ) {
    return SKILL_DIAGNOSES.TEMPORARY_MISTAKE;
  }

  if (
    normTrend === 'improving'
    || (recentAccuracy != null && longTermAccuracy != null && recentAccuracy - longTermAccuracy >= 0.12)
  ) {
    return SKILL_DIAGNOSES.IMPROVING;
  }

  if (
    score != null && score < 52 && confidence >= 0.38 && mistakeFrequency >= 0.32
  ) {
    return SKILL_DIAGNOSES.TRUE_WEAKNESS;
  }

  return SKILL_DIAGNOSES.STABLE;
}

export function buildSkillTrack({
  skill,
  evidence = null,
  entry = null,
  masteryState = null,
  recentResults = [],
  now = Date.now()
} = {}) {
  const attempts = evidence?.attempts || [];
  const sampleSize = evidence?.sampleSize ?? entry?.sampleSize ?? 0;
  const longTermAccuracy = accuracyFromAttempts(attempts);
  const recentAccuracy = accuracyFromAttempts(attempts, RECENT_WINDOW)
    ?? recentAccuracyForSkill(recentResults, skill, RECENT_WINDOW);
  const emaScore = emaScoreFromAttempts(attempts);
  const score = emaScore != null && sampleSize >= 3
    ? Math.round(0.55 * (entry?.score ?? emaScore) + 0.45 * emaScore)
    : (entry?.score ?? emaScore);
  const confidence = entry?.confidence ?? evidence?.confidence ?? 0;
  const trend = normalizeTrend(entry?.recentTrend ?? evidence?.recentTrend ?? trendFromEvidence(evidence));
  const mistakeFrequency = mistakeFrequencyFromEvidence(evidence);
  const lastPracticed = evidence?.lastSeenAt ?? masteryState?.lastPracticedAt ?? null;
  const mastery = masteryState?.state || 'NEW';
  const diagnosis = diagnoseSkillTrack({
    score,
    confidence,
    sampleSize,
    recentAccuracy,
    longTermAccuracy,
    trend,
    mistakeFrequency,
    masteryState: mastery,
    lastPracticedAt: lastPracticed,
    now
  });

  return {
    skill,
    labelRu: skillLabelRu(skill),
    score,
    confidence: round(confidence, 3),
    recentAccuracy,
    longTermAccuracy,
    trend,
    mistakeFrequency,
    masteryState: mastery,
    lastPracticed,
    sampleSize,
    diagnosis,
    avgEvLossBb: evidence?.avgEvLossBb ?? entry?.avgEvLossBb ?? 0,
    emaScore
  };
}

export function buildDynamicPlayerProfile({
  skillProfile = null,
  storedEvidence = null,
  masteryStore = {},
  recentResults = [],
  now = Date.now(),
  skills = null
} = {}) {
  const skillList = skills || SKILLS;
  const masteryStates = buildSkillMasteryStates({
    skillProfile,
    masteryStore,
    recentResults,
    now,
    skills: skillList
  });

  const tracks = {};
  for (const skill of skillList) {
    const evidence = storedEvidence?.[skill] || null;
    const entry = skillProfile?.skills?.[skill] || null;
    if (!evidence && !entry) continue;
    tracks[skill] = buildSkillTrack({
      skill,
      evidence,
      entry,
      masteryState: masteryStates[skill],
      recentResults,
      now
    });
  }

  const present = Object.values(tracks);
  const scored = present.filter((t) => t.score != null);
  const overall = scored.length
    ? Math.round(scored.reduce((s, t) => s + t.score, 0) / scored.length)
    : (skillProfile?.overall ?? null);

  const ranked = [...present].sort((a, b) => (a.score ?? 999) - (b.score ?? 999));

  return {
    version: PROFILE_VERSION,
    tracks,
    skills: Object.fromEntries(
      present.map((t) => [t.skill, {
        skill: t.skill,
        labelRu: t.labelRu,
        score: t.score,
        confidence: t.confidence,
        confidenceLabel: t.confidence >= 0.7 ? 'высокая' : t.confidence >= 0.4 ? 'средняя' : 'низкая',
        sampleSize: t.sampleSize,
        recentTrend: t.trend === 'declining' ? 'worsening' : t.trend,
        avgEvLossBb: t.avgEvLossBb,
        recentAccuracy: t.recentAccuracy,
        longTermAccuracy: t.longTermAccuracy,
        mistakeFrequency: t.mistakeFrequency,
        masteryState: t.masteryState,
        lastPracticed: t.lastPracticed,
        diagnosis: t.diagnosis,
        emaScore: t.emaScore
      }])
    ),
    overall,
    overallLabel: skillProfile?.overallLabel ?? null,
    sampleSize: present.reduce((s, t) => s + t.sampleSize, 0),
    confidence: present.length
      ? round(present.reduce((s, t) => s + t.confidence, 0) / present.length, 3)
      : 0,
    updatedAt: now,
    weakest: ranked[0] || skillProfile?.weakest || null,
    strongest: ranked[ranked.length - 1] || skillProfile?.strongest || null,
    masteryStates,
    diagnoses: Object.fromEntries(present.map((t) => [t.skill, t.diagnosis]))
  };
}

/** Merge dynamic tracks into legacy skillProfile shape for planner/selector. */
export function attachDynamicProfile(skillProfile, dynamicProfile) {
  if (!skillProfile || !dynamicProfile) return skillProfile;
  return {
    ...skillProfile,
    version: dynamicProfile.version,
    skills: { ...skillProfile.skills, ...dynamicProfile.skills },
    overall: dynamicProfile.overall ?? skillProfile.overall,
    weakest: dynamicProfile.weakest ?? skillProfile.weakest,
    strongest: dynamicProfile.strongest ?? skillProfile.strongest,
    tracks: dynamicProfile.tracks,
    diagnoses: dynamicProfile.diagnoses,
    dynamic: dynamicProfile
  };
}

export function diagnosisPriorityBoost(diagnosis) {
  switch (diagnosis) {
    case SKILL_DIAGNOSES.TRUE_WEAKNESS: return 3.5;
    case SKILL_DIAGNOSES.DECAYING: return 3;
    case SKILL_DIAGNOSES.TEMPORARY_MISTAKE: return 2;
    case SKILL_DIAGNOSES.IMPROVING: return 1.2;
    case SKILL_DIAGNOSES.LEARNING: return 1.5;
    case SKILL_DIAGNOSES.MASTERED: return -2.5;
    case SKILL_DIAGNOSES.STABLE: return 0.5;
    default: return 0;
  }
}

export function dynamicWeaknessBoost(spot, dynamicProfile) {
  if (!dynamicProfile?.tracks) return 0;
  let boost = 0;
  for (const tag of spot.skillTags || []) {
    const track = dynamicProfile.tracks[tag];
    if (!track) continue;
    boost += diagnosisPriorityBoost(track.diagnosis);
    if (track.score != null && track.score < 65) {
      boost += (65 - track.score) / 65 * 0.75;
    }
    if (track.recentAccuracy != null && track.longTermAccuracy != null
        && track.longTermAccuracy - track.recentAccuracy >= 0.15) {
      boost += 0.6;
    }
  }
  return boost;
}

export function computeDynamicSkillTargets(dynamicProfile, count = 7) {
  if (!dynamicProfile?.tracks) return null;
  const ranked = Object.values(dynamicProfile.tracks)
    .filter((t) => t.score != null)
    .map((t) => ({
      ...t,
      priority: diagnosisPriorityBoost(t.diagnosis) + (t.score < 50 ? 2 : 0)
        + (t.diagnosis === SKILL_DIAGNOSES.DECAYING ? 1.5 : 0)
        + (t.diagnosis === SKILL_DIAGNOSES.IMPROVING
          && t.recentAccuracy != null && t.longTermAccuracy != null
          && t.recentAccuracy - t.longTermAccuracy >= 0.25 ? 1.8 : 0)
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (a.score ?? 999) - (b.score ?? 999);
    });

  if (!ranked.length) return null;

  const targets = {};
  let remaining = count;
  const alloc = (skill, n) => {
    if (n <= 0 || remaining <= 0) return;
    const take = Math.min(n, remaining);
    targets[skill] = (take + (targets[skill] || 0));
    remaining -= take;
  };

  const hasImprovingGap = (t) =>
    t.recentAccuracy != null
    && t.longTermAccuracy != null
    && t.recentAccuracy - t.longTermAccuracy >= 0.25;

  const focus = ranked.filter((t) =>
    t.diagnosis === SKILL_DIAGNOSES.TRUE_WEAKNESS
    || t.diagnosis === SKILL_DIAGNOSES.DECAYING
    || t.diagnosis === SKILL_DIAGNOSES.TEMPORARY_MISTAKE
    || t.diagnosis === SKILL_DIAGNOSES.LEARNING
    || (t.diagnosis === SKILL_DIAGNOSES.IMPROVING && hasImprovingGap(t))
  ).slice(0, 3);

  const pool = focus.length ? focus : ranked.slice(0, 3);

  if (pool[0]) alloc(pool[0].skill, Math.max(2, Math.round(count * 0.38)));
  if (pool[1]) alloc(pool[1].skill, Math.max(1, Math.round(count * 0.24)));
  if (pool[2]) alloc(pool[2].skill, Math.max(1, Math.round(count * 0.14)));

  const mastered = ranked.find((t) => t.diagnosis === SKILL_DIAGNOSES.MASTERED);
  if (mastered && remaining > 0) alloc(mastered.skill, 1);

  let guard = 0;
  while (remaining > 0 && pool.length && guard < count) {
    alloc(pool[guard % pool.length].skill, 1);
    guard++;
  }

  return targets;
}

export function rebuildSkillProfileFromStore(store, { now = Date.now(), history = null } = {}) {
  if (!store) return null;
  const storedEvidence = typeof store.loadSkillEvidence === 'function' ? store.loadSkillEvidence() : null;
  const baseProfile = typeof store.loadSkillProfile === 'function' ? store.loadSkillProfile() : null;
  const masteryStore = typeof store.loadSkillMastery === 'function' ? store.loadSkillMastery() : {};
  const hist = history || (typeof store.loadHistory === 'function' ? store.loadHistory() : []);
  const recentResults = (hist || []).map((h) => ({
    concept: h.concept,
    grade: h.grade,
    nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD',
    skillTags: h.skillTags || []
  }));

  const dynamic = buildDynamicPlayerProfile({
    skillProfile: baseProfile,
    storedEvidence,
    masteryStore,
    recentResults,
    now
  });

  return attachDynamicProfile(baseProfile || { skills: {}, version: 1 }, dynamic);
}
