// Adaptive initial diagnostic selection (P0). Dedicated algorithm — does NOT use
// training personalizationSeed. Progressive difficulty: calibration → branch by
// answer quality. Two fresh users get different items within the same category
// structure via diagnosticSessionSeed.

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';
import { seededRng } from './personalizationSeed.js';
import {
  DIAGNOSTIC_CATEGORIES,
  DIAGNOSTIC_CATEGORY_IDS,
  getDiagnosticPool,
  getDiagnosticPoolByCategory,
  diagnosticItemToAssessmentItem,
  validateDiagnosticItem
} from './diagnosticPool.js';

export const DIAGNOSTIC_COUNT_MIN = 12;
export const DIAGNOSTIC_COUNT_MAX = 15;
export const DIAGNOSTIC_COUNT_DEFAULT = 13;

const EXTRA_CATEGORY_CANDIDATES = [
  'postflop_fundamentals', 'turn_river', 'bet_sizing', 'blind_defense_3bet'
];

export function createDiagnosticSessionSeed() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(2);
    globalThis.crypto.getRandomValues(buf);
    return `dx-${buf[0].toString(16)}${buf[1].toString(16)}`;
  }
  return `dx-${stableHash(`${Date.now()}|${Math.random()}`)}`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function tierFromAbility(ability) {
  if (ability >= 78) return 5;
  if (ability >= 64) return 4;
  if (ability >= 50) return 3;
  if (ability >= 36) return 2;
  return 1;
}

function updateAbility(ability, item, grade) {
  const diff = item.difficulty || item.tier || 2;
  let delta = 0;
  if (grade.correct) delta = diff * 3;
  else if (grade.nearOptimal) delta = diff * 2;
  else delta = -(diff * 4);
  return clamp(ability + delta, 0, 100);
}

function abilityMaxTier(ability) {
  if (ability >= 64) return 4;
  if (ability >= 50) return 3;
  if (ability >= 36) return 2;
  return 2;
}

function abilityMinFloor(ability, categoryVisit = 0) {
  if (categoryVisit > 0) return ability >= 64 ? 2 : 1;
  if (ability >= 78) return 3;
  if (ability >= 64) return 2;
  if (ability >= 50) return 2;
  return 1;
}

function categoryVisitIndex(session, categoryId) {
  return (session.answers || []).filter((a) => a.category === categoryId).length;
}

