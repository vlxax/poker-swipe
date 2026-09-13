# Phase 13: Training Quality Audit Report

**Date:** 2026-08-21  
**Scope:** 100 generated training sessions (34×A + 33×B + 33×C, trimmed to 100)  
**Method:** `solver/scripts/audit100Sessions.mjs` — audit only, no production changes

## Profiles

| Profile | Simulated player | Weakest skills (fixture) |
|---------|------------------|--------------------------|
| **A** | Strong postflop/river, weak ICM/push-fold | shortStack, icm |
| **B** | Strong ICM, weak postflop/river/bluff-catch | bluffCatch, rangeReading |
| **C** | Balanced strong | shortStack, postflop |

Each session: 15 tasks via `buildProfileDailyPlan`. Between sessions: 3 simulated answers (`recordTrainingResult`) to test longitudinal personalization.

## Measured Metrics

| Metric | Result |
|--------|--------|
| Sessions audited | 100 |
| Total tasks | 1,500 |
| **Duplicate rate** | **0%** |
| **Near-duplicate rate** | **0.5%** |
| Skill coverage (avg unique skills/session) | 9.5 |
| **Profile-to-task mismatch** | **55.1%** (primary weakness slots vs diagnosed weak skills) |
| **Invalid poker spots** | **0** |
| Answer/explanation match failures | 0 |
| Poker Brain context field failures | 0 |
| Russian terminology failures | 0 |
| Difficulty band mismatch | 46.4% |
| Personalized session rate | 100% |
| Library validation | 180/180 OK |
| Metadata fully usable | 180/180 |

### Session-0 differentiation (clean profiles)

| Profile | ICM/push tasks | Postflop/river tasks | Advanced (L4+) |
|---------|----------------|----------------------|------------------|
| A | 53.3% | 46.7% | — |
| B | 6.7% | 73.3% | — |
| C | 33.3% | 60% | 60% |

Cross-profile A↔B task overlap (session 0): **0/15**

### Difficulty distribution (all 1,500 tasks)

| L1 | L2 | L3 | L4 | L5 |
|----|----|----|----|-----|
| 0 | 45 | 945 | 510 | 0 |

## Verdict

| Area | Result | Notes |
|------|--------|-------|
| **Training quality** | **PASS** | Zero duplicates, 0.5% near-dups, 100% personalized |
| **Poker logic** | **PASS** | All 180 library tasks valid; answers/explanations consistent |
| **Personalization quality** | **FAIL** | 55.1% primary-slot mismatch after profile evolution; session-0 targeting is correct |

## Checks performed

- [x] Tasks vs diagnosed weaknesses (primary weakness slot audit)
- [x] Difficulty vs adaptive band (`getTargetDifficulty`)
- [x] Poker spot validity (`validateTask`)
- [x] Answer/explanation consistency (`gradeAnswer` + `buildTaskFeedback`)
- [x] Duplicate / near-duplicate detection (`isTooSimilar`)
- [x] Advanced tasks for strong profile C (60% L4 on session 0)
- [x] Russian terminology (Cyrillic in question/explain/options)
- [x] Poker Brain / task-context fields (blinds, pot, stacks, history, street)
- [x] Personalization across 20+ answers (100% personalized rate over 34 sessions/profile)

## Next P0 fixes (audit findings — not implemented)

1. **Primary weakness slots sometimes miss diagnosed weak skills** — 55.1% mismatch rate on `primary_weakness` / `secondary_weakness` slots after dynamic profile evolution; session-0 plans are well-targeted but longitudinal drift breaks slot↔diagnosis alignment.
2. **Task difficulty often outside adaptive band** — 46.4% of selected tasks fall outside `getTargetDifficulty` min/max for the relevant skill; review selector difficulty fit scoring weights.

## How to re-run

```bash
cd solver
node scripts/audit100Sessions.mjs
node --test tests/trainingQualityAudit.test.js
```
