// Villain personality & archetype system for dialogue and behavioral traits

export const VILLAIN_ARCHETYPES = {
  'tight-reg': {
    label: 'Плотный рег',
    traitLabel: 'Слабо защищает блайнды, редко блефует',
    dialogueTraits: ['осторожный', 'короткий', 'расчётливый'],
    sampleDialogue: [
      'Опять?',
      'Хорошо, посмотрим.',
      'Нужно жариться в нужный момент.',
      'Это серьёзно?',
      'У тебя есть рука здесь?'
    ]
  },

  'tag': {
    label: 'TAG (Tight-Aggressive)',
    traitLabel: 'Сбалансирован, ставит с диапазоном',
    dialogueTraits: ['уверенный', 'стратегический', 'логичный'],
    sampleDialogue: [
      'Интересно.',
      'Посмотрим, что ты тут творишь.',
      'Может быть.',
      'Вэлью или блеф?',
      'Твоя ставка. Моя раздача.'
    ]
  },

  'lag': {
    label: 'LAG (Loose-Aggressive)',
    traitLabel: 'Агрессивен, любит рейзить, может перемешивать',
    dialogueTraits: ['провокативный', 'рискующий', 'активный'],
    sampleDialogue: [
      'Давай играть!',
      'Ну ладно, я готов.',
      'Это меня не пугает.',
      'Ты против не того соперника.',
      'Посмотрим, на что ты способна.'
    ]
  },

  'calling-station': {
    label: 'Calling Station',
    traitLabel: 'Часто колирует, редко фолдит',
    dialogueTraits: ['пассивный', 'любопытный', 'доверчивый'],
    sampleDialogue: [
      'Посмотрю.',
      'Может быть, там что-то есть.',
      'Я коллю.',
      'Давай вскроем.',
      'Не поверю без вскрытия.'
    ]
  },

  'passive': {
    label: 'Пассивный',
    traitLabel: 'Чекирует и фолдит чек-рейзы, редко ставит первым',
    dialogueTraits: ['осторожный', 'медлительный', 'оборонительный'],
    sampleDialogue: [
      'Проверю.',
      'Твой ход.',
      'Это много.',
      'Отдаю.',
      'Не знаю, что здесь происходит.'
    ]
  },

  'aggressive-reg': {
    label: 'Агрессивный рег',
    traitLabel: 'Часто стави и рейзит, давит с диапазоном',
    dialogueTraits: ['напористый', 'уверенный', 'доминирующий'],
    sampleDialogue: [
      'Ставлю.',
      'Твоя очередь.',
      'Это игра, не? Давай.',
      'Не уверена в своей руке?',
      'Ты слишком пассивна.'
    ]
  },

  'overfolder': {
    label: 'Овер-фолдер',
    traitLabel: 'Слишком много фолдит, легко давить',
    dialogueTraits: ['боязливый', 'нерешительный', 'осторожный'],
    sampleDialogue: [
      'Это выглядит сильно.',
      'Я не уверен.',
      'Может, отдать?',
      'У тебя почти всегда есть.',
      'Я выхожу.'
    ]
  },

  'overcaller': {
    label: 'Овер-коллер',
    traitLabel: 'Редко фолдит, нужна очень сильная ставка',
    dialogueTraits: ['упрямый', 'любопытный', 'стойкий'],
    sampleDialogue: [
      'Не пройдёшь.',
      'Я вижу тебя.',
      'Коллю всё.',
      'Много ставишь, но я остаюсь.',
      'Давай вскроем.'
    ]
  },

  'high-3bet': {
    label: 'High 3-bet',
    traitLabel: 'Часто 3-бетит, может быть агрессивно',
    dialogueTraits: ['уверенный', 'боевой', 'стратегический'],
    sampleDialogue: [
      'Три раза.',
      'Полу-блеф, может быть.',
      'Я жду такое.',
      'Попробуй меня запугать.',
      'Вэлью или воздух?'
    ]
  },

  'river-underbluffer': {
    label: 'River Under-bluffer',
    traitLabel: 'На ривере часто чекирует даже со слабыми, редко блефует',
    dialogueTraits: ['пассивный', 'нервный', 'нерешительный'],
    sampleDialogue: [
      'Проверю.',
      'Уж больно много вэлью.',
      'Не рискну блефовать здесь.',
      'Твоё решение.',
      'Может, ты выигрываешь?'
    ]
  },

  'regular': {
    label: 'Обычный рег',
    traitLabel: 'Сбалансирован, непредсказуем',
    dialogueTraits: ['спокойный', 'расчётливый', 'адаптивный'],
    sampleDialogue: [
      'Ладно.',
      'Посмотрим.',
      'Интересно.',
      'Ты решаешь.',
      'Давай играть.'
    ]
  }
};

