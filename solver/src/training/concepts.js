// PokerSwipe leak taxonomy. This is the single source of truth for the concepts
// the personalized training layer can attach to a mistake. It is intentionally
// small (an MVP that can grow) and maps 1:1 onto things the analyzer can actually
// reason about — never a category the solver cannot support.
//
// Everything is deterministic: given the same decision facts, classifyConcept
// returns the same concept. User-facing text is Russian (the product language);
// the keys are stable English identifiers used internally and in storage.

export const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];

export const LEAKS = {
  // ---- PREFLOP ----
  open_range: { street: 'preflop', labelRu: 'Диапазон открытия', definitionRu: 'Какие руки открывать с ранга в этой позиции и с какой частотой.' },
  defend_vs_open: { street: 'preflop', labelRu: 'Защита против открытия', definitionRu: 'Как часто и с каким диапазоном отвечать на открытие из ББ/SB.' },
  '3bet_frequency': { street: 'preflop', labelRu: 'Частота 3-бета', definitionRu: 'Когда переводить игру в 3-бет, а когда просто коллировать.' },
  '3bet_sizing': { street: 'preflop', labelRu: 'Сайзинг 3-бета', definitionRu: 'Какой размер 3-бета выбрать под геометрию и позицию.' },
  call_vs_3bet: { street: 'preflop', labelRu: 'Колл против 3-бета', definitionRu: 'Какие руки защищать коллом, а какие фолдить/4-бетить.' },
  '4bet_decision': { street: 'preflop', labelRu: 'Решение на 4-бет', definitionRu: 'Когда 4-бетить на вэлью или в блеф под стек и диапазон.' },

  // ---- FLOP ----
  cbet_frequency: { street: 'flop', labelRu: 'Частота конт-бета', definitionRu: 'Когда на флопе ставить первым, а когда оставлять чек.' },
  cbet_sizing: { street: 'flop', labelRu: 'Сайзинг конт-бета', definitionRu: 'Какой размер ставки на флопе под текстуру и преимущество.' },
  check_back: { street: 'flop', labelRu: 'Чек-бэк на флопе', definitionRu: 'Когда чекать назад с шоудаун-вэлью, а не ставить тонко.' },
  defend_vs_cbet: { street: 'flop', labelRu: 'Защита против конт-бета', definitionRu: 'Как часто коллировать/рейзить против ставки на флопе.' },
  check_raise: { street: 'flop', labelRu: 'Чек-рейз на флопе', definitionRu: 'Когда использовать чек-рейз вместо простого колла/бета.' },
  range_advantage: { street: 'flop', labelRu: 'Преимущество диапазона', definitionRu: 'Чей диапазон сильнее на этой текстуре и как этим пользоваться.' },
  nut_advantage: { street: 'flop', labelRu: 'Преимущество по натсам', definitionRu: 'Кто владеет старшими комбинациями и что это даёт в сайзинге.' },

  // ---- TURN ----
  second_barrel: { street: 'turn', labelRu: 'Второй баррель', definitionRu: 'Когда продолжать давление на тёрне после флоп-конт-бета.' },
  turn_barrel_sizing: { street: 'turn', labelRu: 'Сайзинг второго барреля', definitionRu: 'Какой размер на тёрне под изменение натс-структуры.' },
  delayed_cbet: { street: 'turn', labelRu: 'Задержанный конт-бет', definitionRu: 'Чек флопа и ставка на тёрне — когда это правильно.' },
  turn_probe: { street: 'turn', labelRu: 'Тёрн-проуб', definitionRu: 'Ставка на тёрне после того, как оппонент чекал позади.' },
  turn_check_back: { street: 'turn', labelRu: 'Чек-бэк на тёрне', definitionRu: 'Когда останавливаться на тёрне и реализовывать шоудаун-вэлью.' },
  turn_defense: { street: 'turn', labelRu: 'Защита на тёрне', definitionRu: 'Как часто отвечать на вторую ставку по текстуре.' },
  equity_realization: { street: 'turn', labelRu: 'Реализация эквити', definitionRu: 'Сколько эквити реально доходит до шоудауна и как это влияет.' },

  // ---- RIVER ----
  value_bet: { street: 'river', labelRu: 'Вэлью-бет на ривере', definitionRu: 'Когда ставить на вэлью, а не чекать в шоудаун.' },
  thin_value: { street: 'river', labelRu: 'Тонкий вэлью', definitionRu: 'Бет со средними руками, которые всё равно чаще побеждают колл.' },
  bluff: { street: 'river', labelRu: 'Блеф на ривере', definitionRu: 'Когда блефовать с лучшими блокерами и полярным диапазоном.' },
  bluff_catch: { street: 'river', labelRu: 'Блафф-кэтч на ривере', definitionRu: 'Колл ривера с руками, которые ловят блеф по соотношению вэлью-блеф.' },
  river_sizing: { street: 'river', labelRu: 'Сайзинг на ривере', definitionRu: 'Какой размер под полярный/мёрджированный диапазон.' },
  overbet: { street: 'river', labelRu: 'Овербет на ривере', definitionRu: 'Когда овербет больше 100% банка — правильное оружие.' },
  fold_vs_bet: { street: 'river', labelRu: 'Фолд на ставку ривера', definitionRu: 'Когда сдаваться на ривере, а не платить слишком дорого.' },
  blocker_selection: { street: 'river', labelRu: 'Выбор блокеров', definitionRu: 'Какие карты выбирать для блефа по блокерам оппонента.' },

  // ---- GENERAL ----
  pot_geometry: { street: 'general', labelRu: 'Геометрия банка (SPR)', definitionRu: 'Как соотношение стек/банк диктует линию и размеры.' },
  sizing_efficiency: { street: 'general', labelRu: 'Эффективность сайзинга', definitionRu: 'Насколько размер меняет EV и какие размеры почти равнозначны.' },
  showdown_value: { street: 'general', labelRu: 'Шоудаун-вэлью', definitionRu: 'Стоит ли ставить/чекать, чтобы реализовать вэлью на вскрытии.' },
  fold_equity: { street: 'general', labelRu: 'Фолд-эквити', definitionRu: 'Сколько банка выигрывает ставка, когда оппонент падает.' },
  blocker_usage: { street: 'general', labelRu: 'Использование блокеров', definitionRu: 'Карты, которые блокируют натсы оппонента и меняют выбор линии.' },
  polarization: { street: 'general', labelRu: 'Поляризация диапазона', definitionRu: 'Разделение диапазона на натсы и блефы под размер ставки.' }
};

