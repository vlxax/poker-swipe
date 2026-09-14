# Poker correctness repair — working audit

## BASELINE (branch `cursor/post-session-review-b438`)

| Item | Value |
|------|--------|
| HEAD (start of mission) | `f14dcc6` |
| Working tree | P0 navigation + poker fixes (local commits pending push) |

### Gate results (post-fix local)

| Command | Result |
|---------|--------|
| `npm test` | PASS |
| `npm run test:training` | PASS 50/50 |
| `npm run test:training-audit` | (run before push) |
| `npm run test:e2e:daily` | PASS |
| `npm run test:e2e:navigation` | PASS A/B/C |
| `npm run test:poker-correctness` | PASS 27/27 |
| `npm run test:grading-consistency` | PASS |
| `npm run test:poker-library` | INVALID_ACTIVE 0 (schema) |

---

# EXECUTIVE VERDICT

**POKER BRAIN STATUS:** READY WITH LIMITATIONS  
**TRAINING STATUS:** READY WITH LIMITATIONS  

**Can product be called “GTO trainer”?** **ONLY WITH QUALIFIER** — library training is **curated quiz** (`LIBRARY_CURATED`); PokerBrain uses **heuristic atlases**; solver-backed EV is **not** the default for Daily/Swipe library drills.

---

# VERIFIED BUGS (REPRODUCED → FIXED)

| Issue | Status | Fix |
|-------|--------|-----|
| Straight high card wrong (`23456` → 5 not 6) | REPRODUCED | `handEvaluator.js` straight high = `low + 6`, max over runs |
| 7-card straight picks 9-high not T-high | REPRODUCED | same |
| Double trips not full house (`AAA` + `KKK`) | REPRODUCED | `tripsList.length >= 2` → full house |
| Made flush classified as DRAW in `handBucket` | REPRODUCED | `handBucketFromEvaluator` + `hand-bucket-bridge.js` |
| Made straight classified as DRAW | REPRODUCED | same |
| Library synthetic 10/9.2/5 shown as BB EV loss | REPRODUCED | `evAvailable: false`, semantic grades, no fake `evLossBb` in feedback |
| MISC_DONK_OVERPAIR “overpair” on Q83 | REPRODUCED | explanation copy fixed (JJ = underpair to Q) |
| F_AA_COORD false flush draw on rainbow | REPRODUCED | explanation copy fixed |
| T_BARREL_BLUF wrong outs/backdoor on turn | REPRODUCED | explanation copy fixed |
| F_3BET_JJ_SCARY OOP action order | REPRODUCED | flop history: BB checks first |
| F_SQUEEZE_SET post-all-in flop action | REPRODUCED | squeeze not shove; legal flop line |

---

# ALREADY FIXED / STALE (older ZIP)

| Issue | Status on HEAD |
|-------|----------------|
| Daily iframe blocks nav | FIXED (P0 navigation pass — `hand-day-bridge` no longer hijacks `show('daily')`) |
| `installShowWrapper` polling | REMOVED |
| INVALID_ACTIVE 13 (old audit JSON) | STALE — current audit **0** schema-invalid |

---

# HAND EVALUATOR RESULT

Canonical: `solver/src/cards/handEvaluator.js`  
Tests: `handEvaluator.test.js`, `handEvaluator.exhaustive.test.js` — **PASS**

---

# LEGACY CLASSIFIER RESULT

Production PokerBrain `handBucket` delegates to `PsHandBucketFromEval` when `hand-bucket-bridge.js` loads.  
Fallback legacy logic remains if bridge missing (degraded).

---

# SYNTHETIC EV RESULT

- Library drills: `evAvailable: false`, `evSource: library_quiz_score`, `policySource: LIBRARY_CURATED`
- UI feedback: no `Потеря EV: X.XX BB` for library-only paths when EV unavailable
- Semantic grades: EXCELLENT / GOOD / MISTAKE from `correct` / `alsoOk`

---

# TRAINING LIBRARY (schema gate)

`taskContextIntegrityAudit.mjs`: **1249 active, 0 schema-invalid**  
**Semantic poker audit** (180+ manual, explanation validator) — **partial**; objective text fixes applied for listed spots. Full explanation validator — follow-up.

---

# POLICY RECONCILIATION

Report: `solver/tests/pokerPolicyReconciliation.report.json`  
Harness note: gateway library path 421/421 unchanged; raw brain blockers require `gradingConsistency.harness` for full matrix (see existing `gradingConsistency.report.json`).

---

# PRODUCT CLAIMS (answers)

1. **GTO?** Not globally — only where `SOLVER_VERIFIED` metadata exists.  
2. **BB EV?** Only when `evAvailable: true` with source metadata.  
3. **Solver-backed modes:** solver API / equity paths — not default library Daily.  
4. **Curated/heuristic:** library drills, PokerBrain atlases, Review scripted cases.  
5. **Contradictory answers across modes?** Possible for non-library swipe (Brain vs library) — documented, not auto-merged.  
6. **Illegal poker tasks?** Some history issues fixed; full action-SM audit not complete.  
7. **Incomplete ICM?** Many tasks — **REQUIRES_SOLVER_VALIDATION** (see queue).  
8. **Safe Daily training?** **Safer** for strategy labels; not solver-GTO.  
9. **Safe Swipe?** Library-routed spots match Daily; Brain spots heuristic.  
10. **My Hands?** Context-dependent; do not infer ICM from isolated hands.

---

# FINAL VERDICT

**NOT READY** for “solver GTO trainer” marketing.  
**READY WITH LIMITATIONS** for curated training with honest provenance labels.

See `POKER_VALIDATION_QUEUE.md` for strategic disputes.
