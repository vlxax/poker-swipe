/**
 * P0-2: scheduler must not use old event timestamp as current time.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryStore,
  processAttempts,
  scheduleNextReview,
  resolveSchedulerNow,
  updateMemoryState,
  createInitialMemoryState
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P0-2 scheduler event time', () => {
  it('resolveSchedulerNow never goes before lastSeenAt', () => {
    const state = {
      lastSeenAt: T0 + 5000,
      lastErrorAt: T0 + 4000
    };
    const ref = resolveSchedulerNow(state, T0 + 1000); // old now
    assert.ok(ref >= T0 + 5000);
  });

  it('old success after new severe does not stretch interval via negative age', () => {
    const store = new MemoryStore();

    // New severe at T0+10000
    processAttempts(store, [{
      itemId: 'sch',
      timestamp: T0 + 10000,
      classification: 'OUT_OF_STRATEGY',
      chosenAction: 'RAISE',
      attemptId: 'sev'
    }], { now: T0 + 10000 });

    const afterSevere = store.get('sch');
    const intervalAfterSevere = afterSevere.intervalMs;

    // Old success at T0+1000 delivered later
    processAttempts(store, [{
      itemId: 'sch',
      timestamp: T0 + 1000,
      classification: 'PURE_MATCH',
      chosenAction: 'CALL',
      attemptId: 'old_ok'
    }], { now: T0 + 10000 }); // processing now is still "now"

    const final = store.get('sch');
    // dueAt must be finite and not absurdly in the past relative to lastSeenAt
    assert.ok(Number.isFinite(final.dueAt));
    assert.ok(final.dueAt >= final.lastSeenAt);
    // interval should still be valid
    assert.ok(final.intervalMs > 0);
    assert.ok(Number.isFinite(final.intervalMs));
  });

  it('chronological vs out-of-order delivery yield same dueAt after full set', () => {
    const attempts = [
      { itemId: 's2', timestamp: T0 + 1000, classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'a' },
      { itemId: 's2', timestamp: T0 + 5000, classification: 'OUT_OF_STRATEGY', chosenAction: 'RAISE', attemptId: 'b' },
      { itemId: 's2', timestamp: T0 + 8000, classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'c' }
    ];

    const s1 = new MemoryStore();
    processAttempts(s1, attempts, { now: T0 + 8000 });

    const s2 = new MemoryStore();
    processAttempts(s2, [...attempts].reverse(), { now: T0 + 8000 });

    const a = s1.get('s2');
    const b = s2.get('s2');
    assert.equal(a.intervalMs, b.intervalMs);
    assert.equal(a.dueAt, b.dueAt);
    assert.equal(a.lastSeenAt, b.lastSeenAt);
  });
});
