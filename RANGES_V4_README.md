# PokerSwipe Range Lab v4 — Final Hardening

## What changed from v3

- **Honest Actions scoring:** untouched cells are `UNANSWERED`, never implicit `UNSELECTED`.
- Actions now exposes **Accuracy**, **Coverage**, and a combined completion-aware score.
- **Shape ACTIVE is visually and semantically separate from AI / ALL-IN.**
- Shape brush is deterministic: **Add / Erase**, not toggle-on-drag.
- Boundary training combines **matrix boundaries** with **semantic hand-family boundaries**.
- Leak classification groups mistakes into poker concepts such as suited Ax, suited Kx, pocket pairs, connectors, etc.
- Personalized drill prioritizes the user's actual mistakes before source boundaries.
- Retest persists **before/after errors and leak concepts**, not just one score.
- Training result emission is **idempotent by sessionId** and capped history remains 100 entries.
- In-progress sessions are restorable for up to 3 days.
- Source Base filters are **dependent** so invalid combinations are not offered.
- Source charts open in a dedicated fullscreen viewer with scroll/zoom-friendly behavior.
- Router ownership remains safe: this module does **not** overwrite or wrap `window.show`.
- Missing structured charts fail closed with DATA ERROR; no silent fallback.

## Data guarantees

- 60 structured UO charts.
- 6 positions × 10 stack bands = all 60 exact combinations.
- 169 canonical hand classes per chart.
- 1326 combos per chart.
- 1578 reference chart records and 1578 local WEBP assets.
- `UNSELECTED` is not renamed to FOLD.
- `nAI` is not expanded beyond the source label.

## Training flow

1. **Build** — Shape or Actions.
2. **Range Ghost** — honest comparison and leak diagnosis.
3. **Boundary Drill** — mistakes first, then semantic/matrix boundaries.
4. **Retest** — before/after comparison and result emission.

## Integration

The feature exposes:

- `window.renderRanges`
- `window.PokerSwipeRanges` (version 4)
- browser event `pokerswipe:ranges-training-result`

If the host app provides `window.recordTrainingResult`, v4 forwards the final session payload to it. Otherwise it falls back to `window.recordEvent` when available.

The module creates `#ranges` only as a compatibility bridge when the shell has not already provided it. Long-term ownership should remain in the app shell.
