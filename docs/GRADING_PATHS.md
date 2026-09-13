# Grading paths map (factual)

## Daily personalized training

```
training-ui/main.js → SessionController.answer()
  → gradingGateway.gradeDecision({ mode: 'daily', drill, chosenActionId })
  → gradeAnswer (solver/src/training/answerEvaluator.js)
  → libraryDrill synthetic EV tiers (NOT CFR, NOT PokerBrain)
```

**Truth source:** `task-context/library.js` `correct` / `alsoOk` + `libraryDrill.js` option EVs.

## Swipe / sizing / quick (legacy + game shell)

```
[data-sa] click / swipe-gesture → finalizeSwipe / sizing handlers
  → gradingGateway modes swipe|sizing|quick
  → solver/src/api/modeAdapters.js → unifiedGrading.js
  → PokerBrain / frequency tables (poker_brain*.js)
```

**Truth source:** `POKER_BRAIN_PACK` / policy tables — separate from library.

## Canonical spot (display / context only)

`task-context/canonicalSpot.js` normalizes hero/villain/pot/history for HUD.  
It does **not** replace grading truth for daily drills.

## Architectural gap

The same **task id** shown in swipe (via `libraryTaskToSwipe`) can be graded differently than in daily (`gradeAnswer`) because backends differ.  
Regression: `solver/tests/gradingPathConsistency.test.js` locks **daily gateway ≡ gradeAnswer** only.

## Not GTO

Neither path proves solver-GTO unless explicitly wired to CFR output. Labels like `source: 'cfr'` in unified grading are provenance metadata, not proof of solver validation for library tasks.
