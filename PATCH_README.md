# PokerSwipe V77 — Visual Home PATCH 1.3

Patch on top of current V77 + MobileShell. It does not replace the application and does not change Poker Brain, grading, datasets, saved data, or route names.

## What changed
- Rebuilt Home renderer to match the approved visual reference composition instead of trying to reshape legacy Home cards with CSS.
- Three equal top stats: SKILL / FORM / БАЗА.
- Large Daily hero with Freak Lady artwork already present in the repository.
- Full-width personalized training recommendation.
- Balanced 2×2 training grid for Sizing / Review / Poker Swipe / Ranges.
- Full-width Exploit card and compact 5-minute session card.
- Stable one-line `POKER SWIPE — by ФРИКОВАЯ ДАМА` chrome.
- No mid-word Russian heading breaks.
- MobileShell 1.2 remains in place for fixed app viewport and bottom navigation.

## Files (6)
- index.html
- poker_swipe_v77_mobile_shell_patch.css
- poker_swipe_v77_mobile_shell_patch.js
- poker_swipe_v77_visual_home.css
- poker_swipe_v77_visual_home.js
- PATCH_README.md

Apply these files over V77 preserving repository paths. The visual-home files are loaded last on purpose so old Home wrappers cannot restyle the new dashboard.


## 1.4
- Replaced the Daily Hand hero character with the user-provided dinosaur image.
- Image is local to the patch: `poker_swipe_daily_dino.jpeg`.
- No poker logic, grading, routing, or data changes.
