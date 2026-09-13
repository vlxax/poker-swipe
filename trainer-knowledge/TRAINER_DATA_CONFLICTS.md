# Trainer Data Conflicts

Trainer vs POKER_BRAIN_PACK — both versions preserved. Trainer wins only on EXACT semantic match.

Total conflicts detected (UO RFI comparison sample): **49**

Policy:
- EXACT trainer match → source = TRAINER
- No exact trainer data → existing Poker Brain / reference / heuristic with own provenance
- Never present Poker Brain heuristic as trainer recommendation
- PARTIAL trainer match → do not auto-replace existing strategy

| hand | position | stackBand | trainer | pokerBrain | atlasKey |
|------|----------|-----------|---------|------------|----------|
| T9o | EP | 40+ | RAISE | FOLD (62%) | RFI|UTG|50|T9o |
| 98o | EP | 40+ | RAISE | FOLD (79%) | RFI|UTG|50|98o |
| 87o | EP | 40+ | RAISE | FOLD (90%) | RFI|UTG|50|87o |
| 77 | EP | 40+ | RAISE | FOLD (57%) | RFI|UTG|50|77 |
| 76o | EP | 40+ | RAISE | FOLD (95%) | RFI|UTG|50|76o |
| 66 | EP | 40+ | RAISE | FOLD (72%) | RFI|UTG|50|66 |
| 65o | EP | 40+ | RAISE | FOLD (98%) | RFI|UTG|50|65o |
| 55 | EP | 40+ | RAISE | FOLD (83%) | RFI|UTG|50|55 |
| 54o | EP | 40+ | RAISE | FOLD (99%) | RFI|UTG|50|54o |
| 44 | EP | 40+ | RAISE | FOLD (91%) | RFI|UTG|50|44 |
| 43o | EP | 40+ | RAISE | FOLD (100%) | RFI|UTG|50|43o |
| 98o | LJ | 40+ | RAISE | FOLD (59%) | RFI|HJ|50|98o |
| 87o | LJ | 40+ | RAISE | FOLD (77%) | RFI|HJ|50|87o |
| 76o | LJ | 40+ | RAISE | FOLD (88%) | RFI|HJ|50|76o |
| 65o | LJ | 40+ | RAISE | FOLD (95%) | RFI|HJ|50|65o |
| 55 | LJ | 40+ | RAISE | FOLD (66%) | RFI|HJ|50|55 |
| 54o | LJ | 40+ | RAISE | FOLD (98%) | RFI|HJ|50|54o |
| 44 | LJ | 40+ | RAISE | FOLD (79%) | RFI|HJ|50|44 |
| 43o | LJ | 40+ | RAISE | FOLD (99%) | RFI|HJ|50|43o |
| 33 | LJ | 40+ | RAISE | FOLD (88%) | RFI|HJ|50|33 |
| 32o | LJ | 40+ | RAISE | FOLD (100%) | RFI|HJ|50|32o |
| 22 | LJ | 40+ | RAISE | FOLD (93%) | RFI|HJ|50|22 |
| 98o | HJ | 40+ | RAISE | FOLD (59%) | RFI|HJ|50|98o |
| 87o | HJ | 40+ | RAISE | FOLD (77%) | RFI|HJ|50|87o |
| 76o | HJ | 40+ | RAISE | FOLD (88%) | RFI|HJ|50|76o |
| 65o | HJ | 40+ | RAISE | FOLD (95%) | RFI|HJ|50|65o |
| 55 | HJ | 40+ | RAISE | FOLD (66%) | RFI|HJ|50|55 |
| 54o | HJ | 40+ | RAISE | FOLD (98%) | RFI|HJ|50|54o |
| 44 | HJ | 40+ | RAISE | FOLD (79%) | RFI|HJ|50|44 |
| 43o | HJ | 40+ | RAISE | FOLD (99%) | RFI|HJ|50|43o |
| 33 | HJ | 40+ | RAISE | FOLD (88%) | RFI|HJ|50|33 |
| 32o | HJ | 40+ | RAISE | FOLD (100%) | RFI|HJ|50|32o |
| 22 | HJ | 40+ | RAISE | FOLD (93%) | RFI|HJ|50|22 |
| 75s | CO | 40+ | RAISE | FOLD (51%) | RFI|CO|50|75s |
| 65s | CO | 40+ | RAISE | FOLD (53%) | RFI|CO|50|65s |
| 64s | CO | 40+ | RAISE | FOLD (70%) | RFI|CO|50|64s |
| 54s | CO | 40+ | RAISE | FOLD (72%) | RFI|CO|50|54s |
| 53s | CO | 40+ | RAISE | FOLD (84%) | RFI|CO|50|53s |
| 54o | CO | 40+ | RAISE | FOLD (90%) | RFI|CO|50|54o |
| 43s | CO | 40+ | RAISE | FOLD (86%) | RFI|CO|50|43s |
| 43o | CO | 40+ | RAISE | FOLD (96%) | RFI|CO|50|43o |
| 33 | CO | 40+ | RAISE | FOLD (63%) | RFI|CO|50|33 |
| 32o | CO | 40+ | RAISE | FOLD (98%) | RFI|CO|50|32o |
| 22 | CO | 40+ | RAISE | FOLD (77%) | RFI|CO|50|22 |
| 62s | BTN | 40+ | RAISE | FOLD (57%) | RFI|BTN|50|62s |
| 52s | BTN | 40+ | RAISE | FOLD (66%) | RFI|BTN|50|52s |
| 43s | BTN | 40+ | RAISE | FOLD (51%) | RFI|BTN|50|43s |
| 42s | BTN | 40+ | RAISE | FOLD (68%) | RFI|BTN|50|42s |
| 32s | BTN | 40+ | RAISE | FOLD (70%) | RFI|BTN|50|32s |
