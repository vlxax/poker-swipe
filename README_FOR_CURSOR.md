# PokerSwipe Trainer Range Pack — Batch 2

Upload this ZIP to a separate GitHub branch as ONE file. It contains 1578 NEW trainer charts in compact readable WebP plus a parsed manifest.

The original `iLoveZIP_jpg.zip` had 1638 charts. 60 UO charts were excluded because Batch 1 already contains UO as the normalized source of truth. The uploaded `UO(2).zip` is byte-for-byte identical to the previously processed `UO(1).zip`, so do not import UO again.

## Included scenario groups
- `callpush`: 615
- `vs1r`: 323
- `vssqueeze`: 202
- `huante`: 172
- `vs1r1c`: 68
- `vs3bet`: 56
- `vs2r`: 53
- `sbvsbb`: 34
- `vs1rshort`: 33
- `vs4bet`: 11
- `vslimp`: 11

## Cursor workflow
1. Unzip this pack LOCALLY into a temporary folder; do not upload the extracted 1,578 images one-by-one through GitHub Web.
2. Read `RANGE_CHART_MANIFEST.csv` first. It already preserves the source filename and parses the filename metadata.
3. Treat these as trainer-provided strategy source material. Do not replace them with generic GTO/model/internet knowledge.
4. Parse each 13×13 matrix into ONE central trainer knowledge layer. Preserve split/mixed action cells.
5. Keep full provenance for every normalized chart and hand record.
6. If a legend term is truncated/ambiguous/unreadable, use a neutral raw tag + `NEEDS_CLARIFICATION`; never guess.
7. Compare against existing PokerSwipe strategy before replacing anything. Flag conflicts instead of silently resolving them.
8. Reuse the central trainer data, where semantically appropriate, in Ranges, Exploit, relevant training mini-apps, Poker Brain, Daily Hand, My Hands/hand review, Academy/practice and personalization.
9. Do not duplicate the same strategy into separate screen files and do not force it into unrelated sections.
10. Once normalized, raw WebPs can remain temporary; commit normalized data + provenance unless source images are intentionally needed for audit.
11. DO NOT MERGE until user review.
