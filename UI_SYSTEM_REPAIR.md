# UI System Repair Report

## EXECUTIVE VERDICT

| Area | Status |
|------|--------|
| **POLYANA** | **FIXED** (runtime ownership clarified; v54 legacy router no longer hijacks native Polyana when `__PSP_NATIVE_POLYANA`) |
| **VISUAL CONSISTENCY** | **READY WITH LIMITATIONS** (token layer + screen shell added; full migration incomplete) |
| **MOTION** | **PARTIAL** (screen enter animation + button press via tokens; per-feature motion not unified) |
| **MOBILE LAYOUT** | **PASS** (UI smoke @ 390px; audit at 390/393/430 — see `UI_SYSTEM_AUDIT.md`) |

## POLYANA ROOT CAUSE

**Cause:** Competing routers. `v54-consolidated-script` in `index.html` wired the Polyana nav button to `show('tournaments')` and rendered legacy V48 content into `#tournamentsArea`, while canonical UI lives in `#polyana` / `#psPolyanaArea` via `polyana/polyana-integrated.js`. Depending on listener order and load timing, users could land on an empty/wrong screen.

**Why it regressed:** Merge of consolidated tournament/Polyana router without gating on native Polyana flag; `installShowWrapper` polling reintroduced duplicate `show` behavior.

**Fix:**
- `index.html` — `openPolyana()` delegates to `openPokerSwipePolyana()` when `__PSP_NATIVE_POLYANA`.
- `polyana/polyana-integrated.js` — `ensurePokerSwipePolyana()` for mount without duplicate navigation.
- `screen-router.js` — calls `ensurePokerSwipePolyana()` when route is `polyana`.
- Removed `installShowWrapper` block from `index.html`.

**Regression test:** `npm run test:e2e:polyana` (10 open/close cycles, tab interaction, no duplicate DOM).

## DESIGN SYSTEM

- **Tokens:** `ps-design-tokens.css` (`--ps-font-*`, spacing, radii, colors, motion).
- **Shell:** `.psScreen`, `.psScreenBody`, `.psSection`, `.psCard`, `.psBtn` variants.
- **Profile:** uses `.psScreenBody` on `#profileArea` (owner unchanged: `profile.js`).

## SCREEN RESULTS (summary)

See `UI_SYSTEM_AUDIT.md` for per-viewport table. Primary screens open in UI smoke; Polyana shows `pspHero` shell with data.

## LEGACY COLLISIONS

- `.v38*` rules remain in `poker_swipe_v39.css` (inactive DOM).
- V48/V54 tournament Polyana still available as fallback if native script fails to load.
- Multiple legacy inline patches in `index.html` remain; not removed in this pass.

## SCREEN OWNERSHIP

See `SCREEN_OWNERSHIP.md`.

## TEST RESULTS

| Command | Result |
|---------|--------|
| `npm run test:e2e:polyana` | PASS |
| `npm run test:e2e:ui-smoke` | PASS (8 routes) |
| `npm run test:ui-audit` | Generated `UI_SYSTEM_AUDIT.md` |
| `npm run test:e2e:daily` | (run in CI/local) |

## REMAINING P0

- None for Polyana open path on tested HEAD.

## REMAINING P1

- Migrate remaining screens to token classes (incremental).
- Remove dead `.v38` CSS after proof no references.
- Geometry Playwright suite for CTA vs nav overlap (not yet automated).
- Visual screenshot baselines per screen.

## COMMITS

See branch `cursor/ui-system-polyana-2f0c` history.
