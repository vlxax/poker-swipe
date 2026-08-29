/**
 * P1-1: target distribution versioning / reset.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  updateMemoryState,
  createInitialMemoryState,
  hashTargetDistribution,
  computeFrequencyMastery
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P1-1 frequency target versioning', () => {
  it('key order does not change hash', () => {
    const h1 = hashTargetDistribution({ CALL: 0.7, FOLD: 0.3 });
    const h2 = hashTargetDistribution({ FOLD: 0.3, CALL: 0.7 });
    assert.equal(h1, h2);
  });

  it('changing target resets counters — old observations do not pollute', () => {
    let state = createInitialMemoryState('tv');
    const targetA = { CALL: 0.7, FOLD: 0.3 };
    // Perfect for A
    for (let i = 0; i < 21; i++) {
      state = updateMemoryState(state, {
        itemId: 'tv', timestamp: T0 + i,
        classification: 'IN_MIX', chosenAction: 'CALL',
        context: { targetDistribution: targetA }
      });
    }
    for (let i = 0; i < 9; i++) {
      state = updateMemoryState(state, {
        itemId: 'tv', timestamp: T0 + 100 + i,
        classification: 'IN_MIX', chosenAction: 'FOLD',
        context: { targetDistribution: targetA }
      });
    }
    assert.ok(state.frequencyMastery > 0.7);

    // Switch to target B: RAISE 1.0
    const targetB = { RAISE: 1.0 };
    for (let i = 0; i < 25; i++) {
      state = updateMemoryState(state, {
        itemId: 'tv', timestamp: T0 + 200 + i,
        classification: 'PURE_MATCH', chosenAction: 'RAISE',
        context: { targetDistribution: targetB }
      });
    }

    // Should be judged only on RAISE observations vs RAISE target
    assert.equal(state.hasFrequencyTarget, true);
    assert.ok(state.frequencyMastery > 0.7, `got ${state.frequencyMastery} — old CALL/FOLD should not pollute`);
    assert.ok(state._frequencyCounters.RAISE >= 25);
    assert.equal(state._frequencyCounters.CALL, undefined);
  });
});
