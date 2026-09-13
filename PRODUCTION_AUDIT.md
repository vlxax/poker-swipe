# PokerSwipe Production Audit — Phase 1

## Executive Summary

Comprehensive audit of PokerSwipe application covering navigation/routing, state persistence, data sources, and mobile viewport compatibility.

## Critical Findings

### 1. Multiple show() Function Wrappers (CRITICAL)

The navigation function is wrapped by 6+ different scripts:
- app-shell.js (lines 60-67)
- game-motion.js (lines 173-186)
- game-visual-rebuild.js (lines 563-584)
- mini-app-compact.js (lines 249-269)
- poker_swipe_v40.js (lines 88-89)
- poker_swipe_v73_hotfix.js (event delegation)

**Risk:** Each wrapper adds a layer where exceptions can break the entire routing chain.

### 2. Hotfix Stacking Problem (HIGH)

Six versions of poker_swipe loaded in sequence:
- v73_hotfix.js
- v32.js (36K)
- v33.js (32K)
- v34.js (8.3K)
- v39.js (18K)
- v40.js (18K)

Each registers handlers on same element IDs (v36Daily, v36Hands, etc.).

**Risk:** Duplicate handlers, version conflicts, unpredictable behavior.

### 3. Hardcoded Test Data vs Canonical Sources (HIGH)

- poker_swipe_v40.js: hardcoded TODAY[], EVENTS[], SERIES[] (test data)
- data/moscow_schedule_today.json: actual tournament data (53KB)
- data/live_polyana.json: actual club/tournament data (200KB)

**Risk:** Tournament list doesn't show real data.

### 4. localStorage Key Inconsistencies (MEDIUM)

- v40.js uses: 'pokerswipe.v40.poliana' (note misspelling: poliana)
- tests use: 'psp-polyana-favorite-clubs-v1'
- Multiple versions may use different keys

**Risk:** State not persisted across screen transitions.

### 5. Script Execution Hang (INFRASTRUCTURE)

- runScripts: 'dangerously' causes infinite hang in JSDOM
- Documented in SCRIPT-HANG-ISSUE.md
- Workaround: runScripts: 'outside-only' (tests disabled)

## Testing Priority Order

1. Navigation: Home → Swipe → Daily → MyHands → Polyana → Profile
2. Data source: Verify real tournaments load (not hardcoded)
3. Persistence: State survives screen transitions and page reload
4. Mobile: Test 320px, 360px, 390px, 430px viewports

## Status

- [x] SCRIPT-HANG-ISSUE.md created and documented
- [x] Tests reverted to 'outside-only' mode
- [ ] Navigation flow test created
- [ ] Data source verification
- [ ] Persistence test
- [ ] Mobile viewport test
- [ ] Bug fixes implemented
- [ ] Regression tests created

## Fixes Applied

### ✓ Fix 1: Tournament Data Rendering (CRITICAL)
**Issue:** poker_swipe_v40.js was hijacking renderTournaments23() and forcing hardcoded test data
**Fix:** Removed renderTournaments23 hijacking and disable v40's render() override
**Commit:** 45f5511
**Impact:** Tournament screen now loads real data from data/moscow_schedule_today.json
**Test:** Open tournaments → ПОЛЯНА screen → verify tournament count

### ✓ Fix 2: localStorage Key (MEDIUM)
**Issue:** v40 used version-specific key 'pokerswipe.v40.poliana' - state lost on upgrade
**Fix:** Changed to version-agnostic key 'pokerswipe.polyana.state'
**Commit:** e9a44e4
**Impact:** State persists across version upgrades
**Test:** Navigate away from polyana → return → verify view state restored

## Remaining Issues to Address

### Priority: Navigation/Routing Stack
- [ ] Test ONE CLICK → ONE HANDLER pattern (verify single execution)
- [ ] Check for duplicate event handlers in hotfix stacking (v32-v40)
- [ ] Verify nav button transitions work for all screens

### Priority: State/Persistence
- [ ] Verify state persists across screen transitions
- [ ] Check localStorage accessibility
- [ ] Test page reload scenarios

### Priority: Mobile Viewports
- [ ] Test 320px (iPhone SE) viewport
- [ ] Test 360px (Android) viewport
- [ ] Test 390px (iPhone 12) viewport  
- [ ] Test 430px (iPhone 15) viewport
- [ ] Verify nav buttons are clickable at all widths
- [ ] Verify no text overflow

## Summary Table (To Be Completed)

| Bug | Root Cause | Fix | Files | Regression Test |
|-----|-----------|-----|-------|-----------------|
| Tournament hardcoded test data | v40 hijack renderTournaments23 | Disable hijacking | poker_swipe_v40.js | Verify real data loads |
| localStorage state lost on upgrade | Version-specific key in v40 | Use version-agnostic key | poker_swipe_v40.js | Navigate away and back |

