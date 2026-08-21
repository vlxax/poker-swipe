// Phase 9: difficulty 4–5 training tasks — reg-level spots with competing factors.
// Uses the same schema as library.js; imported into the main task library.

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

export const ADVANCED_TASKS = [
  /* ============ DIFFICULTY 4 · advanced competing factors ============ */
  T({
    id: 'ADV_ICM_COVER_A5S',
    street: 'ПРЕФЛОП', format: 'PKO', blinds: [1500, 3000], ante: 400, stage: 'ФИНАЛЬНЫЙ СТОЛ',
    table: '6-MAX', left: '5 LEFT', position: 'CO', hero: ['A♣', '5♣'], heroStack: 38, villain: 'BTN',
    villainStack: 22, opp: 'РЕГ', board: [], pot: 9.4,
    history: [{ street: 'ПРЕФЛОП', text: 'Финальный стол PKO. CO открыл 2.2, BTN с баунти 3-бетил 9 ББ, ты покрываешь.', pot: 9.4 }],
    question: 'Что делаешь с A5s в CO против 3-бета короткого стека с баунти на финальном столе?',
    options: ['ФОЛД', 'КОЛЛ', '4-БЕТ'], correct: '4-БЕТ', alsoOk: [],
    concept: 'PKO ICM 4-bet polar', explain: 'Покрывая баунти, 4-бет давит на короткий стек и блокирует AA/AK. A5s — классический полярный 4-бет-блеф с блокерами на туза.',
    difficulty: 4, tags: ['префлоп', 'ICM', 'PKO', '4-бет', 'блокеры', 'баунти']
  }),
  T({
    id: 'ADV_TURN_BLOCKER_BARREL',
    street: 'ТЁРН', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '24 LEFT', position: 'BTN', hero: ['K♠', 'J♠'], heroStack: 52, villain: 'BB',
    villainStack: 48, opp: 'РЕГ', board: ['Q♠', '8♣', '3♦', '2♠'], pot: 16,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BTN 33%, BB колл.', pot: 11 },
      { street: 'ТЁРН', text: 'BB чек.', pot: 16 }
    ],
    question: 'Что делаешь с KJs и бэкдор-флашем на тёрне Q832?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'turn barrel blockers', explain: 'KJs блокирует KQ/KJ и имеет бэкдор-флаш. Второй баррель давит на слабые пары BB и реализует фолд-эквити + дро.',
    difficulty: 4, tags: ['тёрн', 'бареллинг', 'блокеры', 'блеф', 'постфлоп']
  }),
  T({
    id: 'ADV_RIVER_THIN_BLOCK',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '33 LEFT', position: 'CO', hero: ['A♥', '8♥'], heroStack: 44, villain: 'BB',
    villainStack: 41, opp: 'РЕГ', board: ['A♦', '9♣', '5♠', '3♥', '2♣'], pot: 22,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'CO 40%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'CO 50%, BB колл.', pot: 18 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 22 }
    ],
    question: 'Что делаешь с A8 на ривере A9532 против чека?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'thin value blockers', explain: 'A8 блокирует Ax коллы и добирает с 9x/5x. Тонкий сайзинг: BB редко имеет лучше, но платит с парой и слабым тузом.',
    difficulty: 4, tags: ['ривер', 'тонкое значение', 'блокеры', 'сайзинг']
  }),
  T({
    id: 'ADV_3BPOT_AKQ_SCARY',
    street: 'ФЛОП', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '22 LEFT', position: 'BB', hero: ['A♣', 'K♣'], heroStack: 58, villain: 'BTN',
    villainStack: 55, opp: 'АГРО-РЕГ', board: ['J♠', 'T♠', '8♦'], pot: 28,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB 3-бетил, BTN заколлил.', pot: 28 },
      { street: 'ФЛОП', text: 'BB чек, BTN ставит 55%.', pot: 28 }
    ],
    question: 'Что делаешь с AKs в 3-бет-поте на координатной доске JT8?',
    options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: '3bet pot check-raise', explain: 'AKs имеет оверкарты, гатшот и бэкдор-флаш. Чек-рейз на JT8 давит на одномастные дро и слабые пары агрессора.',
    difficulty: 4, tags: ['флоп', 'трибет-пот', 'чек-рейз', 'диапазон', 'постфлоп']
  }),
  T({
    id: 'ADV_BB_DEF_MERGE',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '18 LEFT', position: 'BB', hero: ['T♠', '8♠'], heroStack: 28, villain: 'BTN',
    villainStack: 32, opp: 'АГРО-РЕГ', board: [], pot: 7.0,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN открыл 2.2, SB сфолдил. Анте высокие, эффективный стек ~28 ББ.', pot: 7.0 }],
    question: 'Что делаешь с T8s в BB против широкого оупена при среднем стеке?',
    options: ['ФОЛД', 'КОЛЛ', '3-БЕТ'], correct: 'КОЛЛ', alsoOk: ['3-БЕТ'],
    concept: 'BB merge defence', explain: 'T8s реализует equity против широкого BTN. Колл сохраняет диапазон; 3-бет-блеф тоже допустим, но колл — базовая линия.',
    difficulty: 4, tags: ['префлоп', 'защита BB', 'диапазон', 'позиция']
  }),
  T({
    id: 'ADV_FLOP_XR_RANGE',
    street: 'ФЛОП', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '40 LEFT', position: 'BB', hero: ['9♦', '8♦'], heroStack: 50, villain: 'BTN',
    villainStack: 47, opp: 'РЕГ',     board: ['7♦', '6♣', '5♠'], pot: 5.4,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 4.7 },
      { street: 'ФЛОП', text: 'BB чек, BTN ставит 33%.', pot: 5.4 }
    ],
    question: 'Что делаешь с 98s и натсовым стритом на флопе 765?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'flop check-raise range', explain: '98s — натсовый стрит 9-high на 765. Чек-рейз максимизирует ценность против с-бета и дров BTN; колл тоже ок, но рейз предпочтительнее.',
    difficulty: 4, tags: ['флоп', 'чек-рейз', 'диапазон', 'постфлоп']
  }),
  T({
    id: 'ADV_TURN_SPR_COMMIT',
    street: 'ТЁРН', format: 'CASH', blinds: [5, 10], ante: 0, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '6 СТЕКОВ', position: 'BTN', hero: ['J♣', 'J♦'], heroStack: 95, villain: 'BB',
    villainStack: 92, opp: 'РЕГ', board: ['T♠', '7♣', '3♦', '2♥'], pot: 18,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл 2.5, BB заколлил.', pot: 5.5 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BB чек.', pot: 18 }
    ],
    question: 'Что делаешь с JJ на тёрне T732 при SPR ~5?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'turn SPR value', explain: 'JJ — оверпара на сухом тёрне. При SPR ~5 ставка готовит коммит на ривере и защищает от дров 89/86.',
    difficulty: 4, tags: ['тёрн', 'SPR', 'глубина стека', 'ценность', 'постфлоп']
  }),
  T({
    id: 'ADV_RIVER_BLUFFCATCH_BLOCK',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '25 LEFT', position: 'BB', hero: ['A♠', '4♠'], heroStack: 40, villain: 'BTN',
    villainStack: 38, opp: 'АГРО-РЕГ', board: ['K♦', 'J♣', '7♠', '3♥', '2♦'], pot: 26,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'check-check.', pot: 5.6 },
      { street: 'ТЁРН', text: 'BB ставит 55%, BTN колл.', pot: 13 },
      { street: 'РИВЕР', text: 'BTN ставит 120% банка.', pot: 26 }
    ],
    question: 'Что делаешь с A4s против овербета на ривере KJ732?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'river defense blockers', explain: 'A4s блокирует AK/AJ и часть блефов. Против агро-рега овербет на ривере после чек-флопа — колл с блокерами на натсы.',
    difficulty: 4, tags: ['ривер', 'блеф-кетч', 'блокеры', 'диапазон']
  }),
  T({
    id: 'ADV_PREFLOP_MERGE_4B',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '35 LEFT', position: 'BTN', hero: ['T♠', 'T♦'], heroStack: 62, villain: 'BB',
    villainStack: 59, opp: 'АГРО-РЕГ', board: [], pot: 7.0,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN открыл 2.2, BB 3-бетил 10 ББ.', pot: 7.0 }],
    question: 'Что делаешь с TT против агрессивного 3-бета из BB?',
    options: ['ФОЛД', 'КОЛЛ', '4-БЕТ'], correct: '4-БЕТ', alsoOk: ['КОЛЛ'],
    concept: 'merge 4-bet TT', explain: 'Против агро-рега TT можно 4-бетить по ценности/блокеру: доминируем AQ/AJ и изолируем. Колл тоже стандарт, но 4-бет эксплуатирует широкий 3-бет.',
    difficulty: 4, tags: ['префлоп', '4-бет', 'против трибета', 'диапазон']
  }),
  T({
    id: 'ADV_ICM_SHORT_COVER',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [2000, 4000], ante: 500, stage: 'ФИНАЛЬНЫЙ СТОЛ',
    table: '6-MAX', left: '4 LEFT', position: 'SB', hero: ['K♠', 'Q♠'], heroStack: 18, villain: 'BB',
    villainStack: 45, opp: 'РЕГ', board: [], pot: 2.25,
    history: [{ street: 'ПРЕФЛОП', text: 'Финальный стол, 4 left. Все до SB сфолдили. BB — чиплидер 45 ББ.', pot: 2.25 }],
    question: 'Что делаешь с KQs в SB при 18 ББ на финальном столе?',
    options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['РЕЙЗ'],
    concept: 'final table ICM shove', explain: 'При 18 ББ KQs — пуш из SB: ICM давит на BB, но рука слишком сильна для фолда. Рейз-фолд теряет fold equity.',
    difficulty: 4, tags: ['финальный стол', 'ICM', 'короткий стек', 'пуш']
  }),
  T({
    id: 'ADV_RIVER_OVERBET_POLAR',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '27 LEFT', position: 'BTN', hero: ['Q♣', 'Q♦'], heroStack: 48, villain: 'BB',
    villainStack: 45, opp: 'РЕГ', board: ['J♠', '8♣', '4♦', '2♥', '2♠'], pot: 20,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BTN 55%, BB колл.', pot: 20 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 20 }
    ],
    question: 'Что делаешь с QQ на ривере J8422?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'polarized river overbet', explain: 'QQ — оверпара на спаренном ривере. Крупный полярный сайзинг давит на Jx/8x и изолирует коллы; чек теряет ценность.',
    difficulty: 4, tags: ['ривер', 'овербет', 'поляризация', 'сайзинг']
  }),
  T({
    id: 'ADV_MULTIWAY_TURN',
    street: 'ТЁРН', format: 'MTT', blinds: [500, 1000], ante: 125, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '42 LEFT', position: 'CO', hero: ['A♦', 'K♦'], heroStack: 55, villain: 'BB',
    villainStack: 52, opp: 'РЕГ', board: ['K♣', '7♠', '3♦', '9♣'], pot: 14,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BTN заколлил, BB заколлил.', pot: 9.0 },
      { street: 'ФЛОП', text: 'Все чек до CO. CO 50%, BB колл, BTN фолд.', pot: 14 },
      { street: 'ТЁРН', text: 'BB чек.', pot: 14 }
    ],
    question: 'Что делаешь с топ-парой AK в 3-уэй поте на тёрне K739?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'multiway turn value', explain: 'Топ-пара в 3-уэй поте требует защиты: 9♣ добавляет дрова. Ставка собирает с Kx и дров BB, контролирует размер банка.',
    difficulty: 4, tags: ['тёрн', 'многосторонний', 'ценность', 'постфлоп']
  }),

  /* ============ DIFFICULTY 5 · reg-level multi-factor spots ============ */
  T({
    id: 'ADV5_ICM_BUBBLE_QQ',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1200, 2400], ante: 300, stage: 'БАББЛ',
    table: '6-MAX', left: '7 LEFT', position: 'BB', hero: ['Q♥', 'Q♣'], heroStack: 16, villain: 'SB',
    villainStack: 28, opp: 'РЕГ', board: [], pot: 8.2,
    history: [{ street: 'ПРЕФЛОП', text: 'Баббл: 7 left, призовых 6. SB запушил 28 ББ. Средний стек за столом ~22 ББ.', pot: 8.2 }],
    question: 'Что делаешь с QQ в BB при 16 ББ на баббле против пуша SB?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'bubble ICM QQ call', explain: 'QQ слишком сильна для ICM-фолда даже на баббле: колл доминирует AJ/TT/99 и часть Ax. Риск вылета компенсируется chipEV.',
    difficulty: 5, tags: ['баббл', 'ICM', 'колл', 'пары']
  }),
  T({
    id: 'ADV5_RIVER_BLOCKER_BLUFF',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '23 LEFT', position: 'BTN', hero: ['A♣', '4♣'], heroStack: 50, villain: 'BB',
    villainStack: 47, opp: 'РЕГ', board: ['K♠', 'Q♦', '7♣', '3♠', '2♥'], pot: 24,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BTN 66%, BB колл.', pot: 24 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 24 }
    ],
    question: 'Что делаешь с A4s на ривере KQ732 после трёх улиц агрессии?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'river blocker bluff', explain: 'A4s блокирует AK/AQ и часть KQ. На ривере после тройного бареля — полярный блеф: BB сфолдит большинство пар без топ-силы.',
    difficulty: 5, tags: ['ривер', 'блеф', 'блокеры', 'поляризация']
  }),
  T({
    id: 'ADV5_FT_AJ_ICM',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [2500, 5000], ante: 600, stage: 'ФИНАЛЬНЫЙ СТОЛ',
    table: '6-MAX', left: '3 LEFT', position: 'BB', hero: ['A♦', 'J♣'], heroStack: 12, villain: 'BTN',
    villainStack: 80, opp: 'АГРО-РЕГ', board: [], pot: 15.0,
    history: [{ street: 'ПРЕФЛОП', text: 'Финальный стол, 3 left. BTN-чиплидер запушил 80 ББ. Ты — короткий стек 12 ББ.', pot: 15.0 }],
    question: 'Что делаешь с AJo на финальном столе против пуша чиплидера?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'final table ICM fold AJo', explain: 'AJo против пуша 80 ББ при 3 left — жёсткий ICM-фолд: доминируется Ax и парами, а приз за 3-е место слишком ценен.',
    difficulty: 5, tags: ['финальный стол', 'ICM', 'фолд', 'префлоп']
  }),
  T({
    id: 'ADV5_3STREET_BLUFF',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '36 LEFT', position: 'CO', hero: ['J♠', 'T♠'], heroStack: 48, villain: 'BB',
    villainStack: 45, opp: 'РЕГ', board: ['A♣', '8♦', '4♠', '2♥', 'K♣'], pot: 22,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'CO 33%, BB колл.', pot: 10 },
      { street: 'ТЁРН', text: 'CO 55%, BB колл.', pot: 16 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 22 }
    ],
    question: 'Что делаешь с JTs (промах) на ривере A842K после двух баррелей?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'triple barrel bluff', explain: 'JTs промахнул, но линия A84-K даёт credibility. Третий баррель на ривере — полярный блеф: BB сфолдит слабые Ax и пары.',
    difficulty: 5, tags: ['ривер', 'блеф', 'бареллинг', 'многоулица', 'постфлоп']
  }),
  T({
    id: 'ADV5_RIVER_BLUFFCATCH_KQ',
    street: 'РИВЕР', format: 'MTT', blinds: [1000, 2000], ante: 250, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '20 LEFT', position: 'BB', hero: ['K♦', 'Q♦'], heroStack: 42, villain: 'BTN',
    villainStack: 40, opp: 'АГРО-РЕГ', board: ['K♣', '9♠', '5♥', '3♦', 'A♠'], pot: 28,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, BTN 50%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BB чек, BTN 75%, BB колл.', pot: 22 },
      { street: 'РИВЕР', text: 'BTN ставит 130% банка.', pot: 28 }
    ],
    question: 'Что делаешь с KQ на ривере K953A против овербета?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', alsoOk: [],
    concept: 'river KQ fold defense', explain: 'KQ — вторая пара на ривере с тузом. Овербет полярен: у агро-рега много Ax и двух пар. Блокеры на KQ недостаточны — фолд.',
    difficulty: 5, tags: ['ривер', 'блеф-кетч', 'блокеры', 'овербет']
  }),
  T({
    id: 'ADV5_DEEP_4BET_AK',
    street: 'ПРЕФЛОП', format: 'CASH', blinds: [5, 10], ante: 0, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '6 СТЕКОВ', position: 'BTN', hero: ['A♠', 'K♠'], heroStack: 150, villain: 'BB',
    villainStack: 180, opp: 'РЕГ', board: [], pot: 52,
    history: [{ street: 'ПРЕФЛОП', text: 'BTN открыл 2.5, BB 3-бетил 10, BTN 4-бетил 28, BB 5-бетил до 52.', pot: 52 }],
    question: 'Что делаешь с AKs на 150 ББ против 5-бета?',
    options: ['ФОЛД', 'КОЛЛ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['КОЛЛ'],
    concept: 'deep 5-bet AK', explain: 'AKs на глубоких стеках против 5-бета — олл-ин: блокируем AA/KK, доминируем AQ/AJ. Колл оставляет сложный постфлоп.',
    difficulty: 5, tags: ['кэш', '4-бет', '5-бет', 'префлоп', 'глубина стека']
  }),
  T({
    id: 'ADV5_TURN_RANGE_XR',
    street: 'ТЁРН', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '26 LEFT', position: 'BB', hero: ['8♠', '7♠'], heroStack: 54, villain: 'CO',
    villainStack: 50, opp: 'АГРО-РЕГ', board: ['9♦', '6♣', '5♥', 'K♠'], pot: 22,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'BB чек, CO 60%, BB колл.', pot: 14 },
      { street: 'ТЁРН', text: 'CO ставит 75%.', pot: 22 }
    ],
    question: 'Что делаешь с 87s и стритом на тёрне 965K?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: ['КОЛЛ'],
    concept: 'turn XR nut straight', explain: '87s — натсовый стрит 9-high на 965. Чек-рейз на тёрне после агрессии CO максимизирует ценность и изолирует Kx/дро.',
    difficulty: 5, tags: ['тёрн', 'чек-рейз', 'диапазон', 'постфлоп']
  }),
  T({
    id: 'ADV5_ICM_PKO_OVERLAY',
    street: 'ПРЕФЛОП', format: 'PKO', blinds: [1000, 2000], ante: 250, stage: 'ITM',
    table: '6-MAX', left: '12 LEFT', position: 'BB', hero: ['J♠', 'T♠'], heroStack: 24, villain: 'BTN',
    villainStack: 26, opp: 'РЕГ', board: [], pot: 8.0,
    history: [{ street: 'ПРЕФЛОП', text: 'PKO ITM. BTN с баунти запушил 26 ББ. Ты покрываешь и имеешь свой баунти.', pot: 8.0 }],
    question: 'Что делаешь с JTs в BB против баунти-пуша в PKO ITM?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: 'PKO bounty overlay call', explain: 'Баунти + pot odds делают колл JTs прибыльным: покрываем BTN, получаем overlay и chipEV от доминации слабых пушей.',
    difficulty: 5, tags: ['PKO', 'ICM', 'баунти', 'колл', 'ITM']
  }),
  T({
    id: 'ADV5_RIVER_THIN_SECOND',
    street: 'РИВЕР', format: 'MTT', blinds: [600, 1200], ante: 150, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '32 LEFT', position: 'BTN', hero: ['K♥', 'J♥'], heroStack: 46, villain: 'BB',
    villainStack: 43, opp: 'СТЕЦИОНЕР', board: ['K♣', 'T♦', '6♠', '4♣', '2♦'], pot: 20,
    history: [
      { street: 'ПРЕФЛОП', text: 'BTN открыл, BB заколлил.', pot: 5.2 },
      { street: 'ФЛОП', text: 'BTN 40%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'BTN 55%, BB колл.', pot: 20 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 20 }
    ],
    question: 'Что делаешь с KJ против стационера на ривере KT642?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'thin value vs station', explain: 'KJ — вторая пара, но стационер коллит широко с Tx и слабыми Kx. Тонкая ставка на ривере — максимум EV против пассивного BB.',
    difficulty: 5, tags: ['ривер', 'тонкое значение', 'эксплойт', 'сайзинг']
  }),
  T({
    id: 'ADV5_PREFLOP_5B_JJ',
    street: 'ПРЕФЛОП', format: 'MTT', blinds: [1200, 2400], ante: 300, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '16 LEFT', position: 'CO', hero: ['J♣', 'J♦'], heroStack: 42, villain: 'BTN',
    villainStack: 40, opp: 'АГРО-РЕГ', board: [], pot: 18,
    history: [{ street: 'ПРЕФЛОП', text: 'CO открыл 2.2, BTN 3-бетил 8, CO 4-бетил 20, BTN 5-бетил олл-ин 40.', pot: 18 }],
    question: 'Что делаешь с JJ против 5-бет-пуша при 42 ББ?',
    options: ['ФОЛД', 'КОЛЛ'], correct: 'КОЛЛ', alsoOk: [],
    concept: '5-bet pot JJ call', explain: 'JJ против 5-бет-пуша при 40 ББ эффективных — колл: доминируем TT-99/AQ, против полярного диапазона агро-рега фолд слишком тайт.',
    difficulty: 5, tags: ['префлоп', '5-бет', 'vs 4-бет', 'диапазон']
  }),
  T({
    id: 'ADV5_FLOP_SET_3WAY',
    street: 'ФЛОП', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'СРЕДНЯЯ',
    table: '6-MAX', left: '30 LEFT', position: 'BB', hero: ['6♥', '6♦'], heroStack: 60, villain: 'BTN',
    villainStack: 35, opp: 'РЕГ', board: ['K♦', '6♣', '3♠'], pot: 32,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BTN заколлил, BB сквизил 12 ББ, оба заколлили.', pot: 32 },
      { street: 'ФЛОП', text: 'BTN ставит 50% банка.', pot: 32 }
    ],
    question: 'Что делаешь с сетом шестёрок в сквизнутом 3-уэй поте на K63?',
    options: ['КОЛЛ', 'РЕЙЗ'], correct: 'РЕЙЗ', alsoOk: [],
    concept: 'set in squeeze pot', explain: 'Сет в большом 3-уэй поте — монстр. Чек-рейз (или рейз) максимизирует ценность: BTN и CO имеют Kx, дро и оверпары.',
    difficulty: 5, tags: ['флоп', 'сет', 'многосторонний', 'постфлоп']
  }),
  T({
    id: 'ADV5_RIVER_SIZING_BLOCK',
    street: 'РИВЕР', format: 'MTT', blinds: [800, 1600], ante: 200, stage: 'ПОЗДНЯЯ',
    table: '6-MAX', left: '21 LEFT', position: 'CO', hero: ['Q♠', 'T♠'], heroStack: 52, villain: 'BB',
    villainStack: 49, opp: 'РЕГ', board: ['Q♦', '8♣', '3♠', '5♥', '2♣'], pot: 24,
    history: [
      { street: 'ПРЕФЛОП', text: 'CO открыл, BB заколлил.', pot: 5.6 },
      { street: 'ФЛОП', text: 'CO 40%, BB колл.', pot: 12 },
      { street: 'ТЁРН', text: 'CO 60%, BB колл.', pot: 20 },
      { street: 'РИВЕР', text: 'BB чек.', pot: 24 }
    ],
    question: 'Что делаешь с QTs на ривере Q8352 против чека?',
    options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА', alsoOk: [],
    concept: 'river sizing TPTK', explain: 'QT — топ-пара с хорошим кикером. Крупная ставка (~75% банка) собирает с Qx/8x/дров; чек оставляет ценность на столе против широкого BB.',
    difficulty: 5, tags: ['ривер', 'сайзинг', 'ценность', 'блокеры']
  })
];
