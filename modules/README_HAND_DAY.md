# Hand of the Day — integration status

## Production module

| File | Role |
|------|------|
| `hand-day-bridge.js` | Intercepts `show('daily')`, fullscreen iframe, hides bottom nav, Esc → home |
| `daily-figma-card.js` | Home CTA → `show('daily')`; loads bridge |
| `modules/hand-of-the-day.html` | **Production module** (approved redesign + DAILY_HUMAN_001–003 engine) |

## Assets

- `assets/daily-hand/monster.jpg`
- `assets/daily-hand/freak_lady.jpg`

## Flow

1. Home «ПЕРЕЙТИ К РАЗДАЧЕ ДНЯ» → `show('daily')`
2. Bridge opens overlay iframe → `modules/hand-of-the-day.html`
3. Esc or `postMessage({type:'HAND_DAY_BACK'})` or intro ← НАЗАД → home
4. App bottom nav hidden while open (module bottom nav also hidden in iframe)

## QA

- [x] Navigation from home card
- [x] Single bottom nav (app nav hidden in overlay)
- [x] Esc closes
- [x] Redesign visuals (approved `hand_day_redesign` integrated)
- [x] Character assets monster / freak_lady
