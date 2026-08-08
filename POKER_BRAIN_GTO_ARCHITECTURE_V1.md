# POKER BRAIN V1
## Архитектура GTO / solver-базы для POKER SWIPE

**Цель документа:** превратить приложение из набора красивых тренировок в систему, которая действительно понимает покерные ситуации, умеет честно оценивать решения, объяснять причины, строить диапазоны и персонально находить лики.

**Версия:** 1.0  
**Дата:** 08.08.2026  
**Продукт:** POKER SWIPE / «Фриковая Дама»

---

# 1. Что именно значит «дать приложению мозг»

Сейчас интерфейс уже умеет показывать раздачи, принимать решения и визуализировать отдельные навыки. Но сам по себе красивый UI не знает покер. Если внутри каждой раздачи вручную записано `best: CALL`, приложение остаётся коллекцией карточек, а не тренажёром.

**Poker Brain** должен отвечать на шесть вопросов независимо от конкретного экрана:

1. **Какое игровое состояние сейчас перед нами?** Формат, позиции, стек, банк, ante/rake, борд, история ставок, доступные действия.
2. **Какие диапазоны у игроков на этом node?** Не «у него может быть AK», а weighted range с комбинациями и частотами.
3. **Какие действия живут и с какой частотой/EV?** Check, bet 25, bet 75, shove и т.д.
4. **Насколько дорого выбранное действие?** Не только правильно/неправильно, а EV loss и педагогическая категория.
5. **Почему решение работает?** Range advantage, nut advantage, blockers, pot odds, SPR, ICM, equity realization, bluff density, value targets и т.д.
6. **Что это говорит именно о пользователе?** Случайная ошибка, системный leak, уверенная ошибка, повторный leak, уже вылеченная тема.

Главная архитектурная идея:

> **Solver не должен быть интерфейсом. Solver должен быть источником истины под интерфейсом.**

Пользователь не обязан видеть 1326 комбинаций и частоты 37.4%. Он должен получить правильное упражнение, честный verdict и понятную причину.

---

# 2. Четыре слоя Poker Brain

## Слой A — Game State Engine

Это движок, который понимает саму раздачу.

Он хранит и валидирует:
- game type: NLHE;
- cash / MTT;
- max players: 6-max в базовом продукте;
- positions: UTG, HJ, CO, BTN, SB, BB;
- effective stack;
- blinds / ante;
- pot;
- board;
- hero hole cards;
- action history;
- legal actions;
- available sizes;
- SPR;
- street;
- ICM context, если он есть.

Именно этот слой не позволяет приложению сделать ошибку типа **CALL вместо CHECK**, когда до Hero никто не ставил.

## Слой B — Poker Math Engine

Работает даже без solver-базы.

Должен уметь точно считать:
- pot odds;
- required equity;
- SPR;
- MDF как справочный показатель;
- размер ставки в BB и % pot;
- pot после action;
- effective stack после action;
- количество комбинаций;
- card removal;
- blocker/unblocker effects;
- all-in equity для известных двух рук;
- equity против заданного диапазона;
- простые ICM utility calculations на позднем этапе развития продукта.

Это слой, где **никогда нельзя придумывать цифры**.

## Слой C — Solver Knowledge Base

Это собственная база solver-backed решений.

Она хранит:
- canonical spot;
- стартовые ranges;
- дерево ставок;
- strategy frequencies;
- EV каждого действия;
- strategy каждой combo;
- range после каждого action;
- solve accuracy / exploitability;
- конфигурацию solver;
- источник и версию solve.

## Слой D — Pedagogy + Personalization

Solver отвечает «что максимизирует EV», но почти не объясняет человеку **почему**.

Поэтому поверх solver нужен второй интеллектуальный слой:
- concept tags;
- natural-language explanations;
- difficulty;
- prerequisites;
- mistake taxonomy;
- transfer questions;
- spaced repetition;
- leak detection;
- confidence tracking;
- рекомендация следующей тренировки.

Именно этот слой превращает solver output в POKER SWIPE.

---

# 3. Почему нельзя просто «подключить базу GTO Wizard»

GTO Wizard — отличный ориентир по продукту и структуре solver-инструмента, но не готовый легальный источник базы для нашего приложения.

На август 2026 года их публичные Terms прямо запрещают коммерческое использование ranges, poker trees и charts, полученных из сервиса, а также автоматизированные запросы/scripts внутри сервиса. Их Benchmark API имеет отдельное узкое назначение: подключение poker agent для benchmark, а не массовая выгрузка solution library.

Поэтому архитектура должна быть такой:

**НЕ:**
`наш сайт → автоматом спрашивает GTO Wizard → сохраняет ответ → показывает пользователю`

**ДА:**
`наша solve-конфигурация → лицензированный solver → наш raw output → наша нормализация → наша база → наше приложение`

GTO Wizard можно использовать как:
- UX benchmark;
- способ вручную проверять отдельные контрольные spot'ы;
- образовательный reference;
- источник публичных материалов о solver theory.

Но не как database dump.

---

# 4. Откуда брать собственные solver-данные

## Вариант 1 — PioSOLVER как основной production solver

Для heads-up postflop это самый понятный путь.

Плюсы:
- зрелый solver;
- text interface;
- scripting;
- aggregation reports;
- можно автоматизировать batch solves;
- удобно сохранять trees и стратегии.

Минусы:
- коммерческая лицензия стоит денег;
- postflop HU, а не универсальный multiway engine;
- большую library всё равно надо вычислять самим.

**Рекомендация:** хороший кандидат для production solve factory, если проект получает бюджет.

## Вариант 2 — TexasSolver

