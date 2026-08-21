// task-context/schema.js
// Единая структура данных тренировочной задачи первого раздела.
// Пользовательский текст — только на русском (кроме допустимых сокращений EV/ICM/SPR/VPIP/PFR).

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS = ['♠', '♥', '♦', '♣'];

export const STREETS = ['ПРЕФЛОП', 'ФЛОП', 'ТЁРН', 'РИВЕР'];
export const FORMATS = ['MTT', 'PKO', 'SNG', 'CASH', '3MAX', 'HU'];
export const STAGES = ['РАННЯЯ', 'СРЕДНЯЯ', 'ПОЗДНЯЯ', 'БАББЛ', 'ITM', 'ФИНАЛЬНЫЙ СТОЛ'];
export const TABLES = ['3-MAX', '6-MAX', '8-MAX', '9-MAX', 'HU'];
export const DIFFICULTIES = [1, 2, 3, 4, 5];

// Позиции и их полные русские названия (для первого появления).
export const POSITIONS = {
  UTG: 'UTG · ранняя позиция',
  MP: 'MP · средняя позиция',
  HJ: 'HJ · хай-джек',
  CO: 'CO · кат-офф',
  BTN: 'BTN · баттон',
  SB: 'SB · малый блайнд',
  BB: 'BB · большой блайнд'
};

// Типовые профили соперников (VPIP/PFR в %).
export const OPPONENT_PROFILES = {
  НИТ:     { vpip: 14, pfr: 9,  style: 'ТАЙТ-ПАССИВНЫЙ', sample: 2100, note: 'Редко входит в раздачи, редко блефует.' },
  РЕГ:     { vpip: 21, pfr: 16, style: 'ТАЙТ-АГРЕССИВНЫЙ', sample: 3400, note: 'Дисциплинирован, сбалансирован по улицам.' },
  'АГРО-РЕГ': { vpip: 27, pfr: 23, style: 'АГРЕССИВНЫЙ', sample: 1500, note: 'Ставит часто, с широкими блефами.' },
  ЛЮБИТЕЛЬ: { vpip: 38, pfr: 12, style: 'НЕБЕЗОПАСНЫЙ-ПАССИВНЫЙ', sample: 480, note: 'Широко колит, мало блефует, платит тонко.' },
  МАНИАК:  { vpip: 52, pfr: 41, style: 'АГРЕССИВНЫЙ', sample: 700, note: 'Почти не фолдит, ставит на каждой улице.' },
  СТЕЦИОНЕР: { vpip: 46, pfr: 6,  style: 'ПАССИВНЫЙ', sample: 900, note: 'Колит широко, сам почти не ставит.' }
};

// Русские подписи для полей (второй уровень — «ВСЕ УСЛОВИЯ»).
export const FIELD_LABELS = {
  format: 'Формат',
  blinds: 'Блайнды',
  ante: 'Анте',
  stage: 'Стадия',
  table: 'Стол',
  left: 'В игре',
  heroPosition: 'Твоя позиция',
  hero: 'Твои карты',
  heroStack: 'Твой стек',
  villainPosition: 'Соперник',
  villainStack: 'Его стек',
  effStack: 'Эффективный стек',
  pot: 'Банк',
  board: 'Доска',
  question: 'Вопрос'
};

const CARD_RE = /^[AKQJT98765432][♠♥♦♣]$/;

// Проверка карт без дублей в рамках спота.
export function cardsOf(spot) {
  const out = [];
  for (const c of (spot.hero || [])) out.push(c);
  for (const c of (spot.board || [])) out.push(c);
  for (const c of (spot.villainCards || [])) out.push(c);
  return out;
}

export function isValidCard(c) {
  return typeof c === 'string' && CARD_RE.test(c) && RANKS.includes(c[0]) && SUITS.includes(c[1]);
}

export function hasDuplicates(spot) {
  const all = cardsOf(spot);
  return new Set(all).size !== all.length;
}

// Нормализация маленьких / средних — структура задачи по умолчанию.
export function emptyTask() {
  return {
    id: '',
    format: 'MTT',
    street: 'ПРЕФЛОП',
    blinds: [500, 1000],
    ante: 0,
    stage: 'СРЕДНЯЯ',
    table: '6-MAX',
    left: '',
    position: 'BTN',
    hero: [],
    heroStack: 0,
    villain: '',
    villainStack: 0,
    effStack: 0,
    opp: null,
    board: [],
    pot: 0,
    history: [],
    question: '',
    options: [],
    correct: '',
    alsoOk: [],
    concept: '',
    explain: '',
    difficulty: 1,
    tags: []
  };
}

// Позиция Hero на русском (первое появление — с пояснением).
export function positionLabel(pos) {
  if (POSITIONS[pos]) return POSITIONS[pos];
  return pos;
}

// Blinds в виде "500/1000" (с анте при наличии).
export function blindsLabel(spot) {
  const base = `${spot.blinds[0]}/${spot.blinds[1]}`;
  return spot.ante ? `${base} + анте ${spot.ante}` : base;
}