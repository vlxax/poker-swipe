# POKER SWIPE — KNOWLEDGE BASE V1

Это отдельный data-pack для Poker Swipe / «Фриковая Дама».

## Что внутри

- `10_onboarding_diagnostic.json` — входная диагностика.
- `20_swipe.json` — логика Poker Swipe.
- `30_sizing.json` — тренировка сайзингов.
- `40_review.json` — «Ну что опять не так?».
- `50_daily.json` — Daily.
- `60_heal.json` — персональное лечение ликов.
- `70_my_hands.json` — «Мои раздачи» + математика/анализ.
- `80_reg_battle.json` — PvE exploit / REG BATTLE.
- `90_you.json` — YOU / Poker DNA / лики / прогресс.
- `95_preflop_principles.json` — общая префлоп-база.
- `96_river_principles.json` — общая river-база.
- `00_shared_math.json` — pot odds, MDF, SPR, outs, combinatorics.
- `01_shared_board_textures.json` — типы бордов.
- `02_shared_glossary.json` — словарь.
- `03_shared_freaky_voice.json` — фирменный слой Фриковой Дамы.

## Важная архитектура

Покерные факты и теория отделены от тона Фриковой Дамы.
Один concept_id должен переиспользоваться разными разделами:
Swipe → YOU → Heal → Memory Check → My Hands → Battle.

## Как подключать

На GitHub Pages можно положить папку `data/` рядом с `index.html` и читать JSON:

```js
const swipeKB = await fetch('./data/20_swipe.json').then(r => r.json());
```

Для GitHub Pages лучше не открывать `index.html` локально через `file://`, потому что `fetch()` локальных JSON может блокироваться браузером. На опубликованной странице всё работает нормально.

## Что здесь НЕ является solver output

Все стратегии в V1 — структурированные учебные принципы/эвристики.
Точные частоты, точный EV, точные ICM решения и solver ranges нужно подключать отдельными verified data packs.

Никогда не показывать пользователю эвристический score как «solver EV».