Open-source solver полезен для прототипирования и понимания pipeline. Но его репозиторий отдельно указывает, что коммерческая интеграция кода или предоставление solver-сервиса через интернет требует отдельной коммерческой лицензии.

**Рекомендация:** использовать только после проверки и согласования лицензии.

## Вариант 3 — свой solver service / research stack

Долгосрочно можно строить собственный CFR-пайплайн или использовать лицензированный solver на облачной машине и сохранять только результаты.

На старте это избыточно.

## Практический выбор

Для первой реальной умной версии:

1. **Preflop** — собственные лицензированные/сгенерированные charts и frequencies.
2. **Postflop** — batch solves из PioSOLVER или другого solver с разрешением на production use.
3. **Runtime в приложении** — никакого solver расчёта. Только чтение подготовленной базы.
4. **Exact river / custom hand analysis** — позже отдельный backend solve service.

---

# 5. Что именно решаем в первой solver-базе

Не нужно пытаться «решить весь покер». Это бесконечное дерево.

Нужна **каноническая учебная библиотека**, из которой приложение умеет генерировать много упражнений.

## 5.1 Базовый формат V1

Рекомендованный MVP:

- No-Limit Hold'em;
- MTT;
- 6-max;
- BB ante;
- без PKO в первой версии;
- chips EV для большинства тренировок;
- отдельный ICM pack для bubble/final table;
- effective stacks: **15 / 20 / 25 / 30 / 40 / 60 BB**.

Почему не 10 разных форматов сразу: если mixing formats не контролировать, пользователь не понимает, почему chart изменился. Сначала нужна одна непротиворечивая экосистема.

## 5.2 Preflop library

Обязательные families:

### RFI
- UTG open;
- HJ open;
- CO open;
- BTN open;
- SB open.

### BB defense
- BB vs UTG;
- BB vs HJ;
- BB vs CO;
- BB vs BTN;
- BB vs SB.

### SB defense
- SB vs CO;
- SB vs BTN.

### vs 3-bet
- opener IP vs blind 3-bet;
- opener OOP vs IP 3-bet;
- BTN vs SB/BB 3-bet;
- CO vs BTN 3-bet.

### 3-bet strategy
- blinds vs late position;
- BTN vs CO;
- CO vs HJ.

### 4-bet / shove thresholds
- для ключевых 15–30 BB structures.

## 5.3 Postflop families

На старте преимущественно heads-up pots:

### SRP IP
- BTN vs BB;
- CO vs BB;
- HJ vs BB.

### SRP OOP
- BB vs BTN/CO/HJ;
- SB vs BB blind-vs-blind.

### 3-bet pots
- BTN vs BB 3-bet;
- BTN vs SB 3-bet;
- CO vs BB 3-bet.

### Street concepts
- flop c-bet;
- flop check-back;
- flop defense;
- turn barrel;
- delayed c-bet;
- turn probe;
- river value;
- river bluff;
- bluff-catch;
- overbet;
- check-raise;
- thin value.

---

# 6. Board taxonomy: база не должна мыслить 22,100 флопами как отдельными мирами

Solver может решать конкретные board'ы, но педагогический движок должен понимать **класс доски**.

Для каждого board сохраняем features:

- paired / unpaired;
- monotone / two-tone / rainbow;
- high-card rank;
- connectedness;
- straight density;
- flush density;
- wheel connectivity;
- broadway density;
- low/mid/high board;
- static/dynamic;
- nut concentration;
- range advantage estimate;
- nut advantage estimate.

Пример:

```json
{
  "board": ["As", "7d", "2c"],
  "texture": {
    "paired": false,
    "suit_texture": "rainbow",
    "connectivity": "low",
    "high_card": "A",
    "dynamicity": 0.18,
    "tags": ["A_HIGH", "DRY", "STATIC"]
  }
}
```

Это позволяет делать не только «запомни A72r», а transfer test на A83r / K72r и проверять, понял ли человек принцип.

---

# 7. Главный идентификатор: canonical spot

Каждый solver spot должен иметь стабильный `spot_id`.

Пример:

`MTT6_30BB_BTN_BB_SRP_A72R`

Но для машины ID лучше делать составным/UUID, а читаемое имя хранить отдельно.

Обязательные поля:

```json
{
  "spot_id": "mtt6_30_btn_bb_srp_a72r_v1",
  "format": "MTT",
  "players": 6,
  "effective_stack_bb": 30,
  "ante": "BB_ANTE",
  "hero_position": "BTN",
  "villain_position": "BB",
  "pot_type": "SRP",
  "street": "FLOP",
  "board": ["As", "7d", "2c"],
  "pot_bb": 5.5,
  "node_owner": "BTN",
  "source_type": "SOLVER",
  "solver_family": "PIOSOLVER",
  "solve_version": "2026-08-mtt30-v1"
}
```

---

# 8. Схема Solver Node

Spot — это ситуация. Node — конкретная точка принятия решения внутри дерева.

```json
{
  "node_id": "node_8f2...",
  "spot_id": "mtt6_30_btn_bb_srp_a72r_v1",
  "street": "FLOP",
  "actor": "BTN",
  "pot_bb": 5.5,
  "effective_stack_bb": 27.8,
  "spr": 5.05,
  "history": [
    {"player":"BTN","action":"RAISE","size_bb":2.2},
    {"player":"BB","action":"CALL","size_bb":2.2},
    {"player":"BB","action":"CHECK"}
  ],
  "legal_actions": [
    {"action_id":"check","type":"CHECK"},
    {"action_id":"b25","type":"BET","size_pct_pot":25},
    {"action_id":"b75","type":"BET","size_pct_pot":75}
  ]
}
```

