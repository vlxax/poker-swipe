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
