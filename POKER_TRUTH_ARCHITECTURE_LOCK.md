# Poker truth architecture lock

Generated: 2026-09-15T08:37:37.502Z

## Metrics

| Metric | Value |
|--------|------:|
| PACK_DRIFT | 0 |
| DAILY_TRUE_CONFLICTS | 0 |
| SWIPE_TRUE_CONFLICTS | 1 |
| PUSHFOLD_DIVERGENCES (MID stage) | 0 |
| PUSHFOLD stage-adjusted divergence records | 28481 |
| PROVENANCE_MISLEADING | 40 |
| DOMAIN_MISUSE_VIOLATIONS | 0 |
| XRAY_AUTHORITY | LOCAL_XR_TEACHING |

## Daily conflict IDs

_none_

## Swipe conflict IDs

- `R_98762_88`

## Remaining issues

- **P0**: Swipe preferred vs runtime brain conflicts (R_98762_88)
- **P1**: pushFold.js omits push18 tournament stage bands (BUBBLE/FT)
- **P1**: User-facing GTO/solver labels without provenance

## Verdict

**ARCHITECTURE LOCKED WITH KNOWN CONFLICTS**

## Next implementation task

Wire `solver/config/pokerTruthDomains.json` into grading gateway routing (read-only registry today), and add a single runtime pack loader so `strategy_pack_v17.js` is the only authoritative pack source (remove inline duplicate after drift CI stays green for one release).
