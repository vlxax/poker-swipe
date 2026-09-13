# Hand of the Day — AUDIT REPORT

**Date**: 2024  
**Branch**: `feature/hand-of-day-v1`  
**Status**: STEP 1 COMPLETE — Architecture analysis finished

## EXECUTIVE SUMMARY

The current "Daily Training" system in PokerSwipe is **task-library driven** and renders **single-decision drills** with minimal poker context. It lacks:
- Multi-decision scenarios (only one decision per hand)
- Villain personality/dialogue
- Observation tracking
- Branching logic based on choices
- Character interaction beyond visual avatar
- Tournament context (HUD)
- "Read" system with final verification
- Mobile-optimized game layout

---

## CURRENT ARCHITECTURE

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `training-ui/sessionController.js` | 264 | Session lifecycle, state machine (loading/ready/done) |
| `training-ui/renderer.js` | 327 | DOM rendering for drills, feedback, summary |
| `training-ui/gameShell.js` | 293 | Game-interface shell with HUD, arena, felt |
| `training-ui/viewModel.js` | ? | ViewModel construction (drill, feedback, summary) |
| `training-ui/miniAppBridge.js` | ? | Connection to index.html |
| `training-ui/gameShell.js` | 293 | Render game lobby, drill, feedback, loading |
| `solver/src/training/personalizedTraining.js` | 263 | Session planning, leak profile analysis |
| `solver/src/training/sessionBuilder.js` | 116 | Concept selection for session (60% priority, 25% recent mistakes, 15% maintenance) |
| `solver/src/training/drillGenerator.js` | 306 | Dynamic drill generation from candidates |
| `solver/src/training/drillValidator.js` | ? | Validates generated drills |
| `index.html` | line 971 | `<section id="daily">` screen template |

### Rendering Flow

```
sessionController.start()
  → buildPersonalizedSessionAsync()  [builds 7 drills]
  → _onGenerated()  [sets state = 'ready']
  → _notify()  [triggers renderer.renderDrill()]
  → renderDrill() or renderGameDrill()  [based on __maGameLayout flag]
    → drills[index] scenario rendered
    → answer handler called
  → renderFeedback() or renderGameFeedback()
  → next() → advances to drills[index+1]
  → All drills done → state = 'done' → renderSummary()
```

### Current Scenario Structure

A **drill** is a single decision with:
```js
{
  drillId: string,
  concept: string,  // e.g. 'shortstack_preflop'
  street: string,   // 'preflop' | 'flop' | 'turn' | 'river'
  sourceTaskId: string,  // points to task library item
  scenario: {
    potBb: number,
    effectiveStackBb: number,
    heroPosition: string,  // 'BTN', 'BB', etc.
    villainPosition: string,
    heroCards: [string, string],  // 'As', 'Kh', etc.
    board: [string, string, string],  // flop only
    stage: string,  // 'EARLY', 'MIDDLE', 'LATE', 'BUBBLE'
    format: string,  // 'MTT', 'CASH'
  },
  options: [
    { id: 'fold', labelRu: 'ФОЛД', correct: false, explained: true },
    { id: 'call', labelRu: 'КОЛЛ', correct: true, explained: true }
  ],
  grade: function(chosenId) → { grade, evLossBb, correct },
  why: string,  // explanation
  remember: string,  // key takeaway
}
```

### Current Scenario Count

**Generated dynamically from task library:**
- ~500+ tasks in task-context library
- But only ~7 drills per session (personalized)
- No "Hand of the Day" specific scenario data

**Hardcoded examples:** None found
**Pre-authored scenarios:** None for Hand of the Day

---

## ROOT CAUSES OF ISSUES

### 1. Single Decision Per Hand
- Current `drillViewModel` expects ONE decision → ONE grade
- No branching logic in scenario engine
- UI renders single `grid2` choice grid (max 2 options per row)
- No state tracking for multi-decision flow

### 2. No Villain Personality
- Avatar is static (visual only, via `window.PsCharacter`)
- No dialogue system
- Villain archetype not part of scenario data
- No conditional replies based on hero action

### 3. No Branching
- `sessionController.next()` always moves to `drills[index+1]`
- No scenario branching tree structure
- No replay/alternative path logic

### 4. No Observation System
- No observation tracking during hand
- Read screen exists (`renderFeedback`) but as static list
- Not showing collected observations during play

