// Grades a user's drill answer against the drill's solved strategy and produces
// Russian feedback. Grading is EV-based (requirement 11) using the same solver
// thresholds the analysis layer uses, so a "GOOD" review and a "GOOD" drill
// answer mean the same thing. Mixed strategies are handled explicitly: a
// near-optimal alternative line in a mixed spot is never marked as a mistake.

import { classifyLoss, classifySeverity } from '../config/thresholds.js';
import { leakLabelRu } from './concepts.js';
import { buildTaskFeedback } from './taskFeedback.js';

const GOOD_LOSS = 0.05;

export const GRADE_ORDER = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG MISTAKE'];

const GRADE_HEAD = {
  EXCELLENT: 'Отличный выбор',
  GOOD: 'Хорошее решение',
  INACCURACY: 'Небольшая неточность',
  MISTAKE: 'Ошибка',
  'BIG MISTAKE': 'Большая ошибка'
};

// Map a solver EV loss (BB) to a training grade (requirement 11). Reuses the
// preset thresholds: GOOD→EXCELLENT, INACCURACY→GOOD; the MISTAKE band is split
// into MISTAKE vs BIG MISTAKE on solver severity so we get five distinct grades.
export function gradeForLoss(lossBb, preset = 'mtt') {
  if (lossBb == null) return 'INACCURACY';
  const loss = Math.max(0, lossBb);
  const cat = classifyLoss(loss, preset);
  if (cat === 'GOOD') return 'EXCELLENT';
  if (cat === 'INACCURACY') return 'GOOD';
  if (cat === 'MISTAKE') {
    const sev = classifySeverity(loss, preset);
    return sev === 'large' || sev === 'severe' ? 'BIG MISTAKE' : 'MISTAKE';
  }
  return 'BIG MISTAKE';
}

// Russian feedback for a grade (requirement 12). Deterministic, no ML.
export function feedbackForGrade(grade, ctx = {}) {
  const title = GRADE_HEAD[grade] || 'Результат';
  const concept = ctx.conceptLabelRu || (ctx.concept ? leakLabelRu(ctx.concept) : '');
  const recLabel = ctx.recLabelRu || 'лучшая линия';
  const chosenLabel = ctx.chosenLabelRu || 'выбранная линия';
  const parts = [];

  parts.push(`Выбрано: ${chosenLabel}. Лучшая линия: ${recLabel}.`);
  if (ctx.evLossBb != null) {
    parts.push(`Проигрыш EV относительно оптимальной линии: ${Number(ctx.evLossBb).toFixed(2)} BB.`);
  }
  if (ctx.mixedStrategy) {
    parts.push('Солвер видит смешанную стратегию — несколько линий почти равнозначны, поэтому разница в EV тут невелика.');
  }
  if (ctx.recFreq != null) {
    parts.push(`Рекомендуемая частота: ${Math.round(ctx.recFreq * 100)}%.`);
  }
  if (concept) {
    parts.push(`Тренируемая концепция: ${concept}.`);
  }

  const tip = {
    EXCELLENT: 'Вы играете близко к оптимальной линии.',
    GOOD: 'Решение близко к лучшему — небольшая неточность, но направление верное.',
    INACCURACY: 'Чуть хуже лучшего варианта. Обратите внимание на сайзинг и частоту.',
    MISTAKE: 'Есть EV-ошибка. Сравните вашу линию с оптимальной ниже.',
    'BIG MISTAKE': 'Существенная потеря EV. Разберите линию ниже, чтобы не повторять её.'
  }[grade] || '';

  return {
    grade,
    title,
    summary: parts.join(' '),
    tip,
    concept
  };
}

// Grade a full drill attempt. Returns the grade, EV figures and Russian feedback.
export function gradeAnswer({ drill, chosenId, chosenAction, preset = 'mtt' } = {}) {
  const options = (drill && drill.options) || [];
  const solution = (drill && drill.solution) || {};
  const actionEVs = solution.actionEVs || {};

  // Resolve the chosen option by id first, then by action shape.
  let opt = null;
  if (chosenId != null) opt = options.find((o) => o.id === chosenId) || null;
  if (!opt && chosenAction) {
    opt = options.find((o) => o.action && sameAction(o.action, chosenAction)) || null;
  }

  const chosenEV = opt
    ? actionEVs[opt.id] != null ? actionEVs[opt.id] : opt.evBB != null ? opt.evBB : null
    : null;
  const evs = Object.values(actionEVs).filter((n) => Number.isFinite(n));
  const bestEV = solution.bestEV != null ? solution.bestEV : evs.length ? Math.max(...evs) : null;
  const evLossBb = chosenEV != null && bestEV != null ? Math.max(0, bestEV - chosenEV) : null;

  const grade = gradeForLoss(evLossBb, preset);
  const nearOptimal = evLossBb != null && evLossBb <= GOOD_LOSS;
  const mixedStrategy = solution.recommendedFrequency != null &&
    solution.recommendedFrequency > 0.2 && solution.recommendedFrequency < 0.8;
  const chosenRecommended = !!opt && !!solution.recommendedAction && sameAction(opt.action, solution.recommendedAction);

  const task = drill && drill.metadata && drill.metadata.task;
  let feedbackRu;
  if (task) {
    const recommendedOpt = options.find((o) => solution.recommendedAction && sameAction(o.action, solution.recommendedAction))
      || options.find((o) => o.labelRu === task.correct)
      || options[0];
    feedbackRu = buildTaskFeedback({
      task,
      chosenLabel: opt ? opt.labelRu : null,
      recommendedLabel: recommendedOpt ? recommendedOpt.labelRu : task.correct,
      grade,
      evLossBb,
      concept: drill.concept
    });
  } else {
    feedbackRu = feedbackForGrade(grade, {
      concept: drill && drill.concept,
      evLossBb,
      mixedStrategy,
      chosenRecommended,
      chosenLabelRu: opt ? opt.labelRu : null,
      recLabelRu: actionLabel(solution.recommendedAction),
      recFreq: solution.recommendedFrequency
    });
  }

  return {
    grade,
    evLossBb,
    chosenEV,
    bestEV,
    nearOptimal,
    mixedStrategy,
    chosenRecommended,
    chosenOption: opt,
    feedbackRu
  };
}

function sameAction(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  const sized = ['bet', 'raise', '3bet', '4bet', 'all_in'];
  if (sized.includes(a.type) || String(a.type).startsWith('bet_')) {
    return Math.abs((a.sizePot || 0) - (b.sizePot || 0)) < 0.051;
  }
  return true;
}

function actionLabel(action) {
  if (!action) return '—';
  if (action.type === 'bet') return `Ставка ${Math.round((action.sizePot || 0) * 100)}% пота`;
  if (action.type === 'raise') return `Рейз ${Math.round((action.sizePot || 0) * 100)}%`;
  if (action.type === '3bet') return '3-бет';
  if (action.type === '4bet') return '4-бет';
  if (action.type === 'check') return 'Чек';
  if (action.type === 'call') return 'Колл';
  if (action.type === 'fold') return 'Фолд';
  if (action.type === 'all_in') return 'Олл-ин';
  return action.type;
}