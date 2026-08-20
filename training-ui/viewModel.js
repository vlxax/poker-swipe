// Pure view-model builders for the personalised training UI. No DOM access and
// no solver work — these only turn training-layer data into the render models
// the renderer consumes. Everything here is deterministic and unit-testable.

import { leakLabelRu, actionLabelRu, skillLabelRu } from '../solver/src/index.js';
import { skillScoresForHome } from '../solver/src/training/taskFeedback.js';
import {
  focusItemsFromProfile, whyTextForTraining, trainingSubtitle
} from './trainingHomeCopy.js';

export const STREET_RU = { preflop: 'ПРЕФЛОП', flop: 'ФЛОП', turn: 'ТЁРН', river: 'РИВЕР' };
export const ASSESSMENT_STREET_RU = { 'ПРЕФЛОП': 'ПРЕФЛОП', 'ФЛОП': 'ФЛОП', 'ТЁРН': 'ТЁРН', 'РИВЕР': 'РИВЕР' };

// Grade → visual class used across the daily visual system (g/y/r).
export function gradeClass(grade) {
  if (grade === 'EXCELLENT' || grade === 'GOOD') return 'g';
  if (grade === 'INACCURACY') return 'y';
  return 'r';
}

// ---- Home -------------------------------------------------------------------

// Personalised training home or generic fallback. Never shows fake personalisation.
export function homeViewModel({ leaks = [], plan = null, skillProfile = null } = {}) {
  const total = (plan && plan.total) || (plan && plan.filled) || 7;
  const leaksList = leaks || [];
  const hasSkill = skillProfile && skillProfile.overall != null;
  const hasLeaks = leaksList.length > 0;
  const hasPlan = plan && (plan.personalized || plan.sessionPlan || plan.filled > 0);

  if (!hasSkill && !hasLeaks && !hasPlan) {
    return {
      type: 'fallback',
      title: 'ЕЖЕДНЕВНАЯ ТРЕНИРОВКА',
      note: 'Пока недостаточно раздач… Разбери пару рук в «Мои руки», и тренировка станет персональной.',
      cta: 'НАЧАТЬ ОБЩУЮ',
      total
    };
  }

  const focusItems = focusItemsFromProfile({ skillProfile, leaks: leaksList, plan, limit: 3 });
  const whyText = whyTextForTraining({ skillProfile, leaks: leaksList, focusItems, plan });
  const skillScores = hasSkill ? skillScoresForHome(skillProfile) : [];

  return {
    type: 'training',
    title: 'ТВОЯ ТРЕНИРОВКА',
    subtitle: trainingSubtitle(total),
    levelHeading: 'ТВОЙ УРОВЕНЬ',
    skillScores,
    focusHeading: 'СЕГОДНЯ В ФОКУСЕ',
    focusItems,
    whyHeading: 'ПОЧЕМУ',
    whyText,
    planSessionId: plan && plan.sessionId ? plan.sessionId : null,
    total,
    cta: 'НАЧАТЬ МОЮ ТРЕНИРОВКУ'
  };
}

// ---- Confidence -------------------------------------------------------------

export function confidenceModel(c) {
  if (!c || c.score == null || !Number.isFinite(c.score)) return { available: false };
  const score = Math.round(c.score * 100);
  let note = '';
  if (c.score < 0.6) {
    note = 'диапазон соперника не задан — расчёт приблизительный';
  } else if (c.score < 0.8) {
    note = 'расчёт по приблизительному диапазону соперника';
  }
  return { available: true, score, level: c.level || null, note };
}

// ---- Drill ------------------------------------------------------------------

export function drillViewModel({ drill = null, index = 1, total = 1 } = {}) {
  const sc = (drill && drill.scenario) || {};
  const sol = (drill && drill.solution) || {};
  const options = (drill && drill.options) || [];
  const street = drill && drill.street;
  return {
    drillId: drill && drill.drillId,
    concept: drill && drill.concept,
    conceptLabel: drill && drill.explanation ? drill.explanation.conceptLabelRu : null,
    street,
    streetRu: STREET_RU[street] || String(street || '').toUpperCase(),
    difficulty: drill && drill.difficulty,
    progress: { index, total },
    scenario: {
      heroPosition: sc.heroPosition,
      villainPosition: sc.villainPosition,
      effectiveStackBb: sc.effectiveStackBb,
      potBb: sc.potBb,
      board: sc.board || [],
      heroCards: sc.heroCards || []
    },
    prompt: (drill && drill.explanation && drill.explanation.promptRu) || 'Ваш ход.',
    contextLine: (drill && drill.explanation && drill.explanation.contextRu) || null,
    historyLine: (drill && drill.explanation && drill.explanation.historyRu) || null,
    taskInstruction: (drill && drill.explanation && drill.explanation.promptRu) || null,
    options: options.map((o) => ({ id: o.id, labelRu: o.labelRu })),
    legalActions: options.map((o) => o.id),
    confidence: confidenceModel(sol.confidence)
  };
}

// ---- Feedback ---------------------------------------------------------------

