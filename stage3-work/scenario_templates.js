// ============================================================
//  SCENARIO ARCHITECTURE (Stage 3)
// ============================================================
// Scenarios are now organized by theme and poker situation
// Each has clear learning objectives and branching paths

const SCENARIO_LIBRARY = {
  // ============================================================
  //  PREFLOP SITUATIONS
  // ============================================================

  STEAL_BTN_VS_BB_FOLD: {
    id: 'STEAL_BTN_VS_BB_FOLD',
    title: 'BTN steal, BB складывает',
    theme: 'preflop_aggression',
    learningObjectives: [
      'Распознаёт попытку тв лбя банка',
      'Понимает стек-зависимость решений',
      'Видит адаптацию оппонента'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 45,
      villainStack: 40,
    },
    hero: ['A♠', 'J♦'],
    villainHand: ['9♥', '7♦'],
    boards: {
      preflop: [],
      flop: ['K♠', 'T♥', '3♣'],
      turn: ['K♠', 'T♥', '3♣', '2♦'],
      river: ['K♠', 'T♥', '3♣', '2♦', '8♠']
    },
    publicReads: [
      { text: 'За столом 52 минуты', tag: 'observed_time', confidence: 1.0 },
      { text: 'Часто защищает ББ', tag: 'wide_bb_defense', confidence: 0.7 },
      { text: 'Средний рег', tag: 'solid_regular', confidence: 0.6 },
    ],
    opponentMind: { preset: 'SOLID_TAG' },
    seed: 1001,
  },

  THREE_BET_SPOT: {
    id: 'THREE_BET_SPOT',
    title: '3-бет в баббле',
    theme: 'preflop_aggression',
    learningObjectives: [
      'Распознаёт 3-бет диапазоны',
      'Понимает баббл динамику',
      'Видит переадаптацию'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'BUBBLE',
      blinds: { sb: 1, bb: 2, ante: 0.2 },
      playerCount: 6,
      heroPos: 'CO',
      villainPos: 'BTN',
      heroStack: 32,
      villainStack: 28,
    },
    hero: ['K♣', 'K♦'],
    villainHand: ['A♥', '9♠'],
    boards: {
      preflop: [],
      flop: ['Q♣', 'J♠', '2♦'],
      turn: ['Q♣', 'J♠', '2♦', '4♥'],
      river: ['Q♣', 'J♠', '2♦', '4♥', 'K♠']
    },
    publicReads: [
      { text: 'Агрессивен в баббле', tag: 'bubble_aggressor', confidence: 0.8 },
      { text: 'LAG-рег', tag: 'aggressive_lag', confidence: 0.7 },
    ],
    opponentMind: { preset: 'AGGRESSIVE_LAG' },
    seed: 1002,
  },

  SHORT_STACK_SHOVE: {
    id: 'SHORT_STACK_SHOVE',
    title: 'Шорт-стек пуш из UTG',
    theme: 'preflop_push_fold',
    learningObjectives: [
      'Распознаёт диапазоны шорт-стека',
      'Понимает ICM',
      'Видит вынужденный рейз'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'FINAL_TABLE',
      blinds: { sb: 2, bb: 4, ante: 0.4 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'UTG',
      heroStack: 60,
      villainStack: 12,
    },
    hero: ['Q♦', 'T♣'],
    villainHand: ['3♠', '2♥'],
    boards: {
      preflop: [],
      flop: ['K♠', 'J♠', '9♦'],
      turn: ['K♠', 'J♠', '9♦', '5♣'],
      river: ['K♠', 'J♠', '9♦', '5♣', '7♥']
    },
    publicReads: [
      { text: 'Находится в отчаянии', tag: 'short_stack_desperate', confidence: 0.95 },
      { text: 'Шорт-стек режим', tag: 'push_fold_mode', confidence: 0.9 },
    ],
    opponentMind: { preset: 'TIRED_WANTS_LEAVE' },
    seed: 1003,
  },

  FOUR_BET_POT: {
    id: 'FOUR_BET_POT',
    title: '4-бет потс с TT',
    theme: 'preflop_aggression',
    learningObjectives: [
      'Распознаёт 4-бет диапазоны',
      'Понимает сильные руки оппонента',
      'Видит защиту руки'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'EARLY_STAGE',
      blinds: { sb: 0.25, bb: 0.5, ante: 0.05 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'SB',
      heroStack: 100,
      villainStack: 95,
    },
    hero: ['T♦', 'T♣'],
    villainHand: ['A♠', 'Q♣'],
    boards: {
      preflop: [],
      flop: ['9♥', '7♣', '5♠'],
      turn: ['9♥', '7♣', '5♠', 'J♦'],
      river: ['9♥', '7♣', '5♠', 'J♦', '2♣']
    },
    publicReads: [
      { text: 'Агрессивный рег', tag: 'aggressive_regular', confidence: 0.8 },
      { text: 'Много 4-бетит', tag: 'frequent_4bet', confidence: 0.7 },
    ],
    opponentMind: { preset: 'AGGRESSIVE_LAG' },
    seed: 1004,
  },

  // ============================================================
  //  FLOP SITUATIONS
  // ============================================================

  CBET_CALLED_TWICE: {
    id: 'CBET_CALLED_TWICE',
    title: 'C-бет заколлирован два раза',
    theme: 'postflop_pressure',
    learningObjectives: [
      'Распознаёт вызовы диапазоны',
      'Понимает доскую адаптацию',
      'Видит блеф-кэтч потенциал'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 48,
      villainStack: 42,
    },
    hero: ['A♣', 'K♦'],
    villainHand: ['J♠', 'T♦'],
    boards: {
      preflop: [],
      flop: ['8♥', '6♣', '4♠'],
      turn: ['8♥', '6♣', '4♠', 'Q♦'],
      river: ['8♥', '6♣', '4♠', 'Q♦', '2♠']
    },
    publicReads: [
      { text: 'Часто коллирует флоп', tag: 'frequent_call', confidence: 0.7 },
      { text: 'Хороший рег', tag: 'solid_tag', confidence: 0.75 },
    ],
    opponentMind: { preset: 'SOLID_TAG' },
    seed: 1005,
  },

  CHECK_RAISE_DRY_BOARD: {
    id: 'CHECK_RAISE_DRY_BOARD',
    title: 'Чек-рейз на сухой доске',
    theme: 'postflop_check_raise',
    learningObjectives: [
      'Распознаёт мотивацию чек-рейза',
      'Понимает доскую динамику',
      'Видит блеф потенциал'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 50,
      villainStack: 40,
    },
    hero: ['T♣', '9♦'],
    villainHand: ['K♠', 'Q♦'],
    boards: {
      preflop: [],
      flop: ['7♠', '5♣', '2♦'],
      turn: ['7♠', '5♣', '2♦', 'K♥'],
      river: ['7♠', '5♣', '2♦', 'K♥', '3♣']
    },
    publicReads: [
      { text: 'Любит чек-рейз', tag: 'check_raise_prone', confidence: 0.75 },
      { text: 'Хороший рег', tag: 'solid_reg', confidence: 0.7 },
    ],
    opponentMind: { preset: 'SOLID_TAG' },
    seed: 1006,
  },

  WET_FLOP_AGGRESSION: {
    id: 'WET_FLOP_AGGRESSION',
    title: 'Мокрый флоп, агрессия оппонента',
    theme: 'postflop_pressure',
    learningObjectives: [
      'Распознаёт доскую текстуру',
      'Понимает EquityRundown',
      'Видит поведение на мокрой доске'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'SB',
      villainPos: 'BB',
      heroStack: 45,
      villainStack: 45,
    },
    hero: ['A♠', 'K♠'],
    villainHand: ['Q♦', 'J♦'],
    boards: {
      preflop: [],
      flop: ['T♣', '9♠', '8♦'],
      turn: ['T♣', '9♠', '8♦', 'Q♠'],
      river: ['T♣', '9♠', '8♦', 'Q♠', '2♥']
    },
    publicReads: [
      { text: 'Агрессивен на мокрых досках', tag: 'wet_board_aggression', confidence: 0.7 },
      { text: 'LAG-рег', tag: 'aggressive_lag', confidence: 0.75 },
    ],
    opponentMind: { preset: 'AGGRESSIVE_LAG' },
    seed: 1007,
  },

  // ============================================================
  //  TURN & RIVER SITUATIONS
  // ============================================================

  SECOND_BARREL_SCARE: {
    id: 'SECOND_BARREL_SCARE',
    title: 'Второй барель после скэрэ карты',
    theme: 'postflop_continuation',
    learningObjectives: [
      'Распознаёт скэрэ карты',
      'Понимает страх оппонента',
      'Видит вынужденный чек'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 50,
      villainStack: 40,
    },
    hero: ['K♣', 'J♦'],
    villainHand: ['9♠', '8♦'],
    boards: {
      preflop: [],
      flop: ['7♥', '6♣', '2♠'],
      turn: ['7♥', '6♣', '2♠', 'A♦'],
      river: ['7♥', '6♣', '2♠', 'A♦', 'K♠']
    },
    publicReads: [
      { text: 'Боится оверкарт', tag: 'overcard_scared', confidence: 0.65 },
      { text: 'Аккуратный рег', tag: 'solid_tag', confidence: 0.7 },
    ],
    opponentMind: { preset: 'SOLID_TAG' },
    seed: 1008,
  },

  RIVER_THIN_VALUE: {
    id: 'RIVER_THIN_VALUE',
    title: 'Ривер - тонкое вэлью',
    theme: 'river_value',
    learningObjectives: [
      'Распознаёт тонкое вэлью',
      'Понимает риск-рейвард',
      'Видит диапазон оппонента'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 48,
      villainStack: 42,
    },
    hero: ['9♣', '9♦'],
    villainHand: ['8♠', '8♥'],
    boards: {
      preflop: [],
      flop: ['J♠', '7♥', '3♦'],
      turn: ['J♠', '7♥', '3♦', '5♣'],
      river: ['J♠', '7♥', '3♦', '5♣', '2♠']
    },
    publicReads: [
      { text: 'Ловит тонкое вэлью', tag: 'thin_value_catcher', confidence: 0.65 },
      { text: 'Хороший рег', tag: 'solid_regular', confidence: 0.7 },
    ],
    opponentMind: { preset: 'SOLID_TAG' },
    seed: 1009,
  },

  RIVER_BLUFF_CATCH: {
    id: 'RIVER_BLUFF_CATCH',
    title: 'Ривер - блеф-кэтч колл',
    theme: 'river_bluff_catch',
    learningObjectives: [
      'Распознаёт блеф потенциал',
      'Понимает мотивацию оппонента',
      'Видит игру на эмоциях'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 45,
      villainStack: 45,
    },
    hero: ['T♠', '9♠'],
    villainHand: ['A♣', 'Q♦'],
    boards: {
      preflop: [],
      flop: ['K♦', 'J♣', '5♠'],
      turn: ['K♦', 'J♣', '5♠', '4♥'],
      river: ['K♦', 'J♣', '5♠', '4♥', '3♦']
    },
    publicReads: [
      { text: 'Часто блефует ривер', tag: 'river_bluff_prone', confidence: 0.7 },
      { text: 'Раздражён', tag: 'tilt_showing', confidence: 0.65 },
    ],
    opponentMind: { preset: 'TILTED_REG' },
    seed: 1010,
  },

  // ============================================================
  //  COMPLEX SITUATIONS
  // ============================================================

  MISSED_DRAW_BLUFF: {
    id: 'MISSED_DRAW_BLUFF',
    title: 'Мисcед дро - блеф на ривере',
    theme: 'river_bluff',
    learningObjectives: [
      'Распознаёт линию блефа',
      'Понимает draw логику',
      'Видит последовательность'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'SB',
      villainPos: 'BB',
      heroStack: 50,
      villainStack: 40,
    },
    hero: ['A♠', 'K♠'],
    villainHand: ['9♥', '8♣'],
    boards: {
      preflop: [],
      flop: ['7♠', '5♠', '2♦'],
      turn: ['7♠', '5♠', '2♦', 'J♣'],
      river: ['7♠', '5♠', '2♦', 'J♣', '4♥']
    },
    publicReads: [
      { text: 'Любит спиливать дро', tag: 'draw_player', confidence: 0.7 },
      { text: 'Уравновешенный рег', tag: 'balanced_player', confidence: 0.65 },
    ],
    opponentMind: { preset: 'AGGRESSIVE_LAG' },
    seed: 1011,
  },

  TRAP_SLOW_PLAY: {
    id: 'TRAP_SLOW_PLAY',
    title: 'Трап - медленный слоуплей сета',
    theme: 'postflop_trap',
    learningObjectives: [
      'Распознаёт слоуплей',
      'Понимает ловушку',
      'Видит сильные руки оппонента'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 45,
      villainStack: 45,
    },
    hero: ['A♦', 'K♦'],
    villainHand: ['J♠', 'J♥'],
    boards: {
      preflop: [],
      flop: ['J♣', 'T♠', '5♦'],
      turn: ['J♣', 'T♠', '5♦', 'K♠'],
      river: ['J♣', 'T♠', '5♦', 'K♠', 'Q♣']
    },
    publicReads: [
      { text: 'Иногда трапит', tag: 'traps_sometimes', confidence: 0.6 },
      { text: 'Сильный рег', tag: 'strong_regular', confidence: 0.75 },
    ],
    opponentMind: { preset: 'STRONG_EXPLOITER' },
    seed: 1012,
  },

  // ============================================================
  //  TOURNAMENT CONTEXT
  // ============================================================

  PKO_ICM_BUBBLE: {
    id: 'PKO_ICM_BUBBLE',
    title: 'PKO - баббл зона, давление',
    theme: 'tournament_bubble',
    learningObjectives: [
      'Распознаёт баббл психологию',
      'Понимает стек давление',
      'Видит рисковые решения'
    ],
    context: {
      gameType: 'PKO',
      tableSize: '6-MAX',
      stage: 'BUBBLE',
      blinds: { sb: 2, bb: 4, ante: 0.4 },
      playerCount: 6,
      heroPos: 'CO',
      villainPos: 'BTN',
      heroStack: 35,
      villainStack: 32,
    },
    hero: ['K♣', 'Q♦'],
    villainHand: ['9♠', '9♥'],
    boards: {
      preflop: [],
      flop: ['A♠', 'T♦', '4♣'],
      turn: ['A♠', 'T♦', '4♣', 'J♠'],
      river: ['A♠', 'T♦', '4♣', 'J♠', '2♦']
    },
    publicReads: [
      { text: 'Нервничает в баббле', tag: 'bubble_nervous', confidence: 0.8 },
      { text: 'Недостаточный рег', tag: 'medium_regular', confidence: 0.65 },
    ],
    opponentMind: { preset: 'TILTED_REG' },
    seed: 1013,
  },

  HERO_FOLD_DECISION: {
    id: 'HERO_FOLD_DECISION',
    title: 'Герой-фолд на ривере',
    theme: 'river_fold',
    learningObjectives: [
      'Распознаёт сигналы для фолда',
      'Понимает блефф-вэлью баланс',
      'Видит мотивацию оппонента'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroStack: 50,
      villainStack: 40,
    },
    hero: ['J♣', 'T♣'],
    villainHand: ['A♠', 'A♥'],
    boards: {
      preflop: [],
      flop: ['K♠', 'Q♦', '5♣'],
      turn: ['K♠', 'Q♦', '5♣', '7♦'],
      river: ['K♠', 'Q♦', '5♣', '7♦', '3♣']
    },
    publicReads: [
      { text: 'Часто ставит сильные руки', tag: 'value_bet_tendency', confidence: 0.75 },
      { text: 'Надёжный рег', tag: 'solid_regular', confidence: 0.8 },
    ],
    opponentMind: { preset: 'SOLID_TAG' },
    seed: 1014,
  },

  DOUBLE_PLAY_RIVER: {
    id: 'DOUBLE_PLAY_RIVER',
    title: 'Дабл-плей баланс на ривере',
    theme: 'river_balance',
    learningObjectives: [
      'Распознаёт баланс вэлью-блеф',
      'Понимает сложные руки',
      'Видит диапазон оппонента'
    ],
    context: {
      gameType: 'MTT',
      tableSize: '6-MAX',
      stage: 'СРЕДНЯЯ СТАДИЯ',
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
      playerCount: 6,
      heroPos: 'SB',
      villainPos: 'BB',
      heroStack: 48,
      villainStack: 42,
    },
    hero: ['Q♣', 'Q♦'],
    villainHand: ['9♠', '9♥'],
    boards: {
      preflop: [],
      flop: ['K♠', 'T♥', '4♦'],
      turn: ['K♠', 'T♥', '4♦', 'Q♠'],
      river: ['K♠', 'T♥', '4♦', 'Q♠', '7♣']
    },
    publicReads: [
      { text: 'Уравновешенный игрок', tag: 'balanced_player', confidence: 0.7 },
      { text: 'Хороший рег', tag: 'solid_regular', confidence: 0.75 },
    ],
    opponentMind: { preset: 'STRONG_EXPLOITER' },
    seed: 1015,
  },
};

// Export
if(typeof module !== 'undefined' && module.exports) {
  module.exports = SCENARIO_LIBRARY;
}
