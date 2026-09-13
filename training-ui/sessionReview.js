// Post-session summary + mistake review (presentation only). Uses existing grades/results.

import { feedbackViewModel, gradeClass, STREET_RU } from './viewModel.js';
import { leakLabelRu } from '../solver/src/index.js';

export function isCorrectResult(result) {
  if (!result) return false;
  if (result.chosenRecommended) return true;
  if (result.nearOptimal) return true;
  if (result.grade === 'EXCELLENT' || result.grade === 'GOOD') return true;
  return false;
}

export function isMistakeResult(result) {
  return !!(result && !isCorrectResult(result));
}

export function sessionScoreFromResults(results = []) {
  const list = results || [];
  const answered = list.length;
  const correct = list.filter(isCorrectResult).length;
  const mistakes = list.filter(isMistakeResult).length;
  const percent = answered ? Math.round((correct / answered) * 100) : null;
  return { answered, correct, mistakes, percent };
}

function spotTitle(drill, result, drillIndex) {
  const ex = drill && drill.explanation;
  const conceptLabel = ex && ex.conceptLabelRu;
  const concept = result?.concept || drill?.concept;
  const street = drill && drill.street;
  const streetRu = street ? (STREET_RU[street] || String(street).toUpperCase()) : null;
  const parts = [streetRu, conceptLabel || (concept ? leakLabelRu(concept) : null)].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return `Раздача ${drillIndex + 1}`;
}

/**
 * Build reviewable mistake rows from completed session data (no re-grading).
 */
export function buildMistakeReviewItems({ results = [], drills = [], taskStates = {} } = {}) {
  const items = [];
  const n = Math.min(results.length, drills.length || results.length);
  for (let i = 0; i < n; i++) {
    const result = results[i];
    if (!isMistakeResult(result)) continue;
    const drill = drills[i] || null;
    const fb = feedbackViewModel({ result, drill });
    const snap = taskStates[i];
    let chosen = fb.chosenAction;
    if (!chosen && snap && snap.optionId && drill && drill.options) {
      const opt = drill.options.find((o) => o.id === snap.optionId);
      chosen = opt ? opt.labelRu : snap.optionId;
    }
    items.push({
      drillIndex: i,
      title: spotTitle(drill, result, i),
      concept: result.concept || drill?.concept || null,
      streetRu: drill?.street ? (STREET_RU[drill.street] || String(drill.street).toUpperCase()) : null,
      grade: result.grade,
      gradeClass: gradeClass(result.grade),
      chosenAction: chosen || '—',
      correctAction: fb.correctAction || fb.correctLine || (fb.strategy && fb.strategy.recommendedActionLabel) || '—',
      why: fb.why || fb.summary || null,
      keyTakeaway: fb.keyTakeaway || fb.remember || fb.concept || null,
      userMistake: fb.userMistake || null,
      feedback: fb
    });
  }
  return items;
}

export function enrichSummaryViewModel(base, { results = [], drills = [], taskStates = {} } = {}) {
  const score = sessionScoreFromResults(results);
  const mistakes = buildMistakeReviewItems({ results, drills, taskStates });
  const total = base.total > 0 ? base.total : score.answered;
  return {
    ...base,
    sessionComplete: true,
    total,
    answered: score.answered,
    correctCount: score.correct,
    mistakeCount: score.mistakes,
    percentCorrect: score.percent,
    canReviewMistakes: mistakes.length > 0,
    mistakePreview: mistakes.slice(0, 3).map((m) => m.title)
  };
}

export function mistakeReviewScreenViewModel({ items = [], index = 0 } = {}) {
  const list = items || [];
  const total = list.length;
  const safeIndex = total ? Math.min(Math.max(0, index), total - 1) : 0;
  const current = total ? list[safeIndex] : null;
  return {
    total,
    index: safeIndex,
    isFirst: safeIndex <= 0,
    isLast: safeIndex >= total - 1,
    positionLabel: total ? `${safeIndex + 1} / ${total}` : '0 / 0',
    current
  };
}

/** Recent store history rows (no re-grade; review only when caller has session data). */
export function historyEntriesViewModel(entries = [], { limit = 8, now = Date.now } = {}) {
  const list = (entries || []).slice(-limit).reverse();
  return list.map((e) => {
    const at = e.at || e.savedAt;
    let when = '';
    if (at) {
      const mins = Math.round((now() - at) / 60000);
      if (mins < 120) when = mins < 2 ? 'недавно' : `${mins} мин назад`;
      else when = new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
    const mistake = e.grade && !['EXCELLENT', 'GOOD'].includes(e.grade);
    return {
      when,
      concept: e.concept ? leakLabelRu(e.concept) || e.concept : '—',
      street: e.street || '',
      grade: e.grade || '—',
      isMistake: mistake,
      canOpenReview: false
    };
  });
}
