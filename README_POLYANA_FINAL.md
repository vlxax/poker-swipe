# PokerSwipe — Поляна 2.0 FINAL MVP

Собрано по утверждённому ТЗ и последнему визуальному референсу.

## Внутри
- `polyana2.html`
- `polyana/polyana.css`
- `polyana/polyana.js`
- `assets/headsup_promo_frikovaya_dama.jpeg` — пользовательский рекламный баннер HEADS UP
- `data/moscow_clubs.json` — пустой fallback; если в основном репо уже есть `data/moscow_clubs_pokernomoney.json`, модуль подхватит его автоматически

## Реализовано
- Москва / сегодня
- Клубы А–Я
- Карта
- постоянный партнёрский баннер HEADS UP
- быстрые фильтры: NLH, PLO, Bounty, Freezeout, Freeroll, Re-entry, Add-on, Late reg, Уровни
- расширенные фильтры
- smart filter «Куда ещё можно успеть»
- реальные значения из JSON без выдумывания
- детали турнира
- исключение очевидно чужих городов
- late-reg countdown на основе московского времени
- mobile-first
- нижняя навигация в стиле PokerSwipe

## Как поставить
Распаковать ZIP в корень `poker-swipe`.
Файл `polyana2.html` должен лежать рядом с `index.html`.

Для живых данных в репозитории должен существовать:
`data/moscow_schedule_today.json`

Модуль сначала ищет `data/moscow_clubs.json`, затем автоматически fallback на:
`data/moscow_clubs_pokernomoney.json`

## Важно
Этот пакет не перезаписывает текущий `index.html`.
Сначала открыть `/polyana2.html` на GitHub Pages / Cloudflare и проверить.
После одобрения уже интегрировать в production router.
