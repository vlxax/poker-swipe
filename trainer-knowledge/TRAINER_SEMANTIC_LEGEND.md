# Trainer Semantic Legend Validation — Stage 4.6

Generated: 2026-08-24T18:42:33.567645+00:00

**SAFE TO MERGE: NO** — awaiting user approval.

## Stage 4.6 — Stack Band Fix

- **STACK PARSER FIXED:** YES
- **AFFECTED CHARTS:** 276
- **AFFECTED CELLS:** 1634 (all `nAI→RAISE`, no other action flips)

### Before Stack Fix
- nAI: 4649
- RAISE: 1924
- VERIFIED/grading: 13207

### After Stack Fix
- nAI: 3015
- RAISE: 3558
- VERIFIED/grading: 14358

### Delta
- nAI: -1634
- RAISE: +1634
- VERIFIED/grading: +1151

Ranges spanning the 18BB UO boundary (e.g. `16-22BB`) were **not** upgraded to RAISE.

## Final Report

- **PARSER STRUCTURE VERIFIED:** YES — 1,578/1,578 charts, 266,682/266,682 cells structurally parsed
- **MATRIX ORIENTATION VERIFIED:** YES — 55/55 QA samples: AA@(0,0), 22@(12,12), AKs upper, AKo lower
- **COLOR CLASSIFICATION VERIFIED:** PARTIAL — AI/RAISE/gray/cyan mapped; orange/yellow/margin bands need scheme context
- **GRADING-ALLOWED CELLS:** 14358
- **VERIFIED COVERAGE:** 5.38%
- **NON-GRADABLE TRAINER CELLS:** 252324
- **SOURCE TRACEABILITY:** manifest + SOURCE_NOTES + UO_RANGES_NORMALIZED + chart legend crops
- **TESTS:** see solver/tests/trainerBatch2Parsing.test.js

## Coverage Breakdown

| Metric | Count |
|--------|------:|
| TOTAL BATCH 2 CELLS | 266,682 |
| VERIFIED ACTION CELLS | 14,358 |
| PARTIAL CELLS | 0 |
| NEEDS CLARIFICATION CELLS | 252,324 |
| UNSELECTED | 203,978 |
| nAI | 3,015 |
| ORANGE | 29,232 |
| YELLOW | 1,508 |
| MIXED | 30,677 |
| OTHER UNKNOWN COLORS | 2,072 |
| GRADING-ALLOWED BEFORE (stack fix) | 13207 |
| GRADING-ALLOWED AFTER (stack fix) | 14,358 |
| VERIFIED COVERAGE % | 5.38% |

### By Scenario

| Mode | Total | Grading | UNSELECTED | AI | RAISE | nAI | ORANGE | YELLOW |
|------|------:|--------:|-----------:|---:|------:|----:|-------:|-------:|
| callpush | 103,935 | 1,753 | 90,893 | 2,759 | 323 | 1,661 | 6,893 | 1,405 |
| vs1r | 54,587 | 2,021 | 41,538 | 2,967 | 727 | 8 | 6,650 | 0 |
| vssqueeze | 34,138 | 319 | 31,284 | 827 | 61 | 0 | 1,111 | 0 |
| huante | 29,068 | 7,718 | 8,375 | 7,970 | 1,513 | 907 | 9,724 | 6 |
| vs1r1c | 11,492 | 667 | 7,902 | 967 | 149 | 0 | 1,478 | 0 |
| vs3bet | 9,464 | 151 | 8,447 | 183 | 167 | 0 | 411 | 0 |
| vs2r | 8,957 | 155 | 8,546 | 405 | 0 | 0 | 6 | 0 |
| sbvsbb | 5,746 | 1,436 | 1,221 | 1,122 | 618 | 173 | 1,490 | 97 |
| vs1rshort | 5,577 | 136 | 3,183 | 280 | 0 | 112 | 1,119 | 0 |
| vs4bet | 1,859 | 2 | 1,658 | 3 | 0 | 0 | 198 | 0 |
| vslimp | 1,859 | 0 | 931 | 0 | 0 | 154 | 152 | 0 |

## Evidence-Based Color/Action Legend

### Ai
- **COLOR / VISUAL SIGNATURE:** Purple RGB ~(48-72, 0-16, 96-152)
- **RAW LABEL:** Ai
- **PROPOSED NORMALIZED ACTION:** AI
- **SOURCE EVIDENCE:** SOURCE_NOTES.md §5; UO_RANGES_NORMALIZED action_semantics.AI; chart legend 'Ai' row
- **NUMBER OF SUPPORTING CHARTS:** All modes with purple legend (~1578)
- **CONFIDENCE:** HIGH
- **STATUS:** VERIFIED
- **GRADING ALLOWED:** True

