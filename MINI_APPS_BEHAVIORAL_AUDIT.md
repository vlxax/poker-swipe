# PokerSwipe Mini-Apps Behavioral Audit — PHASE 2 EXECUTION

**Audit Date:** 2026-08-26  
**Scope:** All active mini-app modes + Personalization + Results Persistence  
**Status:** IN PROGRESS (Code Analysis Phase Complete, Runtime Testing Required)

---

## SECTION 1: ACTIVE MINI-APPS INVENTORY

### Discovered Modes

1. **SWIPE** — Card decision training
   - File: index.html, lines 1387-1392
   - Render function: `renderSwipe()`
   - Session: 10 hands per round
   - Auto-advance: YES (with manual override)

2. **SIZING** — Bet sizing drills
   - File: index.html, lines 1405-1415
   - Render function: `renderSizing()`
   - Mode: Single spot per render
   - Auto-advance: NO (explicit button click required)

3. **QUICK** — 5-minute mixed training
   - File: index.html, lines 1585-1587
   - Modes: SWIPE → SIZING → MEMORY → REVIEW → XRAY
   - Flow: `quickAdvance()` manages transitions
   - Auto-advance: YES (for SWIPE component only)

4. **REVIEW** — Line analysis & repair
   - File: index.html, lines 1416-1419
   - Render function: `renderReview()`
   - Stages: Select point → Choose reason → Repair sizing
   - Auto-advance: NO

5. **DAILY** — Calendar-based daily hand challenge
   - File: index.html, lines 1431-1439
   - Stages: Argument board → Reveal → Done
   - Auto-advance: NO
   - Frequency: One hand per day, calendar-driven

6. **HEAL** — Targeted weakness training courses
   - File: index.html, lines 1443-1445
   - Modes: river_bluffcatch, etc. (course-based)
   - Auto-advance: By course progression
   - Targeted: YES (topLeak-based selection)

7. **XRAY** — Range narrowing training
   - File: index.html, lines 1501 (xrReport)
   - Stages: 4-part skill (pre/narrow/river/blockers)
   - Auto-advance: Button-driven
   - Tracking: S.xray.history

8. **QUICKGAME** (QG30) — 3-MAX multi-hand mode
   - File: index.html, lines 3089-3092
   - Spots: Variable pool
   - Auto-advance: YES (after verdict reveal)
   - Ending: Session close + profile update

---

## SECTION 2: AUTO-ADVANCE BEHAVIOR ANALYSIS

### SWIPE Mode — FOUND AUTO-ADVANCE ⚠️

**Code Location:** index.html:1390

```javascript
const delay=g==='g'?2500:g==='y'?3300:4500;
const schedule=()=>{
  swTimer=setTimeout(swipeNext,delay);
  $('#swipeFlash').onclick=()=>{
    clearTimeout(swTimer);
    $('#holdArea').innerHTML='<button class="secondary" id="manualNext">ДАЛЬШЕ →</button>';
    $('#manualNext').onclick=swipeNext
  }
};
```

**Auto-Advance Delays:**
- GREEN (correct): 2500ms (2.5 seconds)
- YELLOW (acceptable): 3300ms (3.3 seconds)
- RED (error): 4500ms (4.5 seconds)

**Manual Override:** User can click feedback box to show manual "ДАЛЬШЕ →" button

**Assessment:** PARTIAL BUG - Delays are SHORT and may cut off reading explanation if user doesn't engage immediately. Explanation length varies:
- Shortest: ~40 chars (5-6 words)
- Longest: ~200 chars (20-25 words)

Example from code:
```
"Даже придраться неприятно." (20 chars)
"Решение живёт, но адвокат уже приехал." (42 chars)
"Карты новые. Привычка почему-то та же." (40 chars)
```

For 40-char explanation: **2.5-4.5 seconds ÷ 40 chars = 62-112ms per char** — human reading speed is ~200ms per word (50ms per char), so delays are MARGINAL, especially for longer explanations.

### SIZING Mode — NO AUTO-ADVANCE ✓

- Result displays after "ПОСТАВИТЬ X% →" button click
- Next button labeled "СЛЕДУЮЩИЙ СПОТ →" (explicit)
- User must click to proceed

### REVIEW Mode — NO AUTO-ADVANCE ✓

- Multi-stage: select → reveal → choose reason → repair → next
- All transitions require explicit button clicks
- User controls pace

### DAILY Mode — NO AUTO-ADVANCE ✓

- Argument drag + "ВСКРЫТЬ ЛОГИКУ →" button
- All transitions explicit
- User controls pace

### QUICKGAME Mode — HAS AUTO-ADVANCE (but acceptable)

