// ============================================================
//  EXPANDED OPPONENT PRESETS (Stage 3)
// ============================================================

const OPPONENT_PRESETS_EXTENDED = {
  // From Stage 2.1
  STUBBORN_REC: {
    id: 'STUBBORN_REC',
    displayName: 'Упрямый любитель',
    traits: {
      skillLevel: 1,
      baselineStyle: 'sticky',
      riskTolerance: 0.8,
      bluffImpulse: 0.1,
      showdownCuriosity: 0.9,
      tiltLevel: 0.3,
      fatigue: 0.4,
      confidence: 0.5,
      adaptability: 0.2,
      valueThreshold: 0.35,
      bluffCatchThreshold: 0.25,
    },
    narrative: {
      privateMotive: 'не люблю сбрасывать, хочу увидеть шоудаун',
      privateBeliefText: 'Hero может блефовать, у моей пары есть шанс'
    }
  },

  THINKING_REG: {
    id: 'THINKING_REG',
    displayName: 'Аккуратный рег',
    traits: {
      skillLevel: 3,
      baselineStyle: 'solid',
      riskTolerance: 0.5,
      bluffImpulse: 0.3,
      showdownCuriosity: 0.3,
      tiltLevel: 0.1,
      fatigue: 0.2,
      confidence: 0.7,
      adaptability: 0.6,
      valueThreshold: 0.5,
      bluffCatchThreshold: 0.55,
    },
    narrative: {
      privateMotive: 'пытаюсь играть правильно по диапазонам',
      privateBeliefText: 'Hero агрессивен, но я могу поймать блеф'
    }
  },

  STRONG_EXPLOITER: {
    id: 'STRONG_EXPLOITER',
    displayName: 'Сильный эксплуатер',
    traits: {
      skillLevel: 4,
      baselineStyle: 'adaptive',
      riskTolerance: 0.6,
      bluffImpulse: 0.5,
      showdownCuriosity: 0.4,
      tiltLevel: 0.0,
      fatigue: 0.1,
      confidence: 0.9,
      adaptability: 0.9,
      valueThreshold: 0.6,
      bluffCatchThreshold: 0.65,
    },
    narrative: {
      privateMotive: 'вижу слабость Hero, буду эксплуатировать',
      privateBeliefText: 'Hero слишком пассивен на тёрне, я могу забрать банк'
    }
  },

  TILTED_REG: {
    id: 'TILTED_REG',
    displayName: 'Раздражённый рег',
    traits: {
      skillLevel: 2,
      baselineStyle: 'aggressive',
      riskTolerance: 0.9,
      bluffImpulse: 0.8,
      showdownCuriosity: 0.2,
      tiltLevel: 0.8,
      fatigue: 0.3,
      confidence: 0.4,
      adaptability: 0.1,
      valueThreshold: 0.25,
      bluffCatchThreshold: 0.2,
    },
    narrative: {
      privateMotive: 'надо удваиваться, либо вылетать',
      privateBeliefText: 'Hero слабый, сдастся под давлением'
    }
  },

  PSEUDO_GTO: {
    id: 'PSEUDO_GTO',
    displayName: 'Теоретик',
    traits: {
      skillLevel: 3,
      baselineStyle: 'theory_focused',
      riskTolerance: 0.4,
      bluffImpulse: 0.4,
      showdownCuriosity: 0.5,
      tiltLevel: 0.1,
      fatigue: 0.2,
      confidence: 0.8,
      adaptability: 0.4,
      valueThreshold: 0.5,
      bluffCatchThreshold: 0.5,
    },
    narrative: {
      privateMotive: 'применяю теорию, даже если не до конца понимаю',
      privateBeliefText: 'по блокерам Hero должен фолдить'
    }
  },

  TIRED_WANTS_LEAVE: {
    id: 'TIRED_WANTS_LEAVE',
    displayName: 'Уставший игрок',
    traits: {
      skillLevel: 2,
      baselineStyle: 'loose',
      riskTolerance: 0.9,
      bluffImpulse: 0.6,
      showdownCuriosity: 0.1,
      tiltLevel: 0.2,
      fatigue: 0.9,
      confidence: 0.3,
      adaptability: 0.1,
      valueThreshold: 0.3,
      bluffCatchThreshold: 0.2,
    },
    narrative: {
      privateMotive: 'хочу домой, либо удваиваюсь, либо вылетаю',
      privateBeliefText: 'неважно, что у Hero, я рискую'
    }
  },

  // New presets for Stage 3
  PASSIVE_REC: {
    id: 'PASSIVE_REC',
    displayName: 'Пассивный любитель',
    traits: {
      skillLevel: 1,
      baselineStyle: 'passive',
      riskTolerance: 0.3,
      bluffImpulse: 0.05,
      showdownCuriosity: 0.7,
      tiltLevel: 0.2,
      fatigue: 0.5,
      confidence: 0.3,
      adaptability: 0.1,
      valueThreshold: 0.4,
      bluffCatchThreshold: 0.3,
    },
    narrative: {
      privateMotive: 'боюсь терять, предпочитаю проверять',
      privateBeliefText: 'лучше потерять маленько, чем поймать блеф'
    }
  },

  SOLID_TAG: {
    id: 'SOLID_TAG',
    displayName: 'Тайтовый-агрессивный',
    traits: {
      skillLevel: 3,
      baselineStyle: 'solid_aggressive',
      riskTolerance: 0.55,
      bluffImpulse: 0.35,
      showdownCuriosity: 0.2,
      tiltLevel: 0.05,
      fatigue: 0.15,
      confidence: 0.75,
      adaptability: 0.7,
      valueThreshold: 0.55,
      bluffCatchThreshold: 0.6,
    },
    narrative: {
      privateMotive: 'вэлью-ориентирован, блефую только в узких ситуациях',
      privateBeliefText: 'Hero имеет множество слабых рук, я поймаю ценой'
    }
  },

  AGGRESSIVE_LAG: {
    id: 'AGGRESSIVE_LAG',
    displayName: 'Свободный-агрессивный',
    traits: {
      skillLevel: 3,
      baselineStyle: 'aggressive',
      riskTolerance: 0.75,
      bluffImpulse: 0.65,
      showdownCuriosity: 0.4,
      tiltLevel: 0.2,
      fatigue: 0.2,
      confidence: 0.7,
      adaptability: 0.8,
      valueThreshold: 0.4,
      bluffCatchThreshold: 0.5,
    },
    narrative: {
      privateMotive: 'играю азартно, много блефую, много вэлью',
      privateBeliefText: 'я читаю Hero лучше, чем он себя понимает'
    }
  },

  NIT: {
    id: 'NIT',
    displayName: 'Нит',
    traits: {
      skillLevel: 1,
      baselineStyle: 'ultra_tight',
      riskTolerance: 0.2,
      bluffImpulse: 0.02,
      showdownCuriosity: 0.05,
      tiltLevel: 0.0,
      fatigue: 0.3,
      confidence: 0.5,
      adaptability: 0.05,
      valueThreshold: 0.7,
      bluffCatchThreshold: 0.75,
    },
    narrative: {
      privateMotive: 'играю только премиум руки, избегаю сложности',
      privateBeliefText: 'если я бет, у меня вэлью, если я коллирую, я сильный'
    }
  },

  CALLING_STATION: {
    id: 'CALLING_STATION',
    displayName: 'Коллинг-стейшн',
    traits: {
      skillLevel: 1,
      baselineStyle: 'calling_focused',
      riskTolerance: 0.6,
      bluffImpulse: 0.15,
      showdownCuriosity: 0.9,
      tiltLevel: 0.4,
      fatigue: 0.5,
      confidence: 0.4,
      adaptability: 0.15,
      valueThreshold: 0.3,
      bluffCatchThreshold: 0.2,
    },
    narrative: {
      privateMotive: 'я коллирую много, потому что боюсь быть выбитым',
      privateBeliefText: 'Hero может быть на чём угодно, я проверю'
    }
  },

  OVERFOLDER: {
    id: 'OVERFOLDER',
    displayName: 'Перефолдер',
    traits: {
      skillLevel: 1,
      baselineStyle: 'overly_cautious',
      riskTolerance: 0.25,
      bluffImpulse: 0.05,
      showdownCuriosity: 0.15,
      tiltLevel: 0.1,
      fatigue: 0.6,
      confidence: 0.25,
      adaptability: 0.2,
      valueThreshold: 0.65,
      bluffCatchThreshold: 0.7,
    },
    narrative: {
      privateMotive: 'я боюсь быть выбитым на блефе, поэтому часто фолдю',
      privateBeliefText: 'если Hero ставит, вероятно, он сильный'
    }
  },

  OVERBLUFFER: {
    id: 'OVERBLUFFER',
    displayName: 'Переблефер',
    traits: {
      skillLevel: 2,
      baselineStyle: 'bluff_heavy',
      riskTolerance: 0.8,
      bluffImpulse: 0.85,
      showdownCuriosity: 0.5,
      tiltLevel: 0.5,
      fatigue: 0.3,
      confidence: 0.5,
      adaptability: 0.3,
      valueThreshold: 0.25,
      bluffCatchThreshold: 0.3,
    },
    narrative: {
      privateMotive: 'люблю прессовать, часто блефую, потом удивляюсь',
      privateBeliefText: 'Hero часто фолдит, поэтому я ставлю много'
    }
  },

  SCARED_MONEY: {
    id: 'SCARED_MONEY',
    displayName: 'Испуганный перепродав',
    traits: {
      skillLevel: 1,
      baselineStyle: 'scared',
      riskTolerance: 0.15,
      bluffImpulse: 0.1,
      showdownCuriosity: 0.3,
      tiltLevel: 0.7,
      fatigue: 0.7,
      confidence: 0.2,
      adaptability: 0.1,
      valueThreshold: 0.8,
      bluffCatchThreshold: 0.65,
    },
    narrative: {
      privateMotive: 'играю на рёбрах, каждая ставка пугает меня',
      privateBeliefText: 'любая ставка кажется большой, я легко фолдю'
    }
  }
};

// Export or attach to global
if(typeof module !== 'undefined' && module.exports) {
  module.exports = OPPONENT_PRESETS_EXTENDED;
}
