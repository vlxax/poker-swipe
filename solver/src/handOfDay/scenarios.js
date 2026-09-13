// Hand of the Day — Pre-authored scenarios (8+ quality examples)

export const HAND_OF_DAY_SCENARIOS = [
  // === Scenario 1: Bubble, BTN vs BB short, tight-reg ===
  {
    id: 'hod_001_bubble_btn_bb_short',
    title: 'Баббл с ботта, тайтовый рег в блайнде',

    tournament: {
      format: 'MTT',
      stage: 'BUBBLE',
      playersRemaining: 11,
      paidPlaces: 9,
      label: 'MTT · Баббл'
    },

    blinds: { small: 500, big: 1000, ante: 1000 },

    hero: {
      position: 'BTN',
      stack: 20500,
      stackBb: 20.5,
      cards: ['As', 'Kh']  // revealed after showdown
    },

    villain: {
      position: 'BB',
      stack: 15500,
      stackBb: 15.5,
      archetype: 'tight-reg',
      name: 'Соперник',
      cards: ['3s', 'Q2h']  // revealed after showdown
    },

    board: [],
    pot: 1500,
    startingPot: 1500,

    rootNodeId: 'root',

    nodes: [
      {
        id: 'root',
        type: 'hero-decision',
        street: 'preflop',
        context: {
          history: 'Хайнд офф дилер. Герой поднял.',
          note: 'Тайтовый рег в BB, очень короток. Что делаешь?'
        },
        prompt: 'Герой поднял 2.2 BB с BTN. Тайтовый рег в BB очень короток (15.5 BB). Фолдит ли?',
        actions: [
          { id: 'fold', label: 'ГЕРОЙ ФОЛДИТ', nextNode: 'villain-wins-1' },
          { id: 'call', label: 'ГЕРОЙ РАИЗИТ В 2.2 ББ', nextNode: 'villain-response' }
        ],
        villainDialogue: {
          'tight-reg': 'Опять мой блайнд?',
          'default': 'Снова?'
        }
      },

      {
        id: 'villain-response',
        type: 'villain-action',
        street: 'preflop',
        action: { actor: 'VILLAIN', type: 'call' },
        context: {
          history: 'Villain BB вызывает.',
          note: 'Очень короток, решает коллировать в BB.'
        },
        villainDialogue: {
          'tight-reg': 'Ладно. Посмотрим.',
          'default': 'Я в.'
        },
        nextNode: 'flop-cards'
      },

      {
        id: 'flop-cards',
        type: 'street-reveal',
        street: 'flop',
        board: ['2h', '5c', '9d'],
        context: {
          history: 'Flop: 2♥ 5♣ 9♦',
          note: 'Герой AK, доска сухая.'
        },
        action: { actor: 'VILLAIN', type: 'check' },
        villainDialogue: {
          'tight-reg': 'Быстро проверяет.',
          'default': 'Чек.'
        },
        nextNode: 'flop-hero-decision'
      },

      {
        id: 'flop-hero-decision',
        type: 'hero-decision',
        street: 'flop',
        prompt: 'Villain чекирует на сухой доске. Герой с AK высокой картой. Что сделать?',
        pot: 4400,
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'turn-check-through' },
          { id: 'bet50', label: 'БЕТ ~50%', nextNode: 'flop-villain-fold-1' },
          { id: 'bet75', label: 'БЕТ ~75%', nextNode: 'flop-villain-fold-1' }
        ],
        observation: {
          text: '⚡ Быстро проверил на сухой доске. Часто так с парой двоек.',
          count: 1,
          totalCount: 3,
          types: ['timing', 'behavior']
        }
      },

      {
        id: 'flop-villain-fold-1',
        type: 'villain-action',
        street: 'flop',
        action: { actor: 'VILLAIN', type: 'fold' },
        context: { history: 'Villain BB фолдит на ставку.' },
        villainDialogue: {
          'tight-reg': 'Отдаю.',
          'default': 'Ладно, не жарить.'
        },
        nextNode: 'hero-wins-1'
      },

      {
        id: 'turn-check-through',
        type: 'street-reveal',
        street: 'turn',
        board: ['2h', '5c', '9d', 'Js'],
        context: {
          history: 'Обе стороны чекировали флоп. Turn: J♠',
          note: 'Джек на тёрне. Герой пары нет, но есть two overcards.'
        },
        action: { actor: 'VILLAIN', type: 'check' },
        villainDialogue: {
          'tight-reg': 'Ещё проверяет.',
          'default': 'Чек.'
        },
        nextNode: 'turn-hero-decision'
      },

      {
        id: 'turn-hero-decision',
        type: 'hero-decision',
        street: 'turn',
        prompt: 'Villain ещё раз проверил на Jack. Твои перекарты. Бетить или чекить?',
        pot: 4400,
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'river-cards' },
          { id: 'bet-turn', label: 'БЕТ 2000 (~45%)', nextNode: 'turn-villain-fold' }
        ],
        observation: {
          text: '🔄 Проверил снова на Джеке. Рука очень слаба.',
          count: 2,
          totalCount: 3,
          types: ['line', 'pattern']
        }
      },

      {
        id: 'turn-villain-fold',
        type: 'villain-action',
        street: 'turn',
        action: { actor: 'VILLAIN', type: 'fold' },
        context: { history: 'Villain фолдит на тёрн.' },
        villainDialogue: {
          'tight-reg': 'Слишком много.',
          'default': 'Выхожу.'
        },
        nextNode: 'hero-wins-2'
      },

      {
        id: 'river-cards',
        type: 'street-reveal',
        street: 'river',
        board: ['2h', '5c', '9d', 'Js', 'Qs'],
        context: {
          history: 'Обе стороны чекировали. River: Q♠',
          note: 'Королева на ривере. Герой ничего не собрал.'
        },
        action: { actor: 'VILLAIN', type: 'check' },
        villainDialogue: {
          'tight-reg': 'Снова чек.',
          'default': 'Давай вскроем.'
        },
        nextNode: 'river-hero-decision'
      },

      {
        id: 'river-hero-decision',
        type: 'hero-decision',
        street: 'river',
        prompt: 'Villain три раза проверил. Герой пока ничего не собрал. Последняя улица. Блефить?',
        pot: 4400,
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'showdown-check' },
          { id: 'bluff-bet', label: 'БЕТ 2500 (БЛЕФ)', nextNode: 'river-villain-call-or-fold' }
        ],
        observation: {
          text: '🌊 На ривере проверил. Раньше видела её со слабыми пассивной игрой.',
          count: 3,
          totalCount: 3,
          types: ['street', 'pattern']
        }
      },

      {
        id: 'river-villain-call-or-fold',
        type: 'villain-action',
        street: 'river',
        action: { actor: 'VILLAIN', type: 'fold' },
        context: { history: 'Villain фолдит на ривер-блеф.' },
        villainDialogue: {
          'tight-reg': 'Забирай. В этот раз.',
          'default': 'Отдаю.'
        },
        nextNode: 'hero-wins-3'
      },

      {
        id: 'showdown-check',
        type: 'showdown',
        board: ['2h', '5c', '9d', 'Js', 'Qs'],
        villainCards: ['3s', 'Q2h'],
        villainLine: 'Защитился в BB, но ничего не собрал. Пассивно играл.',
        nextNode: 'read-screen'
      },

      {
        id: 'hero-wins-1',
        type: 'showdown',
        board: ['2h', '5c', '9d'],
        villainCards: ['3s', 'Q2h'],
        villainLine: 'Герой забрал на флопе.',
        nextNode: 'read-screen'
      },

      {
        id: 'hero-wins-2',
        type: 'showdown',
        board: ['2h', '5c', '9d', 'Js'],
        villainCards: ['3s', 'Q2h'],
        villainLine: 'Герой забрал на тёрне.',
        nextNode: 'read-screen'
      },

      {
        id: 'hero-wins-3',
        type: 'showdown',
        board: ['2h', '5c', '9d', 'Js', 'Qs'],
        villainCards: ['3s', 'Q2h'],
        villainLine: 'Герой забрал на ривере.',
        nextNode: 'read-screen'
      },

      {
        id: 'villain-wins-1',
        type: 'showdown',
        board: ['2h', '5c', '9d'],
        villainCards: ['3s', 'Q2h'],
        villainLine: 'Герой фолдит. Блайнд выигрывает.',
        nextNode: 'read-screen'
      },

      {
        id: 'read-screen',
        type: 'read-question',
        prompt: 'КАК ТЫ ЕГО ПРОЧИТАЛА?',
        subtitle: 'Выбери, что означала его линия.',
        nextNode: 'reveal'
      },

      {
        id: 'reveal',
        type: 'reveal',
        explanation: 'Она защищала BB слабо и пассивно. Парой двоек она бы давила агрессивнее. Это была попытка украсть, которая не прошла.'
      }
    ],

    reveal: {
      villainCards: ['3s', 'Q2h'],
      hand: 'Queen-deuce offsuit',
      correctReadId: 'bb-defense',
      explanation: 'Она защитила BB слабую руку (Q♠2♥) и играла очень пассивно. Это типично для тайтовых регов на короткой стопке в BB — защита диапазона, но не комплит-рука.',
      keyTakeaway: 'Тайтовые регов на коротких стопках защищают BB слабее и пассивнее. На сухих бордах можно давить.'
    },

    metadata: {
      difficulty: 2,
      concepts: ['bb-defense', 'bubble-play', 'short-stack'],
      author: 'coach',
      createdAt: '2024-01-15'
    }
  },

  // === Scenario 2: Flop bluff catch ===
  {
    id: 'hod_002_flop_bluff_catch_lag',
    title: 'Флоп блеф-кэтч против LAG',

    tournament: {
      format: 'MTT',
      stage: 'MIDDLE',
      playersRemaining: 47,
      paidPlaces: 27,
      label: 'MTT · Средняя'
    },

    blinds: { small: 400, big: 800, ante: 100 },

    hero: {
      position: 'CO',
      stack: 35000,
      stackBb: 43.75,
      cards: ['Jh', '9h']
    },

    villain: {
      position: 'BTN',
      stack: 45000,
      stackBb: 56.25,
      archetype: 'lag',
      name: 'Агрессор',
      cards: ['7d', '4c']  // pure air
    },

    board: [],
    pot: 1300,

    rootNodeId: 'root2',
    nodes: [
      {
        id: 'root2',
        type: 'hero-decision',
        street: 'preflop',
        context: {
          history: 'Герой на CO поднял 2x. LAG на BTN переставил в 5.5x.',
          note: 'LAG агрессивен, частая 3-бетка. Что делать с J9 suited?'
        },
        prompt: 'LAG переставил в 5.5x. Герой с J9 suited на CO. Коллировать?',
        actions: [
          { id: 'call', label: 'КОЛЛ', nextNode: 'flop-lag-aggr' },
          { id: 'fold', label: 'ФОЛД', nextNode: 'villain-wins-lag' }
        ],
        villainDialogue: {
          'lag': 'Хм, посмотрим что-то интересное.',
          'default': 'Я жду твоего хода.'
        }
      },

      {
        id: 'flop-lag-aggr',
        type: 'street-reveal',
        street: 'flop',
        board: ['Qh', '8c', '3d'],
        context: {
          history: 'LAG поставил 3500 на флоп.',
          note: 'Герой ловит оверкарту и два проходящих карта.'
        },
        action: { actor: 'VILLAIN', type: 'bet', size: 3500 },
        villainDialogue: {
          'lag': 'Ставлю.',
          'default': 'Бет.'
        },
        nextNode: 'flop-hero-vs-lag'
      },

      {
        id: 'flop-hero-vs-lag',
        type: 'hero-decision',
        street: 'flop',
        prompt: 'LAG ставит 3500 на Q♥8♣3♦. Герой J9♥ с two-pair outs и two overs. Кол или рейз?',
        pot: 7300,
        actions: [
          { id: 'fold', label: 'ФОЛД', nextNode: 'villain-wins-lag-flop' },
          { id: 'call', label: 'КОЛЛ', nextNode: 'turn-lag-check' },
          { id: 'raise', label: 'РЕЙЗ 8500', nextNode: 'lag-folds-preemptive' }
        ],
        observation: {
          text: '⚡ Быстро ставит флоп, даже без тройника. Может быть чистый air.',
          count: 1,
          totalCount: 2,
          types: ['timing', 'behavior']
        }
      },

      {
        id: 'lag-folds-preemptive',
        type: 'villain-action',
        action: { actor: 'VILLAIN', type: 'fold' },
        villainDialogue: {
          'lag': 'Ладно, не жарить.',
          'default': 'Okay, you got me.'
        },
        nextNode: 'hero-wins-lag1'
      },

      {
        id: 'turn-lag-check',
        type: 'street-reveal',
        street: 'turn',
        board: ['Qh', '8c', '3d', 'Kh'],
        context: {
          history: 'Герой коллирует. Turn K♥.',
          note: 'Король сердец. Герой теперь в два проходящих карта (с перехватом).'
        },
        action: { actor: 'VILLAIN', type: 'check' },
        villainDialogue: {
          'lag': 'Хм, чек.',
          'default': 'Чек.'
        },
        nextNode: 'turn-lag-decision'
      },

      {
        id: 'turn-lag-decision',
        type: 'hero-decision',
        street: 'turn',
        prompt: 'LAG проверил тёрн. Герой пока ничего не собрал, но хорошие ауты. Бетить?',
        pot: 14100,
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'river-lag-blank' },
          { id: 'bet', label: 'БЕТ 5000', nextNode: 'lag-fold-turn' }
        ],
        observation: {
          text: '🔄 Проверил на Кинге. Его рука очень слаба или он переводит.',
          count: 2,
          totalCount: 2,
          types: ['line', 'pattern']
        }
      },

      {
        id: 'lag-fold-turn',
        type: 'villain-action',
        action: { actor: 'VILLAIN', type: 'fold' },
        villainDialogue: {
          'lag': 'Слишком много.',
          'default': 'Выхожу.'
        },
        nextNode: 'hero-wins-lag2'
      },

      {
        id: 'river-lag-blank',
        type: 'street-reveal',
        street: 'river',
        board: ['Qh', '8c', '3d', 'Kh', '2s'],
        action: { actor: 'VILLAIN', type: 'check' },
        villainDialogue: {
          'lag': 'Ещё проверяет.',
          'default': 'Чек.'
        },
        nextNode: 'river-lag-decision'
      },

      {
        id: 'river-lag-decision',
        type: 'hero-decision',
        street: 'river',
        prompt: 'LAG три раза проверил. Герой пока блеф-кэтч. Бетить?',
        actions: [
          { id: 'check', label: 'ЧЕК', nextNode: 'showdown-lag-check' },
          { id: 'bet', label: 'БЕТ 4000', nextNode: 'lag-fold-river' }
        ],
        pot: 19100
      },

      {
        id: 'lag-fold-river',
        type: 'villain-action',
        action: { actor: 'VILLAIN', type: 'fold' },
        villainDialogue: {
          'lag': 'Вы выиграли.',
          'default': 'Ладно.'
        },
        nextNode: 'hero-wins-lag3'
      },

      {
        id: 'showdown-lag-check',
        type: 'showdown',
        board: ['Qh', '8c', '3d', 'Kh', '2s'],
        villainCards: ['7d', '4c'],
        villainLine: 'LAG дважды попробовал украсть с полным воздухом.',
        nextNode: 'read-lag'
      },

      {
        id: 'hero-wins-lag1',
        type: 'showdown',
        board: ['Qh', '8c', '3d'],
        villainCards: ['7d', '4c'],
        villainLine: 'LAG собирал на флопе, но герой рейзнул.',
        nextNode: 'read-lag'
      },

      {
        id: 'hero-wins-lag2',
        type: 'showdown',
        board: ['Qh', '8c', '3d', 'Kh'],
        villainCards: ['7d', '4c'],
        villainLine: 'LAG сдал на тёрне.',
        nextNode: 'read-lag'
      },

      {
        id: 'hero-wins-lag3',
        type: 'showdown',
        board: ['Qh', '8c', '3d', 'Kh', '2s'],
        villainCards: ['7d', '4c'],
        villainLine: 'LAG сдал на ривере.',
        nextNode: 'read-lag'
      },

      {
        id: 'villain-wins-lag',
        type: 'showdown',
        board: ['Qh', '8c', '3d'],
        villainCards: ['7d', '4c'],
        villainLine: 'Герой фолдит на флопе. LAG забирает.',
        nextNode: 'read-lag'
      },

      {
        id: 'villain-wins-lag-flop',
        type: 'showdown',
        board: ['Qh', '8c', '3d'],
        villainCards: ['7d', '4c'],
        villainLine: 'Герой фолдит блеф-кэтч.',
        nextNode: 'read-lag'
      },

      {
        id: 'read-lag',
        type: 'read-question',
        nextNode: 'reveal-lag'
      },

      {
        id: 'reveal-lag',
        type: 'reveal',
        explanation: 'LAG собирал два раза с чистым воздухом (семь-четвёрка). Это типично для лузового агрессора — он пытался украсть несколько раз.'
      }
    ],

    reveal: {
      villainCards: ['7d', '4c'],
      hand: 'Seven-four offsuit',
      correctReadId: 'missed-bluff',
      explanation: 'LAG попробовал украсть два раза, но встретил сопротивление. 7-4 это самая худшая рука в покере, он не мог выиграть showdown.',
      keyTakeaway: 'LAG любит давить и блефовать. Когда встречаешь сопротивление, часто это означает, что он попал на плохую комбинацию.'
    },

    metadata: {
      difficulty: 3,
      concepts: ['bluff-catch', 'lag-play', 'multi-street'],
      author: 'coach',
      createdAt: '2024-01-15'
    }
  }

  // ... 6 more scenarios will be added in continuation
];

export function getScenarioById(id) {
  return HAND_OF_DAY_SCENARIOS.find((s) => s.id === id);
}

export function getAllScenarios() {
  return [...HAND_OF_DAY_SCENARIOS];
}

export function getScenarioCount() {
  return HAND_OF_DAY_SCENARIOS.length;
}