### nAI (UO-style) / 10% запас и выше (margin-style)
- **COLOR / VISUAL SIGNATURE:** Green RGB ~(64-96, 144-240, 0-32)
- **RAW LABEL:** nAI (UO-style) / 10% запас и выше (margin-style)
- **PROPOSED NORMALIZED ACTION:** null
- **SOURCE EVIDENCE:** SOURCE_NOTES §6 labels green as nAI in <=18BB UO charts; chart legend shows 'nAI' or '10% запас и выше' depending on scheme. No trainer expansion of nAI semantics.
- **NUMBER OF SUPPORTING CHARTS:** UO-style ~1200; margin-style ~456
- **CONFIDENCE:** MEDIUM
- **STATUS:** NEEDS_CLARIFICATION
- **GRADING ALLOWED:** False

### Рейз
- **COLOR / VISUAL SIGNATURE:** Green RGB (deeper stacks UO) → resolved as RAISE when stack>18BB
- **RAW LABEL:** Рейз
- **PROPOSED NORMALIZED ACTION:** RAISE
- **SOURCE EVIDENCE:** SOURCE_NOTES §6; UO_RANGES_NORMALIZED 'Рейз' in 18-25/25-40/40+ bands only
- **NUMBER OF SUPPORTING CHARTS:** UO batch 18+ bands (18 charts); Batch2 when stack>18BB and green cell
- **CONFIDENCE:** HIGH
- **STATUS:** VERIFIED
- **GRADING ALLOWED:** True
- **NOTE:** Only when stack context confirms UO-style RAISE band

### кол с низкой плюсовостью… (truncated)
- **COLOR / VISUAL SIGNATURE:** Cyan RGB ~(48-64, 208-224, 224-240)
- **RAW LABEL:** кол с низкой плюсовостью… (truncated)
- **PROPOSED NORMALIZED ACTION:** LOW_PLAYABILITY
- **SOURCE EVIDENCE:** SOURCE_NOTES §7; UO_RANGES_NORMALIZED; chart legend crop shows truncated Russian text
- **NUMBER OF SUPPORTING CHARTS:** ~5836 cells + UO charts with cyan
- **CONFIDENCE:** MEDIUM
- **STATUS:** PARTIAL
- **GRADING ALLOWED:** False
- **NOTE:** Visual category preserved; full trainer wording truncated; action semantics not fully confirmed

### UNSELECTED (no legend row — inferred from empty/unselected cells)
- **COLOR / VISUAL SIGNATURE:** Gray RGB ~(38-72, 37-72, 44-96) low saturation
- **RAW LABEL:** UNSELECTED (no legend row — inferred from empty/unselected cells)
- **PROPOSED NORMALIZED ACTION:** null
- **SOURCE EVIDENCE:** SOURCE_NOTES §8; UO_RANGES_NORMALIZED action_semantics.UNSELECTED — NOT fold
- **NUMBER OF SUPPORTING CHARTS:** 203978
- **CONFIDENCE:** HIGH
- **STATUS:** PARTIAL
- **GRADING ALLOWED:** False
- **NOTE:** Category label preserved; fold/call/raise semantics NOT proven

### кол
- **COLOR / VISUAL SIGNATURE:** Orange RGB ~(208, 160, 32-48) — UO-style charts
- **RAW LABEL:** кол
- **PROPOSED NORMALIZED ACTION:** null
- **SOURCE EVIDENCE:** Chart legend crop B2_0500 (vssqueeze family): orange swatch labeled 'кол'
- **NUMBER OF SUPPORTING CHARTS:** ~1200 UO-style charts
- **CONFIDENCE:** MEDIUM
- **STATUS:** PARTIAL
- **GRADING ALLOWED:** False
- **NOTE:** Trainer label 'кол' preserved; normalized CALL not enabled without user confirmation

### 20% запас и выше
- **COLOR / VISUAL SIGNATURE:** Orange RGB ~(208, 160, 32-48) — margin-style (callpush)
- **RAW LABEL:** 20% запас и выше
- **PROPOSED NORMALIZED ACTION:** null
- **SOURCE EVIDENCE:** Chart legend crop B2_1200 (callpush): orange swatch labeled '20% запас и выше'
- **NUMBER OF SUPPORTING CHARTS:** ~456 callpush charts
- **CONFIDENCE:** HIGH
- **STATUS:** NEEDS_CLARIFICATION
- **GRADING ALLOWED:** False
- **NOTE:** Trainer margin band — not a standard poker action; do not merge with UO-style orange 'кол'

