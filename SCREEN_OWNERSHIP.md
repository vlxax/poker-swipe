# Screen ownership map

| SCREEN | ROUTE | RENDER | RUNTIME OWNER | CSS OWNER | WRAPPERS | TEARDOWN |
|--------|-------|--------|---------------|-----------|----------|----------|
| HOME | `home` | `renderHome` | `poker_swipe_v39.js` (v36/v37 home) | `poker_swipe_v39.css`, v36 tokens | `game-visual-rebuild` enhanceHome | `screen-router` transient UI |
| DAILY | `daily` | `renderDaily` | inline `index.html` + daily patches | `poker_swipe_hand_of_day.css`, daily styles | hand-day-bridge | modal close via router |
| SWIPE | `swipe` | `renderSwipe` | inline + grading wrappers | `game-layout.css`, swipe styles | game-visual-rebuild | — |
| SIZING | `sizing` | `renderSizing` | inline brain wrappers | sizing panel CSS | game-visual-rebuild | — |
| MY HANDS | `myhands` | `renderMy` | inline + solver integration script | my hands CSS blocks | game-visual-rebuild | — |
| MY RANGES | `ranges` | `renderRanges` | `ranges-ui/main.js` | `ranges-ui/ranges.css` | module screen insert | — |
| PROFILE | `profile` | `renderProfile` | **`profile.js` (sole)** | **`profile.css`** | `game-visual-rebuild` (skipped via `__psVisualV2`) | innerHTML replace each render |
| POLYANA | `polyana` | `ensurePokerSwipePolyana` / `openPokerSwipePolyana` | **`polyana/polyana-integrated.js`** | **`polyana/polyana-integrated.css`** | v54 legacy fallback only if native flag false; `screen-router` scrub + ensure mount | `render()` replaces `#psPolyanaArea` |
| TOURNAMENTS | `mytournaments` | `openMyTournamentsV72` | `my-tournaments-pro.js` / ps72 overlay | `my-tournaments-pro.css` | v54 journal on `#tournaments` (separate screen) | `screen-router` hide ps72 |

## Legacy layers (inactive for Polyana when native)

- `v54-consolidated-script`: previously routed Polyana nav to `#tournaments` + `renderTournaments23`; now defers to `openPokerSwipePolyana` when `__PSP_NATIVE_POLYANA`.
- `poker_swipe_v38.js`: not in `index.html` script list.
- `installShowWrapper`: removed from `index.html` (was duplicate show + polling).