- After verdict display (code line 3092), shows result then "ДАЛЬШЕ →" button
- No forced advance; button-driven

---

## SECTION 3: RESULTS PERSISTENCE ANALYSIS

### Data Flow Map

**Recording:**
```
1. User action (swipe, size, select) → callback handler
2. recordEvent() called with event object
3. Event object pushed to S.events array
4. S.events kept to max 600 entries
5. save() called → localStorage.setItem(STORAGE, JSON.stringify(S))
```

**Code Location:** index.html:1295

```javascript
function recordEvent(e){
  const ev={ts:now(),date:today(),confidence:null,responseMs:null,sizePct:null,...e};
  S.events.push(ev);
  S.events=S.events.slice(-600);  // Keep only last 600
  touchDay();
  S.skill=overallSkill();
  snapshot();
  save();
  return ev;
}
```

### Event Object Structure

Each recorded event contains:
- `ts` - timestamp
- `date` - YYYY-MM-DD
- `mode` - 'swipe', 'sizing', 'review', 'daily', 'xray', etc.
- `concept` - topic/concept name
- `street` - PREFLOP/FLOP/TURN/RIVER
- `action` - user's chosen action
- `grade` - 'g' (green/correct), 'y' (yellow/acceptable), 'r' (red/error)
- `why` - explanation text
- `responseMs` - decision time
- `confidence` - user confidence level (on 5-hand intervals for SWIPE)
- `policyScore` - GTO score

### Verification Points

✓ **Data is saved:** Every `recordEvent()` calls `save()` which persists to localStorage  
✓ **Data survives reload:** `load()` function retrieves from localStorage on startup  
✓ **Max 600 stored:** Slicing keeps most recent 600 events  
? **My Results display:** Need to verify "Мои результаты" actually shows these events

---

## SECTION 4: TASK SELECTION & PERSONALIZATION ANALYSIS

### CRITICAL FINDING: Task Selection is MOSTLY RANDOM

**Code Location:** index.html:1385

```javascript
function newSwipeSession(){
  const seen=new Set(S.seenSwipe||[]);
  let pool=SWIPE.filter(x=>!seen.has(x.id));
  if(pool.length<10){S.seenSwipe=[];pool=[...SWIPE]}
  pool.sort(()=>Math.random()-.5);  // ← PURE RANDOM SHUFFLE
  swSession=pool.slice(0,10);
  // ...
}
```

**Assessment:** **NO PERSONALIZATION in regular SWIPE mode.**
- Task selection uses `Math.random()` sort
- No difficulty adaptation
- No weak-topic targeting
- Only prevents immediate repetition (tracks last 55 seen tasks)

### Weak-Topic Detection DOES EXIST

**Code Location:** index.html:1298

```javascript
function topLeak(){
  return conceptStats().filter(x=>x.n>=3)[0]||null
}
```

**How it works:**
1. Analyzes S.events by concept
2. Requires minimum 3 attempts per concept
3. Returns worst-scoring concept

**Where used:**
- Profile screen (shows "leak")
- MEMORY CHECK in QUICK mode (filters tasks by weak concept)
- HEAL course selection (suggests weak-topic course)

**Assessment:** **PARTIAL PERSONALIZATION**
- Weak topics ARE identified
- They're targeted in QUICK memory check
- They're offered for HEAL training
- BUT regular SWIPE is still random

### Difficulty Adaptation: NOT FOUND

No code evidence of:
- Task difficulty scaling based on user skill
- Harder tasks for high performers
- Easier tasks for struggling players
- Difficulty curve enforcement

---

## SECTION 5: SPACED REPETITION ANALYSIS

### DAILY Mode History Tracking

**Code:** index.html:1439

```javascript
S.dailyArchive=S.dailyArchive.filter(x=>x.date!==today());
S.dailyArchive.push({date:today(),id:D.id,grade,confidence:dConf});
```

- Tracks one hand per day
- Stores: date, hand ID, grade, confidence
- Kept in S.dailyArchive array

### XRAY History Tracking

**Code:** index.html:1501

```javascript
S.xray.history.push({date:today(),title:s.title,score});
S.xray.history=S.xray.history.slice(-20);  // Keep last 20
```

- Tracks range training attempts
- Stores date, title, score
- Max 20 entries kept

### Spaced Repetition SRS Gaps: NOT FOUND

No evidence of:
- Gap calculation between error and re-occurrence
- Ebbinghaus curve implementation
- Automatic scheduling for weak-topic revival
- Time-based task selection

**Assessment:** **BASIC HISTORY, NO SRS** — App tracks what happened but doesn't use it to schedule when topics reappear.

---