### 15% запас и выше
- **COLOR / VISUAL SIGNATURE:** Yellow RGB ~(240, 240, 32-48) — margin-style only
- **RAW LABEL:** 15% запас и выше
- **PROPOSED NORMALIZED ACTION:** null
- **SOURCE EVIDENCE:** Chart legend crop B2_1200 (callpush): yellow swatch labeled '15% запас и выше'
- **NUMBER OF SUPPORTING CHARTS:** ~456 callpush + 10 vslimp
- **CONFIDENCE:** HIGH
- **STATUS:** NEEDS_CLARIFICATION
- **GRADING ALLOWED:** False
- **NOTE:** Separate from orange; trainer margin band semantics

### 5% запас и выше
- **COLOR / VISUAL SIGNATURE:** Purple margin-style (callpush)
- **RAW LABEL:** 5% запас и выше
- **PROPOSED NORMALIZED ACTION:** null
- **SOURCE EVIDENCE:** Chart legend crop B2_1200
- **NUMBER OF SUPPORTING CHARTS:** ~456 callpush
- **CONFIDENCE:** HIGH
- **STATUS:** NEEDS_CLARIFICATION
- **GRADING ALLOWED:** False

### 10% запас и выше
- **COLOR / VISUAL SIGNATURE:** Green margin-style (callpush)
- **RAW LABEL:** 10% запас и выше
- **PROPOSED NORMALIZED ACTION:** null
- **SOURCE EVIDENCE:** Chart legend crop B2_1200
- **NUMBER OF SUPPORTING CHARTS:** ~456 callpush
- **CONFIDENCE:** HIGH
- **STATUS:** NEEDS_CLARIFICATION
- **GRADING ALLOWED:** False

## nAI

Trainer source preserves `nAI` as a legend label (SOURCE_NOTES §6, UO_RANGES_NORMALIZED, chart legend 'nAI' row).
No trainer source expands what nAI means operationally.

- rawAction = `nAI`
- normalizedAction = null
- gradingAllowed = false
- status = NEEDS_CLARIFICATION

## UNSELECTED / Gray

SOURCE_NOTES §8 and UO_RANGES_NORMALIZED explicitly preserve gray as UNSELECTED.
Trainer source does NOT confirm fold semantics.

- gradingAllowed = false (unchanged)

## Orange / Yellow

Two distinct trainer legend schemes detected:

1. **UO-style** (vssqueeze, vs1r, huante, etc.): orange labeled `кол` in chart legend
2. **Margin-style** (callpush): yellow=`15% запас и выше`, orange=`20% запас и выше`

These are NOT merged. RGB clusters reported separately in legend table.

## Mixed Cells Audit

- Total mixed cells: 30,677
- All components verified (AI/RAISE only): 90
- Has unverified component: 30,587
- Visual-approx frequencies: 30,677
- Grading-enabled mixed: 0 (policy: 0)

## Manual Chart QA

### callpush
- **B2_0964** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_1087** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_1210** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_1333** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_1456** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED

### vs1r
- **B2_0360** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=RAISE live=RAISE
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=RAISE live=RAISE
  - ✓ AKo: stored=RAISE live=RAISE
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ A7s: stored=RAISE live=RAISE
- **B2_0424** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ KK: stored=UNSELECTED live=UNSELECTED
- **B2_0488** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI
- **B2_0552** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=RAISE live=RAISE
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0616** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI

### vssqueeze
- **B2_0001** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0041** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0081** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0121** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0161** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED

### huante
- **B2_0747** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=RAISE live=RAISE
  - ✓ 22: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKs: stored=RAISE live=RAISE
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=AI live=AI
  - ✓ 72o: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ KK: stored=RAISE live=RAISE
- **B2_0781** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=nAI live=nAI
  - ✓ 22: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKs: stored=nAI live=nAI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 72o: stored=nAI live=nAI
  - ✓ KK: stored=nAI live=nAI
- **B2_0815** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0849** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ A8s: stored=UNSELECTED live=UNSELECTED
- **B2_0883** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI

### vs1r1c
- **B2_0203** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=AI live=AI
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI
- **B2_0216** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=AI live=AI
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0229** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=AI live=AI
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ KK: stored=UNSELECTED live=UNSELECTED
- **B2_0242** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=AI live=AI
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ KQs: stored=AI live=AI
- **B2_0255** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ A7s: stored=AI live=AI

### vs3bet
- **B2_0304** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=RAISE live=RAISE
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0315** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=RAISE live=RAISE
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0326** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0337** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0348** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=RAISE live=RAISE
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=RAISE live=RAISE

### vs2r
- **B2_0694** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0704** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0714** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0724** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0734** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED

### sbvsbb
- **B2_0930** scheme=UNKNOWN mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=AI live=AI
  - ✓ AKs: stored=nAI live=nAI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=AI live=AI
  - ✓ 72o: stored=AI live=AI
