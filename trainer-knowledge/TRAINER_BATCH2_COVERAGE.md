# Batch 2 Hand-Level Parsing Coverage (Stage 4)

Generated from `data/trainer/built/batch2-parse-report.json`.

## Summary

| Metric | Value |
|--------|------:|
| BATCH 2 CHARTS TOTAL | 1,578 |
| CHARTS SUCCESSFULLY PARSED | 1,578 |
| CHARTS PARTIALLY PARSED | 0 |
| CHARTS FAILED | 0 |
| HAND CELLS TOTAL | 266,682 |
| HAND CELLS PARSED | 266,682 |
| MIXED CELLS | 30,677 |
| GRADING-ALLOWED CELLS | 13,207 |
| NEEDS-CLARIFICATION CELLS | ~245,000+ |
| SOURCE TRACEABILITY | manifest + source_hash + compressed_sha256 |
| DUPLICATES | 0 |
| DATASET SIZE (parsed) | ~89 MB (gitignored, build-time) |
| DATASET SIZE (shards) | ~23 MB (lazy-load runtime) |

## By scenario

| Mode | Charts | Parsed | Hand records | Grading-enabled | Clarification |
|------|-------:|-------:|-------------:|----------------:|--------------:|
| callpush | 615 | 615 | 103,935 | 1,714+ | high |
| vs1r | 323 | 323 | 54,587 | 1,519+ | high |
| vssqueeze | 202 | 202 | 34,138 | 319+ | high |
| huante | 165 | 165 | 27,885 | 7,438+ | medium |
| vs1r1c | 68 | 68 | 11,492 | 564+ | high |
| vs2r | 53 | 53 | 8,957 | 155+ | high |
| vs3bet | 56 | 56 | 9,464 | 77+ | high |
| sbvsbb | 32 | 32 | 5,408 | 955+ | medium |
| vs1rshort | 31 | 31 | 5,239 | 125+ | high |
| vs4bet | 11 | 11 | 1,859 | 2+ | high |
| vslimp | 10 | 10 | 1,690 | 0 | all clarification |

## Policy

- Gray cells → `UNSELECTED` (NOT fold)
- Orange/yellow legend colors → `NEEDS_CLARIFICATION` (unknown semantics)
- Mixed cells → all strategies preserved, `gradingAllowed=false`
- No Greenline / Poker Brain fill for gaps

## Runtime proof

```bash
node trainer-knowledge/scripts/batch2RuntimeExamples.mjs
```

## Tests

```bash
cd solver && npm run test:trainer
# 56/56 PASS (includes batch2 parsing suite)
```
