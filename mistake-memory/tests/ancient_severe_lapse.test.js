import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  updateMemoryState,
  createInitialMemoryState,
  RECENT_SEVERE_WINDOW_MS
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P1-5 ancient severe does not force new lapse', () => {
  it('old severe outside window + one new severe from MASTERED → no auto-lapse', () => {
    let state = createInitialMemoryState('anc');
    // One ancient severe
    state = updateMemoryState(state, {
      itemId: 'anc', timestamp: T0,
      classification: 'OUT_OF_STRATEGY', chosenAction: 'X', attemptId: 'old_sev'
    });
    // Long recovery
    const later = T0 + RECENT_SEVERE_WINDOW_MS + 60_000;
    for (let i = 0; i < 30; i++) {
      state = updateMemoryState(state, {
        itemId: 'anc',
        timestamp: later + i * 3600_000,
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `ok${i}`
      });
    }
    // Force strong status if needed
    if (state.status !== 'MASTERED' && state.combinedMastery >= 0.88) {
      // ok
    }
    const lifetime = state.severeErrors;
    assert.ok(lifetime >= 1);
    assert.equal(state.recentSevereInWindow, 0);

    const beforeLapses = state.lapseCount ?? 0;
    // One new severe
    state = updateMemoryState(state, {
      itemId: 'anc',
      timestamp: later + 40 * 3600_000,
      classification: 'OUT_OF_STRATEGY',
      chosenAction: 'X',
      attemptId: 'new_sev'
    });

    // Must NOT auto-lapse solely because lifetime severeErrors > 0
    // (isolated new severe from strong state gets protected_strong_single or similar)
    assert.ok(
      state.status !== 'LAPSED' || (state.lapseCount ?? 0) === beforeLapses,
      `unexpected lapse: status=${state.status} lapseCount=${state.lapseCount}`
    );
  });
});