Никаких hardcoded `CALL`, если ставка отсутствует. Legal actions строятся из game state.

---

# 9. Action Strategy: что на самом деле сказал solver

На каждый node храним strategy уровня **range** и уровня **combo**.

## Range-level

```json
{
  "node_id": "node_8f2...",
  "range_strategy": {
    "check": {"frequency": 0.41, "ev_bb": 3.182},
    "b25":   {"frequency": 0.54, "ev_bb": 3.186},
    "b75":   {"frequency": 0.05, "ev_bb": 3.174}
  }
}
```

## Combo-level

```json
{
  "hand": "QhJh",
  "weight_at_node": 0.82,
  "actions": {
    "check": {"frequency": 0.31, "ev_bb": 3.022},
    "b25":   {"frequency": 0.69, "ev_bb": 3.031},
    "b75":   {"frequency": 0.00, "ev_bb": 2.972}
  }
}
```

Это позволяет приложению перестать мыслить `best = BET`.

---

# 10. Как оценивать пользователя: не «правильно / неправильно»

В интерфейсе остаются четыре человеческие оценки:

- **ЧИСТО**;
- **ЖИВЁТ**;
- **ТОНКО**;
- **ОШИБКА**.

Но они выводятся из двух чисел:

1. solver frequency действия;
2. EV loss относительно лучшего доступного действия.

## Формула

```text
best_ev = max(action_ev)
ev_loss_bb = best_ev - chosen_ev
ev_loss_pot = ev_loss_bb / max(pot_bb, 1)
```

Важно: универсальные пороги нельзя объявить «законом покера». Они калибруются по формату, street и точности solve.

Стартовая педагогическая политика может быть такой:

| Категория | Условие-ориентир |
|---|---|
| ЧИСТО | действие solver-live и EV loss практически в пределах solve noise |
| ЖИВЁТ | действие имеет заметную frequency или минимальный EV loss |
| ТОНКО | редкое действие, но не катастрофа |
| ОШИБКА | действие почти не используется и/или EV loss явно значим |

**Не наказывать mixed strategy.** Если CALL 38% и RAISE 62%, CALL не становится ошибкой только потому, что RAISE чаще.

---

# 11. Sizing Brain: ползунок должен понимать не одну «магическую цифру»

В Sizing пользователь выбирает свободный размер.

Solver library хранит дискретные actions, например 25 / 75 / 125. Пользователь может поставить 61%.

Нужен sizing interpreter.

## V1

Для каждого spot вручную/алгоритмически сохраняются:
- `preferred_zones`;
- `acceptable_zones`;
- `bad_zones`;
- `check_live`.

Пример:

```json
{
  "sizing_profile": {
    "check_live": true,
    "preferred_zones": [[45, 70]],
    "acceptable_zones": [[30, 44], [71, 85]],
    "bad_zones": [[1, 29], [86, 200]]
  }
}
```

## V2

Интерполировать EV между solved sizes **только осторожно**. Нельзя выдавать математически точный EV 61%, если solver решал только 50 и 75.

Пользователь должен видеть:
- «рабочая зона»;
- «живёт»;
- «перебор»;

а не фальшивое `EV = +0.183 BB`.

---

# 12. Range Engine — ключевой мозг для «РЕНТГЕНА»

Это один из самых ценных компонентов всего продукта.

Каждая combo имеет **вес** в диапазоне.

Например:

```text
BTN preflop:
QTs = 1.00
A5s = 0.75
K9o = 0.18
```

Когда оппонент делает действие, range обновляется через solver frequency:

```text
new_weight(combo) = old_weight(combo) × frequency(action | combo, node)
```

После этого веса можно нормализовать для визуализации.

## Пример

До flop bet:

```text
QTs weight = 0.80
```

Solver ставит QTs 25% pot с frequency 70%:

```text
0.80 × 0.70 = 0.56
```

Если другая рука ставит всего 5%:

```text
0.80 × 0.05 = 0.04
```

В Рентгене первая остаётся яркой, вторая почти гаснет.

## Самое важное правило

> **Умершая combo не воскресает на следующей улице.**

Range на turn является результатом range на flop, а не новым заранее нарисованным chart.

Это предотвращает главную ошибку начинающего анализа: на river придумать десять bluff combos, которые физически не могли пройти предыдущую линию.

---

# 13. Combo Engine и blockers

Нужно хранить не только hand class `KQs`, но и реальные combos:

- KsQs;
- KhQh;
- KdQd;
- KcQc.

Потому что blockers работают на уровне конкретных карт.

После появления Hero cards и board:

1. удалить невозможные combos;
2. пересчитать counts;
3. отдельно посчитать удалённые value combos;
4. отдельно посчитать удалённые bluff combos.

Рентген может показывать:

```text
VALUE: 16 → 14
BLUFF: 7 → 3
```

И уже потом объяснять:

> Hero blocker убрал 4 natural bluffs и только 2 value combos — bluff-catch стал хуже.

---

# 14. Explanation Engine: solver не умеет быть преподавателем

Нельзя делать объяснение так:

> «Bet лучше, потому что solver ставит».

Для каждого node нужен набор вычисляемых и редакторских признаков.

## Concept tags

Минимальный словарь:

### Preflop
- RFI;
- BB_DEFENCE;
- 3BET_LINEAR;
- 3BET_POLAR;
- 4BET_JAM;
- POSITION;
- REALIZATION;
- DOMINATION;
- BLOCKER_PRE.

