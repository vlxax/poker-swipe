# PokerSwipe — technical map for Cursor agents

Last verified against repository: **2026-09-13** (code inspection, not marketing claims).

This document describes **what exists in the repo**, **how components connect**, and **what is safe to change**. It does not assert GTO correctness of training content unless backed by wired solver validation.

---

## 1. Architecture map

```
USER (browser / Telegram WebApp)
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  index.html — shell, inline legacy JS (swipe/daily/etc.)   │
│  app-shell.js, screen-router.js, poker_swipe_v32…v40.js   │
│  mini-app-compact.js + mini-app-nav.js (__maGameLayout)    │
└───────────────────────────────────────────────────────────┘
        │
        ├─────────────────────────────┬──────────────────────────────┐
        ▼                             ▼                              ▼
 TRAINING / GAME UI            MY HANDS / REVIEW              POLYANA / MTT PRO
 (swipe, sizing, daily,         (import, poker_brain*.js)      (polyana-integrated.js)
  review, xray, ranges)                                              │
        │                                                             │
        ▼                                                             │
┌───────────────────┐         ┌──────────────────┐                    │
│ SessionController │         │ gradingGateway   │                    │
│ (training-ui/     │         │ → modeAdapters   │                    │
│  main.js)         │         │ → unifiedGrading │                    │
│ personalized      │         │ OR gradeAnswer   │                    │
│ daily drills      │         │ (library path)   │                    │
└─────────┬─────────┘         └────────┬─────────┘                    │
          │                            │                              │
          ▼                            ▼                              │
   task-context/                  PokerBrain /                        │
   library.js (180 tasks)        trainer-knowledge                   │
          │                            │                              │
          └──────────────┬─────────────┘                              │
                         ▼                                            │
                  FEEDBACK (taskFeedback.js, UI renderers)              │
                         │                                            │
                         ▼                                            │
              PROFILE / PERSONALIZATION                                 │
              (trainingStore, dynamicPlayerProfile,                   │
               weaknessTargeting, spotSelector, planner)                │
```

### Independent engine stack (not always on training hot path)

```
POKER ENGINE (solver-core/)          SOLVER / CFR (solver/src/cfr/)
├── cards/handEvaluator.js           ├── cfrSolver.js, cfrTrainer.js
├── equity/ (MC + exhaustive)         └── used by decisionAnalyzer API
├── math/potOdds.js, spr.js, ev.js
├── ranges/ (parser, expander, weights)
└── analysis/decisionAnalyzer.js  → may call solveCFR for API consumers
```

**Verified wiring:**

| Path | Grading source | Task data |
|------|----------------|-----------|
| Personalized **daily** (`training-ui/main.js`) | `gradingGateway` mode `daily` → `gradeAnswer` on `libraryDrill` synthetic EV | `task-context/library.js` |
| **Swipe** (`finalizeSwipe` in `index.html`, wrapped by bridges) | `gradeSwipeDecision` / `PokerSwipeGrading` / `PokerBrain` | `SWIPE_BASE` + session in `index.html`; game layout via `mini-app-compact.js` |
| **Sizing** (`renderSizing`) | `gradeSwipeSizing` | Legacy `SIZING` pool in `index.html` |
| **Assessment** | `gradeAssessmentItem` | `placementTestV2` / library via `AssessmentController` |
| **Trainer native** | Trainer index + brain bridge | `data/trainer/built/trainer-candidate-index.json` |

**UNVERIFIED:** That library `correct` fields match CFR or live solver output (library uses fixed EV tiers in `libraryDrill.js`).

---

## 2. Main entry points

| Entry | Role |
|-------|------|
| `index.html` | Production app shell; most legacy game logic inline; script load order matters |
| `training-ui/main.js` (ESM) | Replaces `window.renderDaily` for **personalized daily** training |
| `mini-app-compact.js` | When `window.__maGameLayout === true`, replaces `renderSwipe`, `renderSizing`, etc. with game shell |
| `solver/src/index.js` | Node/browser import surface for training store, planner, equity API |
| `app-shell.js` + `screen-router.js` | Navigation between `#swipe`, `#daily`, `#home`, … |

---

## 3. Where to change what

