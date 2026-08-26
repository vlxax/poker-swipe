# Hand of the Day — integration status

## Live on `main`

| File | Role |
|------|------|
| `hand-day-bridge.js` | Intercepts `show('daily')`, fullscreen iframe, hides bottom nav, Esc → home |
| `daily-figma-card.js` | Home CTA → `show('daily')`; loads bridge |
| `PokerSwipe_DailyHand_STAGE3_1.html` | **Current module** (engine + DAILY_HUMAN_001/002/003) |

## Flow
1. Home «ПЕРЕЙТИ К РАЗДАЧЕ ДНЯ» → `show('daily')`
2. Bridge opens overlay iframe → STAGE3 module
3. Esc or `postMessage({type:'HAND_DAY_BACK'})` → home
4. App bottom nav hidden while open (no double nav)

## Swap to storyboard redesign (`hand_day_redesign.html`)

1. Upload production file as `modules/hand-of-the-day.html` (from local artifacts).
2. Upload images:
   - `assets/daily-hand/monster.jpg`
   - `assets/daily-hand/freak_lady.jpg`
3. In `hand-day-bridge.js` set:
   `const MODULE_SRC = 'modules/hand-of-the-day.html';`
4. Module must post `HAND_DAY_BACK` on intro back.

## QA
- [x] Navigation from home card
- [x] Single bottom nav (hidden in overlay)
- [x] Esc closes
- [ ] Redesign visuals (pending large-file upload)
- [ ] Character assets monster / freak_lady