### Flop
- RANGE_ADVANTAGE;
- NUT_ADVANTAGE;
- STATIC_BOARD;
- DYNAMIC_BOARD;
- SMALL_CBET;
- RANGE_BET;
- CHECK_BACK;
- PROTECTION;
- EQUITY_DENIAL.

### Turn
- SECOND_BARREL;
- POLARIZATION;
- RANGE_SHIFT;
- OVERCARD;
- DRAW_COMPLETION;
- POT_GEOMETRY.

### River
- THIN_VALUE;
- POLAR_BET;
- BLUFF_DENSITY;
- BLUFF_CATCH;
- BLOCKER;
- UNBLOCKER;
- VALUE_TARGETS;
- OVERBET;
- MDF_REFERENCE.

### Tournament
- ICM_PRESSURE;
- RISK_PREMIUM;
- PAYJUMP;
- COVERAGE.

## Explanation record

```json
{
  "explanation_id": "exp_1938",
  "node_id": "node_8f2",
  "hand_filter": ["QJs", "QTs", "JTs"],
  "primary_concept": "SMALL_CBET",
  "secondary_concepts": ["RANGE_ADVANTAGE", "STATIC_BOARD"],
  "plain_ru": "На сухом A-high BTN сохраняет преимущество диапазона, поэтому маленькая ставка может работать широкой частью рук.",
  "transfer_rule": "Чем статичнее high-card board и сильнее range advantage IP, тем чаще маленький c-bet может покрывать широкий range.",
  "freaky_line": "Размер маленький. Причина хотя бы существует."
}
```

---

# 15. Poker Swipe Brain

Poker Swipe должен быть самым быстрым потребителем Poker Brain.

## Что запрашивает режим

```text
next_spot(user_state, session_constraints)
```

Constraints:
- 10 рук;
- без exact повторов;
- 40–60% weak concepts;
- 20–30% maintenance concepts;
- 10–20% random/hard;
- не более 3 подряд одной street;
- difficulty рядом с текущим skill.

## Что получает

```json
{
  "training_id": "sw_00198",
  "node_id": "node_x",
  "hero_combo": "KsJd",
  "display": {...},
  "legal_actions": [...],
  "grading": {...},
  "explanation_id": "exp_1938",
  "concept_ids": ["RIVER_BLUFF_CATCH", "BLOCKER"]
}
```

## Если пользователь выбирает BET / RAISE

Нельзя сразу оценивать действие, если размер имеет стратегическое значение.

Flow:

1. пользователь нажимает **BET** или **RAISE**;
2. появляется мини chip-slider;
3. выбирает размер;
4. только после этого Poker Brain оценивает **action + size**;
5. verdict учитывает и тип действия, и выбранный размер.

Это особенно важно на turn/river.

---

# 16. Daily Brain

Daily — не случайная тяжёлая рука.

Отбор:

- high information value;
- один центральный конфликт;
- несколько разумных competing actions;
- concept должен переноситься на другие boards;
- решение не должно быть «очевидным solver trivia».

Daily record:

```json
{
  "daily_id": "2026-08-08-river-thin-value",
  "node_id": "...",
  "difficulty": 82,
  "decision_point": "RIVER",
  "argument_set": [
    {"text":"хуже Qx платят", "supports":"BET", "weight":0.8},
    {"text":"закрылся flush", "supports":"CHECK", "weight":0.6}
  ],
  "key_question":"Какие худшие руки реально платят выбранный размер?",
  "transfer_node_id":"..."
}
```

Важно: argument cards должны работать drag/drop **и tap alternative**, чтобы мобильный интерфейс никогда не блокировал пользователя.

---

# 17. Review Brain — «Ну что опять не так?»

Review должен знать не только конечную ошибку, но и **первую стратегически дорогую развилку**.

Для полной линии считаем:

```text
EV_loss(node_i) = best_EV(node_i) - chosen_EV(node_i)
```

И различаем:

- first strategic warning;
- first meaningful EV loss;
- biggest EV loss;
- downstream consequence.

Пример:

```text
FLOP 75%: warning, -0.03 BB
TURN 125%: first major error, -0.31 BB
RIVER call: biggest visible loss, -1.10 BB
```

Приложение должно учить:

> River может быть самой дорогой ошибкой, но turn создал плохую геометрию первым.

Именно поэтому CSI timeline полезнее «на какой улице ошибка?».

---

# 18. Heal Brain

Heal — не набор заранее известных задач. Он собирается из leak evidence.

## Leak object

```json
{
  "leak_id": "river_bluffcatch_overcall",
  "concept_id": "RIVER_BLUFF_CATCH",
  "sample": 28,
  "mistakes": 11,
  "high_confidence_mistakes": 6,
  "repeat_errors": 4,
  "severity": 0.78,
  "status": "TREATING"
}
```

## Course generator

Если leak = river bluff-catch:

1. bluff density sorting;
2. pot odds dial;
3. blocker lab;
4. range construction;
5. control hand;
6. delayed memory check через несколько дней.

Только последний этап должен сильно поднимать leak score.

---

# 19. «Мои» — Hand Analysis Brain

Самый опасный раздел для фальшивой «умности».

Пользователь может ввести произвольную раздачу, которой нет в solver library.

Поэтому Brain должен отвечать в три уровня.

## Уровень A — Exact match

Совпадают:
- format;
- positions;
- effective stack bucket;
- preflop tree;
- board;
- bet sizes / node.

Можно дать solver-backed answer.

## Уровень B — Nearest reference

Есть близкий canonical node.

Показываем:

> **Ближайшая модель:** 30 BB BTN vs BB SRP, bet size округлён к 75%.

Не выдаём её как точный solve.

## Уровень C — No solver match