export function feedbackViewModel({ result = null, drill = null } = {}) {
  const sol = (drill && drill.solution) || {};
  const rec = sol.recommendedAction || null;
  const fb = result && result.feedbackRu;

  if (fb && fb.verdict) {
    return {
      grade: result.grade,
      structured: true,
      verdict: fb.verdict,
      correctLine: fb.correctLine,
      why: fb.why,
      userMistake: fb.userMistake,
      remember: fb.concept,
      alternative: fb.alternative,
      tip: fb.tip,
      detail: fb.detail,
      gradeTitle: fb.title || fb.verdict,
      summary: fb.summary,
      concept: fb.concept,
      evLossBb: result.evLossBb,
      nearOptimal: !!(result.nearOptimal),
      mixedStrategy: !!(result.mixedStrategy || fb.mixedStrategy),
      chosenRecommended: !!(result.chosenRecommended),
      strategy: {
        recommendedActionLabel: fb.recLabelRu || (rec ? actionLabelRu(rec) : null),
        recommendedFrequency: sol.recommendedFrequency != null ? sol.recommendedFrequency : null
      }
    };
  }

  return {
    grade: result && result.grade,
    gradeTitle: result && result.feedbackRu && result.feedbackRu.title,
    summary: result && result.feedbackRu && result.feedbackRu.summary,
    tip: result && result.feedbackRu && result.feedbackRu.tip,
    concept: result && result.feedbackRu && result.feedbackRu.concept,
    evLossBb: result && result.evLossBb,
    nearOptimal: !!(result && result.nearOptimal),
    mixedStrategy: !!(result && result.mixedStrategy),
    chosenRecommended: !!(result && result.chosenRecommended),
    strategy: {
      recommendedActionLabel: rec ? actionLabelRu(rec) : null,
      recommendedFrequency: sol.recommendedFrequency != null ? sol.recommendedFrequency : null
    }
  };
}

// ---- Trend (progress on the primary concept) --------------------------------

export function trendModel({ before = [], after = [], minSamples = 5 } = {}) {
  const beforeAv = before.filter((n) => n != null && Number.isFinite(n));
  const afterAv = after.filter((n) => n != null && Number.isFinite(n));
  if (!afterAv.length || beforeAv.length < minSamples) {
    return { available: false };
  }
  const beforeAvg = beforeAv.reduce((s, n) => s + n, 0) / beforeAv.length;
  const afterAvg = afterAv.reduce((s, n) => s + n, 0) / afterAv.length;
  return { available: true, beforeAvg, afterAvg, delta: beforeAvg - afterAvg };
}

// ---- Summary ----------------------------------------------------------------

export function summaryViewModel({ session = null, results = [], baselineLosses = [], minSamples = 5 } = {}) {
  const total = session && session.plan ? session.plan.total
    : session && session.drills ? session.drills.length
      : (results && results.length) || 0;
  const solved = (results && results.length) || 0;
  const losses = (results || []).map((r) => r.evLossBb).filter((n) => n != null && Number.isFinite(n));
  const avgLossBb = losses.length ? losses.reduce((s, n) => s + n, 0) / losses.length : null;
  const nearOptimalCount = (results || []).filter((r) => r.nearOptimal).length;
  const primary = session && session.primaryConcept;

  let trend;
  if (primary && results && results.length) {
    const after = (results || []).filter((r) => r.concept === primary).map((r) => r.evLossBb);
    if (after.length) trend = trendModel({ before: baselineLosses, after, minSamples });
    else trend = { available: false };
  } else {
    trend = { available: false };
  }

  return {
    total,
    solved,
    avgLossBb,
    nearOptimalCount,
    primaryConcept: primary,
    primaryLabel: primary ? leakLabelRu(primary) : null,
    trend
  };
}

// ---- Primary assessment (P0) --------------------------------------------------

// A single question from the 12-item primary diagnostic. Choices are plain
// strings (e.g. 'ФОЛД'/'РЕЙЗ'), exposed as { id, labelRu } pairs for the renderer.
export function assessmentViewModel({ item = null, index = 1, total = 1 } = {}) {
  if (!item) return { q: null, choices: [], progress: { index: 0, total: 0 } };
  return {
    id: item.id,
    q: item.q,
    street: item.street,
    streetRu: ASSESSMENT_STREET_RU[item.street] || String(item.street || '').toUpperCase(),
    skillTag: item.skillTag,
    concept: item.concept,
    progress: { index, total },
    choices: (item.choices || []).map((c) => ({ id: c, labelRu: c }))
  };
}

// The result screen of the diagnostic: overall level + weakest/strongest skills.
export function assessmentSummaryViewModel({ result = null } = {}) {
  const results = (result && result.results) || [];
  const correct = results.filter((r) => r.correct).length;
  const nearOptimal = results.filter((r) => r.nearOptimal).length;
  const weakest = result && result.weakestSkill ? skillLabelRu(result.weakestSkill) : null;
  const strongest = result && result.strongestSkill ? skillLabelRu(result.strongestSkill) : null;
  return {
    answered: result && result.answered != null ? result.answered : 0,
    total: result && result.total != null ? result.total : 0,
    overall: result && result.overall != null ? result.overall : null,
    overallLabel: result && result.overallLabel ? result.overallLabel : null,
    correct,
    nearOptimal,
    weakest,
    strongest,
    hasResult: !!(result && result.skillProfile)
  };
}