// Error-cause taxonomy (requirement P0). Beyond "which concept", we classify WHY
// a mistake happened so explanations can be personalised. A cause is distinct
// from a concept: the concept is WHAT (e.g. bluff_catch), the cause is WHY
// (concept knowledge gap, range misread, sizing drift, tilt, inattention).
// Deterministic given the same facts. Never invents a cause without evidence.

export const ERROR_CAUSES = {
  conceptKnowledge: {
    labelRu: 'Пробел в концепции',
    tipRu: 'Не хватает правила: как решать именно этот класс спотов. Разбери узор один раз — он переносится на другие доски.'
  },
  rangeMisread: {
    labelRu: 'Неверная оценка диапазона',
    tipRu: 'Рука сама по себе сыграна логично, но диапазон соперника оценён неверно. Сузь круг его рук перед решением.'
  },
  sizingDrift: {
    labelRu: 'Дрейф сайзинга',
    tipRu: 'Действие верное, размер — нет. Проверь, какой размер диктует текстура и геометрия стека.'
  },
  discipline: {
    labelRu: 'Дисциплина',
    tipRu: 'Знаешь, как надо, но поддался силе руки/размеру ставки. Вернись к цене и частоте, а не к абсолютной силе карт.'
  },
  pressureTilt: {
    labelRu: 'Давление/тильт',
    tipRu: 'Под давлением баббла/крупных ставок решение отклонилось от плана. Держи план на любую улицу заранее.'
  },
  inattention: {
    labelRu: 'Невнимательность',
    tipRu: 'Упущен ключевой факт: позиция, стек, размер ставки или число игроков. Читай условия перед решением.'
  },
  unknown: {
    labelRu: 'Не распознано',
    tipRu: 'Причинный класс неясен — соберём больше раздач и уточним.'
  }
};

export function errorCauseLabelRu(cause) {
  const c = ERROR_CAUSES[cause];
  return c ? c.labelRu : ERROR_CAUSES.unknown.labelRu;
}
export function errorCauseTipRu(cause) {
  const c = ERROR_CAUSES[cause];
  return c ? c.tipRu : ERROR_CAUSES.unknown.tipRu;
}

// Deterministic heuristic classification of a wrong answer's likely cause.
// Uses only facts already present on the drill/candidate/assessment item.
export function classifyErrorCause({
  actionTaken = null,
  recommendedAction = null,
  concept = null,
  sizeTakenPct = null,
  sizeRecommendedPct = null,
  sizingSensitive = null,
  confidence = null,
  street = null,
  errorType = null,
  reason = []
} = {}) {
  const reasons = reason || [];

  // Explicit signal wins.
  if (errorType) {
    if (errorType === 'sizing') return 'sizingDrift';
    if (errorType === 'range') return 'rangeMisread';
    if (errorType === 'concept') return 'conceptKnowledge';
    if (errorType === 'discipline') return 'discipline';
    if (errorType === 'tilt') return 'pressureTilt';
    if (errorType === 'attention') return 'inattention';
  }

  const takenAggro = isAggro(actionTaken);
  const recAggro = isAggro(recommendedAction);
  const sameActionType = takenAggro === recAggro;

  // Same family of action but different size → sizing drift.
  if (sameActionType && takenAggro && sizeTakenPct != null && sizeRecommendedPct != null) {
    const drift = Math.abs(sizeTakenPct - sizeRecommendedPct);
    if (drift > 0.25) return 'sizingDrift';
  }
  if (sizingSensitive === true) return 'sizingDrift';
  if (reasons.includes('sizing_sensitive')) return 'sizingDrift';

  // Folded/called the wrong way in a known bluff-catch / price spot → discipline
  // or range misread depending on whether the action family was already wrong.
  if (concept && (concept === 'bluff_catch' || concept === 'fold_vs_bet' || concept === 'price_defence')) {
    if (reasons.includes('absolute_strength') || (takenAggro !== recAggro && !takenAggro)) return 'discipline';
    if (reasons.includes('range')) return 'rangeMisread';
  }

  // Aggressive when should check, or check when should bet, with a range reason.
  if (!sameActionType) {
    if (reasons.includes('range') || concept === 'range_advantage' || concept === 'nut_advantage') return 'rangeMisread';
    if (reasons.includes('board_texture') || concept === 'board_texture') return 'conceptKnowledge';
    if (reasons.includes('showdown_value') || concept === 'showdown_value') return 'conceptKnowledge';
    if (reasons.includes('tilt') || reasons.includes('pressure')) return 'pressureTilt';
    return 'conceptKnowledge';
  }

  // High confidence + wrong → overconfidence/discipline.
  if (confidence != null && confidence >= 0.9 && !sameActionType) return 'discipline';

  // Not enough signal.
  return 'unknown';
}

function isAggro(action) {
  if (!action) return null;
  const t = action.type;
  return t === 'bet' || t === 'raise' || t === 'all_in';
}

// Map a solver mistake classification to a probable error cause (thin wrapper
// around the heuristic using the analyzer's own reason tags).
export function errorCauseFromMistake({ concept, reason = [], severity = null } = {}) {
  return classifyErrorCause({ concept, reason });
}