Показываем только то, что знаем точно:
- pot odds;
- required equity;
- SPR;
- pot geometry;
- known-hand equity, если villain hand известна;
- card removal;
- range input request.

И честно:

> «Для точного solver verdict нужен диапазон/точный node».

Это лучше, чем умно выглядящая ложь.

---

# 20. YOU Brain: как приложение реально «узнаёт игрока»

YOU не должен считать общий Skill как процент правильных ответов.

Нужна evidence model.

## Каждое решение создаёт evidence event

```json
{
  "event_id":"evt_...",
  "user_id":"local_or_account",
  "training_id":"sw_00198",
  "concept_id":"RIVER_BLUFF_CATCH",
  "result":"MISTAKE",
  "ev_loss_bb":0.42,
  "difficulty":0.81,
  "confidence":0.90,
  "is_memory_check":false,
  "timestamp":"..."
}
```

## Вес evidence

Концептуально:

```text
weight = difficulty
       × recency_weight
       × independence_weight
       × transfer_weight
       × confidence_modifier
```

Где:
- повтор того же spot весит меньше;
- delayed memory check весит больше;
- transfer spot весит больше простого повторения;
- уверенная ошибка создаёт больший leak signal.

## Minimum sample

До минимальной выборки показываем:

**мало данных**

а не `River 43` после трёх рук.

Рекомендация:
- preview signal: 8 независимых решений;
- публичный skill score: 15–20;
- сильный leak verdict: 25+ или высокая повторяемость на разных spot families.

---

# 21. Spaced Repetition Engine

Система должна повторять **концепт, а не exact картинку**.

После ошибки:

### Immediate reinforcement
Через 3–7 рук — похожая концепция, другой board/hand.

### Delayed check
Через 1–3 дня.

### Transfer check
Другой position / stack / texture, но тот же принцип.

Пример:

Ошибка:
`River overbet bluff-catch + плохой blocker`

Не повторять ту же `KJ on K94...`.

Дать:
`Q8 on Q72...`, где снова нужно не блокировать natural bluffs.

Если пользователь решает правильно только exact repeat — тему не считать выученной.

---

# 22. Difficulty Engine

Difficulty — не «мы так решили».

Можно вычислять из признаков:

- смешанность solver strategy;
- малая разница EV между actions;
- количество plausible actions;
- street;
- sizing complexity;
- blocker sensitivity;
- ICM;
- range depth;
- user historical performance.

Пример:

```text
base = 0.35
+ mixedness 0.15
+ river 0.15
+ blocker_sensitive 0.15
+ overbet 0.10
+ ICM 0.10
= 1.00
```

После калибровки по реальным пользователям difficulty корректируется empirical success rate.

---

# 23. База данных: минимальная логическая схема

## Таблицы solver/content

### `spots`
- spot_id
- format
- players
- stack_bb
- positions
- pot_type
- street
- board
- config_hash
- solve_version

### `nodes`
- node_id
- spot_id
- parent_node_id
- actor
- pot_bb
- stack_bb
- spr
- history_json
- legal_actions_json

### `node_actions`
- node_id
- action_id
- action_type
- size_bb
- size_pct_pot
- frequency
- ev_bb

### `combo_strategy`
- node_id
- combo
- weight
- action_id
- frequency
- ev_bb

### `ranges`
- range_id
- node_id
- player
- combo_weights_blob

### `concepts`
- concept_id
- category
- name_ru
- description_ru
- prerequisites

### `node_concepts`
- node_id
- concept_id
- importance

### `explanations`
- explanation_id
- node_id
- hand_filter
- primary_concept
- plain_ru
- transfer_rule
- freaky_line

### `training_items`
- training_id
- mode
- node_id
- hero_combo
- difficulty
- tags
- active

### `daily_items`
- daily_id
- node_id
- argument_set
- transfer_node_id

## User tables

### `user_events`
Каждое решение.

### `user_concept_state`
Агрегат по concept.

### `user_leaks`
Системные проблемы.

### `user_memory_queue`
Что и когда повторить.

### `user_hands`
Сохранённые реальные раздачи.

---

# 24. Физическая структура базы для GitHub Pages

Не надо снова класть весь мозг в один `index.html`.

Рекомендуемая структура:

```text
/
  index.html
  app.js
  brain/
    manifest.json
    concepts.json
    board_taxonomy.json
    math_rules.json
    preflop/
      15bb.json
      20bb.json
      25bb.json
      30bb.json
      40bb.json
      60bb.json
    postflop/
      btn_bb_srp_30/
        a72r.json
        k83r.json
        jt8tt.json
        ...
    training/
      swipe_01.json
      sizing_01.json
      review_01.json
      daily.json
      heal.json
    versions/
      2026-08-v1.json
```

App загружает только нужный chunk.

## Почему

- index.html остаётся маленьким;
- база обновляется отдельно от интерфейса;
- легче тестировать;
- легче добавлять 10,000 spots;
- можно кешировать chunks;
- solver data не смешивается с CSS/UI.

При росте базы выше десятков мегабайт — перейти на backend/API или SQLite/WASM.

---

# 25. Poker Brain API внутри приложения

UI вообще не должен знать, как устроен solver JSON.

Он обращается к единому API.

```js
brain.getTrainingSpot({ mode, userState })
brain.getLegalActions(gameState)
brain.gradeAction({ nodeId, combo, action, size })
brain.explainDecision({ nodeId, combo, action })
brain.getRangeAtNode(nodeId)
brain.advanceRange({ range, nodeId, observedAction })
brain.countCombos(range, blockers)
brain.getSizingProfile({ nodeId, combo })
brain.matchUserHand(handHistory)
brain.recordEvidence(event)
brain.getLeaks(userId)
brain.getNextMemoryCheck(userId)
brain.getTodayPlan(userId)
```

