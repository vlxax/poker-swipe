// Hand of the Day — Expanded scenario library (40+ scenarios)
// Comprehensive coverage: RFI, 3bet, c-bet, bluff catch, value, pushes, thin value, etc.

import { HAND_OF_DAY_SCENARIOS } from './scenarios.js';
import { HAND_OF_DAY_SCENARIOS_BATCH2 } from './scenariosExpanded2.js';

export const HAND_OF_DAY_SCENARIOS_EXPANDED = [
  // === SECTION 1: RFI (Raise First In) ===

  {
    id: 'hod_003_rfi_co_10bb',
    title: 'РФИ с СО, 10 ББ, тайтовые регулярно',
    difficulty: 'intermediate',
    topic: 'rfi',

    tournament: {
      format: 'MTT',
      stage: 'MIDDLE',
      playersRemaining: 47,
      paidPlaces: 27,
      label: 'MTT · Средина'
    },

    blinds: { small: 150, big: 300, ante: 50 },

    hero: {
      position: 'CO',
      stack: 3000,
      stackBb: 10,
      cards: ['Qs', 'Jd']
    },

    villain: {
      position: 'BB',
      stack: 5000,
      stackBb: 16.67,
      archetype: 'tight-reg',
      cards: ['9s', '3h']
    },

    board: [],
    pot: 500,
    startingPot: 500,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: {
          history: 'Игра 2+1 к рейзу СО.',
          note: 'Только ты, ТЭГ в BB. Шорт стек.'
        },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-end' },
          { id: 'raise2.5', label: 'РЕЙЗ 2.5x', nextNode: 'villain-response' },
          { id: 'raise3', label: 'РЕЙЗ 3x', nextNode: 'villain-response-3x' }
        ]
      },
      {
        id: 'villain-response',
        type: 'villain-action',
        street: 'preflop',
        villainDialogue: { 'tight-reg': 'Вызываю.' },
        nextNode: 'flop-cards-003'
      },
      {
        id: 'villain-response-3x',
        type: 'villain-action',
        street: 'preflop',
        villainDialogue: { 'tight-reg': 'Слишком много. Фолд.' },
        nextNode: 'hero-wins-pot'
      },
      {
        id: 'flop-cards-003',
        type: 'street-reveal',
        street: 'flop',
        board: ['Kh', 'Ts', '6c'],
        context: { board: ['Kh', 'Ts', '6c'], note: 'Сухая доска.' },
        nextNode: 'flop-decision-003'
      },
      {
        id: 'flop-decision-003',
        type: 'hero-decision',
        street: 'flop',
        observation: {
          text: '💬 Тайтовый рег часто защищается с Кингом. Может быть и вэлью, и блеф.',
          count: 1,
          totalCount: 2
        },
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'river-cards-003' },
          { id: 'bet50', label: 'БЕТ 50%', nextNode: 'showdown-003' }
        ]
      },
      { id: 'river-cards-003', type: 'street-reveal', street: 'river', board: ['Kh', 'Ts', '6c', '2d', '5h'], nextNode: 'showdown-003' },
      { id: 'showdown-003', type: 'reveal', board: ['Kh', 'Ts', '6c', '2d', '5h'], nextNode: 'read-003' },
      { id: 'read-003', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-end', type: 'complete' },
      { id: 'hero-wins-pot', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  },

  {
    id: 'hod_004_rfi_btn_20bb_aggressive',
    title: 'РФИ с баттона, 20 ББ, лузовый агр',
    difficulty: 'intermediate',
    topic: 'rfi',

    tournament: {
      format: 'MTT',
      stage: 'LATE',
      playersRemaining: 23,
      paidPlaces: 18,
      label: 'MTT · Позднее'
    },

    blinds: { small: 250, big: 500, ante: 100 },

    hero: {
      position: 'BTN',
      stack: 10000,
      stackBb: 20,
      cards: ['Kh', '9h']
    },

    villain: {
      position: 'BB',
      stack: 15000,
      stackBb: 30,
      archetype: 'lag',
      cards: ['3s', '7c']
    },

    board: [],
    pot: 800,
    startingPot: 800,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: { history: 'Брод рейз с баттона. ЛАГ в BB.' },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-end' },
          { id: 'raise2.5', label: 'РЕЙЗ 2.5x', nextNode: 'villain-response' }
        ]
      },
      {
        id: 'villain-response',
        type: 'villain-action',
        street: 'preflop',
        action: { type: '3bet' },
        villainDialogue: { 'lag': 'Рейз! 3x.' },
        nextNode: 'decision-3bet-004'
      },
      {
        id: 'decision-3bet-004',
        type: 'hero-decision',
        street: 'preflop',
        observation: {
          text: '🔴 ЛАГ рейзит часто. Может быть 25% рук.',
          count: 1,
          totalCount: 1
        },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-to-3bet' },
          { id: 'call', label: 'КОЛЛ', nextNode: 'flop-3bet-004' }
        ]
      },
      {
        id: 'flop-3bet-004',
        type: 'street-reveal',
        street: 'flop',
        board: ['As', '9s', '6d'],
        nextNode: 'showdown-3bet-004'
      },
      { id: 'showdown-3bet-004', type: 'reveal', board: ['As', '9s', '6d', '2h', 'Kc'], nextNode: 'read-3bet-004' },
      { id: 'read-3bet-004', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-end', type: 'complete' },
      { id: 'fold-to-3bet', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  },

  // === SECTION 2: BB Defense ===

  {
    id: 'hod_005_bb_defense_40bb_lag_button',
    title: 'Защита BB, 40 ББ, ЛАГ с баттона',
    difficulty: 'intermediate',
    topic: 'bb_defense',

    tournament: {
      format: 'MTT',
      stage: 'MIDDLE',
      playersRemaining: 51,
      paidPlaces: 30,
      label: 'MTT · Средина'
    },

    blinds: { small: 100, big: 200, ante: 25 },

    hero: {
      position: 'BB',
      stack: 8000,
      stackBb: 40,
      cards: ['Jc', 'Ts']
    },

    villain: {
      position: 'BTN',
      stack: 6000,
      stackBb: 30,
      archetype: 'lag',
      cards: ['8h', '3d']
    },

    board: [],
    pot: 300,
    startingPot: 300,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: { history: 'БТН рейз 2.2x. До тебя BB.' },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-end' },
          { id: 'call', label: 'КОЛЛ', nextNode: 'flop-cards-005' },
          { id: '3bet', label: '3БЕТ 2.5x', nextNode: '3bet-response' }
        ]
      },
      {
        id: '3bet-response',
        type: 'villain-action',
        street: 'preflop',
        action: { type: 'fold' },
        villainDialogue: { 'lag': 'Слишком сильно. Фолд.' },
        nextNode: 'hero-wins-3bet'
      },
      {
        id: 'flop-cards-005',
        type: 'street-reveal',
        street: 'flop',
        board: ['9d', '8d', '3c'],
        nextNode: 'flop-decision-005'
      },
      {
        id: 'flop-decision-005',
        type: 'hero-decision',
        street: 'flop',
        observation: {
          text: '🎯 ЛАГ на баттоне часто продолжает рейз с вилдом. Проверь его реакцию.',
          count: 1,
          totalCount: 2
        },
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'turn-cards-005' },
          { id: 'bet50', label: 'БЕТ 50% банка', nextNode: 'showdown-005' }
        ]
      },
      { id: 'turn-cards-005', type: 'street-reveal', street: 'turn', board: ['9d', '8d', '3c', '6h'], nextNode: 'showdown-005' },
      { id: 'showdown-005', type: 'reveal', board: ['9d', '8d', '3c', '6h', '4s'], nextNode: 'read-005' },
      { id: 'read-005', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-end', type: 'complete' },
      { id: 'hero-wins-3bet', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  },

  // === SECTION 3: SB vs BB ===

  {
    id: 'hod_006_sb_vs_bb_15bb_tight',
    title: 'SB vs BB, 15 ББ шорт, тайтовый BB',
    difficulty: 'easy',
    topic: 'sb_vs_bb',

    tournament: {
      format: 'MTT',
      stage: 'BUBBLE',
      playersRemaining: 12,
      paidPlaces: 9,
      label: 'MTT · Баббл'
    },

    blinds: { small: 200, big: 400, ante: 50 },

    hero: {
      position: 'SB',
      stack: 2250,
      stackBb: 5.625,
      cards: ['Ah', '3d']
    },

    villain: {
      position: 'BB',
      stack: 8000,
      stackBb: 20,
      archetype: 'tight-reg',
      cards: ['Ks', 'Qh']
    },

    board: [],
    pot: 600,
    startingPot: 600,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: { history: 'Баббл. Ты в SB очень шорт (5.6 ББ).' },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-end' },
          { id: 'allin', label: 'ОЛЛ-ИН', nextNode: 'villain-decision-006' }
        ]
      },
      {
        id: 'villain-decision-006',
        type: 'villain-action',
        street: 'preflop',
        action: { type: 'call' },
        villainDialogue: { 'tight-reg': 'Вызываю пуш.' },
        nextNode: 'showdown-006'
      },
      { id: 'showdown-006', type: 'reveal', board: ['As', '9h', '8s', '2d', 'Tc'], nextNode: 'read-006' },
      { id: 'read-006', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-end', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  },

  // === SECTION 4: 3-Bet Pots ===

  {
    id: 'hod_007_3bet_pot_35bb_co_bb',
    title: '3бет пот, 35 ББ, СО+BB',
    difficulty: 'advanced',
    topic: '3bet_pot',

    tournament: {
      format: 'MTT',
      stage: 'MIDDLE',
      playersRemaining: 48,
      paidPlaces: 27,
      label: 'MTT · Средина'
    },

    blinds: { small: 150, big: 300, ante: 40 },

    hero: {
      position: 'CO',
      stack: 10500,
      stackBb: 35,
      cards: ['As', 'Qs']
    },

    villain: {
      position: 'BB',
      stack: 7200,
      stackBb: 24,
      archetype: 'tag',
      cards: ['Kh', 'Jc']
    },

    board: [],
    pot: 1320,
    startingPot: 1320,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: { history: 'Ты рейзил с СО. TAG 3бетил из BB. Флоп.' },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-end' },
          { id: 'call', label: 'КОЛЛ', nextNode: 'flop-cards-007' },
          { id: '4bet', label: '4БЕТ 2.5x', nextNode: '4bet-response' }
        ]
      },
      {
        id: '4bet-response',
        type: 'villain-action',
        street: 'preflop',
        action: { type: 'fold' },
        villainDialogue: { 'tag': 'Слишком агрессивно. Фолд.' },
        nextNode: 'hero-wins-4bet'
      },
      {
        id: 'flop-cards-007',
        type: 'street-reveal',
        street: 'flop',
        board: ['Ah', '9c', '5d'],
        nextNode: 'flop-decision-007'
      },
      {
        id: 'flop-decision-007',
        type: 'hero-decision',
        street: 'flop',
        observation: {
          text: '💎 У тебя топ-пара. TAG диапазон часто содержит T+ и AX.',
          count: 1,
          totalCount: 2
        },
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'showdown-007' },
          { id: 'bet60', label: 'БЕТ 60%', nextNode: 'showdown-007' }
        ]
      },
      { id: 'showdown-007', type: 'reveal', board: ['Ah', '9c', '5d', '3h', '7s'], nextNode: 'read-007' },
      { id: 'read-007', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-end', type: 'complete' },
      { id: 'hero-wins-4bet', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  },

  // === SECTION 5: C-Bet ===

  {
    id: 'hod_008_cbet_flop_40bb_mp_bb',
    title: 'СБет на флопе, 40 ББ, МП+BB',
    difficulty: 'intermediate',
    topic: 'cbet',

    tournament: {
      format: 'MTT',
      stage: 'MIDDLE',
      playersRemaining: 46,
      paidPlaces: 27,
      label: 'MTT · Средина'
    },

    blinds: { small: 120, big: 240, ante: 30 },

    hero: {
      position: 'MP',
      stack: 9600,
      stackBb: 40,
      cards: ['Kd', 'Qs']
    },

    villain: {
      position: 'BB',
      stack: 5400,
      stackBb: 22.5,
      archetype: 'calling-station',
      cards: ['8s', '7h']
    },

    board: [],
    pot: 600,
    startingPot: 600,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: { history: 'Ты рейзил МП. BB вызвал (коллер).' },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-end' },
          { id: 'continue', label: 'ПРОДОЛЖИТЬ', nextNode: 'flop-cards-008' }
        ]
      },
      {
        id: 'flop-cards-008',
        type: 'street-reveal',
        street: 'flop',
        board: ['Kh', 'Th', '4c'],
        nextNode: 'flop-decision-008'
      },
      {
        id: 'flop-decision-008',
        type: 'hero-decision',
        street: 'flop',
        observation: {
          text: '🎯 Флоп сухой, но в BB диапазон много K-блокеров.',
          count: 1,
          totalCount: 2
        },
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'turn-cards-008' },
          { id: 'bet50', label: 'БЕТ 50%', nextNode: 'turn-response-008' }
        ]
      },
      {
        id: 'turn-response-008',
        type: 'villain-action',
        street: 'turn',
        action: { type: 'call' },
        villainDialogue: { 'calling-station': 'Вызываю.' },
        nextNode: 'turn-cards-008'
      },
      {
        id: 'turn-cards-008',
        type: 'street-reveal',
        street: 'turn',
        board: ['Kh', 'Th', '4c', '9d'],
        nextNode: 'turn-decision-008'
      },
      {
        id: 'turn-decision-008',
        type: 'hero-decision',
        street: 'turn',
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'river-cards-008' },
          { id: 'bet75', label: 'БЕТ 75%', nextNode: 'showdown-008' }
        ]
      },
      { id: 'river-cards-008', type: 'street-reveal', street: 'river', board: ['Kh', 'Th', '4c', '9d', '2s'], nextNode: 'showdown-008' },
      { id: 'showdown-008', type: 'reveal', board: ['Kh', 'Th', '4c', '9d', '2s'], nextNode: 'read-008' },
      { id: 'read-008', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-end', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  },

  // === SECTION 6: Bluff Catch ===

  {
    id: 'hod_009_bluff_catch_river_25bb',
    title: 'Поймать блеф на риве, 25 ББ',
    difficulty: 'advanced',
    topic: 'bluff_catch',

    tournament: {
      format: 'MTT',
      stage: 'LATE',
      playersRemaining: 24,
      paidPlaces: 18,
      label: 'MTT · Позднее'
    },

    blinds: { small: 200, big: 400, ante: 50 },

    hero: {
      position: 'BTN',
      stack: 10000,
      stackBb: 25,
      cards: ['Ts', 'Js']
    },

    villain: {
      position: 'BB',
      stack: 8000,
      stackBb: 20,
      archetype: 'lag',
      cards: ['7s', '3c']
    },

    board: [],
    pot: 1000,
    startingPot: 1000,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: { history: 'Ты рейзил. ЛАГ в BB коллировал.' },
        actions: [
          { id: 'continue', label: 'ПРОДОЛЖИТЬ', nextNode: 'flop-cards-009' }
        ]
      },
      {
        id: 'flop-cards-009',
        type: 'street-reveal',
        street: 'flop',
        board: ['Kd', '8h', '2c'],
        nextNode: 'flop-decision-009'
      },
      {
        id: 'flop-decision-009',
        type: 'hero-decision',
        street: 'flop',
        actions: [
          { id: 'bet50', label: 'БЕТ 50%', nextNode: 'turn-cards-009' }
        ]
      },
      {
        id: 'turn-cards-009',
        type: 'street-reveal',
        street: 'turn',
        board: ['Kd', '8h', '2c', '9s'],
        nextNode: 'turn-decision-009'
      },
      {
        id: 'turn-decision-009',
        type: 'hero-decision',
        street: 'turn',
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'river-cards-009' }
        ]
      },
      {
        id: 'river-cards-009',
        type: 'street-reveal',
        street: 'river',
        board: ['Kd', '8h', '2c', '9s', '6h'],
        nextNode: 'river-decision-009'
      },
      {
        id: 'river-decision-009',
        type: 'hero-decision',
        street: 'river',
        observation: {
          text: '🔴 ЛАГ агрессивен. В его диапазоне много драев и блефов.',
          count: 1,
          totalCount: 1
        },
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'villain-river-decision' },
          { id: 'bet75', label: 'БЕТ 75%', nextNode: 'showdown-009' }
        ]
      },
      {
        id: 'villain-river-decision',
        type: 'villain-action',
        street: 'river',
        action: { type: 'bet' },
        villainDialogue: { 'lag': 'БЕТ - БЛЕФ?' },
        nextNode: 'river-call-009'
      },
      {
        id: 'river-call-009',
        type: 'hero-decision',
        street: 'river',
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-river' },
          { id: 'call', label: 'КОЛЛ - ПОЙМАТЬ БЛЕФ', nextNode: 'showdown-009' }
        ]
      },
      { id: 'showdown-009', type: 'reveal', board: ['Kd', '8h', '2c', '9s', '6h'], nextNode: 'read-009' },
      { id: 'read-009', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-river', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  },

  // === SECTION 7: Short Stack / Push-Fold ===

  {
    id: 'hod_010_push_fold_8bb_utg',
    title: 'Пуш-фолд с UTG, 8 ББ, баббл',
    difficulty: 'easy',
    topic: 'push_fold',

    tournament: {
      format: 'MTT',
      stage: 'BUBBLE',
      playersRemaining: 10,
      paidPlaces: 9,
      label: 'MTT · Баббл'
    },

    blinds: { small: 200, big: 400, ante: 50 },

    hero: {
      position: 'UTG',
      stack: 3200,
      stackBb: 8,
      cards: ['Ah', 'Kd']
    },

    villain: {
      position: 'BB',
      stack: 12000,
      stackBb: 30,
      archetype: 'tag',
      cards: ['Ts', 'Qh']
    },

    board: [],
    pot: 600,
    startingPot: 600,
    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: { history: 'Баббл. Ты шорт (8 ББ). АК в UTG.' },
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'fold-end' },
          { id: 'allin', label: 'ОЛЛ-ИН', nextNode: 'villain-decision-010' }
        ]
      },
      {
        id: 'villain-decision-010',
        type: 'villain-action',
        street: 'preflop',
        action: { type: 'call' },
        villainDialogue: { 'tag': 'Вызываю с этим диапазоном.' },
        nextNode: 'showdown-010'
      },
      { id: 'showdown-010', type: 'reveal', board: ['9s', '8h', '4d', '2c', 'Jh'], nextNode: 'read-010' },
      { id: 'read-010', type: 'read-question', nextNode: 'complete' },
      { id: 'fold-end', type: 'complete' },
      { id: 'complete', type: 'complete' }
    ]
  }
];

// Export combined scenario library
export function getScenarioById(scenarioId) {
  const allScenarios = [...HAND_OF_DAY_SCENARIOS_EXPANDED, ...HAND_OF_DAY_SCENARIOS_BATCH2, ...HAND_OF_DAY_SCENARIOS];
  return allScenarios.find(s => s.id === scenarioId);
}

export function getAllScenarios() {
  return [...HAND_OF_DAY_SCENARIOS_EXPANDED, ...HAND_OF_DAY_SCENARIOS_BATCH2, ...HAND_OF_DAY_SCENARIOS];
}

export function getScenarioCount() {
  return HAND_OF_DAY_SCENARIOS_EXPANDED.length + HAND_OF_DAY_SCENARIOS_BATCH2.length + HAND_OF_DAY_SCENARIOS.length;
}
