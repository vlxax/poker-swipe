// Phase 9B: expanded difficulty 4–5 library — balanced skill coverage.
// Imported into library.js alongside advancedTasks.js.

import { emptyTask, OPPONENT_PROFILES, normalizeTaskTerminology } from './schema.js';

function T(o) {
  const d = emptyTask();
  const spot = Object.assign(d, o);
  if (typeof spot.opp === 'string') {
    const base = OPPONENT_PROFILES[spot.opp];
    spot.opp = base
      ? Object.assign({ name: spot.opp }, base)
      : { name: spot.opp, vpip: 21, pfr: 16, sample: 3400, style: 'ТАЙТ-АГРЕССИВНЫЙ', note: '' };
  }
  if (!spot.effStack && spot.heroStack) {
    spot.effStack = Math.min(spot.heroStack, spot.villainStack || spot.heroStack);
  }
  return normalizeTaskTerminology(spot);
}

export const ADVANCED_TASKS_9B = [
  /* ============ DIFFICULTY 4 ============ */
  T({
    id: 'ADV9B_PREFLOP_UTG_AQ',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '9-MAX', left: '28 LEFT', position: 'UTG', hero: ['A♠', 'Q♠'], heroStack: 44, villain: 'BB',
    villainStack: 41, opp: 'РЕГ', board: [], pot: 6.8,
    history: [{ street: 'ПРЕФЛОП', text: 'UTG открыл 2.2, MP и CO заколлили, BTN и SB сфолдили, BB сквизил 14 ББ.', pot: 6.8 }],
    question: 'Что делаешь с AQs в UTG против сквиза в мультивее?',
    options: ['ФОЛД', 'КОЛЛ', '4-БЕТ'], correct: '4-БЕТ', alsoOk: ['КОЛЛ'],
    concept: 'UTG squeeze response', explain: 'AQs блокирует AA/AK и доминирует AQ/AJ. 4-бет изолирует BB и давит на коллеров; колл допустим, но 4-бет — лучшая линия против широкого сквиза.',
    difficulty: 4, tags: ['префлоп', 'ранняя позиция', 'сквиз', 'диапазон']
  }),
  T({
    id: 'ADV9B_PREFLOP_CO_MERGE',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '35 LEFT', position: 'CO', hero: ['T♠', '9♠'], heroStack: 48, villain: 'BTN',
    villainStack: 46, opp: 'АГРО-РЕГ', board: [], pot: 5.4,
    history: [{ street: 'ПРЕФЛОП', text: 'CO открыл 2.2, BTN трибетил 9 ББ.', pot: 5.4 }],
    question: 'Что делаешь с T9s в CO против агрессивного трибета BTN?',
    options: ['ФОЛД', 'КОЛЛ', '4-БЕТ'], correct: 'КОЛЛ', alsoOk: ['4-БЕТ'],
    concept: 'CO flat vs polar 3bet', explain: 'T9s реализует equity в позиции против широкого трибета. 4-бет-блеф возможен, но колл сохраняет диапазон и позволяет эксплуатировать постфлоп.',
    difficulty: 4, tags: ['префлоп', 'позиция', 'против трибета', 'диапазон']
  }),
  T({
    id: 'ADV9B_SHORT_SB_A8O',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1200, 2400], ante: 300, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '14 LEFT', position: 'SB', hero: ['A♣', '8♦'], heroStack: 11, villain: 'BB',
    villainStack: 22, opp: 'РЕГ', board: [], pot: 4.8,
    history: [{ street: 'ПРЕФЛОП', text: 'Все до SB сфолдили. SB при 11 ББ.', pot: 4.8 }],
    question: 'Что делаешь с A8o в SB при 11 ББ?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['РЕЙЗ'],
    concept: 'short SB push A8o', explain: 'При 11 ББ A8o — пуш из SB: анте и мёртвые деньги делают фолд-эквити ценным. Рейз-фолд теряет fold equity против широкого BB.',
    difficulty: 4, tags: ['префлоп', 'короткий стек', 'push-fold', 'позиция']
  }),
  T({
    id: 'ADV9B_ICM_BTN_FOLD',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1500, 3000], ante: 400, stage: 'БАББЛ',
    table: '6-MAX', left: '6 LEFT', position: 'BTN', hero: ['K♦', 'J♦'], heroStack: 14, villain: 'SB',
    villainStack: 32, opp: 'РЕГ', board: [], pot: 5.2,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN. Баббл: 6 left, призовых 5. SB запушил 32 ББ, BB сфолдил.', pot: 5.2 }],
    question: 'Что делаешь с KJs на баттоне при 14 ББ против пуша SB на баббле?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'bubble ICM KJs fold', explain: 'KJs доминируется Ax и парами в пуше SB. На баббле ICM-фолд: приз за 5-е место дороже chipEV от маргинального колла.',
    difficulty: 4, tags: ['баббл', 'ICM', 'короткий стек', 'фолд']
  }),
  T({
    id: 'ADV9B_ICM_COVER_CALL',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [2000, 4000], ante: 500, stage: 'ФИНАЛЬНЫЙ СТОЛ',
    table: '6-MAX', left: '4 LEFT', position: 'BB', hero: ['A♥', 'T♥'], heroStack: 18, villain: 'SB',
    villainStack: 9, opp: 'РЕГ', board: [], pot: 7.5,
    history: [{ street: 'ПРЕФЛОП', text: 'Финальный стол. SB — короткий стек 9 ББ — запушил. Ты покрываешь с 18 ББ.', pot: 7.5 }],
    question: 'Что делаешь с ATs в BB против короткого пуша SB на финальном столе?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'final table cover call', explain: 'Покрывая короткий стек, ATs — стандартный колл: доминируем A9-A2, KQ, KJ и часть пар. ICM давит, но pot odds и покрытие делают колл +EV.',
    difficulty: 4, tags: ['финальный стол', 'ICM', 'колл', 'короткий стек']
  }),
  T({
    id: 'ADV9B_RANGE_FLOP_XR',
    street: 'ФЛОП', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '40 LEFT', position: 'BB', hero: ['9♠', '8♠'], heroStack: 50, villain: 'BTN',
    villainStack: 47, opp: 'РЕГ', board: ['T♦', '7♣', '2♠'], pot: 6.0,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'BB чек, BTN ставит 33%.', pot: 6.0 }
    ],
    question: 'Что делаешь с 98s и гатшотом на T72 против с-бета?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'flop XR semi-bluff range', explain: '98s — гатшот + оверкарты. Чек-рейз давит на слабые пары BTN и реализует fold equity. Колл тоже играбелен, но рейз — агрессивная линия с дро.',
    difficulty: 4, tags: ['флоп', 'чек-рейз', 'диапазон', 'постфлоп']
  }),
  T({
    id: 'ADV9B_BLUFFCATCH_TURN',
    street: 'ТЁРН', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '25 LEFT', position: 'BB', hero: ['A♣', 'Q♣'], heroStack: 46, villain: 'CO',
    villainStack: 43, opp: 'АГРО-РЕГ', board: ['Q♦', '8♠', '3♣', 'K♠'], pot: 18,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO 55%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BB чек, CO ставит 75%.', pot: 18 }
    ],
    question: 'Что делаешь с AQ (топ-пара) на тёрне Q83K против агрессии?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: ['РЕЙЗ'],
    concept: 'turn defense top pair', explain: 'AQ — топ-пара с хорошим кикером. K♠ усложняет, но агро-рег часто баррелит широко. Колл — базовая линия; рейз превращает в блеф против сильного Kx.',
    difficulty: 4, tags: ['тёрн', 'блеф-кетч', 'диапазон', 'постфлоп']
  }),
  T({
    id: 'ADV9B_SIZING_TURN_POT',
    street: 'ТЁРН', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '44 LEFT', position: 'BTN', hero: ['J♣', 'J♦'], heroStack: 42, villain: 'BB',
    villainStack: 40, opp: 'РЕГ', board: ['J♠', '6♣', '2♦', '4♥'], pot: 14,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 4.7 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек.', pot: 14 }
    ],
    question: 'Какой сайзинг на тёрне с сетом JJ на J624?',
    options: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 75%'], correct: 'СТАВКА 75%', alsoOk: ['СТАВКА 33%'],
    concept: 'turn pot sizing set', explain: 'Сет на сухом тёрне — максимум ценности. 75% собирает с 6x/Jx и дров; маленький сайзинг оставляет деньги на столе.',
    difficulty: 4, tags: ['тёрн', 'сайзинг', 'ценность', 'постфлоп']
  }),
  T({
    id: 'ADV9B_EXPLOIT_NIT_RIVER',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '38 LEFT', position: 'BTN', hero: ['8♠', '7♠'], heroStack: 40, villain: 'BB',
    villainStack: 38, opp: 'НИТ', board: ['K♣', 'Q♦', '5♠', '3♥', '2♣'], pot: 18,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BTN 55%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 18 }
    ],
    question: 'Что делаешь с промахом 87s на ривере KQ532 против нита?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'exploit nit river barrel', explain: 'Нит фолдит слишком часто на ривере без силы. Третий баррель с промахом — прибыльный эксплойт: KQ5 доска credibility, нит сфолдит 90%+ диапазона.',
    difficulty: 4, tags: ['ривер', 'эксплойт', 'нит', 'бареллинг']
  }),
  T({
    id: 'ADV9B_POSITION_HJ_STEAL',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '8-MAX', left: '18 LEFT', position: 'HJ', hero: ['K♠', 'T♠'], heroStack: 22, villain: 'BB',
    villainStack: 28, opp: 'ТАЙТ', board: [], pot: 5.8,
    history: [{ street: 'ПРЕФЛОП', text: 'UTG и MP сфолдили. HJ при 22 ББ, тайтовый BB за столом.', pot: 5.8 }],
    question: 'Что делаешь с KTs в HJ при 22 ББ против тайтового BB?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'РЕЙЗ', alsoOk: ['ОЛЛ-ИН'],
    concept: 'HJ steal vs tight BB', explain: 'KTs — сильный стил из HJ. Тайтовый BB фолдит 70%+ — рейз забирает анте. Олл-ин тоже играбелен при 22 ББ, но рейз сохраняет гибкость.',
    difficulty: 4, tags: ['префлоп', 'позиция', 'стил', 'ранняя позиция']
  }),
  T({
    id: 'ADV9B_STACKDEPTH_DEEP_SET',
    street: 'ФЛОП', format: 'CASH', blinds: [5, 10], ante: 0, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '6 СТЕКОВ', position: 'BB', hero: ['5♣', '5♥'], heroStack: 120, villain: 'BTN',
    villainStack: 140, opp: 'РЕГ', board: ['5♦', 'K♠', '2♣'], pot: 22,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл 2.5, BB трибетил 10, BTN заколлил.', pot: 22 },
      { street: 'ФЛОП', text: 'BB чек, BTN ставит 50%.', pot: 22 }
    ],
    question: 'Что делаешь с сетом пятёрок на 120 ББ в трибет-поте?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'deep stack set play', explain: 'Сет на глубоких стеках — медленная игра или рейз? На K52 чек-рейз изолирует Kx и дро, раздувает банк для максимума ценности на тёрне/ривере.',
    difficulty: 4, tags: ['флоп', 'глубина стека', 'сет', 'трибет-пот']
  }),
  T({
    id: 'ADV9B_RIVER_DEFENSE',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '22 LEFT', position: 'BB', hero: ['T♥', 'T♦'], heroStack: 44, villain: 'CO',
    villainStack: 42, opp: 'РЕГ', board: ['T♣', '8♠', '4♦', '2♥', 'A♠'], pot: 24,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек, CO 60%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек, CO ставит 75%.', pot: 24 }
    ],
    question: 'Что делаешь с TT на ривере T842A против ставки?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'river set vs ace', explain: 'Сет TT на ривере с тузом — сложный блеф-кетч. CO полярен: Ax и две пары. TT блокирует Tx, но проигрывает Ax. Колл маргинален против сбалансированного диапазона.',
    difficulty: 4, tags: ['ривер', 'блеф-кетч', 'диапазон', 'блокеры']
  }),

  /* ============ DIFFICULTY 5 ============ */
  T({
    id: 'ADV9B5_PREFLOP_BTN_4B',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1200, 2400], ante: 300, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '15 LEFT', position: 'BTN', hero: ['A♦', '5♦'], heroStack: 38, villain: 'BB',
    villainStack: 36, opp: 'АГРО-РЕГ', board: [], pot: 14,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN открыл 2.2, BB трибетил 10, BTN 4-бетил 24, BB 5-бетил олл-ин 36.', pot: 14 }],
    question: 'Что делаешь с A5s на BTN против 5-бет-пуша BB?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'BTN 5bet call A5s', explain: 'A5s блокирует AA/AK и доминирует AQo/AJo. Против агро-рега 5-бет полярен — A5s в коллах. Pot odds при 36 ББ эффективных делают колл +EV.',
    difficulty: 5, tags: ['префлоп', '5-бет', 'позиция', 'блокеры']
  }),
  T({
    id: 'ADV9B5_SHORT_COVER_SHOVE',
    street: 'ПРЕФЛОП', format: 'PKO', blinds: [1500, 3000], ante: 400, stage: 'ITM',
    table: '6-MAX', left: '10 LEFT', position: 'SB', hero: ['K♣', 'Q♣'], heroStack: 8, villain: 'BB',
    villainStack: 35, opp: 'РЕГ', board: [], pot: 5.2,
    history: [{ street: 'ПРЕФЛОП', text: 'PKO ITM. SB при 8 ББ, BB — средний стек 35 ББ с баунти.', pot: 5.2 }],
    question: 'Что делаешь с KQs в SB при 8 ББ в PKO ITM?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: [],
    concept: 'PKO short stack shove', explain: 'При 8 ББ KQs — пуш: баунти добавляет overlay, fold equity высокое. Рейз-фолд оставляет 4-5 ББ — слишком коротко для игры.',
    difficulty: 5, tags: ['PKO', 'короткий стек', 'пуш', 'ICM']
  }),
  T({
    id: 'ADV9B5_ICM_MEDIUM_FOLD',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [2500, 5000], ante: 600, stage: 'ФИНАЛЬНЫЙ СТОЛ',
    table: '6-MAX', left: '5 LEFT', position: 'CO', hero: ['A♣', 'J♠'], heroStack: 20, villain: 'BTN',
    villainStack: 55, opp: 'РЕГ', board: [], pot: 22,
    history: [{ street: 'ПРЕФЛОП', text: 'Финальный стол. CO открыл 2.2, BTN-чиплидер трибетил 12, CO 4-бетил олл-ин 20, BTN 5-бетил олл-ин 55.', pot: 22 }],
    question: 'Что делаешь с AJo в CO при 20 ББ против 5-бета чиплидера на финальном столе?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'final table AJo fold', explain: 'AJo против 5-бета чиплидера при 20 ББ — ICM-фолд: доминируется AK/QQ+, а призовая структура делает вылет слишком дорогим.',
    difficulty: 5, tags: ['финальный стол', 'ICM', 'префлоп', 'фолд']
  }),
  T({
    id: 'ADV9B5_ICM_BUBBLE_SHOVE',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'БАББЛ',
    table: '6-MAX', left: '7 LEFT', position: 'BTN', hero: ['Q♠', 'J♠'], heroStack: 13, villain: 'SB',
    villainStack: 40, opp: 'НИТ', board: [], pot: 4.5,
    history: [{ street: 'ПРЕФЛОП', text: 'Баббл: 7 left, призовых 6. Все до BTN сфолдили. Нитовый SB.', pot: 4.5 }],
    question: 'Что делаешь с QJs на баттоне при 13 ББ на баббле против нита?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: [],
    concept: 'bubble shove vs nit', explain: 'Нитовый SB фолдит 75%+ на баббле. QJs — пуш с 13 ББ: ICM давит на SB, fold equity максимально. Рейз оставляет сложный постфлоп.',
    difficulty: 5, tags: ['баббл', 'ICM', 'стил', 'позиция']
  }),
  T({
    id: 'ADV9B5_RANGE_TURN_XR',
    street: 'ТЁРН', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '20 LEFT', position: 'BB', hero: ['A♠', '5♠'], heroStack: 48, villain: 'CO',
    villainStack: 45, opp: 'РЕГ', board: ['K♦', 'Q♣', '3♠', '5♦'], pot: 16,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек, CO ставит 60%.', pot: 16 }
    ],
    question: 'Что делаешь с парой пятёрок на тёрне KQ35?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'turn XR middle pair', explain: '55 — средняя пара на KQ3. Чек-рейз поляризует: CO имеет Kx/Qx, но много промахов. Рейз забирает банк или получает колл от худших пар.',
    difficulty: 5, tags: ['тёрн', 'чек-рейз', 'диапазон', 'постфлоп']
  }),
  T({
    id: 'ADV9B5_BLUFFCATCH_RIVER_A4',
    street: 'РИВЕР', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '18 LEFT', position: 'BB', hero: ['A♠', '4♠'], heroStack: 40, villain: 'BTN',
    villainStack: 38, opp: 'АГРО-РЕГ', board: ['A♦', '9♣', '5♠', '3♥', '7♣'], pot: 26,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, BTN 50%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BB чек, BTN 70%, BB колл.', pot: 20 },
      { street: 'РИВЕР', text: 'BB чек, BTN ставит 120%.', pot: 26 }
    ],
    question: 'Что делаешь с A4s (топ-пара) на ривере A9537 против овербета?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'river A4s defense', explain: 'A4s блокирует Ax и часть блефов. Овербет агро-рега полярен — A4s на грани: колл маргинален, но блокер на туза и слабая пара 9x делают колл возможным.',
    difficulty: 5, tags: ['ривер', 'блеф-кетч', 'блокеры', 'овербет']
  }),
  T({
    id: 'ADV9B5_BLUFFCATCH_RIVER_88',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '24 LEFT', position: 'BB', hero: ['8♣', '8♦'], heroStack: 42, villain: 'CO',
    villainStack: 40, opp: 'РЕГ', board: ['K♠', 'J♦', '8♥', '4♣', 'A♠'], pot: 22,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO 45%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек, CO 65%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек, CO ставит 90%.', pot: 22 }
    ],
    question: 'Что делаешь с сетом 88 на ривере KJ84A против крупной ставки?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'river set vs ace', explain: 'Сет 88 на ривере с тузом — рейз для ценности: CO коллит с Ax/KJ/J8. Колл тоже +EV, но рейз максимизирует против диапазона колла.',
    difficulty: 5, tags: ['ривер', 'блеф-кетч', 'ценность', 'сайзинг']
  }),
  T({
    id: 'ADV9B5_BLUFFING_TRIPLE',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '34 LEFT', position: 'CO', hero: ['6♠', '5♠'], heroStack: 46, villain: 'BB',
    villainStack: 44, opp: 'РЕГ', board: ['A♣', 'K♦', '7♠', '2♥', '9♣'], pot: 20,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'CO 35%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'CO 55%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 20 }
    ],
    question: 'Что делаешь с промахом 65s на ривере AK729 после двух баррелей?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'triple barrel polar', explain: 'Линия AK7-9 credible для Ax/Kx. Третий баррель поляризует: BB сфолдит 7x/2x. Блокеры на 65s слабые, но fold equity высокое.',
    difficulty: 5, tags: ['ривер', 'блеф', 'бареллинг', 'поляризация']
  }),
  T({
    id: 'ADV9B5_EXPLOIT_MANIAC',
    street: 'РИВЕР', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '36 LEFT', position: 'BB', hero: ['J♥', 'T♥'], heroStack: 38, villain: 'BTN',
    villainStack: 36, opp: 'МАНИАК', board: ['J♣', '7♦', '3♠', '5♥', '2♣'], pot: 22,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 4.7 },
      { street: 'ФЛОП', text: 'BB чек, BTN 80%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек, BTN 100%, BB колл.', pot: 18 },
      { street: 'РИВЕР', text: 'BB чек, BTN ставит 110%.', pot: 22 }
    ],
    question: 'Что делаешь с топ-парой JT против маниака на ривере?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'exploit maniac catch', explain: 'Маниак блефует на каждой улице. JT — топ-пара, отличный блеф-кетч. Фолд — слишком тайтово против переагрессии.',
    difficulty: 5, tags: ['ривер', 'эксплойт', 'маниак', 'блеф-кетч']
  }),
  T({
    id: 'ADV9B5_EXPLOIT_STATION',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '32 LEFT', position: 'BTN', hero: ['A♥', '9♥'], heroStack: 44, villain: 'BB',
    villainStack: 42, opp: 'СТЕЦИОНЕР', board: ['A♣', '8♦', '3♠', '5♣', '2♦'], pot: 18,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BTN 55%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 18 }
    ],
    question: 'Что делаешь с A9 против стационера на ривере A8352?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'exploit station thin value', explain: 'Стационер коллит слишком широко — A9 добирает с 8x/5x/3x и слабым Ax. Крупная тонкая ставка максимизирует EV.',
    difficulty: 5, tags: ['ривер', 'эксплойт', 'стационер', 'тонкое значение']
  }),
  T({
    id: 'ADV9B5_EXPLOIT_LOVER_FOLD',
    street: 'ФЛОП', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '40 LEFT', position: 'BB', hero: ['Q♠', 'J♠'], heroStack: 48, villain: 'BTN',
    villainStack: 46, opp: 'ЛЮБИТЕЛЬ', board: ['9♣', '6♦', '2♠'], pot: 5.4,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 4.7 },
      { street: 'ФЛОП', text: 'BTN ставит 90%.', pot: 5.4 }
    ],
    question: 'Что делаешь с QJs против огромного с-бета любителя на 962?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'exploit lover overbet fold', explain: 'Любитель ставит крупно только с парой/тузом. QJs — два оверкарты без пары, фолд правильный эксплойт.',
    difficulty: 5, tags: ['флоп', 'эксплойт', 'любитель', 'фолд']
  }),
  T({
    id: 'ADV9B5_POSITION_BTN_ISO',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '20 LEFT', position: 'BTN', hero: ['A♣', 'Q♣'], heroStack: 28, villain: 'SB',
    villainStack: 12, opp: 'РЕГ', board: [], pot: 6.2,
    history: [{ street: 'ПРЕФЛОП', text: 'CO лимпнул, BTN при 28 ББ. SB — короткий стек 12 ББ.', pot: 6.2 }],
    question: 'Что делаешь с AQs на BTN против лимпа CO и короткого SB?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'РЕЙЗ', alsoOk: ['ОЛЛ-ИН'],
    concept: 'BTN iso vs limper', explain: 'AQs — изоляция лимпера рейзом. Короткий SB может запушить — AQs в коллах. Олл-ин тоже играбелен, но рейз сохраняет гибкость против CO.',
    difficulty: 5, tags: ['префлоп', 'позиция', 'изоляция', 'баттон']
  }),
  T({
    id: 'ADV9B5_POSITION_CO_STEAL',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '8-MAX', left: '16 LEFT', position: 'CO', hero: ['J♦', '9♦'], heroStack: 19, villain: 'BB',
    villainStack: 35, opp: 'ТАЙТ', board: [], pot: 5.5,
    history: [{ street: 'ПРЕФЛОП', text: 'UTG, MP, HJ сфолдили. CO при 19 ББ, тайтовый BB.', pot: 5.5 }],
    question: 'Что делаешь с J9s в CO при 19 ББ против тайтового BB?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['РЕЙЗ'],
    concept: 'CO steal short stack', explain: 'При 19 ББ J9s — пуш из CO: тайтовый BB фолдит 70%+, анте раздувают банк. Рейз оставляет 12 ББ — слишком коротко.',
    difficulty: 5, tags: ['префлоп', 'позиция', 'стил', 'короткий стек']
  }),
  T({
    id: 'ADV9B5_STACKDEPTH_4BET',
    street: 'ПРЕФЛОП', format: 'CASH', blinds: [2, 5], ante: 0, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '100 ББ', position: 'CO', hero: ['K♠', 'K♦'], heroStack: 100, villain: 'BTN',
    villainStack: 95, opp: 'РЕГ', board: [], pot: 35,
    history: [{ street: 'ПРЕФЛОП', text: 'CO открыл 2.5, BTN трибетил 10, CO 4-бетил 28, BTN заколлил.', pot: 35 }],
    question: 'Как играешь KK на 100 ББ в 4-бет-поте на префлопе?',
    options: ['КОЛЛ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: [],
    concept: 'deep 4bet pot KK', explain: 'KK в 4-бет-поте на 100 ББ — олл-ин: блокируем AA, доминируем QQ/AQ. Колл оставляет сложный постфлоп на глубоких стеках.',
    difficulty: 5, tags: ['префлоп', 'глубина стека', '4-бет', 'ценность']
  }),
  T({
    id: 'ADV9B5_SIZING_RIVER_OVERBET',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '19 LEFT', position: 'BTN', hero: ['A♠', 'K♠'], heroStack: 50, villain: 'BB',
    villainStack: 48, opp: 'РЕГ', board: ['K♣', 'Q♦', '7♠', '3♣', '2♥'], pot: 22,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BTN 55%, BB колл.', pot: 18 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 22 }
    ],
    question: 'Что делаешь с топ-парой AK на ривере KQ732?',
    options: ['ЧЕК', 'СТАВКА 50%', 'СТАВКА 120%'], correct: 'СТАВКА 120%', alsoOk: ['СТАВКА 50%'],
    concept: 'river polar overbet value', explain: 'AK — топ-пара на KQ732. Овербет поляризует: BB коллит с Kx/Qx/7x. 50% оставляет ценность; 120% максимизирует против широкого BB.',
    difficulty: 5, tags: ['ривер', 'сайзинг', 'овербет', 'поляризация']
  }),
  T({
    id: 'ADV9B5_POSTFLOP_FLOP_XR',
    street: 'ФЛОП', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '38 LEFT', position: 'BB', hero: ['K♣', 'Q♣'], heroStack: 52, villain: 'CO',
    villainStack: 50, opp: 'АГРО-РЕГ', board: ['K♦', '8♠', '3♣'], pot: 6.4,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO ставит 55%.', pot: 6.4 }
    ],
    question: 'Что делаешь с KQs (топ-пара) на K83 против агрессивного с-бета?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'flop XR top pair', explain: 'KQ — топ-пара с хорошим кикером. Чек-рейз изолирует Kx/8x и дро CO. Колл играбелен, но рейз максимизирует против агро-рега.',
    difficulty: 5, tags: ['флоп', 'чек-рейз', 'постфлоп', 'ценность']
  }),
  T({
    id: 'ADV9B5_SHORT_BTN_K9O',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1500, 3000], ante: 400, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '12 LEFT', position: 'BTN', hero: ['K♦', '9♠'], heroStack: 10, villain: 'SB',
    villainStack: 25, opp: 'РЕГ', board: [], pot: 4.2,
    history: [{ street: 'ПРЕФЛОП', text: 'Все до BTN сфолдили. BTN при 10 ББ.', pot: 4.2 }],
    question: 'Что делаешь с K9o на баттоне при 10 ББ?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: [],
    concept: 'BTN short stack push', explain: 'При 10 ББ K9o — пуш с баттона: fold equity и pot odds делают пуш +EV. Рейз-фолд оставляет 6 ББ — слишком коротко.',
    difficulty: 5, tags: ['префлоп', 'короткий стек', 'пуш', 'позиция']
  }),
  T({
    id: 'ADV9B5_ICM_UTG_FOLD',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [2000, 4000], ante: 500, stage: 'ФИНАЛЬНЫЙ СТОЛ',
    table: '6-MAX', left: '4 LEFT', position: 'UTG', hero: ['A♦', 'T♦'], heroStack: 15, villain: 'BB',
    villainStack: 60, opp: 'РЕГ', board: [], pot: 7.0,
    history: [{ street: 'ПРЕФЛОП', text: 'Финальный стол, 4 left. UTG открыл 2.2, все сфолдили до BB, BB запушил 60 ББ.', pot: 7.0 }],
    question: 'Что делаешь с ATs в UTG при 15 ББ против пуша BB на финальном столе?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'UTG ICM ATs fold', explain: 'ATs против пуша 60 ББ при 15 ББ — ICM-фолд: доминируется AK/AQ/парами, приз за 4-е место слишком ценен.',
    difficulty: 5, tags: ['финальный стол', 'ICM', 'префлоп', 'ранняя позиция']
  }),
  T({
    id: 'ADV9B5_RANGE_RIVER_CALL',
    street: 'РИВЕР', format: 'MTT', blinds: [700, 1400], ante: 175, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '21 LEFT', position: 'BB', hero: ['Q♣', 'T♣'], heroStack: 43, villain: 'BTN',
    villainStack: 41, opp: 'РЕГ', board: ['Q♦', '9♠', '4♣', '2♥', '7♦'], pot: 24,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, BTN 45%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек, BTN 60%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек, BTN ставит 75%.', pot: 24 }
    ],
    question: 'Что делаешь с QT (топ-пара) на ривере Q9427 против ставки?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'river range call QT', explain: 'QT — топ-пара с хорошим кикером. BTN полярен: Qx/9x/дро. Колл — базовая линия; рейз превращает в блеф против сильного Qx.',
    difficulty: 5, tags: ['ривер', 'диапазон', 'блеф-кетч', 'постфлоп']
  }),
  T({
    id: 'ADV9B5_BLUFFING_TURN',
    street: 'ТЁРН', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '42 LEFT', position: 'BTN', hero: ['A♦', '4♦'], heroStack: 44, villain: 'BB',
    villainStack: 42, opp: 'РЕГ', board: ['K♠', 'Q♣', '8♦', '3♥'], pot: 12,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 4.7 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 8 },
      { street: 'ТЁРН', text: 'BB чек.', pot: 12 }
    ],
    question: 'Что делаешь с A4s (промах) на тёрне KQ83 после с-бета?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'turn barrel A4s', explain: 'A4s блокирует AK/AQ. Второй баррель на KQ8 — поляризация: BB сфолдит 8x/слабые пары. Fold equity + блокеры делают ставку +EV.',
    difficulty: 5, tags: ['тёрн', 'блеф', 'бареллинг', 'блокеры']
  }),
  T({
    id: 'ADV9B_PREFLOP_SB_DEFEND',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '30 LEFT', position: 'SB', hero: ['J♣', '8♣'], heroStack: 35, villain: 'BTN',
    villainStack: 33, opp: 'РЕГ', board: [], pot: 5.0,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN открыл 2.2, SB при 35 ББ.', pot: 5.0 }],
    question: 'Что делаешь с J8s в SB против открытия BTN?',
    options: ['ФОЛД', 'КОЛЛ', '3-БЕТ'], correct: '3-БЕТ', alsoOk: ['КОЛЛ'],
    concept: 'SB 3bet polar J8s', explain: 'J8s — полярный трибет из SB: блокирует Jx/8x, реализует fold equity. Колл тоже играбелен, но трибет эксплуатирует широкий BTN.',
    difficulty: 4, tags: ['префлоп', 'позиция', 'трибет', 'поляризация']
  }),
  T({
    id: 'ADV9B_SHORT_COVER',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1200, 2400], ante: 300, stage: 'ITM',
    table: '6-MAX', left: '11 LEFT', position: 'BB', hero: ['T♠', '9♠'], heroStack: 14, villain: 'SB',
    villainStack: 7, opp: 'РЕГ', board: [], pot: 6.0,
    history: [{ street: 'ПРЕФЛОП', text: 'ITM. SB — короткий стек 7 ББ — запушил. BB покрывает с 14 ББ.', pot: 6.0 }],
    question: 'Что делаешь с T9s в BB против короткого пуша SB в ITM?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'ITM short cover call', explain: 'Покрывая 7 ББ, T9s — стандартный колл: доминируем T8-65, pot odds отличные. ICM давит, но покрытие и диапазон пуша делают колл +EV.',
    difficulty: 4, tags: ['ITM', 'короткий стек', 'колл', 'ICM']
  }),
  T({
    id: 'ADV9B_EXPLOIT_AGRO_FOLD',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '35 LEFT', position: 'BB', hero: ['K♠', 'Q♠'], heroStack: 40, villain: 'CO',
    villainStack: 38, opp: 'АГРО-РЕГ', board: ['A♣', 'J♦', '5♠', '3♥', '9♣'], pot: 20,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'BB чек, CO 60%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек, CO 80%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек, CO ставит 100%.', pot: 20 }
    ],
    question: 'Что делаешь с KQ (промах) на ривере AJ539 против тройного бареля?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'exploit agro fold river', explain: 'KQ — промах на AJ539. Агро-рег баррелит широко, но тройной баррель на ривере — полярен. KQ без пары — фолд.',
    difficulty: 4, tags: ['ривер', 'эксплойт', 'фолд', 'бареллинг']
  }),
  T({
    id: 'ADV9B_POSITION_UTG_OPEN',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '9-MAX', left: '22 LEFT', position: 'UTG', hero: ['K♠', 'Q♠'], heroStack: 25, villain: 'BB',
    villainStack: 23, opp: 'РЕГ', board: [], pot: 5.8,
    history: [{ street: 'ПРЕФЛОП', text: 'UTG при 25 ББ, все до тебя сфолдили.', pot: 5.8 }],
    question: 'Что делаешь с KQs в UTG при 25 ББ?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'РЕЙЗ', alsoOk: ['ОЛЛ-ИН'],
    concept: 'UTG open KQs', explain: 'KQs — открытие из UTG при 25 ББ. Рейз стандартен; олл-ин тоже играбелен, но рейз сохраняет гибкость постфлоп.',
    difficulty: 4, tags: ['префлоп', 'ранняя позиция', 'RFI', 'позиция']
  }),
  T({
    id: 'ADV9B_STACKDEPTH_TURN',
    street: 'ТЁРН', format: 'CASH', blinds: [2, 5], ante: 0, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '80 ББ', position: 'BTN', hero: ['A♣', 'K♣'], heroStack: 80, villain: 'BB',
    villainStack: 75, opp: 'РЕГ', board: ['A♦', '7♠', '2♣', 'K♠'], pot: 28,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл 2.5, BB трибетил 10, BTN заколлил.', pot: 22 },
      { street: 'ФЛОП', text: 'BB 50%, BTN колл.', pot: 22 },
      { street: 'ТЁРН', text: 'BB ставит 75%.', pot: 28 }
    ],
    question: 'Что делаешь с двумя парами AK на тёрне A72K при 80 ББ?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'deep turn two pair', explain: 'AK — две пары на A72K. Чек-рейз максимизирует ценность: BB имеет Ax/Kx/7x. На глубоких стеках рейз раздувает банк для ривера.',
    difficulty: 4, tags: ['тёрн', 'глубина стека', 'ценность', 'трибет-пот']
  }),
  T({
    id: 'ADV9B_BLUFFCATCH_FLOP',
    street: 'ФЛОП', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '45 LEFT', position: 'BB', hero: ['A♥', 'J♥'], heroStack: 46, villain: 'CO',
    villainStack: 44, opp: 'АГРО-РЕГ', board: ['A♣', '8♦', '3♠'], pot: 6.2,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO ставит 70%.', pot: 6.2 }
    ],
    question: 'Что делаешь с AJ (топ-пара) на A83 против крупного с-бета?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: ['РЕЙЗ'],
    concept: 'flop defense top pair', explain: 'AJ — топ-пара с хорошим кикером. Агро-рег часто с-бетит широко — колл защищает диапазон. Рейз превращает в блеф против сильного Ax.',
    difficulty: 4, tags: ['флоп', 'блеф-кетч', 'защита', 'постфлоп']
  }),
  T({
    id: 'ADV9B_RIVER_THIN',
    street: 'РИВЕР', format: 'MTT', blinds: [700, 1400], ante: 175, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '26 LEFT', position: 'CO', hero: ['9♠', '8♠'], heroStack: 44, villain: 'BB',
    villainStack: 42, opp: 'РЕГ', board: ['9♣', '6♦', '2♠', '4♥', 'A♦'], pot: 18,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'CO 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'CO 55%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 18 }
    ],
    question: 'Что делаешь с 98 (вторая пара) на ривере 9624A?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'ЧЕК', alsoOk: [],
    concept: 'river thin second pair', explain: '98 — вторая пара на 9624A с тузом. Тонкая ставка проигрывает лучшим 9x/6x; чек — шоудаун против широкого BB.',
    difficulty: 4, tags: ['ривер', 'тонкое значение', 'чек', 'постфлоп']
  }),
  T({
    id: 'ADV9B5_BLUFFCATCH_PRICE',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '37 LEFT', position: 'BB', hero: ['J♠', '9♠'], heroStack: 40, villain: 'BTN',
    villainStack: 38, opp: 'РЕГ', board: ['J♣', '7♦', '3♠', '2♥', '5♣'], pot: 20,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 4.7 },
      { street: 'ФЛОП', text: 'check-check.', pot: 4.7 },
      { street: 'ТЁРН', text: 'BB ставит 50%, BTN колл.', pot: 10 },
      { street: 'РИВЕР', text: 'BTN ставит 30%.', pot: 20 }
    ],
    question: 'Что делаешь с J9 (топ-пара) на ривере J7325 против маленькой ставки?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'river price defense J9', explain: 'Маленький сайз даёт отличную цену. J9 — топ-пара, колл +EV против широкого диапазона BTN. Рейз превращает в блеф.',
    difficulty: 5, tags: ['ривер', 'блеф-кетч', 'цена', 'защита']
  }),
  T({
    id: 'ADV9B5_EXPLOIT_NIT_3B',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '28 LEFT', position: 'BTN', hero: ['7♠', '6♠'], heroStack: 42, villain: 'BB',
    villainStack: 40, opp: 'НИТ', board: [], pot: 5.4,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN открыл 2.2, нитовый BB трибетил 10 ББ.', pot: 5.4 }],
    question: 'Что делаешь с 76s на BTN против трибета нита?',
    options: ['ФОЛД', 'КОЛЛ', '4-БЕТ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'exploit nit 3bet fold', explain: 'Нит трибетит только премиум. 76s — фолд: диапазон трибета нита — QQ+/AK, колл доминируется.',
    difficulty: 5, tags: ['префлоп', 'эксплойт', 'нит', 'фолд']
  }),
  T({
    id: 'ADV9B5_POSITION_SB_STEAL',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '14 LEFT', position: 'SB', hero: ['A♠', '4♠'], heroStack: 16, villain: 'BB',
    villainStack: 30, opp: 'ТАЙТ', board: [], pot: 4.5,
    history: [{ street: 'ПРЕФЛОП', text: 'Все до SB сфолдили. SB при 16 ББ, тайтовый BB.', pot: 4.5 }],
    question: 'Что делаешь с A4s в SB при 16 ББ против тайтового BB?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['РЕЙЗ'],
    concept: 'SB steal vs tight BB', explain: 'Тайтовый BB фолдит 75%+. A4s — пуш из SB: fold equity и блокер на туза. Рейз оставляет 10 ББ — менее оптимально.',
    difficulty: 5, tags: ['префлоп', 'позиция', 'стил', 'короткий стек']
  }),
  T({
    id: 'ADV9B5_STACKDEPTH_FLOP',
    street: 'ФЛОП', format: 'CASH', blinds: [1, 2], ante: 0, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '150 ББ', position: 'BB', hero: ['Q♥', 'Q♦'], heroStack: 150, villain: 'BTN',
    villainStack: 140, opp: 'РЕГ', board: ['Q♣', '8♠', '3♦'], pot: 18,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл 2.5, BB трибетил 10, BTN заколлил.', pot: 18 },
      { street: 'ФЛОП', text: 'BB чек, BTN ставит 50%.', pot: 18 }
    ],
    question: 'Что делаешь с сетом дам на 150 ББ в трибет-поте на Q83?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: [],
    concept: 'deep flop set QQ', explain: 'Сет на 150 ББ — чек-рейз максимизирует: BTN имеет Qx/8x/дро. Медленная игра оставляет деньги на столе на глубоких стеках.',
    difficulty: 5, tags: ['флоп', 'глубина стека', 'сет', 'ценность']
  }),
  T({
    id: 'ADV9B5_ICM_COVER_SHOVE',
    street: 'ПРЕФЛОП', format: 'PKO', blinds: [1200, 2400], ante: 300, stage: 'ФИНАЛЬНЫЙ СТОЛ',
    table: '6-MAX', left: '5 LEFT', position: 'CO', hero: ['A♥', 'Q♥'], heroStack: 11, villain: 'BTN',
    villainStack: 45, opp: 'РЕГ', board: [], pot: 5.8,
    history: [{ street: 'ПРЕФЛОП', text: 'Финальный стол PKO. CO при 11 ББ, BTN — средний стек 45 ББ.', pot: 5.8 }],
    question: 'Что делаешь с AQs в CO при 11 ББ на финальном столе PKO?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: [],
    concept: 'PKO FT short shove', explain: 'При 11 ББ AQs — пуш: ICM давит на оппонентов, баунти добавляет overlay. Рейз-фолд теряет fold equity.',
    difficulty: 5, tags: ['PKO', 'финальный стол', 'ICM', 'пуш']
  }),
  T({
    id: 'ADV9B5_RANGE_FLOP_CALL',
    street: 'ФЛОП', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '41 LEFT', position: 'BB', hero: ['T♣', '9♣'], heroStack: 48, villain: 'CO',
    villainStack: 46, opp: 'РЕГ', board: ['J♠', '8♦', '4♣'], pot: 6.0,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'BB чек, CO ставит 40%.', pot: 6.0 }
    ],
    question: 'Что делаешь с T9s и гатшотом на J84 против с-бета?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: ['РЕЙЗ'],
    concept: 'flop range defense T9s', explain: 'T9s — гатшот + оверкарты. Колл реализует equity против широкого CO. Рейз — полу-блеф с дро.',
    difficulty: 5, tags: ['флоп', 'диапазон', 'дрова', 'постфлоп']
  }),
  T({
    id: 'ADV9B5_BLUFFING_RIVER',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '23 LEFT', position: 'BTN', hero: ['5♠', '4♠'], heroStack: 48, villain: 'BB',
    villainStack: 46, opp: 'РЕГ', board: ['K♦', 'Q♣', '9♠', '3♥', '2♣'], pot: 20,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BTN 55%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 20 }
    ],
    question: 'Что делаешь с промахом 54s на ривере KQ932 после двух баррелей?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'river polar 54s', explain: 'KQ9 доска credible для BTN. Третий баррель — поляризация: BB сфолдит 9x/слабые пары. 54s без блокеров, но fold equity высокое.',
    difficulty: 5, tags: ['ривер', 'блеф', 'поляризация', 'бареллинг']
  }),
  T({
    id: 'ADV9B5_SIZING_TURN',
    street: 'ТЁРН', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '43 LEFT', position: 'CO', hero: ['A♠', 'A♣'], heroStack: 50, villain: 'BB',
    villainStack: 48, opp: 'РЕГ', board: ['A♦', '7♠', '2♣', 'K♠'], pot: 14,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'CO 40%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек.', pot: 14 }
    ],
    question: 'Какой сайзинг на тёрне с сетом тузов на A72K?',
    options: ['ЧЕК', 'СТАВКА 33%', 'СТАВКА 100%'], correct: 'СТАВКА 100%', alsoOk: ['СТАВКА 33%'],
    concept: 'turn overbet set AA', explain: 'Сет на тёрне с K♠ — овербет собирает с Ax/Kx/7x. 33% оставляет ценность; 100% максимизирует против широкого BB.',
    difficulty: 5, tags: ['тёрн', 'сайзинг', 'овербет', 'ценность']
  }),
  T({
    id: 'ADV9B5_SHORT_BB_DEFEND',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1500, 3000], ante: 400, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '13 LEFT', position: 'BB', hero: ['K♣', 'T♣'], heroStack: 12, villain: 'BTN',
    villainStack: 28, opp: 'РЕГ', board: [], pot: 5.0,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN открыл 2.2, BB при 12 ББ.', pot: 5.0 }],
    question: 'Что делаешь с KTs в BB при 12 ББ против открытия BTN?',
    options: ['ФОЛД', 'КОЛЛ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['КОЛЛ'],
    concept: 'BB short stack defend', explain: 'При 12 ББ KTs — пуш из BB: pot odds и fold equity. Колл оставляет 8 ББ — слишком коротко для постфлопа.',
    difficulty: 5, tags: ['префлоп', 'короткий стек', 'защита BB', 'пуш']
  }),
  T({
    id: 'ADV9B5_POSTFLOP_TURN',
    street: 'ТЁРН', format: 'MTT', blinds: [700, 1400], ante: 175, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '25 LEFT', position: 'BB', hero: ['J♠', 'T♠'], heroStack: 46, villain: 'CO',
    villainStack: 44, opp: 'АГРО-РЕГ', board: ['J♣', '8♦', '3♠', '2♥'], pot: 14,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO 50%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'BB чек, CO ставит 70%.', pot: 14 }
    ],
    question: 'Что делаешь с JT (топ-пара) на тёрне J832 против агрессии?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'КОЛЛ', alsoOk: ['РЕЙЗ'],
    concept: 'turn defense top pair JT', explain: 'JT — топ-пара. Агро-рег баррелит широко — колл защищает диапазон. Рейз превращает в блеф против сильного Jx.',
    difficulty: 5, tags: ['тёрн', 'блеф-кетч', 'постфлоп', 'защита']
  })
];
