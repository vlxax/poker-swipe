import { conceptFor } from './concepts.js';

// Turns numeric results into a structured explanation object.
// Math is computed elsewhere; this module only renders text from facts.
export function buildExplanation({
  bestAction,
  heroAction,
  actions,
  evLossBB,
  severity,
  street,
  heroPosition,
  villainPosition,
  equity,
  potBB
}) {
  if (!heroAction) {
    return {
      summary: 'Пока нет сохранённого действия Hero — сравниваю доступные линии.',
      why: [],
      keyConcept: null,
      recommendedPractice: null
    };
  }

  const best = actions ? actions.reduce((a, b) => (b.evBB > a.evBB ? b : a), actions[0]) : bestAction;
  const heroEv = actions ? (actions.find((a) => matches(a.action, heroAction)) || {}).evBB : null;
  const evLoss = evLossBB != null ? evLossBB : bestEv(best) - heroEv;

  const why = [];
  if (best && heroEv != null && evLoss > 0.0005) {
    why.push(`Лучшая линия ${describe(best.action)} оценивается на ${bb(bestEv(best))}, а ${describe(heroAction)} на ${bb(heroEv)} — разница ${bb(evLoss)}.`);
  } else if (best) {
    why.push(`Выбранное действие ${describe(heroAction)} совпадает с лучшей оценкой ${bb(bestEv(best))}.`);
  }
  if (equity != null && potBB > 0) {
    why.push(`Горячее эквити Hero против диапазона оппонента — ${Math.round(equity * 100)}% при банке ${potBB} ББ.`);
  }

  const keyConcept = 'range_advantage_and_sizing';
  const summary = evLoss != null && evLoss > 0.0005
    ? `Действие ${describe(heroAction)} теряет ${bb(evLoss)} относительно лучшей линии.`
    : `Действие ${describe(heroAction)} не уступает лучшей оцененной линии.`;

  return {
    summary,
    why,
    keyConcept: conceptFor(keyConcept).name,
    recommendedPractice: {
      type: 'drill',
      topic: 'sizing_and_ev'
    }
  };
}

function matches(a, heroAction) {
  return a.type === heroAction.type &&
    (heroAction.sizePot == null || a.sizePot === heroAction.sizePot);
}

// Solver-mode explanation: a short verdict, the "why", the main alternative line,
// and a reliability statement. Never uses "exact GTO" / "perfect play" wording.
export function buildSolverExplanation({
  best = null,
  bestFrequency = null,
  heroAction = null,
  evLossBB = null,
  convergence = null,
  exploitabilityBB = null,
  chanceBranches = null,
  confidence = null
}) {
  const bestType = best ? describe(best) : '—';
  const heroType = heroAction ? describe(heroAction) : null;
  const same = heroAction && best && describeId(heroAction) === describeId(best);
  const converged = !!(convergence && convergence.converged);

  let summary;
  if (!heroType) {
    summary = `Solver предпочитает ${bestType}.`;
  } else if (same) {
    summary = `${capitalize(heroType)} — оптимальная линия по solver.`;
  } else if (evLossBB != null && evLossBB <= 0.0005) {
    summary = `${capitalize(heroType)} допустим и близок к оптимальной линии.`;
  } else {
    summary = `${capitalize(heroType)} допустим, но используется редко.`;
  }

  const why = [];
  if (bestFrequency != null && best) {
    why.push(`Solver играет ${bestType} в ${Math.round(bestFrequency * 100)}% случаев.`);
  }
  if (!same && heroType && evLossBB != null) {
    why.push(`Твой ${heroType} теряет ${bb(evLossBB)} относительно лучшей линии ${bestType}.`);
  }
  if (why.length === 0 && best) {
    why.push(`Лучшая линия по solver — ${bestType}.`);
  }

  const alternative = same || !heroType
    ? `Основная линия — ${bestType}.`
    : `Основная линия — ${bestType}. ${capitalize(heroType)} остаётся частью mixed strategy.`;

  const reliabilityParts = [];
  if (converged) {
    reliabilityParts.push(`Решение сошлось${convergence && convergence.iterationsRun ? ` (${convergence.iterationsRun} итераций)` : ''}.`);
  } else {
    reliabilityParts.push(`Решение не сошлось${convergence && convergence.stopReason ? ` (${convergence.stopReason})` : ''}.`);
  }
  if (exploitabilityBB != null) {
    reliabilityParts.push(`Exploitability ${Number(exploitabilityBB).toFixed(3)} ББ.`);
  }
  if (chanceBranches != null) {
    reliabilityParts.push(`Используется ограниченная chance abstraction (${chanceBranches} ветка${chanceBranches === 1 ? '' : 'и'} на улицу).`);
  }
  if (confidence) {
    reliabilityParts.push(`Уверенность: ${confidence.level} (${confidence.score}).`);
  }

  return {
    summary,
    why,
    alternative,
    reliability: reliabilityParts.join(' '),
    keyConcept: null,
    recommendedPractice: null
  };
}

function describeId(action) {
  if (!action) return '';
  if (action.type === 'bet') return `bet_${Math.round((action.sizePot || 0) * 100)}`;
  if (action.type === 'raise') return `raise_${Math.round((action.sizePot || 0) * 100)}`;
  return action.type;
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function bestEv(best) {
  return best && typeof best.evBB === 'number' ? best.evBB : 0;
}

function describe(action) {
  if (!action) return '?';
  if (action.type === 'bet' && action.sizePot != null) return `ставка ${Math.round(action.sizePot * 100)}% банка`;
  if (action.type === 'raise' && action.sizePot != null) return `рейз ${Math.round(action.sizePot * 100)}% банка`;
  const RU = { fold: 'фолд', check: 'чек', call: 'колл', bet: 'ставка', raise: 'рейз', all_in: 'олл-ин' };
  return RU[action.type] || action.type;
}

function bb(n) {
  return `${Number(n).toFixed(2)} ББ`;
}