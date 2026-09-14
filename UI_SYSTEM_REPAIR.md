# UI System Repair Report

## EXECUTIVE VERDICT

| Area | Status |
|------|--------|
| **POLYANA** | **FIXED** |
| **VISUAL CONSISTENCY** | **READY WITH LIMITATIONS** (tokens + `.psScreen` on all primary sections; per-screen renderers still use legacy class names) |
| **MOTION** | **PARTIAL** (`.screen.active` enter via tokens; game-polish may override same keyframe name — see collisions) |
| **MOBILE LAYOUT** | **PASS** (UI smoke + geometry @ 390/393/430) |

## POLYANA ROOT CAUSE

**Cause:** Competing routers. `v54-consolidated-script` wired Polyana nav to `show('tournaments')` + legacy `renderTournaments23` into `#tournamentsArea`, while canonical UI is `#polyana` / `#psPolyanaArea` via `polyana/polyana-integrated.js`.

**Why it regressed:** Consolidated tournament router without gating on `__PSP_NATIVE_POLYANA`; `installShowWrapper` polling duplicated `show` behavior.

**Fix:**
- `index.html` — `openPolyana()` → `openPokerSwipePolyana()` when native flag set; v54 field click skipped when native.
- `polyana/polyana-integrated.js` — `ensurePokerSwipePolyana()` / mount ensure.
- `screen-router.js` — `ensurePokerSwipePolyana()` on `show('polyana')`; `tournaments` alias → `polyana`.
- Removed `installShowWrapper` + polling from `index.html`.

**Regression:** `npm run test:e2e:polyana` (10 cycles, tab interaction, duplicate DOM checks).

## DESIGN SYSTEM

| Layer | Location |
|-------|----------|
| Tokens | `ps-design-tokens.css` |
| Typography roles | `.psTypeDisplay` … `.psTypeStat` |
| Shell | `.psScreen`, `.psScreenBody`, `.psScreenHeader`, `.psSection` |
| Cards / buttons | `.psCard`, `.psBtn`, `--primary` / `--secondary` |
| Motion | `--ps-motion-*`, `psScreenEnter` on `.screen.active`, `prefers-reduced-motion` |

**Fonts:** UI = system stack; display = Arial Narrow (existing brand). Profile uses `psScreenBody`.

## SCREEN RESULTS

| Screen | Before (audit) | After |
|--------|----------------|-------|
| HOME | Mixed tile fonts | `.psScreen` + tokens; tiles still v36 classes |
| DAILY | Isolated felt UI | Opens; daily e2e PASS |
| SWIPE | Own motion | Opens via `show('swipe')` |
| SIZING | Dense controls | Opens; geometry PASS |
| MY HANDS | Module tabs | Nav + smoke PASS |
| MY RANGES | Injected section | `show('ranges')` smoke PASS |
| PROFILE | `profile.js` owner | `psScreenBody`; ownership unchanged |
| POLYANA | Did not open / wrong route | Native route; content in `#psPolyanaArea` |
| TOURNAMENTS | ps72 overlay | `mytournaments` nav; smoke PASS |

Detail: `UI_SYSTEM_AUDIT.md` (27 rows × 3 viewports).

## LEGACY COLLISIONS

See `CSS_COLLISION_REPORT.md` (13 multi-file selectors). **Not removed** without runtime proof: `.nav` inline patches, `.v38*` in v39 CSS (inactive DOM), V48/V54 Polyana fallback.

## SCREEN OWNERSHIP

See `SCREEN_OWNERSHIP.md`.

## TEST RESULTS

| Command | Result |
|---------|--------|
| `npm test` | PASS |
| `npm run test:e2e:polyana` | PASS |
| `npm run test:e2e:ui-smoke` | PASS |
| `npm run test:e2e:ui-geometry` | PASS |
| `npm run test:e2e:daily` | PASS |
| `npm run test:e2e:navigation` | PASS |
| `npm run test:e2e:ui-visual` | PASS (9 screenshots → `/opt/cursor/artifacts/ui-baseline`) |
| `npm run test:ui-audit` | Generated audit |
| `npm run test:css-collision` | Generated collision report |

## SCREENSHOTS / VISUAL CHECK

Baseline PNGs: `/opt/cursor/artifacts/ui-baseline/*-390x844.png` + `manifest.json`.

## REMAINING P0

None for Polyana open path or primary-screen smoke on tested HEAD.

## REMAINING P1

- Migrate Daily/Sizing/Home tile markup to `.psCard` / `.psType*` (incremental).
- Deduplicate `psScreenEnter` between `game-polish.css` and tokens (rename or single owner).
- Polyana explicit loading/error UI if API empty (shell renders; network failures need product copy).
- Retire dead `.v38` CSS after reference audit.
- `tests/v32_regression.js` still expects `.v38You` on profile — update if that suite is run in CI.

## COMMITS (branch `cursor/ui-system-polyana-2f0c`)

1. `fix: restore Polyana native route and mount ensure`
2. `test: add Polyana, UI smoke, and audit scripts`
3. (this turn) shell + typography tokens, geometry/visual/collision tests, docs

**Do not merge to `main` until product sign-off.**
