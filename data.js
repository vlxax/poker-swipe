window.HANDS = [
  {
    "id": 1,
    "cards": [
      [
        "A",
        "♠"
      ],
      [
        "J",
        "♥"
      ]
    ],
    "position": "BTN",
    "stack": "18 BB",
    "pot": "2.4 BB",
    "stage": "Средняя · ITM",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "AJo на BTN — слишком сильная рука для фолда. Ты выбрасываешь прибыльное открытие."
      },
      "call": {
        "grade": "yellow",
        "explain": "Лимп не катастрофа, но ты отдаёшь инициативу и часть EV."
      },
      "raise": {
        "grade": "match",
        "explain": "Стандартное прибыльное открытие с баттона."
      }
    }
  },
  {
    "id": 2,
    "cards": [
      [
        "K",
        "♥"
      ],
      [
        "10",
        "♣"
      ]
    ],
    "position": "BTN",
    "stack": "21 BB",
    "pot": "2.3 BB",
    "stage": "Средняя",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "yellow",
        "explain": "Слишком осторожно для BTN. Рука нормально входит в диапазон открытия."
      },
      "call": {
        "grade": "red",
        "explain": "Открытый лимп здесь теряет смысл — рука лучше реализуется через рейз."
      },
      "raise": {
        "grade": "match",
        "explain": "Хорошее стандартное открытие на баттоне."
      }
    }
  },
  {
    "id": 3,
    "cards": [
      [
        "2",
        "♥"
      ],
      [
        "2",
        "♣"
      ]
    ],
    "position": "CO",
    "stack": "24 BB",
    "pot": "2.2 BB",
    "stage": "Средняя",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "yellow",
        "explain": "Допустимо в очень нитовой стратегии, но стандартно пара открывается."
      },
      "call": {
        "grade": "red",
        "explain": "Открытый лимп с CO здесь хуже рейза."
      },
      "raise": {
        "grade": "match",
        "explain": "Маленькая пара хорошо подходит для открытия с CO."
      }
    }
  },
  {
    "id": 4,
    "cards": [
      [
        "Q",
        "♠"
      ],
      [
        "10",
        "♦"
      ]
    ],
    "position": "UTG",
    "stack": "30 BB",
    "pot": "2.2 BB",
    "stage": "Ранняя",
    "situation": "Ты открываешь торговлю 9-max.",
    "actions": {
      "fold": {
        "grade": "match",
        "explain": "QTo из UTG слишком слабая для стабильного открытия."
      },
      "call": {
        "grade": "red",
        "explain": "Открытый лимп из UTG создаёт слабый и неудобный диапазон."
      },
      "raise": {
        "grade": "yellow",
        "explain": "Слишком широко для стандартной 9-max структуры."
      }
    }
  },
  {
    "id": 5,
    "cards": [
      [
        "A",
        "♦"
      ],
      [
        "9",
        "♦"
      ]
    ],
    "position": "BTN",
    "stack": "35 BB",
    "pot": "2.4 BB",
    "stage": "Средняя",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "A9s на BTN слишком хорош, чтобы выбрасывать."
      },
      "call": {
        "grade": "yellow",
        "explain": "Лимп возможен редко, но рейз проще и сильнее."
      },
      "raise": {
        "grade": "match",
        "explain": "Сильное открытие: блокер, позиция и хорошая реализация эквити."
      }
    }
  },
  {
    "id": 6,
    "cards": [
      [
        "K",
        "♣"
      ],
      [
        "7",
        "♦"
      ]
    ],
    "position": "BB",
    "stack": "17 BB",
    "pot": "3.5 BB",
    "stage": "Средняя",
    "situation": "BTN открыл 2 BB. SB фолд.",
    "actions": {
      "fold": {
        "grade": "yellow",
        "explain": "Фолд допустим против тайтового BTN, но обычно BB защищается шире."
      },
      "call": {
        "grade": "match",
        "explain": "Нормальная защита BB против небольшого открытия BTN."
      },
      "raise": {
        "grade": "red",
        "explain": "Для 3-бета эта рука слишком слабая и плохо блокирует продолжение."
      }
    }
  },
  {
    "id": 7,
    "cards": [
      [
        "A",
        "♣"
      ],
      [
        "5",
        "♣"
      ]
    ],
    "position": "CO",
    "stack": "26 BB",
    "pot": "2.4 BB",
    "stage": "Средняя",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "A5s слишком хорош для фолда в CO."
      },
      "call": {
        "grade": "yellow",
        "explain": "Лимп теряет инициативу."
      },
      "raise": {
        "grade": "match",
        "explain": "Отличный кандидат на открытие: блокер и играбельность."
      }
    }
  },
  {
    "id": 8,
    "cards": [
      [
        "J",
        "♠"
      ],
      [
        "8",
        "♦"
      ]
    ],
    "position": "UTG",
    "stack": "30 BB",
    "pot": "2.2 BB",
    "stage": "Ранняя",
    "situation": "Ты первый говоришь 9-max.",
    "actions": {
      "fold": {
        "grade": "match",
        "explain": "Правильно: J8o из UTG слишком слабая."
      },
      "call": {
        "grade": "red",
        "explain": "Открытый лимп не спасает слабую руку."
      },
      "raise": {
        "grade": "red",
        "explain": "Слишком широкое открытие без достаточной постфлоп-реализации."
      }
    }
  },
  {
    "id": 9,
    "cards": [
      [
        "10",
        "♠"
      ],
      [
        "10",
        "♥"
      ]
    ],
    "position": "HJ",
    "stack": "22 BB",
    "pot": "4.8 BB",
    "stage": "Средняя",
    "situation": "MP открыл 2.2 BB.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "TT слишком сильна для фолда."
      },
      "call": {
        "grade": "yellow",
        "explain": "Колл возможен, но часто уступает агрессии по EV."
      },
      "raise": {
        "grade": "match",
        "explain": "Сильный 3-бет на вэлью и защита своей доли банка."
      }
    }
  },
  {
    "id": 10,
    "cards": [
      [
        "A",
        "♥"
      ],
      [
        "Q",
        "♥"
      ]
    ],
    "position": "CO",
    "stack": "31 BB",
    "pot": "5.2 BB",
    "stage": "Средняя",
    "situation": "HJ открыл 2.2 BB.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "AQs слишком сильна для фолда."
      },
      "call": {
        "grade": "yellow",
        "explain": "Колл допустим, но часто теряет часть EV против 3-бета."
      },
      "raise": {
        "grade": "match",
        "explain": "Сильный 3-бет с отличной играбельностью."
      }
    }
  },
  {
    "id": 11,
    "cards": [
      [
        "7",
        "♠"
      ],
      [
        "6",
        "♠"
      ]
    ],
    "position": "SB",
    "stack": "20 BB",
    "pot": "3.0 BB",
    "stage": "Средняя",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "yellow",
        "explain": "Можно выкинуть против сильного BB, но стандартно играем активнее."
      },
      "call": {
        "grade": "yellow",
        "explain": "Лимп возможен в смешанной стратегии."
      },
      "raise": {
        "grade": "match",
        "explain": "Хороший агрессивный выбор против BB."
      }
    }
  },
  {
    "id": 12,
    "cards": [
      [
        "K",
        "♣"
      ],
      [
        "Q",
        "♣"
      ]
    ],
    "position": "MP",
    "stack": "42 BB",
    "pot": "2.5 BB",
    "stage": "Ранняя",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "KQs слишком сильна для фолда."
      },
      "call": {
        "grade": "red",
        "explain": "Открытый лимп без причины теряет EV."
      },
      "raise": {
        "grade": "match",
        "explain": "Стандартное сильное открытие из MP."
      }
    }
  },
  {
    "id": 13,
    "cards": [
      [
        "9",
        "♣"
      ],
      [
        "9",
        "♦"
      ]
    ],
    "position": "BTN",
    "stack": "14 BB",
    "pot": "3.0 BB",
    "stage": "Поздняя",
    "situation": "CO открыл 2 BB.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "99 слишком сильна для фолда на таком стеке."
      },
      "call": {
        "grade": "yellow",
        "explain": "Колл возможен, но короткий стек делает агрессию привлекательнее."
      },
      "raise": {
        "grade": "match",
        "explain": "Сильная агрессия на вэлью против широкого CO."
      }
    }
  },
  {
    "id": 14,
    "cards": [
      [
        "Q",
        "♥"
      ],
      [
        "J",
        "♥"
      ]
    ],
    "position": "CO",
    "stack": "19 BB",
    "pot": "2.6 BB",
    "stage": "Средняя",
    "situation": "До тебя все сфолдили.",
    "actions": {
      "fold": {
        "grade": "red",
        "explain": "QJs слишком сильна для фолда с CO."
      },
      "call": {
        "grade": "yellow",
        "explain": "Лимп возможен редко, но рейз проще и прибыльнее."
      },
      "raise": {
        "grade": "match",
        "explain": "Стандартное открытие с хорошей постфлоп-играбельностью."
      }
    }
  },
  {
    "id": 15,
    "cards": [
      [
        "A",
        "♠"
      ],
      [
        "4",
        "♦"
      ]
    ],
    "position": "UTG",
    "stack": "16 BB",
    "pot": "2.3 BB",
    "stage": "Баббл",
    "situation": "9-max, давление ICM.",
    "actions": {
      "fold": {
        "grade": "match",
        "explain": "На баббле и с таким стеком A4o из UTG — слишком маргинально."
      },
      "call": {
        "grade": "red",
        "explain": "Открытый лимп только усложнит жизнь."
      },
      "raise": {
        "grade": "yellow",
        "explain": "Слишком агрессивно для базовой стратегии на баббле."
      }
    }
  }
];
