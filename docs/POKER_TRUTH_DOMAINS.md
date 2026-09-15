# Poker truth domains (architecture lock)

This document locks **authoritative truth domains** for poker content in PokerSwipe. It reflects the read-only `POKER_TRUTH_ARCHITECTURE_AUDIT` conclusions and is enforced by CI (`npm run test:poker-architecture`).

Machine-readable registry: `solver/config/pokerTruthDomains.json` (metadata only — runtime not migrated yet).

## Domains

### PREFLOP_REFERENCE

- **Authority:** `ranges-ui/referenceRangesPack.js` (+ `ranges-ui/referenceRanges.js`)
- **Use:** Range Trainer **reference** charts, UI rendering of static 6-max reference shapes
- **Not:** Stack-specific MTT grading, Daily/Swipe quiz answers, PokerBrain atlas keys

### PREFLOP_STACK_SPECIFIC

- **Authority:** `strategy_pack_v17.js` → `window.POKER_BRAIN_PACK.preflop` (also `ranges-ui/preflopAtlas.js` for derived UI)
- **Use:** PokerBrain preflop atlas lookup (`RFI|POS|STACK|HAND`), stack-sensitive policies
- **Duplicate (guarded):** inline `window.POKER_BRAIN_PACK` in `index.html` must remain semantically identical (`test:poker-pack-drift`)

### POSTFLOP_POLICY

- **Authority:** `POKER_BRAIN_PACK.postflop` + `POKER_BRAIN_PACK.exact` nodes via `poker_brain.js` → `PokerBrain.gradeDecision`
- **Use:** Non-library Swipe grading, sizing brain path, My Hands brain overlay when a model exists
- **Provenance:** `truth.solverOutput: false` — atlas + curated exact nodes, not CFR dumps

### LIBRARY_QUIZ_TRUTH

- **Authority:** `task-context/library.js` via `gradeAnswer` (`solver/src/training/answerEvaluator.js`)
- **Gateway:** `training-ui/gradingGateway.js` modes `daily` and library-linked `swipe`
- **Fields:** `correct`, `alsoOk`, synthetic EV tiers — **must not** be overwritten by PokerBrain

### PUSH_FOLD

- **Canonical implementation:** `ranges-ui/pushFold.js`
- **Legacy duplicate:** `push18()` in `index.html` (may be wrapped by `GTOBrainV19` at runtime)
- **Provenance:** short-stack **heuristic**, not solver Nash (unless explicitly labeled with metadata)

### EQUITY

- **Authority:** `solver/src/cards/handEvaluator.js` (+ UI `exactEquity` in My Hands)
- **Use:** Showdown math, pot odds, hindsight checks
- **Not:** Strategy recommendation or quiz grading

### POSTFLOP_TEACHING

- **Feature-local:** `XR[]` (XRAY), `REVIEWS[]`, calendar `DAILY[]` preferred/zone/args, Swipe `preferred`/`live`, curated library scenarios used as teaching copy
- **Not:** A single merged solver truth; dual sources are documented in `dailyTruthPaths.report.json` and `swipeTruthPaths.report.json`

### SIZING

- **Current state:** **PARTIAL / dual source**
- **Rendering:** `index.html` `SIZING[]` scenarios + zone pills
- **Grading:** `PokerBrain.sizeEval` / postflop atlas sizes when gateway mode is `sizing`

## MUST NOT UNIFY

1. **referenceRangesPack** must not become production stack-specific grading truth.
2. **PokerBrain** must not overwrite library `correct` / `alsoOk`.
3. **Equity** must not be presented as strategy recommendation.
4. **XRAY** must not use `referenceRangesPack` as grading authority (stay on `XR[]` teaching logic).
5. **Push/fold** heuristic must not be represented as solver-backed GTO/Nash without provenance.
6. Do not auto-merge **LIBRARY_QUIZ_TRUTH** with **POSTFLOP_POLICY** without human review (see `gradingConsistency.report.json`).

## CI / reports

| Check | Output |
|--------|--------|
| Pack drift | `solver/tests/pokerPackDrift.report.json` |
| Duplicates | `solver/tests/pokerTruthDuplicates.report.json` |
| Daily dual-truth | `solver/tests/dailyTruthPaths.report.json` |
| Swipe dual-truth | `solver/tests/swipeTruthPaths.report.json` |
| Push/fold matrix | `solver/tests/pushFoldEquivalence.report.json` |
| Provenance labels | `solver/tests/pokerProvenanceLabelAudit.report.json` |
| Domain misuse | `solver/tests/pokerDomainMisuseViolations.report.json` |
| XRAY authority | `solver/tests/xrayAuthority.report.json` |
| Lock summary | `POKER_TRUTH_ARCHITECTURE_LOCK.md` |
