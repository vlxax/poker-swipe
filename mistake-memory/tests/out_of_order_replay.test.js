/**
 * P0-1 regression: delivery-order independence via event-log replay.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialMemoryState,
  updateMemoryState,
  processAttempts,
  MemoryStore,
  semanticSnapshot,
  createMulberry32
} from '../index.js';

const T0 = 1_700_000_000_000;

function makeAttempts() {
  const items = [];
  // 20 successes then conceptually an old error at T0
  items.push({
    itemId: 'ooo',
    timestamp: T0,
    classification: 'OUT_OF_STRATEGY',
    chosenAction: 'RAISE',
    attemptId: 'err_old'
  });
  for (let i = 1; i <= 20; i++) {
    items.push({
      itemId: 'ooo',
      timestamp: T0 + i * 1000,
      classification: 'PURE_MATCH',
      chosenAction: 'CALL',
      attemptId: `ok_${i}`
    });
  }
  return items;
}

describe('P0-1 out-of-order replay', () => {
  it('Test A: same attempts, chronological vs shuffled → same semantic state', () => {
    const attempts = makeAttempts();

    // Variant 1: chronological
    const store1 = new MemoryStore();
    processAttempts(store1, [...attempts].sort((a, b) => a.timestamp - b.timestamp));
    const snap1 = semanticSnapshot(store1.get('ooo'));

    // Variant 2: reverse (newest first delivery)
    const store2 = new MemoryStore();
    processAttempts(store2, [...attempts].sort((a, b) => b.timestamp - a.timestamp));
    const snap2 = semanticSnapshot(store2.get('ooo'));

    // Variant 3: random shuffle
    const rng = createMulberry32(42);
    const shuffled = [...attempts].sort(() => rng() - 0.5);
    const store3 = new MemoryStore();
    processAttempts(store3, shuffled);
    const snap3 = semanticSnapshot(store3.get('ooo'));

    assert.deepEqual(snap1, snap2);
    assert.deepEqual(snap1, snap3);
  });

  it('Test B: old error after successful streak matches chronological position', () => {
    const attempts = makeAttempts();

    // Chronological all at once
    const storeChrono = new MemoryStore();
    processAttempts(storeChrono, [...attempts].sort((a, b) => a.timestamp - b.timestamp));
    const chrono = semanticSnapshot(storeChrono.get('ooo'));

    // First deliver successes only, then old error
    const storeLate = new MemoryStore();
    const successes = attempts.filter(a => a.classification === 'PURE_MATCH');
    const error = attempts.filter(a => a.classification === 'OUT_OF_STRATEGY');
    processAttempts(storeLate, successes);
    processAttempts(storeLate, error);
    const late = semanticSnapshot(storeLate.get('ooo'));

    assert.deepEqual(chrono, late);
  });

  it('fuzz: 200 random attempts chronological vs shuffled+dup → same state', () => {
    const rng = createMulberry32(99);
    const classes = ['PURE_MATCH', 'IN_MIX', 'RARE_MIX', 'OUT_OF_STRATEGY'];
    const attempts = [];
    for (let i = 0; i < 200; i++) {
      attempts.push({
        itemId: 'fuzz',
        timestamp: T0 + Math.floor(rng() * 1_000_000),
        classification: classes[Math.floor(rng() * classes.length)],
        chosenAction: rng() > 0.5 ? 'CALL' : 'FOLD',
        attemptId: `f_${i}`
      });
    }

    // Path A: unique chronological
    const unique = [...attempts].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.attemptId.localeCompare(b.attemptId);
    });
    const storeA = new MemoryStore();
    processAttempts(storeA, unique);
    const snapA = semanticSnapshot(storeA.get('fuzz'));

    // Path B: shuffled + some duplicates
    const shuffled = [...attempts].sort(() => rng() - 0.5);
    const withDups = [...shuffled, ...shuffled.slice(0, 20)];
    const storeB = new MemoryStore();
    processAttempts(storeB, withDups);
    const snapB = semanticSnapshot(storeB.get('fuzz'));

    assert.deepEqual(snapA, snapB);
  });
});