Это критично: если завтра сменится solver или формат данных, интерфейс не переписывается.

---

# 26. `gradeAction()` — сердце Poker Swipe

Псевдологика:

```js
function gradeAction(node, combo, chosenAction, chosenSize) {
  const strategy = getComboStrategy(node, combo);
  const candidate = mapUserActionToSolvedAction(chosenAction, chosenSize);

  if (!candidate) {
    return {
      grade: 'UNKNOWN',
      reason: 'Размер не покрыт текущей solve-моделью'
    };
  }

  const bestEV = maxEV(strategy.actions);
  const chosenEV = strategy.actions[candidate].ev;
  const loss = bestEV - chosenEV;
  const freq = strategy.actions[candidate].frequency;

  return pedagogicalGrade({ loss, freq, pot: node.pot });
}
```

Отдельно сохраняются:
- solver truth;
- pedagogical verdict.

Это позволяет менять UX-пороги, не пересчитывая solve.

---

# 27. `advanceRange()` — сердце Рентгена

```js
function advanceRange(range, node, observedAction) {
  const next = {};

  for (const [combo, oldWeight] of Object.entries(range)) {
    const freq = strategyFrequency(node, combo, observedAction);
    next[combo] = oldWeight * freq;
  }

  return removeBlockedCombos(normalize(next));
}
```

Для визуала 13×13 hand class:

```text
cell_weight(KQs) = sum(KsQs, KhQh, KdQd, KcQc)
```

Поэтому Рентген должен опираться на один и тот же Range Engine, а не на вручную написанные `counts:[244,171,86,27]`.

Counts должны **вычисляться**, а не быть декорацией.

---

# 28. Как Solver Brain делает «Почему?» умным

У solver output есть цифры, но нет красивой причинности.

Поэтому explanation generator собирает признаки.

Пример river bluff-catch:

```text
1. required equity = 27.8%
2. villain value combos = 18
3. villain bluff combos = 5
4. bluffs required for indifferent call = 7
5. hero card removes 3 bluff combos and 1 value combo
```

Из этого строится объяснение:

> Для безубыточного call нужно около 28% equity. В построенном river range natural bluffs меньше необходимого, а Hero ещё и блокирует часть из них. Поэтому fold не «тайтовый», а математически объяснимый.

Фриковая Дама добавляет только последнюю строку:

> Вера в людей опять обогнала комбинаторику.

---

# 29. Контент нельзя полностью генерировать автоматически

Есть три типа знания.

## Тип 1 — Mathematical truth
Автоматически:
- pot odds;
- combo counts;
- SPR;
- blocker counts;
- equity;
- solver EV/frequency.

## Тип 2 — Derived strategic explanation
Полуавтоматически:
- range advantage;
- bluff density;
- sizing class;
- value targets;
- polarization.

## Тип 3 — Editorial pedagogy
Редактор/покерный эксперт:
- какую мысль учим;
- какое объяснение не перегружает;
- какая ошибка типична;
- какой transfer test;
- какая шутка уместна.

Нельзя просить LLM «придумать solver rationale» без grounded данных.

---

# 30. Quality Control solver-базы

Каждый solve получает паспорт.

```json
{
  "solver":"PioSOLVER 3.x",
  "tree_config_hash":"sha256:...",
  "created_at":"2026-08-08",
  "rake_or_ante_config":"...",
  "stack_bb":30,
  "accuracy_target":"...",
  "exploitability":"...",
  "source_file_hash":"sha256:...",
  "review_status":"APPROVED"
}
```

Обязательные проверки:

1. pot на каждом child node совпадает с action history;
2. stack не уходит ниже нуля;
3. frequencies по combo суммируются примерно в 1;
4. impossible combos удалены;
5. suits не дублируются с board;
6. legal actions соответствуют state;
7. EV units одинаковые;
8. solve config version не смешивается с другой библиотекой;
9. training item указывает существующий node;
10. explanation не утверждает то, чего нет в data.

---

# 31. Не смешивать GTO и exploit

В базе должен быть явный `strategy_type`:

- `EQUILIBRIUM`;
- `NODELOCK_EXPLOIT`;
- `CURATED_EXPLOIT`;
- `FIELD_HEURISTIC`.

Пользователь должен понимать разницу.

Например:

**БАЗОВАЯ МОДЕЛЬ**

и

**ПРОТИВ ТЕЛЕФОНА**

не могут быть одной chart без маркировки.

---

# 32. ICM Layer

ICM нельзя приклеить фразой «на баббле играем тайтовее».

ICM spot должен хранить:
- stack каждого игрока;
- payouts;
- players remaining;
- positions;
- utility model;
- risk premium / bubble factor, если вычислен;
- solver source.

В V1 ICM лучше сделать отдельным curated pack, а не смешивать со всеми chips-EV задачами.

---

# 33. Что делать с multiway

Не притворяться, что HU solution — это multiway truth.

Если hand 3-way postflop, а база HU:

```json
{
  "solver_status":"UNSUPPORTED_MULTIWAY",
  "available_analysis":["POT_ODDS","SPR","KNOWN_EQUITY","BOARD_TEXTURE"]
}
```

Позже можно добавить отдельную multiway library.

---

# 34. Размер базы: реалистичный план

## Этап A — Brain Foundation

**300–500 curated solver-backed training nodes**

Достаточно, чтобы:
- доказать pipeline;
- сделать честный Swipe;
- запустить Sizing;
- оживить Рентген.

