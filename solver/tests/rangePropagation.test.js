import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  propagateRange,
  calculateReachProbability,
  normalizeReach,
  aggregateStrategy
} from '../src/ranges/rangePropagation.js';

test('propagateRange multiplies reach by frequency', () => {
  assert.equal(propagateRange(1, 0.5), 0.5);
  assert.equal(propagateRange(0.5, 0.2), 0.1);
  assert.equal(propagateRange(1, 0), 0);
});

test('calculateReachProbability multiplies along a path', () => {
  assert.equal(calculateReachProbability(1, [0.5, 0.5, 0.5]), 0.125);
  assert.equal(calculateReachProbability(2, [0.5, 0.25]), 0.25);
  assert.equal(calculateReachProbability(1, []), 1);
});

test('normalizeReach sums to 1', () => {
  const out = normalizeReach({ a: 2, b: 2, c: 0 });
  assert.equal(Object.values(out).reduce((s, v) => s + v, 0), 1);
  assert.equal(out.c, undefined);
  assert.deepEqual(normalizeReach({}), {});
});

test('aggregateStrategy weights combos by reach', () => {
  const reachMap = { A: 1, B: 3 };
  const strategies = { A: { x: 1, y: 0 }, B: { x: 0.5, y: 0.5 } };
  const agg = aggregateStrategy(reachMap, strategies);
  assert.ok(Math.abs(agg.x - 0.625) < 1e-9);
  assert.ok(Math.abs(agg.y - 0.375) < 1e-9);
  assert.deepEqual(aggregateStrategy({}, {}), {});
});