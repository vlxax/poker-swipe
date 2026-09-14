# Screen ownership map

| SCREEN | ROUTE | RENDER | RUNTIME OWNER | CSS OWNER | WRAPPERS | TEARDOWN |
|--------|-------|--------|---------------|-----------|----------|----------|
| HOME | `home` | `renderHome` | `poker_swipe_v39.js` (v36/v37 home) | `poker_swipe_v39.css`, v36 tokens | `game-visual-rebuild` enhanceHome | `screen-router` transient UI |
| DAILY | `daily` | `renderDaily` | inline `index.html` + daily patches | `poker_swipe_hand_of_day.css`, daily styles | hand-day-bridge | modal close via router |
| SWIPE | `swipe` | `renderSwipe` | inline + grading wrappers | `game-layout.css`, swipe styles | game-visual-rebuild | — |
| SIZING | `sizing` | `renderSizing` | inline brain wrappers | sizing panel CSS | game-visual-rebuild | — |
| MY HANDS | `myhands` | `renderMy` | inline + solver integration script | my hands CSS blocks | game-visual-rebuild | — |
| MY RANGES | `ranges` | `render()` in `ranges-ui/main.js` | **`ranges-ui/main.js` (v9 / structured UO)** | **`ranges-ui/ranges-ui.css`** | dynamic `#ranges.psScreen` insert | — |
| PROFILE | `profile` | `render` | **`profile.js`** → `window.renderProfile` + `window.PokerSwipeProfile` | **`profile.css`** + `ps-ui-unified.css` (`.pid` bridge) | `game-visual-rebuild` **skipped** (`renderProfile.__psVisualV2`); legacy `index.html` v31/v30 wrappers **inactive** (overwritten by `profile.js`) | full `#profileArea` innerHTML each render |
| POLYANA | `polyana` | `ensurePokerSwipePolyana` / `openPokerSwipePolyana` | **`polyana/polyana-integrated.js`** | **`polyana/polyana-integrated.css`** | v54 legacy fallback only if native flag false; `screen-router` scrub + ensure mount | `render()` replaces `#psPolyanaArea` |
| TOURNAMENTS | `mytournaments` | `openMyTournamentsV72` | `my-tournaments-pro.js` / ps72 overlay | `my-tournaments-pro.css` | v54 journal on `#tournaments` (separate screen) | `screen-router` hide ps72 |

## Profile (current)

- **Product name:** «Твой покерный почерк»
- **DOM root:** `#profileArea .pid` (`data-profile-build="poker-handwriting-v2"`)
- **Not used:** `psYou`, `v38You`, inline `index.html` `renderProfile` panel (superseded at load time by `profile.js`)

## Legacy layers (inactive for Polyana when native)

- `v54-consolidated-script`: defers to `openPokerSwipePolyana` when `__PSP_NATIVE_POLYANA`.
- `poker_swipe_v38.js` / `.v38You` CSS: not loaded / removed from v39 bundle.
- `installShowWrapper`: removed from `index.html`.