### 5. Mobile Layout Issues
- Game shell uses `window.MaCompact` delegate
- Fallback markup is generic HTML (not mobile-optimized)
- No safe-area inset handling
- Arena scaled via global transform (not responsive)

### 6. Spelling/Terminology Issues

Found in current code:
- ✅ "БЛАЙНД" (correct) — appears in most places
- ❌ May need audit of all Russian poker terminology

---

## KEY DATA STRUCTURES

### HandOfDay Scenario (Proposed)

```js
{
  id: 'hod_001_bubble_btn_bb_short',  // unique ID
  
  // Tournament context
  tournament: {
    format: 'MTT',  // MTT, CASH, PKO, ICM
    stage: 'BUBBLE',  // EARLY, MIDDLE, LATE, BUBBLE, ITM, FT
    playersRemaining: 11,
    paidPlaces: 9,
  },
  
  blinds: { small: 500, big: 1000, ante: 1000 },
  
  // Positions & stacks
  hero: {
    position: 'BTN',
    stack: 20500,  // actual chips
    cards: ['As', 'Kh'],  // hole cards (open after decisions)
  },
  
  villain: {
    position: 'BB',
    stack: 15500,
    archetype: 'tight-reg',  // nit, tag, lag, passive, etc.
    avatar: 'freak-lady',  // character name
  },
  
  // Game state
  board: [],  // starts empty for preflop
  pot: 1500,
  
  // Scenario branching tree
  nodes: [
    {
      id: 'root',
      type: 'hero-decision',  // or 'villain-action', 'observation', 'street', 'showdown'
      street: 'preflop',
      context: {
        history: 'Hero raises to 2.2 BB from BTN',
        note: 'Villain is 15.5 BB. Very short. What do you do?'
      },
      actions: [
        { id: 'fold', label: 'ФОЛД', nextNode: 'villain-wins' },
        { id: 'call', label: 'КОЛЛ', nextNode: 'flop-villain-check' }
      ],
      villainDialogue: {
        'tight-reg': 'Опять мой блайнд?',
        'lag': 'Опять баттон?',
        'calling-station': 'Посмотрим.'
      }
    },
    
    {
      id: 'flop-villain-check',
      type: 'street-reveal',
      street: 'flop',
      board: ['2h', '5c', '9d'],
      action: { actor: 'VILLAIN', type: 'check' },
      villainDialogue: {
        'tight-reg': 'Проверю.',
        'lag': 'Ладно, посмотрим.',
      },
      nextNode: 'flop-hero-decision'
    },
    
    {
      id: 'flop-hero-decision',
      type: 'hero-decision',
      street: 'flop',
      pot: 4400,  // after call
      actions: [
        { id: 'check', label: 'ЧЕК', nextNode: 'turn-villain-check' },
        { id: 'bet33', label: '33%', nextNode: 'flop-villain-fold' },
        { id: 'bet66', label: '66%', nextNode: 'flop-villain-call' },
      ],
      observation: {
        text: 'Быстро проверил. Часто так играет со слабыми руками.',
        count: 1,
        totalCount: 3
      }
    },
    
    // ... more nodes
    
    {
      id: 'showdown',
      type: 'showdown',
      villainCards: ['3s', 'Q2h'],  // reveal
      villainLine: 'Попробовал украсть, но попался',
      nextNode: 'read'
    },
    
    {
      id: 'read',
      type: 'read-question',
      prompt: 'Как ты прочитала его линию?',
      choices: [
        { id: 'strong-value', label: 'Сильное вэлью', feedback: 'Не совсем. Он не доверял тебе.' },
        { id: 'bluff', label: 'Кража банка', feedback: 'Верно!' },
        { id: 'no-idea', label: 'Не знаю', feedback: 'Он старался украсть блайнд.' },
      ]
    }
  ],
  
  // Pre-authored observations that could appear
  observations: [
    {
      trigger: 'flop-villain-check',
      text: 'Быстро проверил. С сильными обычно медленнее.',
      types: ['timing', 'line']
    }
  ],
  
  metadata: {
    difficulty: 3,  // 1-5
    concept: ['bb-defense', 'all-in-equity'],
    author: 'coach-name',
    createdAt: '2024-01-15'
  }
}
```

---

## MOBILE LAYOUT ISSUES FOUND

### Current Problems

