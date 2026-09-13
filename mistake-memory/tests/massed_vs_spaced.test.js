import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateMemoryState, createInitialMemoryState } from '../index.js';

const T0 = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe('P1-4 massed vs spaced stability', () => {
  it('100 massed correct does not reach 365-day stability', () => {
    let state = createInitialMemoryState('mass');
    for (let i = 0; i < 100; i++) {
      state = updateMemoryState(state, {
        itemId: 'mass',
        timestamp: T0 + i, // ~1ms apart
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `m${i}`
      });
    }
    const year = 365 * DAY;
    assert.ok(state.stability < year * 0.5, `massed stability ${state.stability} too high`);
  });

  it('spaced recalls yield higher stability than massed', () => {
    let massed = createInitialMemoryState('m');
    let spaced = createInitialMemoryState('s');
    const n = 20;
    for (let i = 0; i < n; i++) {
      massed = updateMemoryState(massed, {
        itemId: 'm', timestamp: T0 + i,
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `m${i}`
      });
      // spaced: growing intervals
      const gap = (i === 0 ? 0 : Math.min(massed.stability || 600000, 7 * DAY));
      spaced = updateMemoryState(spaced, {
        itemId: 's',
        timestamp: (spaced.lastSeenAt || T0) + (i === 0 ? 0 : Math.max(gap, 60 * 60 * 1000)),
        classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: `s${i}`
      });
    }
    assert.ok(spaced.stability > massed.stability,
      `spaced ${spaced.stability} should exceed massed ${massed.stability}`);
  });
});
