# Phase 13 — Training quality audit

Audit only. No product, UI, or personalization-logic changes.

Generated 100 daily sessions (10 profiles × 10 sequential sessions × 7 tasks = 700 spots) through `buildProfileDailyPlan` + `buildPersonalizedSessionAsync` (library path).

```
TRAINING QUALITY: FAIL
POKER LOGIC: FAIL
PERSONALIZATION QUALITY: PASS
DUPLICATES: 0.1%
NEAR-DUPLICATES: 0.3%
PROFILE MISMATCH: 33.8%
INVALID SPOTS: 7
TESTS: 45/45
```

## What passed

- Anti-repeat inside a session: 0 exact duplicate IDs in 100 sessions.
- Same-player reuse across 10 sequential sessions: 0.1%.
- Intra-session near-duplicates: 0.3%.
- All 100 sessions personalized from the library path.
- Skill coverage: 12/12 taxonomy skills.
- Advanced/strong players: 62.1% of spots at L4–L5.
- After 20+ answers, weakness-focused profiles still receive tasks on diagnosed weak skills.
- ICM-weak vs river-weak plans stay distinct (12 overlapping IDs of 70+70).

## What failed

### Poker logic (7 unique spots)

| ID | Issue |
| --- | --- |
| `ADV_ICM_SHORT_COVER` | Unopened pot 12.5 BB vs ~2.25 BB dead money |
| `TOUR_FT_AK`, `TOUR_PKO_FT_TT` | Unopened pot 9.1 BB vs ~2.70 BB dead money |
| `ADV9B5_ICM_MEDIUM_FOLD` | Pot 8.5 BB after a 28 BB 4-bet in the line |
| `CASH_100BB_AA`, `HU_PREFLOP_QQ` | Pot still 1.5 BB after a 3-bet |
| `PRE_3B_BTN_AQO` | History contains «ошибка ввода» |

Existing `validateLibrary` still reports the corpus as schema-clean. These are pot/history bugs it does not catch.

### Training quality

- Beginners received 54.3% L4–L5 spots (L1–L3 share 45.7%). First beginner session: four L4/L5 tasks out of seven.
- Library is top-heavy: L3 has 37 generated spots vs L5 204. Mid-game decisions are scarce.
- `libraryDrill.choiceToActionType` maps СТАВКА / РЕЙЗ / 3-БЕТ / 4-БЕТ / ОЛЛ-ИН all to `bet` with no size, so `gradeAnswer` treats those options as the same line (307 collisions / 78 task ids).
- 84.7% of explanations mention the recommended action; the rest describe the concept only (RFI opens, bubble steals, floats).
- User-facing copy mixes English (`fold equity`, `showdown`, `check-check`, `range-bet`, `overlay`, `required equity`) and inconsistent Russian (`батон` vs `баттон`, `блафф-кэтч` vs `блеф-кетч`).

### Poker Brain context

Daily personalized training grades through `gradeAnswer`, not `PokerBrain.gradeDecision`. Mini-app swipe mapping (`libraryTaskToSwipe`) is the Brain path, and it:

- omits `format` and `stage` (700/700 missing «формат/число игроков»)
- sends only `history[0]` as `ctx`, so postflop spots lose the current street action (366 missing exact preflop line / open-size)

## Profiles

| Profile | Kind | Weak skills at start |
| --- | --- | --- |
| icmWeak | diagnosed leak | icm, shortStack |
| riverWeak | diagnosed leak | river, bluffCatch, postflop |
| strongBalanced | strong | none |
| beginner | all-mistake | broad |
| advanced | all-excellent | none |
| newUser | tiny sample | low confidence |
| decliningIcm | recent ICM slump | icm |
| improvingPostflop | improving | postflop recovered |
| shortWeak | diagnosed leak | shortStack |
| mixed | intermediate | postflop |

## Difficulty mix (700 spots)

L1 87 · L2 229 · L3 37 · L4 143 · L5 204

## NEXT P0 FIXES

1. Fix the 7 invalid pot/history spots listed above.
2. Give RAISE / 3-BET / 4-BET / ALL-IN distinct action types in `libraryDrill` so grading matches the chosen option.
3. Pass format, stage, and full action history into Poker Brain (`libraryTaskToSwipe`).
4. Stop serving L4–L5 spots to beginners (L1–L3 share is 45.7%).
5. Normalize Russian poker terms and strip leftover English from user-facing copy.
6. Make explanations name the recommended action.
7. Remove authoring leftovers such as «ошибка ввода» from task history.

## Tests

- `solver/tests/trainingQualityAudit.test.js` — 6/6
- `tests/task_context.js` — 8/8
- `solver/tests/personalizationV2.test.js` + `playerDifferentiation.test.js` + `taskDifficultyExpansion.test.js` — 31/31
- Total: **45/45**