## Этап B — Useful Reg Beta

**2,000–3,000 nodes**

Цели:
- 200+ unique preflop decisions;
- 500+ flop nodes;
- 500+ turn nodes;
- 700+ river nodes;
- несколько stack buckets;
- несколько board families.

Из одного node можно генерировать несколько Hero combos, поэтому training items будет значительно больше.

## Этап C — Serious Library

**20,000+ nodes**, chunked storage/backend.

Только здесь можно говорить о действительно широком покрытии.

---

# 35. Какие 500 nodes я бы решал первыми

Приоритет не «самые частые флопы», а **максимальная образовательная отдача**.

### 100 Preflop
- BTN RFI / BB defend на 15/20/30/40 BB;
- CO RFI / BTN/SB/BB response;
- BTN vs blind 3-bet;
- BvB;
- 20–30 BB jam/4bet decisions.

### 120 Flop
Board classes:
- A-high dry;
- K-high dry;
- Q-high dry;
- low disconnected;
- middling connected;
- paired;
- monotone;
- two-tone dynamic;
- broadway connected;
- wheel boards.

### 120 Turn
- brick;
- overcard;
- flush completion;
- straight completion;
- pair board;
- range-changing card.

### 160 River
Потому что именно здесь больше всего дорогих человеческих ошибок:
- thin value;
- bluff-catch;
- overbet;
- missed draws;
- blockers;
- bluff construction;
- value/bluff ratios;
- river check-raise;
- polar sizes.

---

# 36. Интеграция по разделам приложения

## PLAY
Brain отдаёт персональную очередь упражнений.

## Poker Swipe
`node + combo → legal actions → optional size → grade → explanation → evidence`.

## Sizing
`node + combo → sizing profile → selected size → zone grade → concept explanation`.

## Review
`hand line → node sequence → EV losses → first meaningful mistake → repair node`.

## Daily
`hard node → arguments → action → confidence → transfer node`.

## Heal
`leak → concept course → microgames → control → delayed check`.

## Мои
`hand parser → exact/nearest/unsupported → honest math + solver if available`.

## Рентген
`initial weighted range → multiply by observed action frequencies each street → blocker removal → value/bluff construction`.

## YOU
`events → concept state → leak detector → recommendations → longitudinal Poker DNA`.

---

# 37. Что должно исчезнуть из текущего кода

После Brain integration больше нельзя хранить покерную истину прямо в UI:

```js
best: 'FOLD'
yellow: ['CALL']
why: '...'
```

Это заменяется:

```text
UI → training_id → Brain → node/strategy/explanation
```

UI хранит только:
- анимацию;
- layout;
- пользовательский input;
- переходы.

Покерная логика живёт в `/brain`.

---

# 38. Версионирование

Solver strategy меняется, когда меняется:
- stack;
- ante;
- rake;
- tree;
- solver;
- accuracy;
- sizings;
- preflop ranges.

Поэтому нельзя просто заменять `a72r.json`.

Нужно:

```text
brain_version = 2026.08.01
solve_pack = MTT6_30BB_V1
content_version = 4
```

User event сохраняет версии, на которых был дан ответ.

Иначе через полгода исторические scores нельзя будет интерпретировать.

---

# 39. Data provenance: каждая цифра должна иметь происхождение

Для любого solver-backed verdict должна быть цепочка:

```text
training_id
  → node_id
  → solve_pack
  → solver configuration
  → source solve file hash
```

Для curated principle:

```text
source_type = CURATED
reviewer = poker_expert
review_date = ...
```

Для math:

```text
source_type = CALCULATED
formula_version = pot_odds_v1
```

Так приложение никогда не смешивает «мы посчитали» и «мы придумали».

---

# 40. Анти-фейк правила продукта

1. **Нет solver data — не показываем solver EV.**
2. **Нет villain range — не показываем fake equity vs range.**
3. **Нет sample — не ставим диагноз.**
4. **Mixed action — не называем ошибкой только из-за меньшей frequency.**
5. **Nearest solve — маркируем как nearest.**
6. **Multiway без multiway solve — не маскируем HU reference под truth.**
7. **Curated heuristic — не называем GTO.**
8. **Solver frequency — не равно обязательному человеческому действию.**

Это одна из главных вещей, которая будет отличать хороший тренажёр от игрушки.

---

# 41. MVP Brain Manifest

```json
{
  "brain_version":"1.0.0",
  "game":"NLHE",
  "primary_format":"MTT_6MAX_BB_ANTE",
  "stack_buckets":[15,20,25,30,40,60],
  "solver_packs":[
    "PREFLOP_MTT6_V1",
    "POSTFLOP_BTN_BB_SRP_30_V1"
  ],
  "concepts_version":"1.0",
  "grading_version":"1.0",
  "math_version":"1.0",
  "supported_modes":[
    "SWIPE","SIZING","REVIEW","DAILY","HEAL","MY_HANDS","XRAY","YOU"
  ]
}
```

---

# 42. Пошаговый план внедрения

## Фаза 1 — отделить мозг от UI

Создать:
- `brain.js`;
- `brain/manifest.json`;
- `brain/concepts.json`;
- `brain/math_rules.json`;
- unified state model.

Переписать Poker Swipe так, чтобы он спрашивал `brain.gradeAction()`.

## Фаза 2 — preflop brain

Загрузить первую собственную preflop library.

Сделать:
- weighted ranges;
- contextual legal actions;
- frequency/EV grading;
- concept tags.

## Фаза 3 — postflop solver pack

Первый pack:
`30 BB BTN vs BB SRP`.

Почему: огромное количество тренируемых flop/turn/river тем в одном частом tree.

