# UI System Repair Report (final visual pass — PR #97)

## EXECUTIVE VERDICT

| Area | Status |
|------|--------|
| **POLYANA** | **FIXED** (runtime + loading/error shell) |
| **VISUAL CONSISTENCY** | **READY** (shared bridge: typography, cards, buttons, spacing on all `.psScreen` routes) |
| **MOTION** | **READY** (single screen-enter owner; press states bridged) |
| **MOBILE LAYOUT** | **PASS** (smoke, geometry, 20× stress × 9 screens) |

## POLYANA ROOT CAUSE (unchanged)

Competing v54 router vs native `#polyana` / `polyana-integrated.js`. Fixed via `__PSP_NATIVE_POLYANA`, `ensurePokerSwipePolyana`, `screen-router.js`. **This pass:** explicit `renderStatusView` for loading/error; retry button; no blank `#psPolyanaArea` during fetch.

## FINAL MOTION OWNER

| Effect | Owner |
|--------|--------|
| Screen enter | `ps-design-tokens.css` + **`ps-ui-unified.css`** `.psScreen.screen.active` → `psScreenEnter` |
| game-motion | Removed `animation: none` on `.screen.active` |
| game-polish | Renamed to `psScreenEnterPolish` on `.ps-screen-enter` only |
| Card/button press | `ps-ui-unified.css` + existing `game-motion` tap list |
| Answer reveal | `ps-ui-unified.css` `psReveal` on verdict / sizing result |

## DESIGN SYSTEM (active)

- **Tokens:** `ps-design-tokens.css`
- **Bridge (legacy markup → one product):** `ps-ui-unified.css` (loaded last)
- **Shell:** `.psScreen` on all primary sections + injected `#ranges`
- **Profile:** `profile.js` («Твой покерный почерк», `.pid`) / `profile.css` + `ps-ui-unified.css` `.pid` bridge

## PER-SCREEN BEFORE → AFTER

| Screen | Before | After |
|--------|--------|-------|
| **HOME** | v36 tiles, mixed font sizes | Unified `.ey`/titles/buttons/cards via bridge; v36 layout preserved |
| **DAILY** | `.panel` isolated typography | `.panel`/`.dailyStage` use token card + type scale; reveal motion on feedback |
| **SWIPE** | Custom swipe card fonts | Titles/buttons aligned; card glyphs untouched |
| **SIZING** | Dense panel, ad-hoc CTA | Panel + primary CTA match system; result `psReveal` |
| **MY HANDS** | `.myHero` / entries disparate | Hero + entries use card border/radius/spacing rhythm |
| **MY RANGES** | Separate injected screen | `#ranges.psScreen` + horizontal padding/safe area |
| **PROFILE** | psYou / v38 / inline panel wrappers | **`profile.js` `.pid`**; `__psVisualV2` blocks `game-visual-rebuild` wrap; v38 CSS removed |
| **POLYANA** | Blank while loading | Loading/error cards; list empty copy unchanged |
| **TOURNAMENTS** | ps72 overlay | Stress-tested 20×; no stale overlay |

## REMAINING INTENTIONAL DEVIATIONS

- **Home v36 grid** — information architecture unchanged; visual language bridged, not re-marked up.
- **Polyana hero** — large display title (brand) scoped in `#polyana` CSS.
- **Ranges matrix** — dedicated `ranges-ui/*.css` for grid density.
- **Bottom nav** — multiple historical `.nav` patches; layout grid intentional.

## REMAINING DEAD LEGACY CSS

- `.v38*` in `poker_swipe_v39.css` — **removed**
- `poker_swipe_v38.js` — not loaded in `index.html` (orphan)
- Root `polyana-integrated.css` — duplicate of `polyana/` copy, **not linked** (dead file)
- `.v32` hooks — inactive unless legacy scripts run

## CSS COLLISIONS

See `CSS_COLLISION_REPORT.md` — conflicting `.screen.active` **fixed**; classifications per selector.

## SCREEN OWNERSHIP

`SCREEN_OWNERSHIP.md` (unchanged ownership; visual layer = tokens + bridge).

## TEST RESULTS

| Command | Result |
|---------|--------|
| `npm test` | PASS |
| `npm run test:e2e:polyana` | PASS (10 cycles) |
| `npm run test:e2e:ui-smoke` | PASS |
| `npm run test:e2e:ui-geometry` | PASS (3 viewports) |
| `npm run test:e2e:ui-stress` | PASS (9 screens × 20 cycles) |
| `npm run test:e2e:daily` | PASS |
| `npm run test:e2e:navigation` | PASS |
| `npm run test:e2e:ui-visual` | PASS (27 PNGs, 3 viewports × 9 screens) |
| `npm run test:css-collision` | PASS |
| `npm run test:ui-audit` | Regenerates `UI_SYSTEM_AUDIT.md` |
| `npm run test:e2e:profile` | Post-merge pid ownership, styles, 20× home↔profile, profile PNGs |

## SCREENSHOTS / VISUAL CHECK

`/opt/cursor/artifacts/ui-baseline/` — `home|daily|swipe|sizing|myhands|myranges|profile|polyana|tournaments` × `390x844`, `393x852`, `430x932`.

## REMAINING P0

None.

## REMAINING P1

- Optional: delete unlinked `polyana-integrated.css` at repo root.
- Optional: migrate v36 home markup to explicit `psCard` classes (bridge sufficient today).
- `tests/v32_regression.js` updated to assert `#profileArea .pid`.

## COMMITS (this pass)

See branch `cursor/ui-system-polyana-2f0c` after push.

## POST-MERGE PROFILE VERIFICATION (main handwriting)

| Check | Result |
|-------|--------|
| `renderProfile` owner | `profile.js` → `render` (`renderName: "render"`) |
| `PokerSwipeProfile` | present |
| Runtime `.pid` | 1 root; `data-profile-build=poker-handwriting-v2` |
| `psYou` / `v38You` at runtime | **0** |
| `renderProfile.__psVisualV2` | **true** (blocks `game-visual-rebuild` legacy wrap) |
| Computed fonts vs home | **match** (system-ui stack) |
| Title | 24px / 900 |
| Screen enter | `psScreenEnter` on `#profile` |
| Home ↔ Profile 20× | PASS (`test:e2e:profile`) |
| Profile PNGs | `profile-390x844`, `profile-393x852`, `profile-430x932` |

**PR #97 merge-ready (UI gate):** **YES** — pending human product sign-off; **do not auto-merge**.

**Do not merge to `main` until product sign-off.**
