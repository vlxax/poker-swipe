// Per-skill mastery + spaced repetition (Phase 6). Tracks NEW → LEARNING →
// PRACTICING → MASTERED → REVIEW_DUE and review intervals (1/3/7/14/30 days).

import { SKILLS } from './skillProfile.js';

export const MASTERY_STATES = ['NEW', 'LEARNING', 'PRACTICING', 'MASTERED', 'REVIEW_DUE'];
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];
export const DAY_MS = 24 * 60 * 60 * 1000;

const MASTERED_SCORE = 82;
const MASTERED_CONFIDENCE = 0.55;
const MASTERED_MIN_SAMPLES = 8;
const MASTERED_RECENT_ACCURACY = 0.75;
const LEARNING_MAX_SAMPLES = 4;
const LEARNING_MAX_SCORE = 50;

export function createSkillMasteryRecord({ skill, now = Date.now() } = {}) {
  return {
    skill,
    state: 'NEW',
    intervalIndex: 0,
    lastPracticedAt: null,
    lastReviewAt: null,
    nextReviewAt: null,
    reviewStreak: 0,
    updatedAt: now
  };
}

export function intervalMsForIndex(index = 0) {
  const idx = Math.max(0, Math.min(index, REVIEW_INTERVAL_DAYS.length - 1));
  return REVIEW_INTERVAL_DAYS[idx] * DAY_MS;
}

export function reviewIntervalDays(index = 0) {
  const idx = Math.max(0, Math.min(index, REVIEW_INTERVAL_DAYS.length - 1));
  return REVIEW_INTERVAL_DAYS[idx];
}

export function recentResultsForSkill(recentResults = [], skill) {
  if (!skill) return [];
  return (recentResults || []).filter((r) => {
    if (r.skill === skill) return true;
    return Array.isArray(r.skillTags) && r.skillTags.includes(skill);
  });
}

export function recentAccuracyForSkill(recentResults = [], skill, window = 8) {
  const list = recentResultsForSkill(recentResults, skill).slice(-window);
  if (!list.length) return null;
  const ok = list.filter((r) => r.grade === 'EXCELLENT' || r.grade === 'GOOD' || r.nearOptimal === true).length;
  return ok / list.length;
}

export function meetsMasteredCriteria(entry, recentResults = [], skill) {
  if (!entry || entry.score == null) return false;
  if (entry.score < MASTERED_SCORE) return false;
  if ((entry.confidence ?? 0) < MASTERED_CONFIDENCE) return false;
  if ((entry.sampleSize ?? 0) < MASTERED_MIN_SAMPLES) return false;
  const acc = recentAccuracyForSkill(recentResults, skill);
  if (acc != null && acc < MASTERED_RECENT_ACCURACY) return false;
  return true;
}

export function deriveMasteryState({
  skill,
  entry = null,
  record = null,
  recentResults = [],
  now = Date.now()
} = {}) {
  const sampleSize = entry?.sampleSize ?? 0;
  const score = entry?.score;
  const recordState = record?.state || 'NEW';

  if (record && recordState === 'PRACTICING' && record.failedReviewAt != null) {
    if (!meetsMasteredCriteria(entry, recentResults, skill)) return 'PRACTICING';
  }

  if (record && record.nextReviewAt != null && now >= record.nextReviewAt
      && (recordState === 'MASTERED' || recordState === 'REVIEW_DUE')) {
    return 'REVIEW_DUE';
  }

  if (recordState === 'REVIEW_DUE' && record?.nextReviewAt != null && now >= record.nextReviewAt) {
    return 'REVIEW_DUE';
  }

  if (meetsMasteredCriteria(entry, recentResults, skill)) {
    if (record?.nextReviewAt != null && now >= record.nextReviewAt) return 'REVIEW_DUE';
    return 'MASTERED';
  }

  if (sampleSize === 0 && !record?.lastPracticedAt) return 'NEW';
  if (sampleSize <= LEARNING_MAX_SAMPLES && (score == null || score < LEARNING_MAX_SCORE)) return 'LEARNING';
  return 'PRACTICING';
}

export function buildSkillMasteryStates({
  skillProfile = null,
  masteryStore = {},
  recentResults = [],
  now = Date.now(),
  skills = null
} = {}) {
  const skillList = skills || (skillProfile?.skills ? Object.keys(skillProfile.skills) : SKILLS);
  const states = {};
  for (const skill of skillList) {
    const entry = skillProfile?.skills?.[skill] || null;
    const record = masteryStore[skill] || createSkillMasteryRecord({ skill, now });
    const state = deriveMasteryState({ skill, entry, record, recentResults, now });
    states[skill] = {
      ...record,
      skill,
      state,
      derivedAt: now
    };
  }
  return states;
}

function scheduleNextReview(record, now) {
  const idx = record.intervalIndex ?? 0;
  record.nextReviewAt = now + intervalMsForIndex(idx);
  record.lastReviewAt = now;
}

