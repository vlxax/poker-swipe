# PokerSwipe — Trainer UO Range Bundle (Batch 1)

This bundle converts the trainer's 60 PNG range charts into structured data that Cursor can use without manually reading every image.

## Files
- `UO_RANGES_NORMALIZED.json` — primary source for integration. 60 charts with stack, position, action buckets, hand lists, combo counts and full 13×13 matrices.
- `UO_RANGES_FLAT.csv` — 10,140 rows: one row per chart × starting-hand cell. Useful for audit/import scripts.
- `UO_MANIFEST.csv` — one row per original chart with source path, checksum and selected combo count.
- `VALIDATION_REPORT.json` — structural parser checks.
- `SOURCE_NOTES.md` — critical provenance/semantic rules.
- `ORIGINAL_SOURCE_SHA256.txt` — checksum linking this normalized bundle to the original `UO(1).zip`.

## Integration rule
Use `UO_RANGES_NORMALIZED.json` as a READ-ONLY trainer source layer first. Do not paste duplicated copies into each mini-app. Create adapters/selectors so Ranges, Exploit, training mini-apps, Daily Hand, My Hands and Poker Brain can query the same central dataset where semantically relevant.

## Important
`UO` is kept as the raw source group name. Do not guess what the abbreviation means unless the trainer/user confirms it. `nAI` is also preserved exactly rather than expanded by inference. Gray cells are marked `UNSELECTED`, not automatically `FOLD`.

## Parser validation
Every 13×13 matrix covers all 169 starting-hand classes and weighted combo counts sum to 1326 per chart.
