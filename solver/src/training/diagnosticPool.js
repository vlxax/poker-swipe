// Dedicated initial diagnostic pool (P0). Authored spots with full table context —
// NOT reused from the training task library. Each item is tagged by skill category,
// difficulty tier (1–5), and whether it is a calibration question.

import { SKILLS } from './skillProfile.js';

export const DIAGNOSTIC_CATEGORIES = [
  { id: 'preflop_fundamentals', skill: 'preflop', labelRu: 'Префлоп база' },
  { id: 'position_awareness', skill: 'positionAwareness', labelRu: 'Позиция' },
  { id: 'stack_depth', skill: 'stackDepthAwareness', labelRu: 'Глубина стеков' },
  { id: 'blind_defense_3bet', skill: 'preflop', labelRu: 'Защита блайндов / 3-бет' },
  { id: 'postflop_fundamentals', skill: 'postflop', labelRu: 'Постфлоп база' },
  { id: 'bet_sizing', skill: 'betSizing', labelRu: 'Сайзинг' },
  { id: 'range_reading', skill: 'rangeReading', labelRu: 'Чтение диапазонов' },
  { id: 'turn_river', skill: 'river', labelRu: 'Тёрн / ривер' },
  { id: 'bluff_catch_value', skill: 'bluffCatch', labelRu: 'Блафф-кэтч / вэлью' },
  { id: 'short_stack', skill: 'shortStack', labelRu: 'Короткий стек' },
  { id: 'icm', skill: 'icm', labelRu: 'ICM / баббл' }
];

export const DIAGNOSTIC_CATEGORY_IDS = DIAGNOSTIC_CATEGORIES.map((c) => c.id);

const POSTFLOP_STREETS = new Set(['ФЛОП', 'ТЁРН', 'РИВЕР']);

export function formatDiagnosticQuestion(item) {
  const c = item.context || {};
  const lines = [
    `${c.format} · ${c.tableSize}-max`,
    `Герой: ${c.heroPosition} · ${c.heroCards} · эфф. стек ${c.effectiveStackBb} ББ`,
    `История: ${c.actionHistory}`
  ];
  if (c.potBb != null) lines.push(`Банк: ${c.potBb} ББ`);
  if (c.board) lines.push(`Борд (${c.boardStreet || item.street}): ${c.board}`);
  if (c.villainPosition) lines.push(`Оппонент: ${c.villainPosition}`);
  lines.push(`Доступные действия: ${(item.choices || []).join(' / ')}`);
  lines.push('', c.question);
  return lines.join('\n');
}

export function diagnosticItemToAssessmentItem(item) {
  return {
    id: item.id,
    skillTag: item.skillTag,
    skillTags: item.skillTags || [item.skillTag],
    concept: item.concept,
    street: item.street,
    q: formatDiagnosticQuestion(item),
    choices: item.choices.slice(),
    correct: item.correct,
    alsoOk: (item.alsoOk || []).slice(),
    score: item.score != null ? item.score : scoreFromTier(item.difficulty),
    difficulty: item.difficulty,
    category: item.category,
    tier: item.tier,
    isCalibration: !!item.isCalibration,
    position: item.context?.heroPosition || null,
    heroStack: item.context?.effectiveStackBb ?? null,
    tags: item.tags || [],
    context: item.context
  };
}

function scoreFromTier(tier) {
  const t = Number(tier) || 2;
  return Math.round(Math.max(60, Math.min(95, 96 - t * 4)));
}

export function validateDiagnosticItem(item) {
  if (!item || !item.id || !item.category || !item.correct) return false;
  if (!Array.isArray(item.choices) || item.choices.length < 2) return false;
  if (!item.choices.includes(item.correct)) return false;
  if (!item.skillTag || !SKILLS.includes(item.skillTag)) return false;
  if (item.difficulty == null || item.tier == null) return false;

  const c = item.context;
  if (!c) return false;
  const base = ['format', 'tableSize', 'heroPosition', 'heroCards', 'effectiveStackBb', 'actionHistory', 'question'];
  for (const key of base) {
    if (c[key] == null || c[key] === '') return false;
  }
  if (POSTFLOP_STREETS.has(item.street) && !c.board) return false;
  if ((item.street === 'ТЁРН' || item.street === 'РИВЕР') && !c.boardStreet) return false;
  return true;
}

