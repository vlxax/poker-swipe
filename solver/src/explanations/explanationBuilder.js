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