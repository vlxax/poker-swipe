# QA REPORT — V14.4 SWIPE + XRAY

Browser test: Chromium headless, 390×844 viewport.

- New-user onboarding → HOME: OK
- Existing-user startup path (onboarded=true): OK
- Poker Swipe opens: OK
- Swipe action click gets selected/grade class: OK
- Swipe card changes automatically after answer: OK
- Swipe session uses 10 unique hands from a 16-spot pool: OK
- Röntgen bottom navigation opens: OK
- Röntgen landing renders: OK
- Full Röntgen starts: OK
- 13×13 grid = 169 cells: OK
- Range can be removed/kept by tap: OK
- Fix range → reveal: OK
- Next street keeps the user's prior model instead of resetting to reference: OK
- Home / My Hands / YOU navigation after Röntgen: OK
- JavaScript syntax (`node --check`): OK
- Browser console/page errors during tested flow: NONE

Important: reference ranges are curated training models, not claimed solver outputs.
