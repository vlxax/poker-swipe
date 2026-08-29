import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateMemoryState,
  updateMemoryState,
  MemoryStore,
  processAttempts,
  createInitialMemoryState,
  EVENT_LOG_LIMIT,
  semanticSnapshot
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P0-1 migration preserves aggregate', () => {
  it('legacy MASTERED + one correct → attempts 101, mastery preserved', () => {
    const legacy = {
      schemaVersion: 1,
      itemId: 'leg',
      attempts: 100,
      successes: 95,
      severeErrors: 1,
      actionMastery: 0.95,
      frequencyMastery: null,
      combinedMastery: 0.95,
      confidence: 0.9,
      actionConfidence: 0.9,
      stability: 7 * 24 * 60 * 60 * 1000,
      status: 'MASTERED',
      lastSeenAt: T0,
      hasFrequencyTarget: false
    };
    const mig = migrateMemoryState(legacy);
    assert.ok(mig._checkpoint);
    assert.equal(mig.attempts, 100);

    const next = updateMemoryState(mig, {
      itemId: 'leg',
      timestamp: T0 + 86400000,
      classification: 'PURE_MATCH',
      chosenAction: 'CALL',
      attemptId: 'n1'
    });
    assert.equal(next.attempts, 101);
    assert.ok(next.actionMastery > 0.9, `mastery ${next.actionMastery}`);
    assert.ok(next.combinedMastery > 0.9);
    assert.ok(['MASTERED', 'STABLE'].includes(next.status));
  });
});

describe('P0-2 bounded log with checkpoint compaction', () => {
  it('Test A: 501 attempts → attempts===501, log<=limit', () => {
    const store = new MemoryStore();
    const attempts = [];
    for (let i = 0; i < 501; i++) {
      attempts.push({
        itemId: 'b501',
        timestamp: T0 + i * 1000,
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `a${i}`
      });
    }
    processAttempts(store, attempts);
    const s = store.get('b501');
    assert.equal(s.attempts, 501);
    assert.ok(s._eventLog.length <= EVENT_LOG_LIMIT);
  });

  it('Test B: 1200 attempts preserve lifetime aggregate', () => {
    const store = new MemoryStore();
    const attempts = [];
    for (let i = 0; i < 1200; i++) {
      attempts.push({
        itemId: 'b1200',
        timestamp: T0 + i * 60000, // 1 min apart
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `b${i}`
      });
    }
    processAttempts(store, attempts);
    const s = store.get('b1200');
    assert.equal(s.attempts, 1200);
    assert.ok(s.actionMastery > 0.85);
    assert.ok(s._eventLog.length <= EVENT_LOG_LIMIT);
    assert.ok(s._checkpoint);
  });

  it('event older than checkpoint boundary is rejected', () => {
    let state = createInitialMemoryState('rej');
    for (let i = 0; i < EVENT_LOG_LIMIT + 10; i++) {
      state = updateMemoryState(state, {
        itemId: 'rej',
        timestamp: T0 + i * 1000,
        classification: 'PURE_MATCH',
        chosenAction: 'CALL',
        attemptId: `r${i}`
      });
    }
    const boundary = state._checkpointBoundaryTs;
    assert.ok(boundary != null);
    const before = state.attempts;
    const next = updateMemoryState(state, {
      itemId: 'rej',
      timestamp: boundary - 1,
      classification: 'OUT_OF_STRATEGY',
      chosenAction: 'X',
      attemptId: 'ancient'
    });
    assert.equal(next.attempts, before);
    assert.equal(next._lastRejectReason, 'event_older_than_checkpoint_boundary');
  });
});