| If you need to change… | Primary locations | Do NOT touch (without poker/Savercraft review) |
|------------------------|-------------------|-----------------------------------------------|
| **Training UI (personalized daily)** | `training-ui/renderer.js`, `gameShell.js`, `main.js`, `sessionChrome.js`, `training-session.css` | `libraryDrill.js` correct/EV, `weaknessTargeting.js` selection math |
| **Feedback copy layout** | `training-ui/taskFeedback.js` (text from task), `renderer.js` / `sessionChrome.js` | Inventing new EV/equity on frontend |
| **Session flow (daily)** | `training-ui/sessionController.js`, `main.js` | `buildPersonalizedSessionAsync` planner internals unless P0 spec |
| **Swipe tap / gesture UX** | `mini-app-compact.js`, `swipe-gesture-core.js`, `swipe-gesture-bind.js`, `game-motion.js/css` | `finalizeSwipe` grading body, `swipeGrade` / brain |
| **Legacy swipe content** | `index.html` (`SWIPE_BASE`, `renderSwipe`, `finalizeSwipe`) | Overwriting `PokerSwipeGrading` owner |
| **Poker task text / answers** | `task-context/library.js`, `advancedTasks*.js` | — (content + poker review required) |
| **Grading** | `training-ui/gradingGateway.js`, `solver/src/api/unifiedGrading.js`, `solver/src/training/answerEvaluator.js` | Changing thresholds without test pass |
| **Solver / CFR** | `solver/src/cfr/*`, `solver/src/analysis/decisionAnalyzer.js` | Training library expecting solver sync |
| **Equity / pot math** | `solver/src/equity/*`, `solver/src/math/*` | UI pretending to compute new poker math |
| **Player profile display** | `training-ui/viewModel.js`, `playerProfileCopy.js` | `dynamicPlayerProfile.js` diagnosis formulas |
| **Personalization selection** | `solver/src/training/spotSelector.js`, `weaknessTargeting.js`, `planner.js` | Tag heuristics without semantic QA |
| **Mobile layout (game)** | `mini-app-compact.css`, `poker-table.css`, `game-layout.css` | Breaking safe-area on `#swipeActions` |
| **Game character** | `character-system.js`, `character-integration.js`, `freak-lady-reactive` | `finalizeSwipe` character hooks order |
| **Polyana / tournaments** | `polyana/polyana-integrated.js`, `my-tournaments-pro.js` | Training grading |
| **Legacy swipe versions** | See §5 — **do not add new script tags** for old `poker_swipe_v3x.js` |

---

## 4. DO NOT TOUCH WITHOUT VERIFICATION

| Component | Why sensitive |
|-----------|----------------|
| `libraryDrill.js` (`correct`, `alsoOk`, EV 10/9.2/5) | Defines personalized daily “truth”; not solver-backed |
| `answerEvaluator.js` + `config/thresholds.js` | Grade ↔ EV loss mapping |
| `unifiedGrading.js` (`source: 'cfr'` labels) | Misleading if library path labeled CFR |
| `gradingGateway.js` | Single production grading router; double-wrap risk |
| `PokerSwipeGrading` / `poker_brain*.js` | Swipe/sizing brain policy |
| `task-context/library.js` + `validator.js` | Structural only; no pot/action poker proofs |
| `weaknessTargeting.js` / `spotSelector.js` | P0 personalization band/slot contract |
| `buildPersonalizedSessionAsync` | Session composition |
| `index.html` `finalizeSwipe` assignment chain | Many wrappers (`game-motion`, `character`, `unified-grading`) |
| `trainer-knowledge/*` + `data/trainer/built/*` | Reference ranges / trainer index |

---

## 5. Legacy script inventory

**Actively loaded by `index.html` (bottom of file, order matters):**

| File | Role |
|------|------|
| `poker_swipe_v73_hotfix.js` | DOM guards / hotfix layer |
| `screen-router.js` | Screen routing |
| `poker_swipe_v32.js` | Stability wrapper; patches `renderSwipe`, strips duplicate context |
| `poker_brain.js`, `poker_brain_v33.js`, `poker_brain_v34.js` | Brain policy versions (stacked) |
| `poker_swipe_v33.js` | Incremental UX |
| `poker_swipe_v34.js` | Explanations / review UI helpers |
| `poker_swipe_v39.js`, `poker_swipe_v40.js` | Home / dashboard generations |
| `game-visual-rebuild.js` | Verdict polish, wraps `finalizeSwipe` |
| `unified-grading-integration.js` | Creates/wraps `finalizeSwipe` if missing |
| `training-ui/main.js` | Personalized daily module |
| `game-motion.js` + `swipe-gesture-bind.js` | Motion + swipe drag bind |

**Present in repo but NOT in main `index.html` load chain (backup / artifacts):**

`poker_swipe_v35.js`, `v36.js`, `v37.js`, `v38.js` — treat as **LEGACY / version artifacts**; do not `<script>` them without explicit migration.

**CSS:** `poker_swipe_v32.css`, `v33.css`, `v34.css`, `v39.css`, `v40.css` linked from `index.html`.

---

## 5b. Grading paths (dual brain)

See **[docs/GRADING_PATHS.md](../docs/GRADING_PATHS.md)**. Daily uses `gradeAnswer` + library EV; swipe uses PokerBrain via gateway. Same task id can disagree across modes — not silently unified.

Regression: `solver/tests/gradingPathConsistency.test.js` (daily gateway ≡ `gradeAnswer`).

---

## 6. Testing

### UI / training (Node + jsdom)

```bash
cd /workspace && npm install   # jsdom devDependency at repo root
node --test solver/tests/trainingUiRenderer.test.js
node --test solver/tests/playerProfileUi.test.js
node --test solver/tests/swipeGesture.test.js
npm run test:training          # curated training UI + personalization + grading path
npm run test:training-audit    # Phase 13 harness (slow)
npm run test:e2e:daily         # Playwright daily bootstrap (pretest installs Chromium; ephemeral port)
```

