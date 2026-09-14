# Poker validation queue (no auto-fix)

Strategic spots and atlas frequencies require human/solver review.

## Preflop atlas / stack sensitivity

- Verify provenance of `POKER_BRAIN_PACK.preflop` entries (RFI, BB defend, vs 3bet).
- Stack depth tables that appear identical across 15–100bb — **REQUIRES_SOLVER_VALIDATION**.
- Do **not** change frequencies without solver export metadata.

## Library vs Brain (96 blockers)

- `solver/tests/gradingConsistency.report.json` — `brainPolicyBlockersCount: 96`
- Sample taxonomy: `solver/tests/pokerPolicyBlockerClassification.report.json`
  - CONTEXT_LOSS, ACTION_NORMALIZATION, TRUE_POLICY_CONFLICT (sample only)
- **Do not** auto-pick library vs Brain.

### Example queued spots (TRUE_POLICY_CONFLICT sample)

| spotId | library | brain top | method |
|--------|---------|-----------|--------|
| PRE_RFI_SB_22 | ОЛЛ-ИН | RAISE 57.9% | preflop solver |
| PRE_BB_T6O | ФОЛД | CALL 89.9% | preflop solver |
| PRE_RFI_BTN_22_SHORT | ОЛЛ-ИН | RAISE 72.3% | preflop solver |

## ICM / PKO tasks

- Tasks with `stage` bubble/FT/PKO but missing payout/bounty fields → **ICM_CONTEXT_PARTIAL** or **INSUFFICIENT** (see `pokerLibraryValidation.report.json` spotlight).
- TOUR_PKO_FT_TT — **VALIDATION QUEUE** (no bounty $)
- ADV_ICM_COVER_A5S — **DOWNGRADE CLAIM** (concept training)
- Downgrade UI claims or quarantine from authoritative grading.

## Spot: PRE_BB_VS_SQZ

- **CURRENT POLICY:** CALL with 87s vs squeeze  
- **WHY SUSPICIOUS:** pot odds / ranges not fully specified in task JSON  
- **SEVERITY:** medium — explanation heuristic  
- **VERIFY:** solver sim or curated range chart with exact stacks