## SECTION 6: RANDOMNESS VS REAL PERSONALIZATION VERDICT

### Evidence from Code

| Factor | Finding | Evidence |
|--------|---------|----------|
| Random selection in SWIPE | YES | `pool.sort(()=>Math.random()-.5)` |
| Weak-topic targeting | YES (partial) | `topLeak()` + memory check |
| Difficulty scaling | NO | No difficulty condition in pool filter |
| User history used | YES (limited) | Only for topLeak detection & seen tracking |
| Time-based scheduling | NO | No SRS or gap tracking |
| Personalized ordering | NO | Random sort always used |

### Strength of Evidence

**Weak evidence of real personalization:**
- topLeak exists but only in QUICK/HEAL modes, not SWIPE main
- Weak topics reappear in memory check, but that's only 1 spot per 5-min session
- No difficulty personalization

**Strong evidence of randomness:**
- `Math.random()-.5` is the primary sorting method
- No skill-based task selection
- No history weighting in task choice

---

## SECTION 7: BUG INVENTORY (Code Analysis Phase)

### P0 (Blocker) Bugs Found

**P0-1: SWIPE auto-advance may cut feedback short**
- **Mode:** SWIPE
- **Issue:** 2.5-4.5 second display time for explanations up to 200 chars
- **Expected:** Explanation fully readable before advance
- **Actual:** User must engage (click) to override auto-advance
- **Impact:** User frustration, missed learning if distracted
- **Severity:** P1 (not a crash, but UX friction)

### P1 (High) Bugs Found

**P1-1: "Personalization" is mainly random with limited weak-topic targeting**
- **Issue:** SWIPE mode (primary mode) uses pure random task selection
- **Expected:** Task difficulty should scale with user performance
- **Actual:** All tasks equally likely regardless of skill
- **Impact:** Weak players don't get fundamentals-focused curriculum
- **Evidence:** Line 1385 `pool.sort(()=>Math.random()-.5)`

**P1-2: No spaced repetition scheduling**
- **Issue:** App tracks weak topics but doesn't schedule their re-appearance
- **Expected:** Error topics return in SRS curve
- **Actual:** Errors only retargeted in QUICK memory check or HEAL course (manual)
- **Impact:** Weak-topic learning is hit-or-miss

**P1-3: Results may not display in "Мои результаты" correctly**
- **Issue:** recordEvent stores in S.events but unclear if "My Results" page fetches them
- **Expected:** All completed tasks shown in "Мои результаты"
- **Actual:** Unknown (requires browser test)
- **Status:** NEEDS VERIFICATION

---

## SECTION 8: RUNTIME TESTING REQUIRED

### Test Protocol A: Auto-Advance Measurements

**Required Execution:**
1. Run SWIPE mode for 10 hands
2. Note explanation text length for each verdict
3. Measure display time before auto-advance
4. Test override (click during display)
5. Verify manual "ДАЛЬШЕ" button appears

**Success Criteria:**
- Longest explanation fully readable before auto-advance OR
- Manual override always available and responsive

### Test Protocol B: Result Persistence

**Required Execution:**
1. BEFORE: `console.log(window.S.events.length)` → note count
2. Complete 15 tasks in different modes (swipe/sizing/review/daily)
3. Check My Results page displays all 15
4. Reload page (F5)
5. Check My Results still shows all 15

**Success Criteria:**
- Results saved to localStorage after each task
- Results persisted through reload
- My Results page displays complete history

### Test Protocol C: Weak Player vs Strong Player Task Distribution

**Required Execution:**

**Profile A (Weak Player):**
- Clear browser storage, start fresh
- Complete 40 SWIPE hands
- Intentionally get 30-35% correct
- Deliberately fail same categories (e.g., "RIVER BLUFF CATCH")
- Collect: taskId, category, difficulty for all 40

**Profile B (Strong Player):**
- Clear browser storage, start fresh
- Complete 40 SWIPE hands
- Aim for 85%+ correct
- Collect: taskId, category, difficulty for all 40

**Comparison Analysis:**
- Calculate task ID overlap percentage
  - EXPECT <50% if real personalization
  - EXPECT >80% if both random
- Compare difficulty distribution
  - Strong: expect more hard tasks
  - Weak: expect more easy tasks
- Compare category distribution
  - Check if weak player sees more of error categories

**Success Criteria for Real Personalization:**
- Task overlap <50%
- Weak player avg difficulty <50
- Strong player avg difficulty >60
- Error categories appear more for weak player

---

## SECTION 9: KNOWN LIMITATIONS (From Code)

### Design Limitations (Not Bugs)

