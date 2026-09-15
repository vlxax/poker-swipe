# Grading paths map (factual)

## End-to-end flow (task → feedback)

```
task-context/library.js (authoring: correct, alsoOk, options, explain)
        │
        ├──────────────────────────────┬─────────────────────────────┐
        ▼                              ▼                             ▼
 drillFromLibraryTask          libraryTaskToBrainSpot          buildCanonicalSpot
 (libraryDrill.js)             (swipe / brain HUD payload)      (HUD identity only)
        │                              │
        ▼                              │
 gradeAnswer ◄─── gradingGateway mode: daily
 (answerEvaluator.js)                  │
        │                              │
        │         gradingGateway mode: swipe|sizing|quick
        │              │               │
        │              ├─ spot._library + spot._drill → gradeAnswer (same EV tiers)
        │              └─ else → modeAdapters → unifiedGrading → PokerBrain
        ▼                              ▼
 taskFeedback.js / renderer      legacy g/y/r + unified verdict
```

| Stage | Daily | Swipe (library task) | Swipe (non-library) |
|--------|--------|----------------------|----------------------|
| **Source of truth** | `correct` / `alsoOk` + fixed option EVs | Same when `_library` (gateway adapter) | `POKER_BRAIN_PACK` atlases + exact nodes |
| **Action vocabulary** | Russian labels → `choiceToActionType` | Swipe sends EN (`FOLD`/`CALL`/…) mapped to drill option id | `normAction` in `poker_brain.js` |
| **Frequencies** | `recommendedFrequency: 1` (pure quiz) | N/A on library path | `node.actions` freqs → `gradeFromFreq` |
| **Fallback** | `INACCURACY` if EV missing | Library path: same as daily; else `NO_MODEL` → poor grade | Postflop atlas / preflop lookup |
| **Unsupported** | Schema validation in planner | Brain without `_drill`: policy may disagree with library | `source: NO_MODEL` |

## Daily personalized training

```
training-ui/main.js → SessionController.answer()
  → gradingGateway.gradeDecision({ mode: 'daily', drill, chosenActionId })
  → gradeAnswer (solver/src/training/answerEvaluator.js)
  → libraryDrill synthetic EV tiers (NOT CFR, NOT PokerBrain)
```

## Swipe / sizing / quick

```
gesture / UI → gradingGateway.gradeDecision({ mode: 'swipe', scenario, action })
  → if scenario._library && scenario._drill → gradeAnswer (library truth)
  → else modeAdapters → unifiedGrading.gradeViaLegacy → PokerBrain.gradeDecision
```

**Non-library truth:** `strategy_pack_v17.js` / `POKER_BRAIN_PACK` — independent of library `correct`.

## Canonical identity

- **Task id:** `task.id` (e.g. `PRE_RFI_BTN_A8S`)
- **Drill id:** `stableHash('lib|{taskId}|{concept}')` in `libraryDrill.js`
- **Canonical spot:** `buildCanonicalSpot(task)` — display / integrity; not grading truth

## Regression & audit

| Test | Locks |
|------|--------|
| `gradingPathConsistency.test.js` | daily gateway ≡ `gradeAnswer` |
| `gradingConsistency.test.js` | library spots: daily ≡ swipe gateway (all options) |
| `gradingConsistency.report.json` | Machine-readable A/B/C/D split |

## Dual-grading policy

- **Do not** auto-merge library `correct` with PokerBrain policy without human review.
- **Safe adapter:** library-mapped swipe spots carry `_drill`; gateway routes them to `gradeAnswer` without changing EV math.
- **Blockers:** Non-library swipe spots where Brain policy conflicts with library — listed in `gradingConsistency.report.json` → `conflictSpotIds` (must be empty for UX merge).

## Not GTO

Neither path proves solver-GTO unless explicitly wired to CFR output. Gateway `source: 'cfr'` on library drills is metadata for the EV-tier evaluator, not CFR output.

## Truth domain map (UI → gateway → authority)

See `docs/POKER_TRUTH_DOMAINS.md` and `solver/config/pokerTruthDomains.json`. **Rendering source** (what the user sees) may differ from **grading source** (what scores the action).

| Feature | UI entry | Router / gateway | Truth domain | Grading source | Fallback |
|--------|-----------|------------------|--------------|----------------|----------|
| Daily calendar | `index.html` `renderDaily` / `dailyReveal` | `PokerSwipeGrading.gradeBrain` (legacy shell) | POSTFLOP_TEACHING + POSTFLOP_POLICY overlay | `preferred` + args locally; action/size also `PokerBrain.gradeDecision` | `grade: y` if brain missing |
| Daily personalized | `training-ui/main.js` | `gradingGateway` `mode: daily` | LIBRARY_QUIZ_TRUTH | `gradeAnswer` ← `library.js` | `INACCURACY` tier |
| Swipe library-linked | `training-ui` / tasks with `_library` | `gradingGateway` `mode: swipe` + `_drill` | LIBRARY_QUIZ_TRUTH | `gradeAnswer` | same as daily |
| Swipe non-library | `index.html` `finalizeSwipe` | `PokerSwipeGrading.gradeBrain` | POSTFLOP_POLICY | `PokerBrain.gradeDecision` + pack atlases / exact nodes | `NO_MODEL` → poor grade |
| Sizing lab | `index.html` `renderSizing` | `PokerSwipeGrading` / brain size eval | SIZING (dual) | `sizeZone` UI + `PokerBrain.sizeEval` | zone tolerance bands in UI |
| Review | `index.html` `renderReview` | local `REVIEWS[]` + `PokerBrain.reviewLine` when wired | POSTFLOP_TEACHING | curated review models in pack + local `bad` index | manual repair slider |
| XRAY | `index.html` `renderXray` / `XR[]` | feature-local `weightedScore` | POSTFLOP_TEACHING | `XR[].ref` / `river` teaching grids | no `referenceRangesPack` |
| My Hands | `index.html` builder / `showHand` | `PokerBrain.analyzeHand` optional | EQUITY + POSTFLOP_POLICY | `exactEquity` for hindsight; brain for decision point if modeled | reg signals only |
| Push/Fold | `ranges-ui` push_fold + `index.html` push18 | `pushFoldEval` / runtime `push18` | PUSH_FOLD | heuristic matrix (`pushFold.js` canonical) | legacy `push18` / `GTOBrainV19` wrapper |
| All-In / short stack | Range trainer + swipe push views | `pushFold` / brain preflop | PUSH_FOLD + PREFLOP_STACK_SPECIFIC | situational: heuristic vs atlas | see equivalence report |
| Range Trainer reference | `ranges-ui/referenceRanges.js` | static pack loader | PREFLOP_REFERENCE | render-only frequencies | n/a |
| Range Trainer stack-specific | `preflopAtlas.js` + brain pack | `POKER_BRAIN_PACK.preflop` | PREFLOP_STACK_SPECIFIC | atlas policy lookup | reference chart for display only |

### Daily dual-truth note (P0 documentation)

Calendar `DAILY[]` templates carry teaching `preferred` / `zone` / `args` while `dailyReveal` also calls `PokerSwipeGrading.gradeBrain`. Personalized Daily in `training-ui` uses **only** `LIBRARY_QUIZ_TRUTH`. Quantified in `solver/tests/dailyTruthPaths.report.json` (no auto-merge).

### Swipe dual-truth note

`SWIPE_BASE` ships `preferred`/`live` for copy and legacy `swipeGrade`, but production `finalizeSwipe` grades via **PokerBrain**. Library tasks with the same concept may still route through `gradingGateway` when `_library` is set. Quantified in `solver/tests/swipeTruthPaths.report.json`.
