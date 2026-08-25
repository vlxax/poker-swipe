# Trainer Knowledge Layer — FROZEN

**Status:** Technical parser stable. Semantic interpretation frozen pending trainer confirmation.

## Frozen Counts (do not change via heuristics)

| Metric | Value |
|--------|------:|
| VERIFIED / grading-enabled | 14,358 |
| NEEDS_CLARIFICATION | 252,324 |
| Total Batch 2 cells | 266,682 |

## Blocked Until Trainer Confirms

- nAI
- UNSELECTED / gray
- orange (UO-style `кол` vs margin-style `20% запас и выше`)
- yellow (`15% запас и выше`)
- mixed-cell frequency semantics

## Central Semantic Update Path (no image reparse)

1. Edit `trainer-knowledge/trainerSemanticLegend.json` only
2. Run `node trainer-knowledge/scripts/reapplyTrainerSemantics.mjs`
3. Run `node trainer-knowledge/scripts/compactBatch2Shards.mjs`
4. Run `node trainer-knowledge/scripts/buildTrainerKnowledge.mjs`

Parsed cells retain stable `actionRaw` labels (e.g. `ORANGE_208_160_32`, `nAI`, `UNSELECTED`).
Per-chart legend scheme is in `trainer-knowledge/batch2-legend-schemes.json`.

**SAFE TO MERGE: NO**