1. **Game Arena not responsive**
   - `.pgArena` height fixed at `185px` for desktop
   - Cards displayed but may be too small on mobile
   - Pot label may overlap

2. **Bottom Nav Overlap**
   - `.nav` fixed at `bottom:0` with `95px` padding
   - Drills may be cut off on small screens

3. **No Safe Area**
   - Not using `env(safe-area-inset-*)` for notched devices
   - iOS Safe Area not respected on iPhone 12+

4. **Viewport Settings**
   - ✅ Has `viewport-fit=cover` in meta tag
   - Need to add inset handling to `.screen` padding

### Tested Viewports (NOT YET TESTED)
- 375×812 (iPhone SE)
- 390×844 (iPhone 12)
- 393×852 (Pixel 6)
- 430×932 (iPhone 14 Pro Max)

---

## CURRENT ISSUES SUMMARY

| Category | Issue | Severity | Status |
|----------|-------|----------|--------|
| Architecture | No branching scenario support | HIGH | ❌ TODO |
| Architecture | No multi-decision per hand | HIGH | ❌ TODO |
| Architecture | No villain personality/dialogue | HIGH | ❌ TODO |
| Architecture | No observation tracking | MEDIUM | ❌ TODO |
| Architecture | Read screen too simplistic | MEDIUM | ❌ TODO |
| Mobile | Arena not responsive | HIGH | ❌ TODO |
| Mobile | No safe-area handling | HIGH | ❌ TODO |
| Mobile | Bottom nav overlap | MEDIUM | ❌ TODO |
| Mobile | Card sizes too small | MEDIUM | ❌ TODO |
| Spelling | (To be verified in final pass) | LOW | ⏳ PENDING |
| Scenarios | Only ~7 per session (generated) | HIGH | ❌ TODO |
| Scenarios | No Hand of the Day set defined | HIGH | ❌ TODO |

---

## FILES TO BE CREATED/MODIFIED

### New Files (will create)
- `solver/src/handOfDay/scenarios.js` — Pre-authored Hand of the Day scenario data (8+)
- `solver/src/handOfDay/scenarioEngine.js` — Branching scenario logic, state machine
- `solver/src/handOfDay/villainPersonality.js` — Dialogue, archetype traits
- `solver/src/handOfDay/observationSystem.js` — Observation tracking & collection
- `solver/src/handOfDay/readSystem.js` — Final read choice → reveal logic
- `training-ui/handOfDayShell.js` — Specialized game shell for Hand of the Day
- `training-ui/handOfDayRenderer.js` — Rendering for multi-decision flow
- `tests/handOfDay.test.js` — Test suite for scenario branching, observations

### Files to Modify
- `training-ui/sessionController.js` — Add Hand of the Day session type
- `training-ui/renderer.js` — Add Hand of the Day rendering
- `index.html` — May need dedicated screen or merge into daily
- `poker_swipe_v32.css` / `poker_swipe_v33.css` — Mobile responsive improvements

---

## NEXT STEPS

**STEP 2:** Root Cause Analysis  
→ Create scenario engine that supports branching  
→ Implement villain personality system  
→ Build observation tracking  
→ Fix mobile layout  

**STEP 3:** Implementation  
→ Author 8+ quality Hand of the Day scenarios  
→ Wire up branching engine to renderer  
→ Implement observation UI  
→ Implement read system  

**STEP 4:** Mobile Testing  
→ Test on iOS/Android viewports  
→ Verify no overlaps, clipping, scrolling issues  
→ Verify safe-area insets  

**STEP 5:** Testing & QA  
→ Run scenario tests  
→ Verify branching paths  
→ Grammar/spelling check  
→ Browser smoke test  

**STEP 6:** Report  
→ Document changes  
→ List scenarios created  
→ Report layout fixes  

---

## NOTES

- ✅ Existing character system (`window.PsCharacter`) can be extended
- ✅ Motion system (`window.PsMotion`) already supports deal, pulse, reveal
- ✅ Game shell structure (`gameShell.js`) is reusable
- ⚠️ Task library (~500 tasks) is separate from Hand of the Day scenarios (these are authored)
- ⚠️ Do NOT break existing daily training flow
- ⚠️ Do NOT modify 1698 trainer charts
- ⚠️ Do NOT redesign overall color scheme/fonts
- ⚠️ Ensure mobile responsiveness from start

---

**END OF AUDIT**