// Deterministic Russian label/definition helpers (requirement 13 — keep standard
// poker terms natural, do not force awkward literal translations).
export function leakLabelRu(key) {
  const l = LEAKS[key];
  return l ? l.labelRu : (key || '—');
}
export function leakDefinitionRu(key) {
  const l = LEAKS[key];
  return l ? l.definitionRu : '';
}
export function isKnownLeak(key) {
  return Object.prototype.hasOwnProperty.call(LEAKS, key);
}

// A curated mapping of the analyzer's own concept keys to the closest leak
// concept, so we never invent a category the analyzer cannot produce evidence for.
const ANALYZER_CONCEPT_TO_LEAK = {
  blunder: null,
  mistake: null,
  mixed_strategy: null,
  close_decision: null,
  sizing_efficiency: 'sizing_efficiency',
  pot_geometry: 'pot_geometry',
  value: 'value_bet',
  fold_equity: 'fold_equity',
  bluff_catch: 'bluff_catch',
  range_advantage_and_sizing: 'range_advantage'
};

// Classify a decision into the most specific supported leak concept. Deterministic
// given the same facts. Falls back to a sensible street-aware default rather than
// inventing an unsupported category.
export function classifyConcept({
  street = 'flop',
  actionTaken = null,
  recommendedAction = null,
  reason = [],
  keyConcept = null,
  sizingSensitive = null
} = {}) {
  const reasons = reason || [];
  const sizing = sizingSensitive != null ? sizingSensitive : reasons.includes('sizing_sensitive');

  const takenType = actionTaken ? actionTaken.type : null;
  const recType = recommendedAction ? recommendedAction.type : null;
  const takenSize = actionTaken && actionTaken.sizePot != null ? actionTaken.sizePot : 0;
  const recSize = recommendedAction && recommendedAction.sizePot != null ? recommendedAction.sizePot : 0;
  const takenAggro = takenType === 'bet' || takenType === 'raise';
  const recAggro = recType === 'bet' || recType === 'raise';
  const overbetTaken = takenAggro && takenSize >= 1;
  const overbetRec = recAggro && recSize >= 1;
  const sizingDrift = takenAggro && recAggro && Math.abs(recSize - takenSize) > 0.1;

  if (street === 'river') {
    if (reasons.includes('river_bluff_catch') && (takenType === 'call' || takenType === 'fold')) return 'bluff_catch';
    if (takenType === 'fold' || recType === 'fold') return 'fold_vs_bet';
    if (overbetTaken || overbetRec) return 'overbet';
    if (sizing || sizingDrift) return 'river_sizing';
    if (reasons.includes('bluff')) return 'bluff';
    if (recAggro || takenAggro) return 'value_bet';
    return 'thin_value';
  }

  if (street === 'turn') {
    if (sizing || sizingDrift) return 'turn_barrel_sizing';
    if (takenAggro && recType === 'check') return 'turn_check_back';
    if (takenType === 'check' && recAggro) return 'delayed_cbet';
    if (keyConcept === 'fold_equity') return 'turn_probe';
    if (keyConcept === 'pot_geometry') return 'pot_geometry';
    return 'second_barrel';
  }

  if (street === 'flop') {
    if (sizing || sizingDrift) return 'cbet_sizing';
    if (takenAggro && recType === 'check') return 'check_back';
    const mapped = ANALYZER_CONCEPT_TO_LEAK[keyConcept];
    if (mapped && mapped !== 'sizing_efficiency') return mapped;
    return 'cbet_frequency';
  }

  // preflop / fallback — the current analyzer solves postflop spots, so be honest.
  if (street === 'preflop') {
    if (takenAggro && recAggro) return '3bet_sizing';
    if (recAggro) return '3bet_frequency';
    return 'defend_vs_open';
  }

  return 'sizing_efficiency';
}

// A short Russian label for the family used in UI copy like "Тренируем: …".
export function conceptFamilyLabelRu(key) {
  return leakLabelRu(key);
}