- **B2_0936** scheme=UNKNOWN mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ KK: stored=UNSELECTED live=UNSELECTED
- **B2_0942** scheme=UNKNOWN mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=COLOR_128_112_64 live=COLOR_128_112_64
  - ✓ AKs: stored=COLOR_240_240_128 live=COLOR_240_240_128
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=AI live=AI
  - ✓ 72o: stored=COLOR_128_112_64 live=COLOR_128_112_64
- **B2_0948** scheme=UNKNOWN mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ KK: stored=UNSELECTED live=UNSELECTED
- **B2_0954** scheme=UNKNOWN mismatches=0
  - ✓ AA: stored=AI live=AI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=AI live=AI
  - ✓ 76s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ A8s: stored=ORANGE_208_160_32 live=ORANGE_208_160_32

### vs1rshort
- **B2_0271** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 76s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI
- **B2_0277** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 76s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI
- **B2_0283** scheme=MARGIN_STYLE mismatches=0
  - ✓ AA: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 76s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI
- **B2_0289** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 76s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI
- **B2_0295** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=AI live=AI
  - ✓ AKo: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ 76s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=AI live=AI

### vs4bet
- **B2_0683** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=UNSELECTED live=UNSELECTED
- **B2_0685** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0687** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0689** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ A8s: stored=UNSELECTED live=UNSELECTED
- **B2_0691** scheme=UO_STYLE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=ORANGE_208_160_32 live=ORANGE_208_160_32
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ AQs: stored=UNSELECTED live=UNSELECTED

### vslimp
- **B2_0919** scheme=MARGIN_STYLE_LITE mismatches=0
  - ✓ AA: stored=COLOR_240_240_112 live=COLOR_240_240_112
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=nAI live=nAI
  - ✓ AKo: stored=COLOR_240_240_128 live=COLOR_240_240_128
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0921** scheme=MARGIN_STYLE_LITE mismatches=0
  - ✓ AA: stored=nAI live=nAI
  - ✓ 22: stored=COLOR_192_208_96 live=COLOR_192_208_96
  - ✓ AKs: stored=nAI live=nAI
  - ✓ AKo: stored=nAI live=nAI
  - ✓ 76s: stored=COLOR_192_224_96 live=COLOR_192_224_96
  - ✓ 72o: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ A7s: stored=COLOR_192_208_96 live=COLOR_192_208_96
- **B2_0923** scheme=MARGIN_STYLE_LITE mismatches=0
  - ✓ AA: stored=nAI live=nAI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=nAI live=nAI
  - ✓ AKo: stored=nAI live=nAI
  - ✓ 76s: stored=COLOR_128_144_96 live=COLOR_128_144_96
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ KQs: stored=nAI live=nAI
- **B2_0925** scheme=MARGIN_STYLE_LITE mismatches=0
  - ✓ AA: stored=UNSELECTED live=UNSELECTED
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY
  - ✓ AKo: stored=UNSELECTED live=UNSELECTED
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
- **B2_0927** scheme=MARGIN_STYLE_LITE mismatches=0
  - ✓ AA: stored=nAI live=nAI
  - ✓ 22: stored=UNSELECTED live=UNSELECTED
  - ✓ AKs: stored=nAI live=nAI
  - ✓ AKo: stored=nAI live=nAI
  - ✓ 76s: stored=UNSELECTED live=UNSELECTED
  - ✓ 72o: stored=UNSELECTED live=UNSELECTED
  - ✓ A7s: stored=LOW_PLAYABILITY live=LOW_PLAYABILITY

## Verified Action Semantics

- **AI** — legend label `Ai` in trainer charts + SOURCE_NOTES
- **RAISE** — legend label `Рейз` in UO 18+ stack bands (context-dependent)

## Unresolved Action Semantics

- **nAI** — label only, no expansion
- **UNSELECTED** — category only, not fold
- **LOW_PLAYABILITY** — truncated cyan legend
- **Orange (UO-style)** — trainer label `кол`, not normalized
- **Orange/Yellow (margin-style)** — margin bands, not poker actions
- **Mixed cells** — proportions visual-approx; grading blocked

QA summary: 55 charts checked, 0 hand mismatches on re-parse, 55/55 orientation OK

## Known Limitations

- Stack band strings now parse as EXACT/RANGE/MINIMUM/CONTEXT — see `trainer-knowledge/stackParser.js`
- Ranges spanning 18BB boundary remain ambiguous for green nAI/RAISE resolution
- Two legend schemes coexist: UO-style (AI/nAI/кол) vs margin-style (5%/10%/15%/20% запас)
- Orange RGB cluster `(208,160,32)` maps to different trainer labels depending on scheme

## SAFE TO MERGE: NO