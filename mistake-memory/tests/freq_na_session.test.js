import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewSession, scoreItem, createInitialMemoryState } from '../index.js';

describe('P0-3 frequency N/A not treated as low mastery', () => {
  it('sessionBuilder does not tag no-freq item as low_frequency_mastery', () => {
    const item = {
      ...createInitialMemoryState('naf'),
      itemId: 'naf',
      status: 'REVIEW',
      hasFrequencyTarget: false,
      frequencyMastery: null,
      combinedMastery: 0.7,
      actionMastery: 0.7
    };
    const session = buildReviewSession({
      dueItems: [item],
      targetLength: 5,
      rng: () => 0.5
    });
    const reasons = session.reasonBreakdown.filter(r => r.itemId === 'naf');
    for (const r of reasons) {
      assert.notEqual(r.reason, 'low_frequency_mastery');
    }
  });

  it('reviewQueue frequency weakness contribution is 0 when no target', () => {
    const state = {
      ...createInitialMemoryState('naf2'),
      hasFrequencyTarget: false,
      frequencyMastery: null,
      combinedMastery: 0.7,
      actionMastery: 0.7,
      confidence: 0.5,
      status: 'REVIEW',
      lastSeenAt: 1_700_000_000_000
    };
    const scored = scoreItem(state, 1_700_000_000_000 + 10000, []);
    assert.equal(scored.breakdown.lowFreq, 0);
  });
});
