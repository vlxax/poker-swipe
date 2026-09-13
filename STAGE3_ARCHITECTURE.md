# Stage 3 Architecture Plan

## Core Improvements Over Stage 2.1

### 1. Scenario Architecture
- **Before**: Hardcoded in SCENARIOS object, mixing data and behavior
- **After**: Clean data structure with scenario compiler
- Scenarios now reference hand templates, opponent types, board progressions
- Support for branching narratives based on Hero actions

### 2. Opponent Presets (Expanded)
**From 6 presets to 12+ archetypes:**
- PASSIVE_RECREATIONAL
- STICKY_RECREATIONAL  
- SOLID_TAG_REGULAR
- AGGRESSIVE_LAG_REGULAR
- TILTED_REGULAR
- STRONG_EXPLOITER
- PSEUDO_GTO_REGULAR
- NITTY_CONSERVATIVE
- CALLING_STATION
- OVERFOLDER
- OVERBLUFFER
- SCARED_MONEY_PLAYER

Each with:
- Skill level (1-5)
- Risk tolerance (0-1)
- Bluff frequency (0-1)
- Showdown curiosity (0-1)
- Tilt level (0-1)
- Adaptability (0-1)
- Value threshold (0-1)
- Bluff catch threshold (0-1)

### 3. Branching System
- Actions on different streets lead to different boards
- Opponent reactions vary based on Hero's actual sizing/action, not predefined
- Tree-like progression instead of linear

### 4. Sizing Selection
- Flop: 25%, 33%, 50%, 66%, 75%, CHECK
- Turn: 33%, 50%, 66%, 75%, 100%, CHECK
- River: 25%, 50%, 75%, 100%, CHECK (when no bet facing)
- Show only legal options per street/situation

### 5. Post-Hand Analysis
- YOUR LINE: Sequence of actions
- KEY MOMENT: Where critical decision was
- WHAT YOU COULD KNOW: Info available to Hero
- WHAT WAS NOISE: Misleading signals
- OPPONENT'S MIND: Revealed private state
- STRATEGIC LESSON: Main poker insight
- ACCURACY: Did you read opponent correctly

### 6. Daily Mode
- getDailyScenario(dateString) → scenario for that calendar day
- Deterministic per date
- Refresh page = same scenario
- Can override with ?scenarioId=X for QA

### 7. Deterministic Replay
- startHand({scenarioId, seed, heroActions})
- Same seed + scenario = identical progression
- Random variations in opponent decisions use seeded RNG

### 8. Integration API
```javascript
PokerSwipeDailyHand.init(containerSelector)
PokerSwipeDailyHand.start(scenarioId, options)
PokerSwipeDailyHand.getState()
PokerSwipeDailyHand.reset()
PokerSwipeDailyHand.destroy()

// Events
PokerSwipeDailyHand.on('handStarted', callback)
PokerSwipeDailyHand.on('heroAction', callback)
PokerSwipeDailyHand.on('streetChanged', callback)
PokerSwipeDailyHand.on('handFinished', callback)
```

### 9. Debug Mode (?dailyDebug=1)
- Scenario selector
- Seed picker
- Full opponent mind visible
- Jump to street
- Run tests
- Reload scenario

### 10. Minimum Scenarios: 15
**Coverage:**
- PREFLOP (5): steal, 3bet, 4bet, short stack, bubble
- FLOP (3): c-bet, check-raise, dry vs wet
- TURN (3): second barrel, scare card, value protect
- RIVER (3): thin value, bluff catch, hero fold
- TOURNAMENT (1): ICM/PKO context

## Testing Strategy
- Keep all Stage 2.1 tests passing
- Add new tests for:
  - Branching paths
  - Scenario loading
  - Daily mode consistency
  - Deterministic replay
  - Private data isolation
  - Chip conservation across branches

## Implementation Order
1. ✅ Expand opponent presets
2. ✅ Scenario architecture
3. ✅ Add 12+ new scenarios
4. ✅ Branching logic
5. ✅ Sizing selection UI
6. ✅ Post-hand analysis
7. ✅ Daily mode
8. ✅ Replay API
9. ✅ Integration API
10. ✅ Debug mode
11. ✅ Comprehensive tests
12. ✅ Production bundle