### Solver-core (from `solver/` package)

```bash
cd solver && npm install
node --test tests/trainingUiRenderer.test.js   # path via ../ if needed
node --test tests/*.test.js                    # individual files
```

Note: `npm test` in `solver/` runs `node --test tests/` which may fail if a broken importer exists in `tests/` — prefer **explicit file list** or `npm run test:solver`.

### Root package

```bash
npm test              # polyana_map.js (fast gate)
npm run test:polyana  # polyana_regression.js — legacy full index.html jsdom stress test (slow; optional)
```

**Polyana DOM regression (`tests/polyana_regression.js`):** jsdom **v26** removed `requestInterceptor`; the test uses a custom `ResourceLoader` + stubs (`matchMedia`, third-party scripts). It boots the full `index.html` graph and can take several minutes in CI. It is **not** part of `npm test` so training/Polyana map checks stay fast; run `npm run test:polyana` when changing Polyana shell integration.

### Playwright / E2E

`npm run test:e2e:daily` — daily training bootstrap at 390×844 (`tests/daily_e2e_verify.mjs`).

### Manual QA scripts (examples)

`tests/qa-runtime.mjs`, `tests/p1_decision_quality_gate.mjs`, `tests/miniapps_qa.mjs` — run with `node tests/<file>.mjs` when investigating; not unified in root `npm test`.

### Typecheck / build

No root `tsc` or production bundler for the static `index.html` app → **NOT AVAILABLE** (static assets + ESM modules).

---

## 7. Safe change protocol

1. **Inspect** the live call path (`window.renderSwipe`, `renderDaily`, `finalizeSwipe`, `gradeDecision`).
2. **Identify** whether change is UI-only, training pipeline, or brain/solver.
3. **Smallest diff**; reuse guards (`swLocked`, `answering`, `showingFeedback`, `pendingOptionId`).
4. **Run** targeted tests (see §6).
5. **Broader regression** if touching `gradingGateway`, `index.html` finalize chain, or `mini-app-compact.js`.
6. **Mobile** check if touching `#swipe`, `#swipeActions`, `touch-action`, safe-area.
7. **Never** change poker correctness without library/brain validation.
8. **Report** exact files and whether brain/solver were untouched.

---

## 8. Current project status

| Area | Status | Notes |
|------|--------|-------|
| UI / UX shell | **PARTIAL** | Game layout (`__maGameLayout`), motion, swipe drag bind; legacy inline UI remains |
| Training (personalized daily) | **VERIFIED** | `training-ui` + `task-context` library; grading is quiz-EV not CFR |
| Poker brain (swipe/sizing) | **PARTIAL** | `PokerBrain` + bridges; content pools in `index.html` |
| Solver / CFR | **VERIFIED** (code exists) | API/analysis path; **UNVERIFIED** link to 180 library tasks |
| Personalization P0 | **VERIFIED** (metrics) | `weaknessTargeting` / `audit100Sessions.mjs`; semantic ICM quality **REQUIRES VALIDATION** |
| Legacy areas | **LEGACY** | Inline `index.html` swipe session, old `poker_swipe_v35–38` files |
| Verification gaps | **REQUIRES VALIDATION** | Pot/action consistency in library; `taskContextIntegrity` `currentLine` on raw tasks |

---

## 9. KNOWN ISSUES / FOLLOW-UP (not fixed in doc-only pass)

| Issue | File | Reason |
|-------|------|--------|
| Library answers not solver-validated | `solver/src/training/libraryDrill.js` | Synthetic EV; `correct` author-defined |
| `unifiedGrading` may label `source: 'cfr'` for library drills | `solver/src/api/unifiedGrading.js` | Provenance mismatch |
| `auditCanonicalSpot` false positives on facing bet | `solver/src/training/taskContextIntegrity.js` | Uses `currentLine` not `history` |
| Example pot/history mismatch | `task-context/library.js` (`PRE_VS3B_66`, etc.) | No pot auditor in `validator.js` |
| `PsMotion.startHand` / `decisionLock` were no-ops until `swipe-gesture-bind.js` | `game-motion.js` | Optional chaining hid absence |

---

## 10. Swipe gesture call path (2026-09-13)

```
pointerdown on .pgArenaWrap (#swipeVisual)
  → swipe-gesture-bind.js (attachSwipeScene)
  → mapSwipeToAction (swipe-gesture-core.js) — picks existing action label
  → programmatic .click() on [data-sa] button
  → mini-app-compact.js onclick
  → window.finalizeSwipe(s, a, size)  [grading — DO NOT CHANGE in UX tasks]
  → swLocked = true; verdict UI
```

Tap path unchanged. One gesture → one `.click()` → existing `swLocked` in `finalizeSwipe`.

---

*Savercraft / external poker brain workstreams are out of scope for this file; treat `poker_brain*.js` and `trainer-knowledge` as shared sensitive surfaces.*
