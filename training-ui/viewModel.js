// Pure view-model builders for the personalised training UI. No DOM access and
// no solver work — these only turn training-layer data into the render models
// the renderer consumes. Everything here is deterministic and unit-testable.

import { leakLabelRu, actionLabelRu } from '../solver/src/index.js';

export const STREET_RU = { preflop: 'ПРЕФЛОП', flop: 'ФЛОП', turn: 'ТЁРН', river: 'РИВЕР' };

// Grade → visual class used across the daily visual system (g/y/r).
export function gradeClass(grade) {
  if (grade === 'EXCELLENT' || grade === 'GOOD') return 'g';
  if (grade === 'INACCURACY') return 'y';
  return 'r';
}

// ---- Home -------------------------------------------------------------------

// The training home is either a personalised block (leak profile available) or
// a general-daily fallback. Never shows fake personalised content.
export function homeViewModel({ leaks = [], plan = null } = {}) {
  const total = plan && plan.total ? plan.total : 7;
  const difficulty = plan && plan.estimatedDifficulty != null ? plan.estimatedDifficulty : null;
  const leaksList = leaks || [];

  if (!leaksList.length) {
    return {
      type: 'fallback',
      title: 'ЕЖЕДНЕВНАЯ ТРЕНИРОВКА',
      note: 'Пока недостаточно раздач… Разбери пару рук в «Мои руки», и тренировка станет персональной.',
      cta: 'НАЧАТЬ ОБЩУЮ',
      total
    };
  }

  const primary = leaksList[0];
  return {
    type: 'personalized',
    title: 'ТРЕНИРОВКА ДЛЯ ТЕБЯ',
    concept: primary.concept,
    label: primary.label,
    definition: primary.definition,
    evidence: primary.evidence,
    priority: primary.priority,
    sampleSize: primary.sampleSize,
    avgEvLossBb: primary.avgEvLossBb,
    spots: leaksList.length,
    total,
    difficulty,
    why: 'Почему сейчас',
    cta: 'НАЧАТЬ'
  };
}

// ---- Confidence -------------------------------------------------------------

export function confidenceModel(c) {
  if (!c || c.score == null || !Number.isFinite(c.score)) return { available: false };
  const score = Math.round(c.score * 100);
  let note = '';
  if (c.score < 0.6) {
    note = 'Ограничено: диапазон соперника не задан';
  } else if (c.score < 0.8) {
    note = 'Ограничено: приближение по диапазону соперника';
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
    options: options.map((o) => ({ id: o.id, labelRu: o.labelRu })),
    legalActions: options.map((o) => o.id),
    confidence: confidenceModel(sol.confidence)
  };
}

// ---- Feedback ---------------------------------------------------------------

export function feedbackViewModel({ result = null, drill = null } = {}) {
  const sol = (drill && drill.solution) || {};
  const rec = sol.recommendedAction || null;
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