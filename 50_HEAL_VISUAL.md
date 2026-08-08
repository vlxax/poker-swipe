# «ЛЕЧИТЬ»
## Визуальная концепция: Poker Lab, где каждый микронавык — отдельная маленькая игра

Это принципиально НЕ ещё одна колода вопросов.

# ГЛАВНЫЙ ЭКРАН ЛИКА

Пример:
### RIVER BLUFF-CATCH
`41 → цель 60`

В центре не список, а **маршрут лечения**:

`1 BLUFFS` ●  
`↓`
`2 VALUE` ○  
`↓`
`3 POT ODDS` ○  
`↓`
`4 BLOCKERS` ○  
`↓`
`5 CONTROL` 🔒

По мере прохождения точки загораются.

---

# MICROGAME 1 — SORT THE RANGE

На столе 8–12 combo-cards.

Внизу две физические зоны:
**VALUE**
**BLUFF**

Пользователь drag&drop раскладывает combos.

После зоны превращаются в столбики:

VALUE `████████████ 12`
BLUFF `█████ 5`

Справа линия:
`CALL НУЖНО: 8 BLUFFS`

Сразу видно:
**НЕ ХВАТАЕТ**

Фриковая Дама:
> **Пять блефов не становятся восемью от силы желания заколлировать.**

---

# MICROGAME 2 — VALUE RANGE PAINTER

13×13 grid.

Кисти:
`VALUE`
`CHECK`

Пользователь рисует range.

После overlay reference.

Не надо сразу делать идеальную solver-grid. Можно использовать curated reference из JSON.

---

# MICROGAME 3 — POT ODDS DIAL

Экран почти пустой.

Большой круг:
`POT 24`
`BET +18`

В центре dial.

Пользователь вращает pointer:
`27 → 29 → 30%`

Отпустил:
**30% ✓**

Сразу следующий.

Режим:
**5 ПОДРЯД**

Показатели:
- точность;
- среднее время;
- лучший streak.

Это уже реальный автоматизируемый навык.

---

# MICROGAME 4 — BLOCKER LAB

Верх:
`RANGE ОППОНЕНТА`

Небольшая combo-grid.

Низ:
три candidate hands.

Пользователь тянет выбранную карту/масть поверх range.

Комбинации, которые она блокирует, **визуально гаснут**.

Сбоку счётчик:
`VALUE −5`
`BLUFF −2`

И вывод:
**ХОРОШИЙ BLUFF-CATCHER**

Пользователь видит blocker, а не читает определение.

---

# MICROGAME 5 — CONTROL HAND

Только здесь возвращается обычная покерная раздача.

Без подсказок.

Если прошёл:
`41 → 48`

Но score повышается умеренно.

Через несколько дней Memory Check должен иметь больший вес.

---

# Визуальная шкала лечения

У leak icon цвет:
- красный NEW;
- красно-розовый TREATING;
- жёлтый IMPROVING;
- зелёно-жёлтый CONTROL;
- зелёный CLOSED.

Не превращать это в медицинский интерфейс буквально. Это всё ещё fashion/editorial poker UI.

---

# Другие курсы

### TURN SIZING
- goal card drag;
- range-shape slider;
- two hands comparison;
- chip drag;
- control hand.

### BB DEFENCE
- range painter;
- price / pot-odds mini-game;
- dominated hands sorting;
- position comparison;
- control.

### RIVER VALUE
- «кто платит?» drag;
- thin value slider;
- compare two bet sizes;
- missed value reconstruction;
- control.

Так «Лечить» остаётся системой, а не одной игрой.
