import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeNearDuplicates,
  pickSpread,
  pruneSizes,
  calculateGeometricSizing,
  buildBetSizingModel
} from '../src/abstraction/betSizingModel.js';

// --- mergeNearDuplicates ---------------------------------------------------

test('mergeNearDuplicates collapses sizes within tolerance', () => {
  const out = mergeNearDuplicates([0.3, 0.31, 0.5, 0.52], 0.05);
  assert.deepEqual(out, [0.3, 0.5]);
});

test('mergeNearDuplicates keeps distinct sizes', () => {
  const out = mergeNearDuplicates([0.25, 0.5, 0.75, 1.0], 0.05);
  assert.deepEqual(out, [0.25, 0.5, 0.75, 1.0]);
});

// --- pickSpread ------------------------------------------------------------

test('pickSpread preserves first and last when capped', () => {
  const out = pickSpread([0.1, 0.2, 0.3, 0.4, 0.5], 3);
  assert.equal(out[0], 0.1);
  assert.equal(out[out.length - 1], 0.5);
  assert.equal(out.length, 3);
});

test('pickSpread returns all when within the cap', () => {
  assert.deepEqual(pickSpread([0.25, 0.5, 0.75], 4), [0.25, 0.5, 0.75]);
});

// --- pruneSizes ------------------------------------------------------------

test('pruneSizes drops below-min and keeps all-in sizes', () => {
  const r = pruneSizes({ sizes: [0.1, 0.5, 3], pot: 10, stack: 30, minBet: 1 });
  assert.ok(r.prunedSizes.some((p) => p.size === 0.1));
  assert.ok(r.usedSizes.includes(0.5));
  assert.ok(r.allInSizes.includes(3));
});

// --- calculateGeometricSizing ---------------------------------------------

test('calculateGeometricSizing returns a sub-1 fraction for a normal spot', () => {
  const r = calculateGeometricSizing({ pot: 10, stack: 30, streetsRemaining: 3 });
  assert.ok(r.fraction > 0 && r.fraction < 1);
  assert.equal(r.allInForced, false);
});

test('calculateGeometricSizing flags an all-in-forced line for a short stack', () => {
  const r = calculateGeometricSizing({ pot: 10, stack: 30, streetsRemaining: 1 });
  assert.ok(r.fraction >= 1);
  assert.equal(r.allInForced, true);
});

test('calculateGeometricSizing is zero for invalid inputs', () => {
  assert.deepEqual(calculateGeometricSizing({ pot: 0, stack: 10 }), { fraction: 0, allInForced: false });
  assert.deepEqual(calculateGeometricSizing({ pot: 10, stack: 0 }), { fraction: 0, allInForced: false });
});

// --- buildBetSizingModel ---------------------------------------------------

test('buildBetSizingModel is deterministic', () => {
  const a = buildBetSizingModel({ street: 'flop', pot: 10, stack: 30, requestedBetSizes: [0.33, 0.66, 1] });
  const b = buildBetSizingModel({ street: 'flop', pot: 10, stack: 30, requestedBetSizes: [0.33, 0.66, 1] });
  assert.deepEqual(a, b);
});

test('buildBetSizingModel injects a geometric size on the flop when applicable', () => {
  const r = buildBetSizingModel({ street: 'flop', pot: 10, stack: 30, requestedBetSizes: [0.5] });
  assert.ok(r.geometricSizeUsed > 0);
  assert.ok(r.usedSizes.includes(r.geometricSizeUsed));
});

test('buildBetSizingModel never applies geometric sizing on the river', () => {
  const r = buildBetSizingModel({ street: 'river', pot: 10, stack: 30, requestedBetSizes: [0.5] });
  assert.equal(r.geometricSizeUsed, null);
});

test('buildBetSizingModel validates inputs', () => {
  assert.throws(() => buildBetSizingModel({ street: 'flop', pot: -1, stack: 30 }), /INVALID_POT/);
  assert.throws(() => buildBetSizingModel({ street: 'flop', pot: 10, stack: -1 }), /INVALID_STACK/);
});

test('buildBetSizingModel keeps oversized pot-sized all-in sizes', () => {
  const r = buildBetSizingModel({ street: 'turn', pot: 20, stack: 10, requestedBetSizes: [0.1, 1, 5], maxBetSizesPerNode: 4 });
  assert.ok(r.usedSizes.includes(1)); // pot-sized all-in kept
  assert.ok(r.usedSizes.includes(5)); // oversized all-in kept
});