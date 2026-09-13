# Mistake Memory + Spaced Repetition Engine

Standalone JavaScript engine for granular learner memory, mastery estimation, forgetting, and review scheduling.

**Not integrated into PokerSwipe.** No UI, no auth, no database, no poker strategy invention.

## Core Concepts

### Learning Item
Generic: `{ id, type, spotId?, hand?, metadata? }`  
Types supported: `RANGE | SPOT_HAND | TRANSITION_HAND | CONCEPT`

### Attempt
`{ itemId, timestamp, classification?, chosenAction?, targetProbability?, weaknessScore?, frequencyDeviation?, responseTimeMs?, context?, attemptId? }`

Classification:
- `PURE_MATCH` – correct primary action
- `IN_MIX` – legal mixed action
- `RARE_MIX` – legal but rare
- `OUT_OF_STRATEGY` – illegal action error

### Memory State
Tracks attempts, successes, severeErrors, actionMastery, frequencyMastery, combinedMastery, stability, forgettingRisk, confidence, timestamps, dueAt, intervalMs, status, lapseCount, recoveryProgress.

Statuses: `NEW | LEARNING | WEAK | REVIEW | STABLE | MASTERED | LAPSED`

## Key Algorithms (documented)

### Forgetting
```
retention = exp(-elapsedMs / stabilityMs)
```
Monotonic, higher stability → slower decay. Bounded, no NaN/Inf.

### Stability
- Success → multiply by `(1 + growth * sampleConfidence)` (diminishing)
- Severe → multiply by `(1 - penalty * sampleConfidence)`
- Isolated low-evidence mistake cannot destroy long-term stability (floor protection)

### Action Mastery
Bayesian weighted success rate.  
Weights: PURE_MATCH=1.0, IN_MIX=0.85, RARE_MIX=0.55, OUT_OF_STRATEGY=0.0  
`IN_MIX` is **not** punished as an error.

### Frequency Mastery
Empirical distribution vs target → absolute deviation.  
Mastery = (1 − deviation) × soft sample-confidence factor.  
7/3 matching 70/30 has **lower confidence** than 70/30 with 100 samples.

### Combined Mastery
Weighted geometric mean of action + frequency mastery.

### Scheduler
```
interval ≈ stability × masteryFactor × evidenceFactor
```
× error/lapse penalties × mastered stretch.  
Urgency combines forgetting risk, weakness, overdue ratio, evidence.

### Lapses
Requires previously strong state + repeated severe errors.  
One isolated mistake does **not** auto-lapse.  
Tracks `lapseCount`, `lastLapseAt`, `recoveryProgress`.

### Review Queue
Priority: overdue → forgetting risk → weakness → lapses → low frequency/action mastery → low evidence → anti-repeat → review-burden penalty for strong items.

### Short-term Retry
Soft anti-repeat (no hard ban). Same-session and later-session concepts.

## Usage

```js
import {
  createInitialMemoryState,
  updateMemoryState,
  processAttempts,
  MemoryStore,
  buildReviewQueue,
  buildReviewSession,
  scheduleNextReview,
  isMastered
} from './index.js';

const store = new MemoryStore();
processAttempts(store, attempts); // sorted, deduped, deterministic

const queue = buildReviewQueue({
  memoryStates: store.allStates(),
  now: injectedNow,
  recentTasks: [],
  maxItems: 15
});
```

All core functions accept injected `now` / `rng`. Never call `Date.now()` or `Math.random()` internally for scheduling decisions.

## Persistence
States are plain JSON-serializable objects with `schemaVersion`.  
Use `migrateMemoryState` for future upgrades.

## Complexity
Per-item compact state. Batch update: O(A log A) for sort + O(A) updates.  
Designed for tens of thousands of attempts and thousands of items without scanning full history on every schedule decision.

## Tests
See `tests/`. Run with `node --test tests/*.test.js` (Node ≥ 18).