1. **Max 600 events stored** — After 600 events, oldest deleted
2. **No historical analysis beyond 40-120 events** — Skills score uses last 120
3. **Leak detection requires 3+ occurrences** — Can't diagnose single concept
4. **Daily limited to 1 per day** — By design
5. **QUICK is 5-minute fixed flow** — By design

### Missing Features (Not Implemented)

1. Difficulty scaling (tasks don't adapt to user skill)
2. Spaced repetition scheduler (no SRS curve)
3. Multi-concept learning paths (randomized instead)
4. User level progression (no explicit levels/badges)

---

## SECTION 10: CURRENT AUDIT FINDINGS SUMMARY

### Auto-Advance Issues
**Modes with AUTO-ADVANCE:**
- SWIPE: YES (2.5-4.5s, with manual override)
- QUICKGAME: YES (after verdict, button-driven)

**Modes WITHOUT auto-advance:**
- SIZING, REVIEW, DAILY, HEAL, XRAY

**Assessment:** MOSTLY OK, but SWIPE delays may be marginal for long explanations

---

### My Results Persistence
**Saved:** YES (recordEvent → S.events → localStorage)
**Persisted:** YES (load() retrieves from localStorage)
**Displayed:** UNKNOWN (needs browser test)

**Modes confirmed writing to events:**
- SWIPE: YES (recordEvent in finalizeSwipe)
- SIZING: YES (recordEvent in sizeLock click)
- REVIEW: YES (recordEvent in reviewRepair)
- DAILY: YES (recordEvent in dailyReveal)
- XRAY: YES (recordEvent in xrReport)
- QUICKGAME: YES (recordEvent in verdict)

**Expected:** All 6 modes write to S.events

---

### Personalization Reality Check
**Weak Profile Hypothesis:** If weak players get random tasks just like strong players, task overlap should be >80%

**Real Personalization Indicators:**
- ✗ Difficulty scaling: NOT FOUND
- ✓ Weak-topic detection: FOUND (topLeak)
- ✗ Weak-topic targeting in SWIPE: NOT FOUND (random sort)
- ✓ Weak-topic targeting in QUICK: FOUND (memory check)
- ✗ Spaced repetition: NOT FOUND

**Verdict:** PARTIAL & LIMITED personalization
- Works in QUICK mode memory check
- Works in HEAL course selection
- Does NOT work in main SWIPE mode (most used)

---

### Spaced Repetition
**Implemented:** Basic history tracking
**SRS Scheduling:** NOT FOUND
**Gap calculation:** NOT FOUND
**Auto-retry:** Only in QUICK memory check

**Verdict:** REACTIVE (manual), not PROACTIVE (automatic)

---

## SECTION 11: PRODUCTION READINESS ASSESSMENT

### RED FLAGS 🚩
1. SWIPE auto-advance may cut feedback short
2. Task selection in SWIPE is purely random, not personalized
3. No SRS scheduling despite tracking history
4. Weak-topic targeting only in secondary modes (QUICK/HEAL), not main mode

### GREEN FLAGS ✅
1. Results ARE being saved to localStorage consistently
2. Multiple modes update S.events correctly
3. Weak-topic detection (topLeak) works
4. Memory override always available in SWIPE
5. Data persists through reload

### YELLOW FLAGS ⚠️
1. Explanation display time may be marginal
2. Personalization is partial and mode-dependent
3. Limited historical tracking (max 600 events, max 120 for skill)

---

## EXECUTION PLAN FOR PHASE 3 (Runtime Testing)

**Test Suite Deployment Needed:**
1. Auto-advance measurement script (measure display times)
2. Results persistence test (6-mode verification)
3. Weak/strong player profile comparison (40 tasks each)
4. Spaced repetition tracking (error-to-recall time)

**Expected Outcome:**
- Confirm/deny auto-advance is a real UX issue
- Verify all 6 modes write to My Results
- Measure personalization gap (% overlap)
- Calculate SRS effectiveness

**Timeline:**
- Phase 3a: Manual testing (2-3 hours)
- Phase 3b: Automated test suite (1-2 hours)
- Phase 3c: Data analysis & verdict (1 hour)

---

## PRODUCTION_READY VERDICT

### Current Status: **NEEDS TESTING**

**Blocker Issues Before Production:**
1. ❌ SWIPE auto-advance timing needs validation
2. ❌ Result persistence to My Results needs verification
3. ❌ Personalization gap between weak/strong needs measurement

**No Blockers After Verification:**
- Weak-topic detection works
- Results save correctly
- Data persists
- No crashes found

**Recommendation:** 
**PROCEED TO PHASE 3 RUNTIME TESTING.** Do not mark PRODUCTION_READY until behavioral tests complete.

---

*Audit continues in Phase 3: Runtime Testing*
