// Placement Test V2 — adaptive 12–15 task MTT placement using validated library
// tasks and mini-app mechanics. First 4 = calibration anchors L1/L2/L4/L5;
// remaining slots adapt to earlier answers with controlled randomness.

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';
import { seededRng } from './personalizationSeed.js';
import { deriveSkillTags } from './planner.js';
import {
  getValidatedMttTasks,
  libraryTaskToPlacementItem,
  assignMiniAppMode,
  PLACEMENT_MODES
} from './placementTaskAdapter.js';

export const PLACEMENT_COUNT_MIN = 12;
export const PLACEMENT_COUNT_MAX = 15;
export const PLACEMENT_COUNT_DEFAULT = 13;

export const CALIBRATION_TIERS = [1, 2, 4, 5];

export const PLACEMENT_SKILLS = [
  'preflop', 'postflop', 'betSizing', 'rangeReading', 'river',
  'bluffCatch', 'bluffing', 'shortStack', 'icm',
  'positionAwareness', 'stackDepthAwareness'
];

const MODE_ROTATION = ['swipe', 'quick', 'sizing', 'review', 'xray', 'swipe', 'quick', 'swipe', 'review'];

const CORRECT_WEIGHT = { 1: 0.5, 2: 0.75, 3: 1.0, 4: 1.25, 5: 1.5 };
const WRONG_WEIGHT = { 1: 1.4, 2: 1.0, 3: 0.65, 4: 0.35, 5: 0.15 };