function shuffleWithRng(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDiverseWithinCategory(categoryItems, session, categoryId) {
  const isCalibration = session.index < 2;
  const maxTier = isCalibration ? 2 : abilityMaxTier(session.ability);
  const visit = categoryVisitIndex(session, categoryId);
  const minTier = isCalibration ? 1 : abilityMinFloor(session.ability, visit);
  const slotRng = seededRng(`${session.sessionSeed}|pick|${session.index}|${categoryId}`);

  const tiers = [];
  for (let t = minTier; t <= maxTier; t++) {
    if (categoryItems.some((i) => i.tier === t && !session.usedIds.has(i.id))) tiers.push(t);
  }

  if (tiers.length) {
    const tierOrder = shuffleWithRng(tiers, seededRng(`${session.sessionSeed}|tierOrder|${session.index}|${categoryId}`));
    const start = Math.floor(slotRng() * tierOrder.length);
    for (let attempt = 0; attempt < tierOrder.length; attempt++) {
      const tierPick = tierOrder[(start + attempt) % tierOrder.length];
      const atTier = categoryItems.filter((i) => !session.usedIds.has(i.id) && i.tier === tierPick);
      if (atTier.length) {
        const pickRng = seededRng(`${session.sessionSeed}|item|${session.index}|${categoryId}|${tierPick}`);
        return atTier[Math.floor(pickRng() * atTier.length)];
      }
    }
  }

  let pool = categoryItems.filter((i) => !session.usedIds.has(i.id) && i.tier >= minTier && i.tier <= maxTier);
  if (!pool.length) pool = categoryItems.filter((i) => !session.usedIds.has(i.id) && i.tier <= maxTier);
  if (!pool.length) pool = categoryItems.filter((i) => !session.usedIds.has(i.id));
  return pool.length ? pool[Math.floor(slotRng() * pool.length)] : null;
}

function buildCategoryPlan(_sessionSeed, targetCount, _rng) {
  const base = DIAGNOSTIC_CATEGORY_IDS.slice();
  const extrasNeeded = Math.max(0, targetCount - base.length);
  return base.concat(EXTRA_CATEGORY_CANDIDATES.slice(0, extrasNeeded)).slice(0, targetCount);
}

export function createDiagnosticSession({
  sessionSeed = null,
  targetCount = DIAGNOSTIC_COUNT_DEFAULT,
  pool = null
} = {}) {
  const seed = sessionSeed || createDiagnosticSessionSeed();
  const rng = seededRng(seed);
  const count = clamp(Number(targetCount) || DIAGNOSTIC_COUNT_DEFAULT, DIAGNOSTIC_COUNT_MIN, DIAGNOSTIC_COUNT_MAX);
  const sourcePool = pool || getDiagnosticPool();
  const categoryPlan = buildCategoryPlan(seed, count, rng);
  const draft = {
    version: 1,
    sessionSeed: seed,
    targetCount: count,
    categoryPlan,
    ability: 50,
    index: 0,
    done: false,
    usedIds: new Set(),
    items: [],
    answers: [],
    pool: sourcePool
  };
  return draft;
}

export function selectNextDiagnosticItem(session, { gradeFn = null } = {}) {
  if (!session || session.done) return null;
  if (session.index >= session.categoryPlan.length) {
    session.done = true;
    return null;
  }

  const categoryId = session.categoryPlan[session.index];
  const categoryItems = session.pool.filter((i) => i.category === categoryId);

  const raw = pickDiverseWithinCategory(categoryItems, session, categoryId);
  if (!raw) {
    session.done = true;
    return null;
  }

  session.usedIds.add(raw.id);
  const item = diagnosticItemToAssessmentItem(raw);
  session._currentRaw = raw;
  session._currentItem = item;
  return item;
}

export function submitDiagnosticAnswer(session, choice, gradeResult) {
  if (!session || session.done && !session._currentItem) return session;

  const item = session._currentItem;
  const raw = session._currentRaw;
  if (!item || !raw) return session;

  const grade = gradeResult || { correct: false, nearOptimal: false, score: 0, evLossBb: 0.5 };
  session.ability = updateAbility(session.ability, raw, grade);
  session.items.push(item);
  session.answers.push({
    id: item.id,
    choice,
    category: item.category,
    tier: item.tier,
    difficulty: item.difficulty,
    skillTag: item.skillTag,
    correct: grade.correct,
    nearOptimal: grade.nearOptimal,
    score: grade.score,
    evLossBb: grade.evLossBb,
    evidenceWeight: evidenceWeight(raw, grade)
  });

  session.index++;
  session._currentItem = null;
  session._currentRaw = null;

  if (session.index >= session.targetCount) {
    session.done = true;
  }

  return session;
}

export function evidenceWeight(item, grade) {
  const diffW = 0.6 + ((item.difficulty || item.tier || 2) / 5) * 0.4;
  const resultW = grade.correct ? 1 : grade.nearOptimal ? 0.7 : 0.3;
  return round(diffW * resultW, 3);
}

export function recommendedStartingDifficulty({ ability = 50, overall = null } = {}) {
  const signal = overall != null ? overall * 0.6 + ability * 0.4 : ability;
  if (signal >= 78) return 4;
  if (signal >= 62) return 3;
  if (signal >= 45) return 2;
  return 1;
}

export function diagnosticSessionSummary(session) {
  const answers = session.answers || [];
  const tiers = answers.map((a) => a.tier || a.difficulty || 2);
  const avgTier = tiers.length ? tiers.reduce((s, t) => s + t, 0) / tiers.length : 0;
  const advancedCount = answers.filter((a) => (a.tier || a.difficulty || 0) >= 4).length;
  const advancedShare = answers.length ? advancedCount / answers.length : 0;

  return {
    sessionSeed: session.sessionSeed,
    targetCount: session.targetCount,
    answered: answers.length,
    ability: session.ability,
    avgTier: round(avgTier, 2),
    advancedCount,
    advancedShare: round(advancedShare, 3),
    categoryPlan: session.categoryPlan.slice(),
    itemIds: (session.items || []).map((i) => i.id)
  };
}

export function simulateDiagnosticRun({
  sessionSeed,
  answerFn,
  targetCount = DIAGNOSTIC_COUNT_DEFAULT,
  pool = null,
  gradeFn = null
} = {}) {
  const session = createDiagnosticSession({ sessionSeed, targetCount, pool });
  const grade = gradeFn || defaultGradeFn;
  const results = [];

  while (!session.done) {
    const item = selectNextDiagnosticItem(session);
    if (!item) break;
    const choice = answerFn(item, session);
    const gradeResult = grade(item, choice);
    submitDiagnosticAnswer(session, choice, gradeResult);
    results.push({ item, choice, grade: gradeResult });
  }

  return { session, results, items: session.items.slice(), answers: session.answers.slice() };
}

function defaultGradeFn(item, choice) {
  const correct = choice === item.correct;
  const nearOptimal = !correct && (item.alsoOk || []).includes(choice);
  const evLossBb = correct ? 0 : nearOptimal ? 0.08 : 0.5;
  const score = correct ? item.score : nearOptimal ? Math.round(item.score * 0.85) : Math.round(item.score * 0.3);
  return { score, correct, nearOptimal, evLossBb };
}

export function buildDiagnosticSetFromSession(session) {
  return (session.items || []).slice();
}

export function getDiagnosticCategoryCoverage(pool = null) {
  const source = pool || getDiagnosticPool();
  const byCategory = {};
  for (const cat of DIAGNOSTIC_CATEGORIES) {
    byCategory[cat.id] = source.filter((i) => i.category === cat.id).length;
  }
  return byCategory;
}

export function getDiagnosticDifficultyCoverage(pool = null) {
  const source = pool || getDiagnosticPool();
  const byTier = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of source) {
    const t = item.tier || item.difficulty || 1;
    if (byTier[t] != null) byTier[t]++;
  }
  return byTier;
}

export function getDiagnosticSkillCoverage(pool = null) {
  const source = pool || getDiagnosticPool();
  const skills = new Set();
  for (const item of source) {
    skills.add(item.skillTag);
    for (const s of (item.skillTags || [])) skills.add(s);
  }
  return [...skills].sort();
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export {
  DIAGNOSTIC_CATEGORIES,
  DIAGNOSTIC_CATEGORY_IDS,
  validateDiagnosticItem
};
