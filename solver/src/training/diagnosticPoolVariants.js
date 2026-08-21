// Alternate diagnostic items (variant B) — same category/tier coverage, different hands.

import { SKILLS } from './skillProfile.js';

const POSTFLOP_STREETS = new Set(['ФЛОП', 'ТЁРН', 'РИВЕР']);

function scoreFromTier(tier) {
  const t = Number(tier) || 2;
  return Math.round(Math.max(60, Math.min(95, 96 - t * 4)));
}

function validateDiagnosticItem(item) {
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

function spot(args) {
  const item = {
    ...args,
    skillTags: args.skillTags || [args.skillTag],
    alsoOk: args.alsoOk || [],
    tags: args.tags || [],
    score: scoreFromTier(args.difficulty)
  };
  if (!validateDiagnosticItem(item)) throw new Error(`Invalid diagnostic item: ${args.id}`);
  return item;
}

export const VARIANT_B_POOL = [
  spot({
    id: 'DX_PF_T1_B', category: 'preflop_fundamentals', skillTag: 'preflop', concept: 'open_range',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1, isCalibration: true,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KJs', effectiveStackBb: 100,
      actionHistory: 'UTG, HJ, CO фолд. SB и BB ещё не действовали.',
      potBb: 1.5, question: 'Открываешь ли диапазон с BTN с KJs?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ЛИМП'], correct: 'РЕЙЗ 2.2 ББ'
  }),
  spot({
    id: 'DX_PF_T2_B', category: 'preflop_fundamentals', skillTag: 'preflop', concept: 'open_range',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'ATs', effectiveStackBb: 100,
      actionHistory: 'UTG и HJ фолд. BTN, SB, BB ещё не действовали.',
      potBb: 1.5, question: 'Открываешь с CO с ATs?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ЛИМП'], correct: 'РЕЙЗ 2.2 ББ'
  }),
  spot({
    id: 'DX_POS_T1_B', category: 'position_awareness', skillTag: 'positionAwareness', concept: 'rfi_position',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1, isCalibration: true,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'SB', heroCards: 'Q9o', effectiveStackBb: 100,
      actionHistory: 'BTN открыл 2.2 ББ. BB ещё не действовал.',
      potBb: 3.7, question: 'SB вне позиции против открытия BTN с Q9o. Твоё решение?'
    },
    choices: ['ФОЛД — SB худшая позиция постфлоп', 'КОЛЛ — цена хорошая', '3-БЕТ'], correct: 'ФОЛД — SB худшая позиция постфлоп', alsoOk: ['КОЛЛ — цена хорошая']
  }),
  spot({
    id: 'DX_POS_T2_B', category: 'position_awareness', skillTag: 'positionAwareness', concept: 'position',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: '65s', effectiveStackBb: 100,
      actionHistory: 'CO открыл 2.5 ББ. SB и BB ещё не действовали.',
      potBb: 4.0, question: 'BTN с 65s и позицией постфлоп. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ 8 ББ'], correct: '3-БЕТ 8 ББ', alsoOk: ['КОЛЛ']
  }),
  spot({
    id: 'DX_STACK_T1_B', category: 'stack_depth', skillTag: 'stackDepthAwareness', concept: 'stack_depth',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'TT', effectiveStackBb: 40,
      actionHistory: 'До тебя фолд. SB и BB ещё не действовали.',
      potBb: 1.5, question: 'При 40 ББ эфф. стека открываешь TT с BTN?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'РЕЙЗ 3 ББ'], correct: 'РЕЙЗ 2.2 ББ'
  }),
  spot({
    id: 'DX_STACK_T2_B', category: 'stack_depth', skillTag: 'stackDepthAwareness', concept: 'spr',
    street: 'ФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'QQ', effectiveStackBb: 30,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5, board: 'Q72r', boardStreet: 'ФЛОП',
      question: 'SPR ≈ 6 с сетом на сухом флопе. Сайзинг с-бета?'
    },
    choices: ['ЧЕК', 'СТАВКА 25%', 'СТАВКА 66%'], correct: 'СТАВКА 25%', alsoOk: ['СТАВКА 66%']
  }),
  spot({
    id: 'DX_BB_T1_B', category: 'blind_defense_3bet', skillTag: 'preflop', concept: 'defend_vs_open',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'Q9s', effectiveStackBb: 100,
      actionHistory: 'BTN открыл 2.2 ББ. SB фолд.',
      potBb: 3.7, question: 'Защищаешь BB с Q9s против открытия BTN?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ 9 ББ'], correct: 'КОЛЛ', alsoOk: ['3-БЕТ 9 ББ']
  }),
  spot({
    id: 'DX_BB_T2_B', category: 'blind_defense_3bet', skillTag: 'preflop', concept: '3bet_frequency',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'SB', heroCards: 'K5s', effectiveStackBb: 100,
      actionHistory: 'CO открыл 2.3 ББ. BTN и BB ещё не действовали.',
      potBb: 3.8, question: 'SB против открытия CO с K5s. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', '3-БЕТ 8.5 ББ'], correct: 'ФОЛД', alsoOk: ['КОЛЛ']
  }),
  spot({
    id: 'DX_POST_T1_B', category: 'postflop_fundamentals', skillTag: 'postflop', concept: 'cbet_frequency',
    street: 'ФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KJs', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'K83r', boardStreet: 'ФЛОП',
      question: 'Префлоп-агрессор на K83 с топ-парой. BB чекнул. С-бет?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%'], correct: 'СТАВКА 33%'
  }),
  spot({
    id: 'DX_POST_T2_B', category: 'postflop_fundamentals', skillTag: 'postflop', concept: 'cbet_frequency',
    street: 'ФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KJ', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'JT4ss', boardStreet: 'ФЛОП',
      question: 'Префлоп-агрессор с KJ на JT4ss. BB чекнул. Твоё действие?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 66%'], correct: 'ЧЕК', alsoOk: ['СТАВКА 33%']
  }),
  spot({
    id: 'DX_SIZE_T1_B', category: 'bet_sizing', skillTag: 'betSizing', concept: 'cbet_sizing',
    street: 'ФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AA', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'A94r', boardStreet: 'ФЛОП',
      question: 'Топ-сет на A94. Какой сайзинг с-бета?'
    },
    choices: ['ЧЕК', 'СТАВКА 25%', 'СТАВКА 75%'], correct: 'СТАВКА 25%', alsoOk: ['СТАВКА 75%']
  }),
  spot({
    id: 'DX_SIZE_T2_B', category: 'bet_sizing', skillTag: 'betSizing', concept: 'turn_barrel_sizing',
    street: 'ТЁРН', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KJ', effectiveStackBb: 95,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BTN ставка 33%, BB колл. Тёрн BB чек.',
      potBb: 9, board: 'K732r', boardStreet: 'ТЁРН',
      question: 'Топ-пара с KJ на тёрне. BB чекнул. Сайзинг второго бочка?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 75%', alsoOk: ['СТАВКА 33%']
  }),
  spot({
    id: 'DX_RANGE_T1_B', category: 'range_reading', skillTag: 'rangeReading', concept: 'range_advantage',
    street: 'ФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KJ', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'J98ss', boardStreet: 'ФЛОП',
      question: 'BTN vs BB на J98ss — у кого преимущество диапазона?'
    },
    choices: ['BB', 'BTN', 'РАВНО'], correct: 'BB'
  }),
  spot({
    id: 'DX_RANGE_T2_B', category: 'range_reading', skillTag: 'rangeReading', concept: 'range_advantage',
    street: 'ФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'AK', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BB чек.',
      potBb: 5.5, board: 'K72r', boardStreet: 'ФЛОП',
      question: 'BTN vs BB на K72r — у кого преимущество диапазона?'
    },
    choices: ['BB', 'BTN', 'РАВНО'], correct: 'BTN'
  }),
  spot({
    id: 'DX_TR_T1_B', category: 'turn_river', skillTag: 'river', concept: 'value_bet',
    street: 'РИВЕР', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'CO', heroCards: 'KJ', effectiveStackBb: 100,
      villainPosition: 'BB', actionHistory: 'CO рейз, BB колл. Флоп CO ставка 33%, BB колл. Тёрн чек-чек. Ривер BB чек.',
      potBb: 9, board: 'K8432', boardStreet: 'РИВЕР',
      question: 'Топ-пара на ривере, BB чекнул. Ставишь вэлью?'
    },
    choices: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 33%', alsoOk: ['ЧЕК']
  }),
  spot({
    id: 'DX_TR_T2_B', category: 'turn_river', skillTag: 'river', concept: 'turn_barrel_sizing',
    street: 'ТЁРН', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KQ', effectiveStackBb: 95,
      villainPosition: 'BB', actionHistory: 'BTN рейз, BB колл. Флоп BTN ставка 33%, BB колл. Тёрн BB чек.',
      potBb: 9, board: 'K73r Q', boardStreet: 'ТЁРН',
      question: 'Две пары на тёрне. BB чекнул. Продолжаешь?'
    },
    choices: ['ЧЕК', 'СТАВКА 50%', 'СТАВКА 100%'], correct: 'СТАВКА 50%', alsoOk: ['СТАВКА 100%']
  }),
  spot({
    id: 'DX_BC_T1_B', category: 'bluff_catch_value', skillTag: 'bluffCatch', concept: 'bluff_catch',
    street: 'РИВЕР', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'QJ', effectiveStackBb: 100,
      villainPosition: 'BTN', actionHistory: 'BTN рейз, BB колл. Флоп чек-чек. Тёрн BTN ставка 50%, BB колл. Ривер BTN ставит 140%.',
      potBb: 9, board: 'Q947A', boardStreet: 'РИВЕР',
      question: 'BB с QJ (пара Q) против овербета BTN на ривере. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД'
  }),
  spot({
    id: 'DX_BC_T2_B', category: 'bluff_catch_value', skillTag: 'bluffCatch', concept: 'fold_vs_bet',
    street: 'РИВЕР', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BB', heroCards: 'KJ', effectiveStackBb: 100,
      villainPosition: 'CO', actionHistory: 'CO рейз, BB колл. Флоп CO ставка 33%, BB колл. Тёрн чек-чек. Ривер CO ставит 75%.',
      potBb: 9, board: '942r 2 6', boardStreet: 'РИВЕР',
      question: 'BB с K-high на ривере против ставки CO. Твоё действие?'
    },
    choices: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'ФОЛД', alsoOk: ['КОЛЛ']
  }),
  spot({
    id: 'DX_SS_T1_B', category: 'short_stack', skillTag: 'shortStack', concept: 'push_fold',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'SB', heroCards: 'A5s', effectiveStackBb: 12,
      actionHistory: 'BTN фолд. BB ещё не действовал.',
      potBb: 1.5, question: '12 ББ в SB с A5s. Твоё действие?'
    },
    choices: ['ФОЛД', 'ЛИМП', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['ЛИМП']
  }),
  spot({
    id: 'DX_SS_T2_B', category: 'short_stack', skillTag: 'shortStack', concept: 'fold_equity',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: '6-max кэш', tableSize: 6, heroPosition: 'BTN', heroCards: 'KJo', effectiveStackBb: 15,
      actionHistory: 'До тебя фолд. SB и BB ещё не действовали.',
      potBb: 1.5, question: '15 ББ на BTN с KJo. Твоё действие?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['РЕЙЗ 2.2 ББ']
  }),
  spot({
    id: 'DX_ICM_T1_B', category: 'icm', skillTag: 'icm', concept: 'icm_pressure',
    street: 'ПРЕФЛОП', difficulty: 1, tier: 1,
    context: {
      format: 'MTT 6-max', tableSize: 6, heroPosition: 'BTN', heroCards: 'K9o', effectiveStackBb: 6,
      actionHistory: '5 игроков до ITM. Баббл. До тебя фолд. SB и BB — средние стеки.',
      potBb: 1.5, question: 'Баббл, 6 ББ на BTN с K9o. Открываешь?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2x', 'ОЛЛ-ИН'], correct: 'ФОЛД', alsoOk: ['РЕЙЗ 2x']
  }),
  spot({
    id: 'DX_ICM_T2_B', category: 'icm', skillTag: 'icm', concept: 'icm_fold',
    street: 'ПРЕФЛОП', difficulty: 2, tier: 2,
    context: {
      format: 'MTT 9-max', tableSize: 9, heroPosition: 'CO', heroCards: 'QJo', effectiveStackBb: 14,
      actionHistory: 'Баббл, 9 игроков. UTG и HJ фолд. BTN — короткий стек 5 ББ.',
      potBb: 1.5, question: 'ICM-давление на баббле, CO с QJo 14 ББ. Твоё действие?'
    },
    choices: ['ФОЛД', 'РЕЙЗ 2.2 ББ', 'ОЛЛ-ИН'], correct: 'ФОЛД', alsoOk: ['РЕЙЗ 2.2 ББ']
  })
];
