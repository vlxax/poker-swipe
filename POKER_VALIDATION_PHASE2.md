# EXECUTIVE VERDICT

**Poker correctness:** READY WITH LIMITATIONS  
**Training library:** READY WITH LIMITATIONS  
**Preflop strategy trust:** PARTIAL (atlas curated; `solverOutput: false`)  
**Postflop strategy trust:** PARTIAL (REFERENCE_ATLAS / heuristics)  
**Sizing strategy trust:** PARTIAL (legacy SIZING pool + heuristic brain)  
**ICM/PKO:** LIMITED — concept training unless payout/bounty modeled  

**Can PokerSwipe currently call itself "GTO trainer":** ONLY WITH QUALIFIERS  

Engineering validation complete. Remaining items require solver/expert poker validation.

---

# BASELINE (HEAD `9717b15` → post-Phase-2 commits on branch)

| Command | Result (pre-change baseline @ 9717b15) |
|---------|----------------------------------------|
| `npm test` | PASS |
| `npm run test:training` | 50/50 PASS |
| `npm run test:training-audit` | 12/13 FAIL (harness beginner band) |
| `npm run test:e2e:daily` | PASS (prior run) |
| `npm run test:e2e:navigation` | PASS (prior run) |
| `npm run test:poker-correctness` | 27/27 PASS |
| `npm run test:grading-consistency` | PASS |

---

# FULL LIBRARY RESULTS

| Metric | Value |
|--------|------:|
| totalTasks | 180 |
| activeTasks | 180 |
| duplicateIds | 0 |
| objectiveErrors (hard) | 0 |
| illegalHistories (integrity) | 0 |
| contextInsufficient | 0 |
| ICMInsufficient (strict) | 0 |
| PKOInsufficient (strict) | 0 |
| ICM partial | 23 |
| PKO partial | 10 |
| strategyValidationRequired (curated library) | 180 |

Report: `solver/tests/pokerLibraryValidation.report.json`

---

# ICM / PKO

| Task | Status | Action |
|------|--------|--------|
| SNG_ICM_77 | ICM_CONTEXT_PARTIAL | KEEP — 3-max bubble heuristic |
| ADV_ICM_COVER_A5S | PKO_CONTEXT_PARTIAL | DOWNGRADE CLAIM — bounty size absent |
| TOUR_PKO_FT_TT | PKO_CONTEXT_PARTIAL | VALIDATION QUEUE |
| ADV_ICM_SHORT_COVER | ICM_CONTEXT_PARTIAL | KEEP — FT push/fold heuristic |

---

# PREFLOP PROVENANCE

| Source | Type | solverOutput |
|--------|------|--------------|
| `strategy_pack_v17.js` / POKER_BRAIN_PACK | CURATED | false |
| `task-context/library.js` | CURATED | false |
| `libraryDrill.js` | LIBRARY_CURATED quiz | evAvailable false |
| `ranges-ui/referenceRangesPack.js` | CURATED | solverVerified false |

Suspicious spot re-run: `solver/tests/preflopStackSensitivity.report.json` → `suspiciousCases[]`

---

# STACK SENSITIVITY

`preflopStackSensitivity.report.json`: 30 comparable hand×spot rows across depths 15–100bb.  
Identical clusters flagged when all depths share one policy fingerprint (atlas interpolation via `nearest()` in `poker_brain.js`).

---

# POSTFLOP CONTEXT

`postflopContextSensitivity.report.json`:

| Dimension | Support |
|-----------|---------|
| effectiveStack | PARTIALLY_SUPPORTED |
| SPR | PARTIALLY_SUPPORTED |
| position | SUPPORTED |
| potType | PARTIALLY_SUPPORTED |
| street | SUPPORTED |
| players (multiway) | IGNORED |
| actionHistory | PARTIALLY_SUPPORTED |

---

# SIZING

Legacy `SIZING` pool in `index.html` graded via PokerBrain / atlas; not solver-verified.  
Pot/SPR/street used in brain spot assembly; no separate solver sizing export.  
**Trust:** HEURISTIC / CURATED.

---

# 96 POLICY BLOCKERS

`gradingConsistency.report.json`: **brainPolicyBlockersCount: 96** (library gateway still 421/421 exact on comparable).  
Sample classification (`pokerPolicyBlockerClassification.report.json`):

| Class | Sample count |
|-------|-------------:|
| CONTEXT_LOSS | 8 |
| ACTION_NORMALIZATION | 5 |
| TRUE_POLICY_CONFLICT | 7 |

Full enumeration → `npm run test:grading-consistency` + reconciliation script.

---

# DIFFICULTY AUDIT

**Previous 12/13 failure:** Harness counted all sessions for `profile.kind === 'beginner'` while simulated `overall` climbed 33→83 after mostly-correct answers, so the selector correctly served L4–L5.  

**Classification:** harness measurement bug (not threshold noise).  

**Fixes:**  
1. Measure beginner L1–L3 only when `overallAtSessionStart < 42`.  
2. Selector: apply easy-pool filter on weakness slots; strict L1–L3 weakness band when `overall < 35`; no +1 band leak to L4.

---

# PHASE 13 RESULT

| | |
|--|--|
| Was | 12/13 |
| Now | **13/13** |
| Why | Harness beginner band + selector weakness/difficulty guards |

---

# MY HANDS

Imported HH typically lacks payout field, bounties, and remaining field → **cannot support exact ICM**.  
`analyzeHand` returns atlas/heuristic with source label; copy in `index.html` notes non-exact postflop nodes.

---

# PRODUCT CLAIM HONESTY

`POKER_BRAIN_PACK.truth.solverOutput: false` — UI still says “GTO BRAIN” in places; library drills use `LIBRARY_CURATED` / `evAvailable: false`.  
**P0:** Do not market atlas frequencies as solver-exact GTO.

---

# REMAINING P0

- Reconcile 96 brain blockers (true conflicts → queue)
- PKO bounty economics on FT tasks
- UI “GTO” labels vs provenance

---

# REMAINING P1

- Granular INVALID_SPOTS in harness (split counts wired in library validation summary)
- Full blocker export (not only sample) for queue automation

---

# REQUIRES EXTERNAL SOLVER

- Preflop atlas spot checks (UTG 20bb K7o, etc.)
- ICM/PKO exact lines (ADV_ICM_COVER_A5S, TOUR_PKO_FT_TT)
- TRUE_POLICY_CONFLICT spots from Brain vs library

---

# TEST RESULTS (final run on branch)

Run: `npm test`, `test:training`, `test:training-audit`, `test:poker-correctness`, `test:grading-consistency`, `test:poker-validation`, e2e scripts.

---

# COMMITS

See `git log` on `cursor/post-session-review-b438` after Phase 2 push.