## Фаза 4 — настоящий Рентген

Убрать вручную заданные counts.

Range narrowing считать через combo weights × action frequency.

## Фаза 5 — Sizing + Review

Sizing берёт working zones из solver nodes.

Review считает EV loss по node sequence.

## Фаза 6 — YOU + Heal

Все режимы записывают evidence по одинаковым `concept_id`.

YOU перестаёт быть декоративной статистикой.

Heal строится автоматически из повторяющихся ошибок.

## Фаза 7 — Hand Analyzer

Parser hand histories + exact/nearest solver matcher.

---

# 43. Что разработчику нужно сделать первым

Первый технический milestone:

> **Одна полностью честная solver-backed раздача от базы до YOU.**

Не 500 задач сразу.

Путь:

1. Node существует в JSON.
2. Combo strategy существует.
3. Swipe показывает его.
4. Пользователь выбирает action + size.
5. Brain считает verdict.
6. Explanation берётся из concept layer.
7. Event сохраняется.
8. YOU обновляет relevant skill.
9. При ошибке создаётся memory check.
10. Рентген может использовать тот же node/range.

Когда этот loop работает, масштабирование — уже data problem, а не архитектурный хаос.

---

# 44. Что в итоге будет ощущать пользователь

Пользователь не увидит «Poker Brain» как отдельную кнопку.

Он просто заметит, что приложение вдруг стало последовательным:

- в Swipe mixed action не называют ошибкой;
- в Sizing понимают размер, а не только кнопку;
- в Review находят первую настоящую дорогую развилку;
- в Daily аргументы связаны с реальным range;
- в Рентгене combos исчезают математически, а не по сценарию;
- в «Моих» приложение честно знает границу своих знаний;
- в YOU появляется один и тот же leak, даже если он проявлялся в трёх разных режимах;
- Heal лечит именно эту причину;
- спустя несколько дней система проверяет, действительно ли навык закрепился.

Это и есть момент, когда POKER SWIPE перестаёт быть «прикольным приложением с вопросами» и становится **покерным тренажёром с собственной моделью знаний**.

---

# 45. Финальная архитектура одним рисунком

```text
                 ┌─────────────────────┐
                 │      UI MODES       │
                 │ Swipe / Sizing      │
                 │ Daily / Review      │
                 │ Heal / My / Xray    │
                 │ YOU                 │
                 └─────────┬───────────┘
                           │
                           ▼
                 ┌─────────────────────┐
                 │     POKER BRAIN     │
                 ├─────────────────────┤
                 │ Game State Engine   │
                 │ Math Engine         │
                 │ Range Engine        │
                 │ Grading Engine      │
                 │ Explanation Engine  │
                 │ Personalization     │
                 └─────────┬───────────┘
                           │
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
       ┌────────────┐ ┌────────────┐ ┌──────────────┐
       │ Solver DB  │ │ Concepts   │ │ User Events  │
       │ EV/Freq    │ │ Pedagogy   │ │ Leak/Memory  │
       │ Ranges     │ │ Explan.    │ │ Skill State  │
       └────────────┘ └────────────┘ └──────────────┘
              ▲
              │ OFFLINE PIPELINE
              │
       ┌───────────────┐
       │ Licensed      │
       │ solver(s)     │
       └───────────────┘
```

---

# 46. Источники и лицензионные ориентиры

Проверено 08.08.2026.

1. **GTO Wizard Terms of Service** — ограничения на автоматизированные запросы и коммерческое использование ranges/trees/charts.  
   https://gtowizard.com/terms/

2. **GTO Wizard Benchmark API Terms** — API предназначен для benchmarking poker agents, а не для выгрузки solution database.  
   https://gtowizard.com/benchmark/terms

3. **GTO Wizard — All You Need To Know About Our Solutions** — публичное описание presolved library, preflop solve assumptions и postflop solution construction.  
   https://blog.gtowizard.com/all-you-need-to-know-about-our-solutions/

4. **GTO Wizard — How Solvers Work** — solver inputs: betting tree, ranges, board, stack/pot, accuracy, rake/ICM и общий CFR-style процесс.  
   https://blog.gtowizard.com/how-solvers-work/

5. **GTO Wizard Analyze Mode** — пример архитектурного подхода nearest presolved solution для preflop-turn и exact/actual river parameters.  
   https://help.gtowizard.com/analyze-mode-guide/

6. **PioSOLVER Feature Overview** — text interface, scripting, aggregation reports и solver functionality.  
   https://piosolver.com/docs/feature_overview/

7. **PioSOLVER Products** — актуальные линейки лицензий и scripting support.  
   https://piosolver.com/products/

8. **TexasSolver GitHub** — AGPL и отдельное указание автора о commercial license для интеграции кода/интернет-сервиса.  
   https://github.com/bupticybee/TexasSolver

---

# 47. Решение, которое я рекомендую для POKER SWIPE

**Не строить клон GTO Wizard.**

Строить другой продукт:

> **GTO Wizard отвечает: «какая стратегия?»**  
> **POKER SWIPE должен отвечать: «какую ошибку именно ты повторяешь, почему она возникает и научился ли ты её больше не делать?»**

Solver-база нужна нам не ради 1326 цветных клеток. Она нужна, чтобы все игровые механики имели один честный фундамент.

Первый pack, который стоит реально сделать:  
**MTT 6-max, 30 BB, BTN vs BB single-raised pot + полноценный preflop pack.**

На нём уже можно оживить Poker Swipe, Sizing, Review, Daily, Heal, Рентген и часть «Моих», а YOU впервые получит единый язык concept IDs.