function spot({
  id, category, skillTag, skillTags, concept, street, difficulty, tier,
  isCalibration = false, context, choices, correct, alsoOk = [], tags = []
}) {
  const item = {
    id,
    category,
    skillTag,
    skillTags: skillTags || [skillTag],
    concept,
    street,
    difficulty,
    tier,
    isCalibration,
    context,
    choices,
    correct,
    alsoOk,
    tags,
    score: scoreFromTier(difficulty)
  };
  if (!validateDiagnosticItem(item)) {
    throw new Error(`Invalid diagnostic item: ${id}`);
  }
  return item;
}

// ---- Pool (44 authored items, 4 tiers per category) -------------------------

const POOL = [
  // preflop_fundamentals
  spot({
    id: 'DX_PF_T1', category: 'preflop_fundamentals', skillTag: 'preflop', concept: 'open_range',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1, isCalibration: true,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'A8s', effectiveStackBb: 100,
      actionHistory: 'UTG, HJ, CO фолд. SB и BB ещё не действовали.',
      potBb: 1.5, question: 'Открываешь ли диапазон с BTN?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ЛИМП'], correct: 'РЕЙЗ 2.2 ББ'
  }),
  spot({
    id: 'DX_PF_T2', category: 'preflop_fundamentals', skillTag: 'preflop', concept: 'open_range',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'KJo', effectiveStackBb: 100,
      actionHistory: 'UTG и HJ фолд. BTN, SB, BB ещё не действовали.',
      potBb: 1.5, question: 'Открываешь с CO?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ЛИМП'], correct: 'РЕЙЗ 2.2 ББ', alsoOk: ['ФОЛД']
  }),
  spot({
    id: 'DX_PF_T3', category: 'preflop_fundamentals', skillTag: 'preflop', concept: 'open_range',
    street: 'ПРЕФЛОП', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'HJ', heroCards: 'Q9s', effectiveStackBb: 100,
      actionHistory: 'UTG фолд. CO, BTN, SB, BB ещё не действовали.',
      potBb: 1.5, question: 'Открываешь с HJ?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ'], correct: 'ФОЛД', alsoOk: ['РЕЙЗ 2.2 ББ']
  }),
  spot({
    id: 'DX_PF_T4', category: 'preflop_fundamentals', skillTag: 'preflop', concept: 'open_range',
    street: 'ПРЕФЛОП', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'UTG', heroCards: 'A5s', effectiveStackBb: 100,
      actionHistory: 'Все позиции после тебя ещё не действовали.',
      potBb: 1.5, question: 'Открываешь с UTG?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ'], correct: 'РЕЙЗ 2.2 ББ'
  }),

  // position_awareness
  spot({
    id: 'DX_POS_T1', category: 'position_awareness', skillTag: 'positionAwareness', concept: 'rfi_position',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1, isCalibration: true,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'SB', heroCards: 'K9o', effectiveStackBb: 100,
      actionHistory: 'BTN открыл 2.2 ББ. BB ещё не действовал.',
      potBb: 3.7, question: 'Как позиция SB влияет на твоё решение против открытия BTN?'
    },
    choices: ['ФОЛД — SB худшая позиция постфлоп', 'КОЛЛ — цена хорошая', '3-БЕТ'], correct: 'ФОЛД — SB худшая позиция постфлоп', alsoOk: ['КОЛЛ — цена хорошая']
  }),
  spot({
    id: 'DX_POS_T2', category: 'position_awareness', skillTag: 'positionAwareness', concept: 'position',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: '76s', effectiveStackBb: 100,
      actionHistory: 'CO открыл 2.5 ББ. SB и BB ещё не действовали.',
      potBb: 4.0, question: 'BTN имеет позицию постфлоп. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ 8 ББ'], correct: '3-БЕТ 8 ББ', alsoOk: ['КОЛЛ']
  }),
  spot({
    id: 'DX_POS_T3', category: 'position_awareness', skillTag: 'positionAwareness', concept: 'position',
    street: 'ФЛОП', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'T8s', effectiveStackBb: 95,
      villainPosition: 'BTN', actionHistory: 'BTN открыл, BB колл. Флоп BB чек, BTN ставит 33%.',
      potBb: 5.5, board: 'T72r', boardStreet: 'ФЛОП',
      question: 'BB вне позиции с топ-парой слабого кикера. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: ['РЕЙЗ']
  }),
  spot({
    id: 'DX_POS_T4', category: 'position_awareness', skillTag: 'positionAwareness', concept: 'position',
    street: 'ТЁРН', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'AQo', effectiveStackBb: 88,
      villainPosition: 'BTN', actionHistory: 'CO рейз, BTN 3-бет, CO колл. Флоп CO чек, BTN чек. Тёрн CO чек.',
      potBb: 18, board: 'K73r 2', boardStreet: 'ТЁРН',
      question: 'CO в позиции с AQ на сухом борде. BTN чекнул тёрн. Твоё действие?'
    },
    choices: ['ЧЕК', 'СТАВКА 50%', 'СТАВКА 75%'], correct: 'СТАВКА 50%', alsoOk: ['ЧЕК']
  }),

  // stack_depth
  spot({
    id: 'DX_STACK_T1', category: 'stack_depth', skillTag: 'stackDepthAwareness', concept: 'stack_depth',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'JJ', effectiveStackBb: 40,
      actionHistory: 'До тебя фолд. SB и BB ещё не действовали.',
      potBb: 1.5, question: 'При 40 ББ эфф. стека открываешь JJ с BTN?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'РЕЙЗ 3 ББ'], correct: 'РЕЙЗ 2.2 ББ'
  }),
  spot({
    id: 'DX_STACK_T2', category: 'stack_depth', skillTag: 'stackDepthAwareness', concept: 'spr',
    street: 'ФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AKs', effectiveStackBb: 30,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5, board: 'A72r', boardStreet: 'ФЛОП',
      question: 'SPR ≈ 6 с топ-парой топ-кикером. Сайзинг с-бета?'
    },
    choices: ['ЧЕК', 'СТАВКА 25%', 'СТАВКА 66%'], correct: 'СТАВКА 25%', alsoOk: ['СТАВКА 66%']
  }),
  spot({
    id: 'DX_STACK_T3', category: 'stack_depth', skillTag: 'stackDepthAwareness', concept: 'spr',
    street: 'ФЛОП', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'QQ', effectiveStackBb: 15,
      villainPosition: 'BB', actionHistory: 'CO рейз, BB колл. Флоп BB чек.',
      potBb: 5, board: 'JT9ss', boardStreet: 'ФЛОП',
      question: 'SPR ≈ 3 на динамичном флопе с оверпарой. Твоё действие?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 75%'
  }),
  spot({
    id: 'DX_STACK_T4', category: 'stack_depth', skillTag: 'stackDepthAwareness', concept: 'pot_geometry',
    street: 'ТЁРН', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: '88', effectiveStackBb: 22,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BTN ставка 33%, BB колл. Тёрн BB чек.',
      potBb: 9, board: '842r 8', boardStreet: 'ТЁРН',
      question: 'Фулл-хаус на тёрне, SPR ≈ 2.4. Твоё действие?'
    },
    choices: ['ЧЕК', 'СТАВКА 50%', 'СТАВКА 100%'], correct: 'СТАВКА 100%', alsoOk: ['СТАВКА 50%']
  }),

  // blind_defense_3bet
  spot({
    id: 'DX_BB_T1', category: 'blind_defense_3bet', skillTag: 'preflop', concept: 'defend_vs_open',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'K8s', effectiveStackBb: 100,
      actionHistory: 'BTN открыл 2.2 ББ. SB фолд.',
      potBb: 3.7, question: 'Защищаешь BB с K8s против открытия BTN?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ 9 ББ'], correct: 'КОЛЛ', alsoOk: ['3-БЕТ 9 ББ']
  }),
  spot({
    id: 'DX_BB_T2', category: 'blind_defense_3bet', skillTag: 'preflop', concept: '3bet_frequency',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'SB', heroCards: 'A5s', effectiveStackBb: 100,
      actionHistory: 'CO открыл 2.3 ББ. BTN и BB ещё не действовали.',
      potBb: 3.8, question: 'SB против открытия CO с A5s. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ 8.5 ББ'], correct: '3-БЕТ 8.5 ББ', alsoOk: ['КОЛЛ']
  }),
  spot({
    id: 'DX_BB_T3', category: 'blind_defense_3bet', skillTag: 'preflop', concept: 'defend_vs_open',
    street: 'ПРЕФЛОП', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'J4o', effectiveStackBb: 100,
      actionHistory: 'BTN открыл 2.2 ББ. SB фолд.',
      potBb: 3.7, question: 'Защищаешь BB с J4o против BTN?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ'], correct: 'ФОЛД'
  }),
  spot({
    id: 'DX_BB_T4', category: 'blind_defense_3bet', skillTag: 'preflop', concept: '4bet_decision',
    street: 'ПРЕФЛОП', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'AKo', effectiveStackBb: 100,
      actionHistory: 'CO рейз 2.2, BTN 3-бет 7.5, CO на решении.',
      potBb: 10.7, question: 'CO с AKo против 3-бета BTN. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '4-БЕТ 20 ББ'], correct: '4-БЕТ 20 ББ', alsoOk: ['КОЛЛ']
  }),

  // postflop_fundamentals
  spot({
    id: 'DX_POST_T1', category: 'postflop_fundamentals', skillTag: 'postflop', concept: 'cbet_frequency',
    street: 'ФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'QJs', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'A72r', boardStreet: 'ФЛОП',
      question: 'Префлоп-агрессор на сухом A-high флопе без попадания. С-бет?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%'], correct: 'СТАВКА 33%'
  }),
  spot({
    id: 'DX_POST_T2', category: 'postflop_fundamentals', skillTag: 'postflop', concept: 'cbet_frequency',
    street: 'ФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AQ', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'T98ss', boardStreet: 'ФЛОП',
      question: 'Префлоп-агрессор с AQ на динамичном флопе. BB чекнул. Твоё действие?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 66%'], correct: 'ЧЕК', alsoOk: ['СТАВКА 33%']
  }),
  spot({
    id: 'DX_POST_T3', category: 'postflop_fundamentals', skillTag: 'postflop', concept: 'defend_vs_cbet',
    street: 'ФЛОП', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: '76s', effectiveStackBb: 100,
      villainPosition: 'BTN', actionHistory: 'BTN рейз, BB колл. Флоп BB чек, BTN ставит 125%.',
      potBb: 5.5, board: 'K72r', boardStreet: 'ФЛОП',
      question: 'BB с 76s на K72, BTN овербет. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'ФОЛД'
  }),
  spot({
    id: 'DX_POST_T4', category: 'postflop_fundamentals', skillTag: 'postflop', concept: 'check_raise',
    street: 'ФЛОП', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: '98s', effectiveStackBb: 100,
      villainPosition: 'CO', actionHistory: 'CO рейз, BB колл. Флоп BB чек, CO ставит 33%.',
      potBb: 5.5, board: 'T76ss', boardStreet: 'ФЛОП',
      question: 'BB с дро и оверкартами на T76ss. CO ставит 33%. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ 3x'], correct: 'РЕЙЗ 3x', alsoOk: ['КОЛЛ']
  }),

  // bet_sizing
  spot({
    id: 'DX_SIZE_T1', category: 'bet_sizing', skillTag: 'betSizing', concept: 'cbet_sizing',
    street: 'ФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KK', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'K73r', boardStreet: 'ФЛОП',
      question: 'Топ-сет на сухом флопе. Какой сайзинг с-бета?'
    },
    choices: ['ЧЕК', 'СТАВКА 25%', 'СТАВКА 75%'], correct: 'СТАВКА 25%', alsoOk: ['СТАВКА 75%']
  }),
  spot({
    id: 'DX_SIZE_T2', category: 'bet_sizing', skillTag: 'betSizing', concept: 'turn_barrel_sizing',
    street: 'ТЁРН', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AQ', effectiveStackBb: 95,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BTN ставка 33%, BB колл. Тёрн BB чек.',
      potBb: 9, board: 'Q832r', boardStreet: 'ТЁРН',
      question: 'Топ-пара с AQ на тёрне. BB чекнул. Сайзинг второго бочка?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 75%', alsoOk: ['СТАВКА 33%']
  }),
  spot({
    id: 'DX_SIZE_T3', category: 'bet_sizing', skillTag: 'betSizing', concept: 'overbet',
    street: 'РИВЕР', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'A5s', effectiveStackBb: 80,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп чек-чек. Тёрн BTN ставка 50%, BB колл. Ривер BB чек.',
      potBb: 14, board: 'K72r 2 5', boardStreet: 'РИВЕР',
      question: 'Блеф-ривер с A-high и блокером 5. BB чекнул. Твоё действие?'
    },
    choices: ['ЧЕК', 'СТАВКА 50%', 'СТАВКА 125%'], correct: 'СТАВКА 125%', alsoOk: ['ЧЕК']
  }),
  spot({
    id: 'DX_SIZE_T4', category: 'bet_sizing', skillTag: 'betSizing', concept: 'river_sizing',
    street: 'РИВЕР', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'KQ', effectiveStackBb: 90,
      villainPosition: 'BB', actionHistory: 'CO рейз, BB колл. Флоп CO ставка 33%, BB колл. Тёрн чек-чек. Ривер BB чек.',
      potBb: 9, board: 'K9522', boardStreet: 'РИВЕР',
      question: 'Тонкое вэлью с KQ (топ-пара) на ривере. BB чекнул. Сайзинг?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 33%', alsoOk: ['ЧЕК']
  }),

  // range_reading
  spot({
    id: 'DX_RANGE_T1', category: 'range_reading', skillTag: 'rangeReading', concept: 'range_advantage',
    street: 'ФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AQ', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'T98ss', boardStreet: 'ФЛОП',
      question: 'BTN vs BB на T98ss — у кого преимущество диапазона?'
    },
    choices: ['BB', 'BTN', 'РАВНО'], correct: 'BB'
  }),
  spot({
    id: 'DX_RANGE_T2', category: 'range_reading', skillTag: 'rangeReading', concept: 'range_advantage',
    street: 'ФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'JJ', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'A72r', boardStreet: 'ФЛОП',
      question: 'BTN vs BB на A72r — у кого преимущество диапазона?'
    },
    choices: ['BB', 'BTN', 'РАВНО'], correct: 'BTN'
  }),
  spot({
    id: 'DX_RANGE_T3', category: 'range_reading', skillTag: 'rangeReading', concept: 'nut_advantage',
    street: 'ФЛОП', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'Ah5h', effectiveStackBb: 100,
      villainPosition: 'BTN', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'Kh7h2d', boardStreet: 'ФЛОП',
      question: 'BB с Ah5h на Kh7h2d — как оценить диапазон BTN?'
    },
    choices: ['BTN часто попал', 'BTN редко попал', 'Диапазоны равны'], correct: 'BTN редко попал', alsoOk: ['Диапазоны равны']
  }),
  spot({
    id: 'DX_RANGE_T4', category: 'range_reading', skillTag: 'rangeReading', concept: 'board_texture',
    street: 'ТЁРН', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'TT', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'CO рейз, BB колл. Флоп CO ставка 33%, BB колл. Тёрн BB чек.',
      potBb: 9, board: 'JT4r 9', boardStreet: 'ТЁРН',
      question: 'CO с TT на JT49 — как изменился диапазон BB после колла флопа?'
    },
    choices: ['BB сужен до пар+', 'BB широкий с дро', 'BB только натсы'], correct: 'BB сужен до пар+', alsoOk: ['BB широкий с дро']
  }),

  // turn_river
  spot({
    id: 'DX_TR_T1', category: 'turn_river', skillTag: 'river', concept: 'value_bet',
    street: 'РИВЕР', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'KQ', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'CO рейз, BB колл. Флоп CO ставка 33%, BB колл. Тёрн чек-чек. Ривер BB чек.',
      potBb: 9, board: 'K9522', boardStreet: 'РИВЕР',
      question: 'Топ-пара на ривере, BB чекнул. Ставишь вэлью?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 33%', alsoOk: ['ЧЕК']
  }),
  spot({
    id: 'DX_TR_T2', category: 'turn_river', skillTag: 'river', concept: 'turn_barrel_sizing',
    street: 'ТЁРН', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AK', effectiveStackBb: 95,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BTN ставка 33%, BB колл. Тёрн BB чек.',
      potBb: 9, board: 'A73r Q', boardStreet: 'ТЁРН',
      question: 'Две пары (A и K) на тёрне. BB чекнул. Продолжаешь?'
    },
    choices: ['ЧЕК', 'СТАВКА 50%', 'СТАВКА 100%'], correct: 'СТАВКА 50%', alsoOk: ['СТАВКА 100%']
  }),
  spot({
    id: 'DX_TR_T3', category: 'turn_river', skillTag: 'river', concept: 'bluff',
    street: 'РИВЕР', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'QJs', effectiveStackBb: 85,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BTN ставка 33%, BB колл. Тёрн чек-чек. Ривер BB чек.',
      potBb: 9, board: 'A84r 2 K', boardStreet: 'РИВЕР',
      question: 'Промах на ривере, BB чекнул. Блефуешь?'
    },
    choices: ['ЧЕК', 'СТАВКА 50%', 'СТАВКА 125%'], correct: 'ЧЕК', alsoOk: ['СТАВКА 50%']
  }),
  spot({
    id: 'DX_TR_T4', category: 'turn_river', skillTag: 'river', concept: 'thin_value',
    street: 'РИВЕР', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'AJ', effectiveStackBb: 90,
      villainPosition: 'BB', actionHistory: 'CO рейз, BB колл. Флоп CO ставка 33%, BB колл. Тёрн CO ставка 66%, BB колл. Ривер BB чек.',
      potBb: 22, board: 'J73r 2 4', boardStreet: 'РИВЕР',
      question: 'Вторая пара (J) на ривере после двух бочков. BB чекнул. Твоё действие?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'ЧЕК', alsoOk: ['СТАВКА 33%']
  }),

  // bluff_catch_value
  spot({
    id: 'DX_BC_T1', category: 'bluff_catch_value', skillTag: 'bluffCatch', concept: 'bluff_catch',
    street: 'РИВЕР', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'KJ', effectiveStackBb: 100,
      villainPosition: 'BTN', actionHistory: 'BTN рейз, BB колл. Флоп чек-чек. Тёрн BTN ставка 50%, BB колл. Ривер BTN ставит 140%.',
      potBb: 9, board: 'K947A', boardStreet: 'РИВЕР',
      question: 'BB с KJ (пара K) против овербета BTN на ривере. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД'
  }),
  spot({
    id: 'DX_BC_T2', category: 'bluff_catch_value', skillTag: 'bluffCatch', concept: 'fold_vs_bet',
    street: 'РИВЕР', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'A9', effectiveStackBb: 100,
      villainPosition: 'CO', actionHistory: 'CO рейз, BB колл. Флоп CO ставка 33%, BB колл. Тёрн чек-чек. Ривер CO ставит 75%.',
      potBb: 9, board: '942r 2 6', boardStreet: 'РИВЕР',
      question: 'BB с A-high на ривере против ставки CO. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'ФОЛД', alsoOk: ['КОЛЛ']
  }),
  spot({
    id: 'DX_BC_T3', category: 'bluff_catch_value', skillTag: 'bluffCatch', concept: 'price_defence',
    street: 'РИВЕР', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: '88', effectiveStackBb: 100,
      villainPosition: 'BTN', actionHistory: 'BTN рейз, BB колл. Флоп BTN ставка 33%, BB колл. Тёрн чек-чек. Ривер BTN ставит 50%.',
      potBb: 9, board: 'T73r 2 8', boardStreet: 'РИВЕР',
      question: 'BB с сетом восьмёрок на ривере против ставки 50%. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ']
  }),
  spot({
    id: 'DX_BC_T4', category: 'bluff_catch_value', skillTag: 'bluffCatch', concept: 'bluff_catch',
    street: 'РИВЕР', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'QJ', effectiveStackBb: 100,
      villainPosition: 'BTN', actionHistory: 'BTN рейз, BB колл. Флоп чек-чек. Тёрн BTN ставка 66%, BB колл. Ривер BTN ставит 100%.',
      potBb: 14, board: 'JT4r 2 7', boardStreet: 'РИВЕР',
      question: 'BB с QJ (пара Q) против pot-bet BTN. Блафф-кэтч?'
    },
    choices: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: ['ФОЛД']
  }),

  // short_stack
  spot({
    id: 'DX_SS_T1', category: 'short_stack', skillTag: 'shortStack', concept: 'push_fold',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'SB', heroCards: '22', effectiveStackBb: 12,
      actionHistory: 'BTN фолд. BB ещё не действовал.',
      potBb: 1.5, question: '12 ББ в SB с 22. Твоё действие?'
    },
    choices: ['ФОЛД', 'ЛИМП', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['ЛИМП']
  }),
  spot({
    id: 'DX_SS_T2', category: 'short_stack', skillTag: 'shortStack', concept: 'fold_equity',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'A9o', effectiveStackBb: 15,
      actionHistory: 'До тебя фолд. SB и BB ещё не действовали.',
      potBb: 1.5, question: '15 ББ на BTN с A9o. Твоё действие?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['РЕЙЗ 2.2 ББ']
  }),
  spot({
    id: 'DX_SS_T3', category: 'short_stack', skillTag: 'shortStack', concept: 'push_fold',
    street: 'ПРЕФЛОП', difficulty: 3, tier: 3,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'KQo', effectiveStackBb: 10,
      actionHistory: 'UTG и HJ фолд. BTN, SB, BB ещё не действовали.',
      potBb: 1.5, question: '10 ББ на CO с KQo. Твоё действие?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН'
  }),
  spot({
    id: 'DX_SS_T4', category: 'short_stack', skillTag: 'shortStack', concept: 'call_vs_3bet',
    street: 'ПРЕФЛОП', difficulty: 4, tier: 4,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AJo', effectiveStackBb: 18,
      actionHistory: 'CO рейз 2.2, BTN 3-бет 5.5, CO 4-бет олл-ин 18 ББ.',
      potBb: 24, question: '18 ББ эфф. стек, BTN с AJo против 4-бет олл-ин. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: ['ФОЛД']
  }),

  // icm
  spot({
    id: 'DX_ICM_T1', category: 'icm', skillTag: 'icm', concept: 'icm_pressure',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: 'MTT 6-max', tableSize: 6, heroPosition: 'BTN', heroCards: 'A7o', effectiveStackBb: 6,
      actionHistory: '5 игроков до ITM. Баббл. До тебя фолд. SB и BB — средние стеки.',
      potBb: 1.5, question: 'Баббл, 6 ББ на BTN с A7o. Открываешь?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2x', 'ОЛЛ-ИН'], correct: 'РЕЙЗ 2x', alsoOk: ['ОЛЛ-ИН']
  }),
  spot({
    id: 'DX_ICM_T2', category: 'icm', skillTag: 'icm', concept: 'icm_fold',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: 'MTT 9-max', tableSize: 9, heroPosition: 'CO', heroCards: 'KJo', effectiveStackBb: 14,
      actionHistory: 'Баббл, 9 игроков. UTG и HJ фолд. BTN — короткий стек 5 ББ.',
      potBb: 1.5, question: 'ICM-давление на баббле, CO с KJo 14 ББ. Твоё действие?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ОЛЛ-ИН'], correct: 'ФОЛД', alsoOk: ['РЕЙЗ 2.2 ББ']
  }),
  spot({
    id: 'DX_ICM_T3', category: 'icm', skillTag: 'icm', concept: 'icm_push',
    street: 'ПРЕФЛОП', difficulty: 3, tier: 3,
    context: {
      format: 'MTT 6-max', tableSize: 6, heroPosition: 'SB', heroCards: 'A5s', effectiveStackBb: 8,
      actionHistory: '4 игрока до ITM. BTN фолд. BB — большой стек 40 ББ.',
      potBb: 1.5, question: 'ICM: SB 8 ББ с A5s, BB покрывает. Твоё действие?'
    },
    choices: ['ФОЛД', 'ЛИМП', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['ФОЛД']
  }),
  spot({
    id: 'DX_ICM_T4', category: 'icm', skillTag: 'icm', concept: 'bubble',
    street: 'ПРЕФЛОП', difficulty: 4, tier: 4,
    context: {
      format: 'MTT финальный стол', tableSize: 6, heroPosition: 'BB', heroCards: 'TT', effectiveStackBb: 25,
      actionHistory: '3 игрока до призов. BTN (чип-лидер 60 ББ) открыл 2.2. SB (5 ББ) фолд.',
      potBb: 3.7, question: 'Финальный стол, BB 25 ББ с TT против BTN chip-leader. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ 8 ББ'], correct: '3-БЕТ 8 ББ', alsoOk: ['КОЛЛ']
  })
];

let _poolCache = null;

export function getDiagnosticPool() {
  if (!_poolCache) _poolCache = POOL.slice();
  return _poolCache;
}

export function getDiagnosticPoolByCategory(categoryId) {
  return getDiagnosticPool().filter((item) => item.category === categoryId);
}

export function getDiagnosticPoolSize() {
  return getDiagnosticPool().length;
}

export function validateDiagnosticPool() {
  const pool = getDiagnosticPool();
  const invalid = pool.filter((item) => !validateDiagnosticItem(item));
  const categories = new Set(pool.map((i) => i.category));
  const missing = DIAGNOSTIC_CATEGORY_IDS.filter((c) => !categories.has(c));
  return {
    poolSize: pool.length,
    validCount: pool.length - invalid.length,
    invalidIds: invalid.map((i) => i.id),
    missingCategories: missing,
    allValid: invalid.length === 0 && missing.length === 0
  };
}
