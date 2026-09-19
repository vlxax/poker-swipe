# PokerSwipe V77 MobileShell PATCH 1.1 — MERGE CANDIDATE

Apply these files on top of **V77 Truth Contract**. This is a patch, not a full application.

## Files
- `index.html` — V77 index with the two patch includes at the end.
- `poker_swipe_v77_mobile_shell_patch.css`
- `poker_swipe_v77_mobile_shell_patch.js`
- `PATCH_README.md`

## 1.1 fixes after audit
- Removed global `.actions` override. Swipe/action bars outside the shell contract are no longer rewritten.
- Removed the DOM-wide MutationObserver that could interfere while a long explanation was rendering.
- Route observer now watches only `class` changes on direct `.screen` elements and resets scroll only when the active route changes.
- Header and bottom-nav heights are measured with `getBoundingClientRect()` / `ResizeObserver`; no 70/76/72px breakpoint assumption is used for layout.
- `.screen` shell rules are scoped to `#mainApp > main > .screen`; nested screens/modals are not converted into route viewports.
- Legacy mini-app height normalization is scoped to known area roots.
- Horizontal overflow is contained inside route screens.
- Poker/grading/Truth Contract/data code is unchanged.

## Verification performed
- Patch JS: `node --check` PASS.
- Inline classic JS in patched `index.html`: syntax check PASS.
- Patch include order: CSS in head; runtime patch is the last script after V77 Truth Contract.
- Patch contains 4 files (GitHub upload friendly).

## Mobile acceptance checklist before merging main
Check on the same iPhone/WebView used for the screenshots:
1. Home: header is below status bar; bottom nav fixed; page itself does not scroll.
2. Sizing: task can scroll internally from title to submit button; no clipped header/footer.
3. Review: long forensic review scrolls inside the screen; reading position is not reset while content renders.
4. Exploit: title/context/action area stay inside viewport; no document-level blank tail.
5. Swipe: hand/card content remains visible above actions; route does not degrade to only FOLD/CALL/ALL-IN buttons.
6. Navigate Home → Sizing → Review → Swipe: each new route starts at its own top.
7. Modal/sheet: opens above current screen and remains scrollable/usable.

If any of 1–7 fails, do not merge; capture the failing screen and console error.