export function createPlacementSessionSeed() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(2);
    globalThis.crypto.getRandomValues(buf);
    return `pt2-${buf[0].toString(16)}${buf[1].toString(16)}`;
  }
  return `pt2-${stableHash(`${Date.now()}|${Math.random()}`)}`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function shuffleWithRng(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildModePlan(sessionSeed, targetCount) {
  const rng = seededRng(`${sessionSeed}|modes`);
  const adaptiveCount = Math.max(0, targetCount - CALIBRATION_TIERS.length);
  const base = MODE_ROTATION.slice(0, adaptiveCount);
  while (base.length < adaptiveCount) base.push(PLACEMENT_MODES[base.length % PLACEMENT_MODES.length]);
  return shuffleWithRng(base, rng);
}

function buildAdaptiveSkillPlan(sessionSeed, targetCount) {
  const adaptiveCount = Math.max(0, targetCount - CALIBRATION_TIERS.length);
  const rng = seededRng(`${sessionSeed}|skills`);
  const core = ['preflop', 'postflop', 'betSizing', 'river', 'icm', 'shortStack', 'rangeReading', 'bluffCatch'];
  const plan = [];
  for (let i = 0; i < adaptiveCount; i++) {
    plan.push(core[i % core.length]);
  }
  return shuffleWithRng(plan, rng);
}

export function createPlacementSession({
  sessionSeed = null,
  targetCount = PLACEMENT_COUNT_DEFAULT,
  library = null
} = {}) {
  const seed = sessionSeed || createPlacementSessionSeed();
  const count = clamp(Number(targetCount) || PLACEMENT_COUNT_DEFAULT, PLACEMENT_COUNT_MIN, PLACEMENT_COUNT_MAX);
  const rawTasks = getValidatedMttTasks(library);
  const modePlan = buildModePlan(seed, count);
  const skillPlan = buildAdaptiveSkillPlan(seed, count);

  return {
    version: 2,
    sessionSeed: seed,
    targetCount: count,
    ability: 50,
    index: 0,
    done: false,
    usedIds: new Set(),
    items: [],
    answers: [],
    rawTasks,
    modePlan,
    skillPlan,
    skillSignals: Object.fromEntries(PLACEMENT_SKILLS.map((s) => [s, { correct: 0, wrong: 0, weight: 0 }])),
    _currentItem: null,
    _currentRaw: null
  };
}

function updateAbility(ability, tier, grade) {
  let delta = 0;
  if (grade.correct) delta = tier * 3;
  else if (grade.nearOptimal) delta = tier * 2;
  else delta = -(tier * 4);
  return clamp(ability + delta, 0, 100);
}

function updateSkillSignals(session, item, grade) {
  const tags = item.skillTags && item.skillTags.length ? item.skillTags : [item.skillTag].filter(Boolean);
  const tier = item.tier || item.difficulty || 2;
  const w = placementEvidenceWeight(tier, grade);
  for (const skill of tags) {
    if (!session.skillSignals[skill]) {
      session.skillSignals[skill] = { correct: 0, wrong: 0, weight: 0 };
    }
    const sig = session.skillSignals[skill];
    sig.weight += Math.abs(w);
    if (grade.correct || grade.nearOptimal) sig.correct += w > 0 ? w : 0;
    else sig.wrong += w < 0 ? Math.abs(w) : 0;
  }
}

function abilityMaxTier(ability) {
  if (ability >= 72) return 5;
  if (ability >= 58) return 4;
  if (ability >= 44) return 3;
  if (ability >= 30) return 2;
  return 2;
}

function abilityMinTier(ability, visit = 0) {
  if (visit > 0) return ability >= 58 ? 2 : 1;
  if (ability >= 72) return 3;
  if (ability >= 44) return 2;
  return 1;
}

function pickCalibrationTask(session, tier, slotIndex) {
  const rng = seededRng(`${session.sessionSeed}|cal|${slotIndex}|${tier}`);
  const pool = session.rawTasks.filter((t) => !session.usedIds.has(t.id) && (t.difficulty || 2) === tier);
  if (!pool.length) {
    const fallback = session.rawTasks.filter((t) => !session.usedIds.has(t.id) && Math.abs((t.difficulty || 2) - tier) <= 1);
    if (!fallback.length) return null;
    return fallback[Math.floor(rng() * fallback.length)];
  }
  const mode = slotIndex % 2 === 0 ? 'swipe' : (tier >= 4 ? 'quick' : 'swipe');
  const start = Math.floor(rng() * pool.length);
  for (let i = 0; i < pool.length; i++) {
    const task = pool[(start + i) % pool.length];
    if (!session.usedIds.has(task.id)) return { task, mode };
  }
  return null;
}

function weakestSkills(session, limit = 3) {
  const scored = PLACEMENT_SKILLS.map((skill) => {
    const sig = session.skillSignals[skill] || { correct: 0, wrong: 0, weight: 0 };
    const net = sig.correct - sig.wrong;
    const samples = sig.weight;
    return { skill, net, samples };
  }).filter((s) => s.samples > 0)
    .sort((a, b) => a.net - b.net);
  return scored.slice(0, limit).map((s) => s.skill);
}

function strongestSkills(session, limit = 2) {
  return PLACEMENT_SKILLS.map((skill) => {
    const sig = session.skillSignals[skill] || { correct: 0, wrong: 0, weight: 0 };
    return { skill, net: sig.correct - sig.wrong, samples: sig.weight };
  }).filter((s) => s.samples > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, limit)
    .map((s) => s.skill);
}

function pickAdaptiveTask(session, slotIndex) {
  const adaptiveIdx = slotIndex - CALIBRATION_TIERS.length;
  const rng = seededRng(`${session.sessionSeed}|adapt|${slotIndex}`);
  const plannedSkill = session.skillPlan[adaptiveIdx] || 'postflop';
  const plannedMode = session.modePlan[adaptiveIdx] || 'swipe';

  const weak = weakestSkills(session, 2);
  const strong = strongestSkills(session, 2);

  let targetSkill = plannedSkill;
  if (weak.includes('postflop') && strong.includes('preflop') && rng() < 0.65) {
    targetSkill = 'postflop';
  } else if (weak.includes('preflop') && strong.includes('icm') && rng() < 0.65) {
    targetSkill = 'preflop';
  } else if (weak.includes('icm') && strong.includes('preflop') && rng() < 0.55) {
    targetSkill = 'icm';
  } else if (weak.length && rng() < 0.5) {
    targetSkill = weak[0];
  }

  const maxTier = abilityMaxTier(session.ability);
  const visit = session.answers.filter((a) => a.skillTag === targetSkill || (a.skillTags || []).includes(targetSkill)).length;
  const minTier = abilityMinTier(session.ability, visit);

  let pool = session.rawTasks.filter((t) => {
    if (session.usedIds.has(t.id)) return false;
    const diff = t.difficulty || 2;
    if (diff < minTier || diff > maxTier) return false;
    const tags = deriveSkillTags(t);
    return tags.includes(targetSkill);
  });

  if (!pool.length) {
    pool = session.rawTasks.filter((t) => {
      if (session.usedIds.has(t.id)) return false;
      const diff = t.difficulty || 2;
      return diff >= minTier && diff <= maxTier;
    });
  }

  if (!pool.length) {
    pool = session.rawTasks.filter((t) => !session.usedIds.has(t.id));
  }

  if (!pool.length) return null;

  const start = Math.floor(rng() * pool.length);
  const task = pool[(start + Math.floor(rng() * pool.length)) % pool.length];
  return { task, mode: plannedMode, targetSkill };
}

export function selectNextPlacementItem(session) {
  if (!session || session.done) return null;
  if (session.index >= session.targetCount) {
    session.done = true;
    return null;
  }

  let pick = null;
  if (session.index < CALIBRATION_TIERS.length) {
    const tier = CALIBRATION_TIERS[session.index];
    pick = pickCalibrationTask(session, tier, session.index);
  } else {
    pick = pickAdaptiveTask(session, session.index);
  }

  if (!pick || !pick.task) {
    session.done = true;
    return null;
  }

  session.usedIds.add(pick.task.id);
  const item = libraryTaskToPlacementItem(pick.task, {
    slotIndex: session.index,
    modePlan: session.modePlan,
    forceMode: pick.mode
  });

  session._currentRaw = pick.task;
  session._currentItem = item;
  return item;
}

export function placementEvidenceWeight(tier, grade) {
  const t = clamp(Number(tier) || 2, 1, 5);
  if (grade.correct) return CORRECT_WEIGHT[t];
  if (grade.nearOptimal) return CORRECT_WEIGHT[t] * 0.75;
  return -WRONG_WEIGHT[t];
}

export function submitPlacementAnswer(session, choice, gradeResult) {
  if (!session) return session;

  const item = session._currentItem;
  const raw = session._currentRaw;
  if (!item || !raw) return session;

  const grade = gradeResult || { correct: false, nearOptimal: false, score: 0, evLossBb: 0.5 };
  const tier = item.tier || item.difficulty || 2;

  session.ability = updateAbility(session.ability, tier, grade);
  updateSkillSignals(session, item, grade);

  session.items.push(item);
  session.answers.push({
    id: item.id,
    choice,
    category: item.category,
    skillTag: item.skillTag,
    skillTags: item.skillTags,
    tier,
    difficulty: tier,
    miniAppMode: item.miniAppMode,
    correct: grade.correct,
    nearOptimal: grade.nearOptimal,
    score: grade.score,
    evLossBb: grade.evLossBb,
    evidenceWeight: placementEvidenceWeight(tier, grade)
  });

  session.index++;
  session._currentItem = null;
  session._currentRaw = null;

  if (session.index >= session.targetCount) session.done = true;
  return session;
}

export function recommendedStartingDifficulty({ ability = 50, overall = null } = {}) {
  const signal = overall != null ? overall * 0.55 + ability * 0.45 : ability;
  if (signal >= 78) return 4;
  if (signal >= 62) return 3;
  if (signal >= 45) return 2;
  return 1;
}

export function placementSessionSummary(session) {
  const answers = session.answers || [];
  const tiers = answers.map((a) => a.tier || a.difficulty || 2);
  const avgTier = tiers.length ? tiers.reduce((s, t) => s + t, 0) / tiers.length : 0;
  const modes = answers.map((a) => a.miniAppMode).filter(Boolean);
  const modeCounts = {};
  for (const m of modes) modeCounts[m] = (modeCounts[m] || 0) + 1;

  return {
    version: 2,
    sessionSeed: session.sessionSeed,
    targetCount: session.targetCount,
    answered: answers.length,
    ability: session.ability,
    avgTier: round(avgTier, 2),
    advancedCount: answers.filter((a) => (a.tier || 0) >= 4).length,
    advancedShare: answers.length
      ? round(answers.filter((a) => (a.tier || 0) >= 4).length / answers.length, 3)
      : 0,
    itemIds: (session.items || []).map((i) => i.id),
    miniAppModes: modeCounts,
    skillSignals: session.skillSignals
  };
}

export function simulatePlacementRun({
  sessionSeed,
  answerFn,
  targetCount = PLACEMENT_COUNT_DEFAULT,
  library = null,
  gradeFn = null
} = {}) {
  const session = createPlacementSession({ sessionSeed, targetCount, library });
  const grade = gradeFn || defaultGradeFn;
  const results = [];

  while (!session.done) {
    const item = selectNextPlacementItem(session);
    if (!item) break;
    const choice = answerFn(item, session);
    const gradeResult = grade(item, choice);
    submitPlacementAnswer(session, choice, gradeResult);
    results.push({ item, choice, grade: gradeResult });
  }

  return {
    session,
    results,
    items: session.items.slice(),
    answers: session.answers.slice()
  };
}

function defaultGradeFn(item, choice) {
  const correct = choice === item.correct;
  const nearOptimal = !correct && (item.alsoOk || []).includes(choice);
  const evLossBb = correct ? 0 : nearOptimal ? 0.08 : 0.5;
  const score = correct ? item.score : nearOptimal ? Math.round(item.score * 0.85) : Math.round(item.score * 0.3);
  return { score, correct, nearOptimal, evLossBb };
}

export function getPlacementPoolStats(library = null) {
  const tasks = getValidatedMttTasks(library);
  const byTier = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const skills = new Set();
  const modes = {};

  for (const t of tasks) {
    const tier = t.difficulty || 2;
    byTier[tier] = (byTier[tier] || 0) + 1;
    for (const s of deriveSkillTags(t)) skills.add(s);
    const mode = assignMiniAppMode(t);
    modes[mode] = (modes[mode] || 0) + 1;
  }

  return {
    poolSize: tasks.length,
    byTier,
    skillCoverage: [...skills].sort(),
    modeDistribution: modes
  };
}

export {
  getValidatedMttTasks,
  libraryTaskToPlacementItem,
  PLACEMENT_MODES
};