export function applySkillMasteryTraining({
  masteryStore = {},
  skill,
  entry = null,
  recentResults = [],
  grade = null,
  now = Date.now()
} = {}) {
  const store = { ...masteryStore };
  const record = { ...(store[skill] || createSkillMasteryRecord({ skill, now })) };
  record.lastPracticedAt = now;
  record.updatedAt = now;

  const syncedState = deriveMasteryState({ skill, entry, record, recentResults, now });
  record.state = syncedState;
  const success = grade === 'EXCELLENT' || grade === 'GOOD';

  if (syncedState === 'REVIEW_DUE') {
    if (success) {
      record.state = 'MASTERED';
      record.intervalIndex = Math.min((record.intervalIndex ?? 0) + 1, REVIEW_INTERVAL_DAYS.length - 1);
      record.reviewStreak = (record.reviewStreak ?? 0) + 1;
      delete record.failedReviewAt;
      scheduleNextReview(record, now);
    } else {
      record.state = 'PRACTICING';
      record.intervalIndex = Math.max(0, (record.intervalIndex ?? 0) - 1);
      record.reviewStreak = 0;
      record.nextReviewAt = null;
      record.failedReviewAt = now;
    }
  } else if (meetsMasteredCriteria(entry, recentResults, skill)) {
    if (record.state !== 'MASTERED' || record.nextReviewAt == null) {
      record.intervalIndex = record.intervalIndex ?? 0;
      scheduleNextReview(record, now);
    }
    record.state = 'MASTERED';
    delete record.failedReviewAt;
  } else {
    record.state = syncedState;
    if (record.state !== 'MASTERED') {
      record.nextReviewAt = null;
    }
  }

  store[skill] = record;
  return { store, record, state: record.state };
}

export function applyTrainingToMasteryStore({
  masteryStore = {},
  skillTags = [],
  skillProfile = null,
  recentResults = [],
  grade = null,
  now = Date.now()
} = {}) {
  let store = { ...masteryStore };
  const updated = [];
  for (const skill of [...new Set(skillTags || [])]) {
    if (!SKILLS.includes(skill)) continue;
    const entry = skillProfile?.skills?.[skill] || null;
    const result = applySkillMasteryTraining({
      masteryStore: store,
      skill,
      entry,
      recentResults,
      grade,
      now
    });
    store = result.store;
    updated.push(result.record);
  }
  return { store, updated, states: buildSkillMasteryStates({ skillProfile, masteryStore: store, recentResults, now }) };
}

export function masteryBoostForSpot(spot, masteryStates = {}, skillProfile = null, { allowMasteredPenalty = true } = {}) {
  let boost = 0;
  for (const tag of spot.skillTags || []) {
    const m = masteryStates[tag];
    if (!m) continue;
    const score = skillProfile?.skills?.[tag]?.score;
    switch (m.state) {
      case 'REVIEW_DUE':
        boost += 4;
        break;
      case 'NEW':
        break;
      case 'LEARNING':
        if (score == null || score < 55) boost += 2;
        break;
      case 'PRACTICING':
        if (score == null || score < 65) boost += 1.5;
        break;
      case 'MASTERED':
        if (allowMasteredPenalty) boost -= 2;
        break;
      default:
        break;
    }
  }
  return boost;
}

export function syncSkillMasteryStore(store, {
  skillProfile = null,
  recentResults = [],
  now = Date.now()
} = {}) {
  if (!store || typeof store.loadSkillMastery !== 'function') return null;
  const masteryStore = store.loadSkillMastery() || {};
  const states = buildSkillMasteryStates({ skillProfile, masteryStore, recentResults, now });
  const nextStore = { ...masteryStore };
  for (const [skill, stateRec] of Object.entries(states)) {
    nextStore[skill] = {
      ...(nextStore[skill] || createSkillMasteryRecord({ skill, now })),
      state: stateRec.state,
      nextReviewAt: stateRec.nextReviewAt,
      intervalIndex: stateRec.intervalIndex,
      lastPracticedAt: stateRec.lastPracticedAt,
      lastReviewAt: stateRec.lastReviewAt,
      reviewStreak: stateRec.reviewStreak,
      updatedAt: now
    };
  }
  store.saveSkillMastery(nextStore);
  return states;
}

export function updateSkillMasteryAfterTraining(store, {
  skillTags = [],
  skillProfile = null,
  grade = null,
  recentResults = null,
  now = Date.now()
} = {}) {
  if (!store || typeof store.loadSkillMastery !== 'function') return null;
  const hist = typeof store.loadHistory === 'function' ? store.loadHistory() : [];
  const recent = recentResults || hist.map((h) => ({
    concept: h.concept,
    grade: h.grade,
    nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD',
    skillTags: h.skillTags || []
  }));
  const masteryStore = store.loadSkillMastery() || {};
  const { store: nextStore, states } = applyTrainingToMasteryStore({
    masteryStore,
    skillTags,
    skillProfile,
    recentResults: recent,
    grade,
    now
  });
  store.saveSkillMastery(nextStore);
  return states;
}
