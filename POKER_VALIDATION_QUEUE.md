# Poker validation queue (no auto-fix)

Strategic spots and atlas frequencies require human/solver review.

## Preflop atlas / stack sensitivity

- Verify provenance of `POKER_BRAIN_PACK.preflop` entries (RFI, BB defend, vs 3bet).
- Stack depth tables that appear identical across 15–100bb — **REQUIRES_SOLVER_VALIDATION**.
- Do **not** change frequencies without solver export metadata.

## Library vs Brain (historical ~96 blockers)

- Use `solver/tests/gradingConsistency.report.json` (`brainPolicyBlockersCount`) for raw Brain vs library on **correct** action.
- Classify per `pokerPolicyReconciliation.report.json` schema (A–G).
- **Do not** auto-pick library vs Brain.

## ICM / PKO tasks

- Tasks with `stage` bubble/FT/PKO but missing payout/bounty fields → **ICM_CONTEXT_INSUFFICIENT**.
- Downgrade UI claims or quarantine from authoritative grading.

## Spot: PRE_BB_VS_SQZ

- **CURRENT POLICY:** CALL with 87s vs squeeze  
- **WHY SUSPICIOUS:** pot odds / ranges not fully specified in task JSON  
- **SEVERITY:** medium — explanation heuristic  
- **VERIFY:** solver sim or curated range chart with exact stacks
