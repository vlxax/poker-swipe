# Аудит первого раздела PokerSwipe (тренировочные мини-апки)

Ветка: `sourcecraft/miniapps-full-context` (от актуального main `a219f88`).
Цель аудита: понять, где и как мини-апки первого раздела отдают пользователю условия раздачи,
чтобы перевести их на единый стандарт «ДАНО → ИСТОРИЯ РАЗДАЧИ → ВАЖНЫЙ КОНТЕКСТ → ТВОЙ ХОД → ВОПРОС».

## Навигация

Секции-экраны заданы в `index.html` (около строк 965–975 и `show` ~1133):
`home, swipe, sizing, review, daily, heal, myhands, xray, tournaments, polyana, profile`.

Первый раздел (тренировка):
- **Swipe** — 10 рук, быстрые споты.
- **Sizing Lab** — построение размера ставки.
- **Review (CSI)** — «где линия сломалась».
- **Daily** — одна рука в день + аргумент-борд.
- **Heal** — курсы по лику.
- **My Hands** — конструктор рук.
- **X-ray** — диапазоны.
- Диагностика/онбординг (DIAG).
- **Quick Session** (5 минут) и **3-MAX Hyper** (QG30).

Поляна (`polyana`), карта клубов, живое расписание и турниры — независимые разделы, не трогаем.

## Источники данных

Два параллельных слоя:

1. **Legacy статичные массивы в `index.html`:**
   - `DIAG` (~1175) — 8 диагностических задач: `c, q, a, p`.
   - `SWIPE_BASE` (~1190) — 16 базовых спотов: `id, street, pos, hero[], board[], ctx, stack, pot, actions[], preferred[], live[], sizeZone?, concept, why`.
     `expandSwipe()` (~1208) → 4 варианта стеков = 64 спота; `newSwipeSession` берёт 10.
   - `SIZING` (~1220) — 8 задач: `id, street, ctx, hero[], board[], pot, check, zone[], concept, goal, why`.
   - `REVIEWS` (~1233) — 6 задач: `id, hero[], board[], nodes[][], bad, reasons[], correctReason, repair[], best[], concept, why`.
   - `DAILY_TEMPLATES` (~1246) — 5 шаблонов: `theme, hero[], board[], pot, stack, line[], decision[], zone?, preferred, concept, key, args[][]`.
   - `CTX30` / `passport30` (~2847–2865) — «паспорт спота»: `field, event, stage, table, left, eff, hero, villain·opp, note`. Уже внедряется через `wrapRender30` в swipe/sizing/daily/review/heal/xray.
   - `QG30_SPOTS` (~2872–2880) — 3-MAX: `hand, pos, ctx, policy{...}, concept`.
   - `freshBuilder()` (~1280) — конструктор My Hands.
   - Инлайн `POKER_BRAIN_PACK` (~990).
2. **Современный персонализированный слой:** `training-ui/*.js` (подключён `index.html:4829`), генерирует дриллы через CFR-солвер в `solver/src/training/*`.
   `training-ui/main.js` переопределяет `renderDaily`.

## Ключевые проблемы

- Много английских терминов в UI: `EFF STACK`, `POT`, `EFFECTIVE`, `HERO/VILLAIN`, `BLINDS`,
  `SIZING LAB`, `SESSION REPORT`, `MEMORY CHECK`, `POLICY SPRINT`, `RANGE LAB`,
  `SKILL/FORM/SAMPLE/MATCH`, concept-поля («RFI BTN», «dry board c-bet», «range advantage»),
  `PRE/FLOP/TURN/RIVER` в REVIEWS.
- Нет полных условий: нет блайндов/анте, стадии турнира (кроме `stage` в `data.js`),
  статистики соперника, турнирного контекста (ICM/баббл), явного вопроса —
  только `ctx`/`situation`/`key`.
- `poker_swipe_v32.js:188–192` удаляет паспорта `.spot30` как декоративные —
  надо проверить, чтобы при внедрении контекста он не ломал рендер.
- Рендеры (`renderSwipe`, `renderSizing`, `renderReview`, `renderDaily`, `renderHeal`,
  `renderMy`, `renderHome`) выводят карточки без полноценного единого блока условий.

## Рендеры первого раздела (строки index.html)

| Рендер | Строка | Контент |
|---|---|---|
| `renderHome` | ~2893 | главный экран первого раздела |
| `renderSwipe` | ~1212 | карточка свайпа, контекст `POT`/`EFF STACK` |
| `renderSizing` | ~1230 | `ctx`, `POT`, стек |
| `renderReview` | ~1241 | `nodes[]`, «точка поломки» |
| `renderDaily` | ~1256–1264 | line по улицам, аргумент-борд |
| `renderHeal` | ~1268 | курсы по лику |
| `renderMy` | ~1281 | конструктор |

## Прочие файлы

- `data.js` — `window.HANDS` (15 старых рук, `stage` есть). Потребляется `app.js`.
- `app.js` — legacy контроллер свайпа.
- `poker_swipe_v32…v40.js` — слои рендера/стабильности.
- `poker_brain_v32…v34.js` — движок объяснений.
- `training-ui/` + `solver/src/training/` — персонализированный слой.
- `tests/` — существующие тесты (`v32_regression.js` бут-аппит `index.html` через jsdom).
- `src/index.js`, `polyana*` — другой раздел, не трогаем.