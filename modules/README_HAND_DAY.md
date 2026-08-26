# Hand of the Day module

## Files
- `modules/hand-of-the-day.html` — production module (gzip bootstrap expands redesign)
- `hand-day-bridge.js` — intercepts `show('daily')`, fullscreen iframe, hides bottom nav
- `daily-figma-card.js` — loads bridge; home CTA → `show('daily')`

## Assets (required)
Place character images:
- `assets/daily-hand/monster.jpg`
- `assets/daily-hand/freak_lady.jpg`

Until uploaded, UI uses CSS/emoji fallbacks (`onerror`).

## Flow
1. Home card «ПЕРЕЙТИ К РАЗДАЧЕ ДНЯ» → `show('daily')`
2. Bridge opens `#psHandDayOverlay` iframe → `modules/hand-of-the-day.html`
3. Back on intro → `postMessage({type:'HAND_DAY_BACK'})` → home
4. Scenarios: `DAILY_HUMAN_001` / `002` / `003` unchanged

## QA checklist
- [ ] No second bottom nav
- [ ] Back from intro → home
- [ ] Restart on finish works
- [ ] Mobile 390×844
- [ ] Console clean (no engine errors)
