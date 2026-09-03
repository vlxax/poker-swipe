// Hand of the Day — Additional 20+ scenarios for production library
// Comprehensive topic coverage

export const HAND_OF_DAY_SCENARIOS_BATCH2 = [
  // === THIN VALUE SCENARIOS ===

  {
    id: 'hod_011_river_thin_value_30bb',
    title: 'Тонкая вэлью на реке, 30 ББ',
    difficulty: 'advanced',
    topic: 'thin_value',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 45, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'CO', stack: 6000, stackBb: 30, cards: ['9h', 'Th'] },
    villain: { position: 'BB', stack: 5000, stackBb: 25, archetype: 'tag', cards: ['8s', '2d'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }, { id: 'fold', label: 'ФОЛД' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_012_turn_thin_value_35bb',
    title: 'Тонкая вэлью на тёрне, 35 ББ',
    difficulty: 'advanced',
    topic: 'thin_value',
    tournament: { format: 'MTT', stage: 'LATE', playersRemaining: 28, paidPlaces: 18, label: 'MTT' },
    blinds: { small: 150, big: 300, ante: 40 },
    hero: { position: 'BTN', stack: 10500, stackBb: 35, cards: ['Jc', 'Qc'] },
    villain: { position: 'SB', stack: 4500, stackBb: 15, archetype: 'lag', cards: ['5s', '9h'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === OVERBET SCENARIOS ===

  {
    id: 'hod_013_overbet_bluff_20bb',
    title: 'Оверберт блеф на риве, 20 ББ',
    difficulty: 'advanced',
    topic: 'overbet',
    tournament: { format: 'MTT', stage: 'BUBBLE', playersRemaining: 11, paidPlaces: 9, label: 'MTT' },
    blinds: { small: 200, big: 400, ante: 50 },
    hero: { position: 'BTN', stack: 8000, stackBb: 20, cards: ['As', '2h'] },
    villain: { position: 'BB', stack: 6000, stackBb: 15, archetype: 'tight-reg', cards: ['Kd', 'Kc'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === CHECK-RAISE SCENARIOS ===

  {
    id: 'hod_014_check_raise_defense_25bb',
    title: 'Чек-рейз защита, 25 ББ',
    difficulty: 'intermediate',
    topic: 'check_raise',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 50, paidPlaces: 30, label: 'MTT' },
    blinds: { small: 120, big: 240, ante: 30 },
    hero: { position: 'BB', stack: 6000, stackBb: 25, cards: ['Qh', 'Qd'] },
    villain: { position: 'BTN', stack: 7000, stackBb: 29.17, archetype: 'lag', cards: ['3s', '4d'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'call', label: 'КОЛЛ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_015_flop_check_raise_blocking',
    title: 'Чек-рейз на флопе с блокером, 32 ББ',
    difficulty: 'intermediate',
    topic: 'check_raise',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 48, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'SB', stack: 6400, stackBb: 32, cards: ['9s', 'As'] },
    villain: { position: 'BTN', stack: 5600, stackBb: 28, archetype: 'tag', cards: ['Ks', 'Qh'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === ICM / CHIP CHOP SCENARIOS ===

  {
    id: 'hod_016_icm_bubble_50_30_20',
    title: 'ICM баббл 50-30-20, разные стеки',
    difficulty: 'intermediate',
    topic: 'icm',
    tournament: { format: 'MTT', stage: 'BUBBLE', playersRemaining: 3, paidPlaces: 2, label: 'MTT FT' },
    blinds: { small: 500, big: 1000, ante: 100 },
    hero: { position: 'BTN', stack: 50000, stackBb: 50, cards: ['8c', '7h'] },
    villain: { position: 'BB', stack: 20000, stackBb: 20, archetype: 'tight-reg', cards: ['Ah', 'Kd'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_017_final_table_6max_chip_leader',
    title: 'ФТ 6-макс лидер чипов с маржей',
    difficulty: 'intermediate',
    topic: 'final_table',
    tournament: { format: 'MTT', stage: 'FINAL TABLE', playersRemaining: 6, paidPlaces: 3, label: 'ФТ 6-макс' },
    blinds: { small: 800, big: 1600, ante: 200 },
    hero: { position: 'BTN', stack: 120000, stackBb: 75, cards: ['Th', 'Jh'] },
    villain: { position: 'BB', stack: 25000, stackBb: 15.625, archetype: 'lag', cards: ['3h', '4s'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === DOUBLE BARREL SCENARIOS ===

  {
    id: 'hod_018_double_barrel_flop_turn',
    title: 'Даббл-бэррель флоп-тёрн, 40 ББ',
    difficulty: 'intermediate',
    topic: 'double_barrel',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 46, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'MP', stack: 8000, stackBb: 40, cards: ['Kd', 'Jc'] },
    villain: { position: 'BB', stack: 6000, stackBb: 30, archetype: 'lag', cards: ['2s', '8h'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === CALLING STATION EXPLOITATION ===

  {
    id: 'hod_019_exploit_calling_station_value',
    title: 'Эксплуатация коллер-стейшена вэлью',
    difficulty: 'easy',
    topic: 'exploitation',
    tournament: { format: 'MTT', stage: 'LATE', playersRemaining: 25, paidPlaces: 18, label: 'MTT' },
    blinds: { small: 200, big: 400, ante: 50 },
    hero: { position: 'BTN', stack: 12000, stackBb: 30, cards: ['As', 'Qs'] },
    villain: { position: 'BB', stack: 8000, stackBb: 20, archetype: 'calling-station', cards: ['9h', '4c'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === TIGHT-REG SPECIFIC SCENARIOS ===

  {
    id: 'hod_020_tight_reg_ranges_3bet',
    title: '3-бет против тайт-рега узкие рейнджи',
    difficulty: 'intermediate',
    topic: 'vs_tight_reg',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 49, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'CO', stack: 6500, stackBb: 32.5, cards: ['Ah', '9c'] },
    villain: { position: 'BTN', stack: 5500, stackBb: 27.5, archetype: 'tight-reg', cards: ['Kc', 'Kh'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === PASSIVE OPPONENT SCENARIOS ===

  {
    id: 'hod_021_passive_lag_vs_value',
    title: 'Пассивный оппонент - вэлю-линии',
    difficulty: 'easy',
    topic: 'vs_passive',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 47, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'BTN', stack: 6000, stackBb: 30, cards: ['Qs', 'Kd'] },
    villain: { position: 'SB', stack: 7000, stackBb: 35, archetype: 'passive', cards: ['3s', '7h'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === POSITION-SPECIFIC SCENARIOS ===

  {
    id: 'hod_022_utg_plus_2_rfi_tight_range',
    title: 'РФИ с UTG+2 тайт рейндж',
    difficulty: 'easy',
    topic: 'position_rfi',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 48, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'UTG+2', stack: 6000, stackBb: 30, cards: ['Ad', 'Kc'] },
    villain: { position: 'BB', stack: 5000, stackBb: 25, archetype: 'tag', cards: ['9s', '5d'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_023_mp_rfi_moderate',
    title: 'РФИ с MP модераторано',
    difficulty: 'intermediate',
    topic: 'position_rfi',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 46, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'MP', stack: 5500, stackBb: 27.5, cards: ['Ts', 'Js'] },
    villain: { position: 'BB', stack: 6500, stackBb: 32.5, archetype: 'lag', cards: ['2h', '4s'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === LATE STAGE / BUBBLE SCENARIOS ===

  {
    id: 'hod_024_bubble_chip_leader_wide_push',
    title: 'Баббл лидер чипов вайд-пуш',
    difficulty: 'intermediate',
    topic: 'bubble',
    tournament: { format: 'MTT', stage: 'BUBBLE', playersRemaining: 10, paidPlaces: 9, label: 'MTT' },
    blinds: { small: 300, big: 600, ante: 75 },
    hero: { position: 'BTN', stack: 25000, stackBb: 41.67, cards: ['6s', '7d'] },
    villain: { position: 'SB', stack: 5000, stackBb: 8.33, archetype: 'tight-reg', cards: ['Ah', 'Kh'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_025_bubble_short_stack_push_fold',
    title: 'Баббл шорт-стек пуш-фолд диапазон',
    difficulty: 'easy',
    topic: 'bubble_push_fold',
    tournament: { format: 'MTT', stage: 'BUBBLE', playersRemaining: 11, paidPlaces: 9, label: 'MTT' },
    blinds: { small: 250, big: 500, ante: 60 },
    hero: { position: 'UTG', stack: 4000, stackBb: 8, cards: ['Jh', 'Jd'] },
    villain: { position: 'BB', stack: 20000, stackBb: 40, archetype: 'tag', cards: ['2s', '9c'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'allin', label: 'ОЛЛ-ИН' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  // === DRAFT SCENARIOS ===

  {
    id: 'hod_026_pko_bounty_hunting_25bb',
    title: 'ПКО охота на баунти 25 ББ',
    difficulty: 'intermediate',
    topic: 'pko',
    tournament: { format: 'PKO', stage: 'MIDDLE', playersRemaining: 44, paidPlaces: 25, label: 'PKO' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'CO', stack: 5000, stackBb: 25, cards: ['Ad', 'Ac'] },
    villain: { position: 'BB', stack: 3000, stackBb: 15, archetype: 'tight-reg', cards: ['8h', '6d'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_027_4bet_pot_heads_up_decision',
    title: '4-бет пот хедз-ап решение',
    difficulty: 'advanced',
    topic: 'multiway',
    tournament: { format: 'MTT', stage: 'LATE', playersRemaining: 4, paidPlaces: 3, label: 'ФТ' },
    blinds: { small: 500, big: 1000, ante: 125 },
    hero: { position: 'BTN', stack: 40000, stackBb: 40, cards: ['Ah', 'Qh'] },
    villain: { position: 'BB', stack: 35000, stackBb: 35, archetype: 'lag', cards: ['9s', '2c'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_028_limped_pot_response_30bb',
    title: 'Лимп-пот ответ 30 ББ',
    difficulty: 'intermediate',
    topic: 'limped_pots',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 45, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'CO', stack: 6000, stackBb: 30, cards: ['Ks', 'Qh'] },
    villain: { position: 'BTN', stack: 5000, stackBb: 25, archetype: 'calling-station', cards: ['7d', '5s'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_029_short_stacked_push_50_100',
    title: 'Короткий шорт-стек 5 ББ пуш',
    difficulty: 'easy',
    topic: 'push_fold',
    tournament: { format: 'MTT', stage: 'LATE', playersRemaining: 30, paidPlaces: 20, label: 'MTT' },
    blinds: { small: 200, big: 400, ante: 50 },
    hero: { position: 'SB', stack: 2000, stackBb: 5, cards: ['Tc', 'Td'] },
    villain: { position: 'BB', stack: 12000, stackBb: 30, archetype: 'tag', cards: ['9c', '3h'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'allin', label: 'ОЛЛ-ИН' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_030_late_position_steal_attempt_bubble',
    title: 'Лейт-позишн стил баббл',
    difficulty: 'intermediate',
    topic: 'steal',
    tournament: { format: 'MTT', stage: 'BUBBLE', playersRemaining: 12, paidPlaces: 9, label: 'MTT' },
    blinds: { small: 200, big: 400, ante: 50 },
    hero: { position: 'CO', stack: 7000, stackBb: 17.5, cards: ['5h', '6c'] },
    villain: { position: 'BB', stack: 9000, stackBb: 22.5, archetype: 'tight-reg', cards: ['Ac', 'Kd'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  },

  {
    id: 'hod_031_multiway_pot_oop_action',
    title: 'Многосторонний пот ООП действие',
    difficulty: 'advanced',
    topic: 'multiway',
    tournament: { format: 'MTT', stage: 'MIDDLE', playersRemaining: 42, paidPlaces: 27, label: 'MTT' },
    blinds: { small: 100, big: 200, ante: 25 },
    hero: { position: 'BTN', stack: 5000, stackBb: 25, cards: ['9h', '9s'] },
    villain: { position: 'BB', stack: 6000, stackBb: 30, archetype: 'lag', cards: ['As', '2h'] },
    board: [],
    nodes: [
      { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'raise', label: 'РЕЙЗ' }] },
      { id: 'complete', type: 'complete' }
    ],
    rootNodeId: 'root'
  }
];
