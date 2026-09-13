/**
 * P1-3: severe errors must not permanently penalize scheduler.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryStore,
  processAttempts,
  scheduleNextReview,
  RECENT_SEVERE_WINDOW_MS
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P1-3 severe error recovery for scheduler', () => {
  it('two recent severes activate penalty; after recovery window it clears', () => {
    const store = new MemoryStore();
    const itemId = 'sevrec';

    // Two severes near T0
    processAttempts(store, [
      { itemId, timestamp: T0, classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 's1' },
      { itemId, timestamp: T0 + 1000, classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 's2' }
    ], { now: T0 + 1000 });

    let state = store.get(itemId);
    assert.ok(state.recentSevereInWindow >= 2);
    assert.equal(state.severeErrors, 2); // lifetime

    const schedHot = scheduleNextReview(state, T0 + 2000);
    assert.ok(schedHot.reasonBreakdown.recentSeverePenalty);

    // Many successes far in the future (outside window)
    const later = T0 + RECENT_SEVERE_WINDOW_MS + 60_000;
    const successes = [];
    for (let i = 0; i < 30; i++) {
      successes.push({
        itemId,
        timestamp: later + i * 1000,
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `ok_${i}`
      });
    }
    processAttempts(store, successes, { now: later + 30_000 });
    state = store.get(itemId);

    // Lifetime still 2
    assert.equal(state.severeErrors, 2);
    // Recent window should be 0 (old severes outside window)
    assert.equal(state.recentSevereInWindow, 0);

    const schedCool = scheduleNextReview(state, later + 40_000);
    assert.equal(schedCool.reasonBreakdown.recentSeverePenalty, undefined);
  });
});
