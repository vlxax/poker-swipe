# PokerSwipe trainer range charts — GitHub upload pack

This pack contains the same 1,578 WEBP range charts, split into 16 nested ZIP chunks so the GitHub web uploader does not hit the 100-files-per-upload limit.

## Upload
1. Unzip THIS outer package on your computer.
2. Upload all 18 resulting files to the SAME trainer/ranges branch in GitHub.
3. Do NOT manually unpack the 16 chart ZIP chunks in GitHub.
4. Cursor should unpack them locally when processing the trainer dataset.

## Contents
- 16 chart ZIP chunks, max 100 charts each
- CHUNK_INDEX.csv
- README_FOR_CURSOR.md

Total charts: 1,578. No charts were removed or recompressed; the original WEBP bytes are preserved inside the chunks.

## Cursor instruction
Treat all `charts_*.zip` files as one logical trainer chart dataset. Unpack them locally, verify that chart IDs 0001 through 1578 are present exactly once, then join them to the existing trainer metadata/manifest by chart ID. Do not infer strategy from filenames alone and do not duplicate charts already registered in the central trainer knowledge layer.