// Get dialogue for villain based on archetype and situation
export function getVillainDialogue(archetype, situation) {
  const arch = VILLAIN_ARCHETYPES[archetype] || VILLAIN_ARCHETYPES.regular;

  // Situation-specific dialogue
  const dialogueMap = {
    'preflop-challenge': arch.sampleDialogue[0] || 'Ладно.',
    'raises-you': arch.sampleDialogue[1] || 'Посмотрим.',
    'large-bet': arch.sampleDialogue[2] || 'Это много.',
    'all-in': arch.sampleDialogue[3] || 'Серьёзно?',
    'river-bluff': arch.sampleDialogue[4] || 'Вскроем.'
  };

  return dialogueMap[situation] || arch.sampleDialogue[Math.floor(Math.random() * arch.sampleDialogue.length)];
}

// Estimate villain's action tendency (for analysis, not real prediction)
export function getArchetypeTendency(archetype, scenario) {
  const arch = VILLAIN_ARCHETYPES[archetype] || VILLAIN_ARCHETYPES.regular;

  // These are hints for teaching, not real strategy
  const tendencies = {
    'tight-reg': {
      folds: 'часто',
      calls: 'редко',
      raises: 'редко',
      bluffs: 'редко',
      description: 'Плотно защищает, редко риск'
    },
    'tag': {
      folds: 'логично',
      calls: 'сбалансированно',
      raises: 'с диапазоном',
      bluffs: 'редко',
      description: 'Сбалансирован, расчётлив'
    },
    'lag': {
      folds: 'редко',
      calls: 'часто',
      raises: 'часто',
      bluffs: 'часто',
      description: 'Агрессивен, рискует часто'
    },
    'calling-station': {
      folds: 'редко',
      calls: 'часто',
      raises: 'редко',
      bluffs: 'редко',
      description: 'Коллирует, редко фолдит'
    },
    'passive': {
      folds: 'часто',
      calls: 'часто',
      raises: 'редко',
      bluffs: 'редко',
      description: 'Чекирует и фолдит на рейзы'
    },
    'aggressive-reg': {
      folds: 'редко',
      calls: 'редко',
      raises: 'часто',
      bluffs: 'часто',
      description: 'Давит агрессивно, микс вэлью и воздух'
    },
    'overfolder': {
      folds: 'часто',
      calls: 'редко',
      raises: 'редко',
      bluffs: 'редко',
      description: 'Легко давить, много фолдит'
    },
    'overcaller': {
      folds: 'редко',
      calls: 'часто',
      raises: 'редко',
      bluffs: 'редко',
      description: 'Вскрывает часто, не верит блефам'
    }
  };

  return tendencies[archetype] || tendencies.tag;
}

// Generate a brief character summary
export function getCharacterProfile(villain) {
  const archetype = villain.archetype || 'regular';
  const arch = VILLAIN_ARCHETYPES[archetype];

  return {
    name: villain.name || 'Соперник',
    archetype,
    label: arch.label,
    traitLabel: arch.traitLabel,
    avatar: villain.avatar || 'default'
  };
}
