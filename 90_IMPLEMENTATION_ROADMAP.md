# IMPLEMENTATION ROADMAP
## В каком порядке реализовывать, чтобы не утонуть

### P0 — максимальный визуальный эффект при небольшом коде

1. **Sizing chip slider**
   - заменяет ряд одинаковых кнопок;
   - заметно меняет ощущение режима;
   - легко реализуется.

2. **Review vertical timeline**
   - action nodes;
   - отдельный выбор конкретного действия;
   - после reveal окрашивание timeline.

3. **Daily single-table replay**
   - board reveal;
   - pot animation;
   - decision freeze.

4. **YOU time scrubber + bars**
   - даёт ощущение настоящего прогресса.

### P1 — интерактивность

5. Sizing two-hand positioning.
6. Daily argument sorting.
7. Heal value/bluff sorting.
8. Heal pot-odds dial.
9. Battle READ sliders.
10. Battle exploit-plan drag.

### P2 — более сложные, но сильные

11. 13×13 range painter.
12. Blocker Lab с визуальным выключением combos.
13. My Hands table-based action builder.
14. My Hands SVG equity graph.
15. YOU skill constellation.

---

# Общие компоненты, которые надо сделать один раз

## `chip-slider`
Используют:
- Sizing;
- My Hands;
- Daily bet;
- Review repair.

## `range-grid`
Используют:
- Sizing;
- Heal;
- My Hands;
- будущий Preflop.

## `drag-zone`
Используют:
- Daily arguments;
- Heal value/bluff;
- Battle exploit plan.

## `street-timeline`
Используют:
- Review;
- My Hands;
- Daily archive/detail.

## `mini-chart`
Используют:
- YOU;
- Battle;
- My Hands;
- Sizing Report.

Это важно: визуально режимы разные, но код не должен дублироваться.

---

# CSS tokens

```css
--bg: #08080c;
--panel: #15151b;
--panel-2: #0f0f13;
--line: #30303a;
--text: #faf8fa;
--muted: #98939f;
--pink: #ff2e84;
--pink-soft: #ff6aac;
--green: #42e786;
--yellow: #ffd257;
--red: #ff4b68;
```

Не добавлять каждому режиму собственную радугу.
Различие создаём **композицией и жестом**, а не шестью новыми цветами.

---

# Общие motion rules

- tap feedback: 120–180 ms;
- card/node select: 180–240 ms;
- drag settle: 220–300 ms;
- street reveal: 300–450 ms;
- result emphasis: максимум 500 ms;
- никаких длинных 1.5-секундных «вау»-анимаций между каждым действием.

---

# Accessibility / mobile

Минимальная зона тапа: 44×44 px.

На iPhone экран с главным действием должен помещаться без обязательного scroll.

Drag всегда имеет tap-alternative:
например combo можно и перетащить, и тапнуть → выбрать destination.

Не строить критические функции только на hover.

---

# Финальная продуктовая проверка

Перед выпуском каждого экрана спросить:

1. **Что здесь изучает человек?**
2. **Какой уникальный жест это выражает?**
3. **Что он узнаёт после действия?**
4. **Как результат попадёт в YOU/лик/прогресс?**
5. **Не является ли это снова карточкой с тремя кнопками?**
6. **Можно ли понять экран за 3 секунды без инструкции?**
7. **Есть ли один визуальный момент, который хочется заскринить?**

Если №5 = «да», экран переделывать.
