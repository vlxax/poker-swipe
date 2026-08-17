import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateStrategy,
  averageStrategy,
  strategyDelta
} from '../src/cfr/strategyAccumulator.js';

test('accumulateStrategy weights by reach', () => {
  const acc = {};
  accumulateStrategy(acc, 2, { a: 0.5, b: 0.5 });
  accumulateStrategy(acc, 1, { a: 1, b: 0 });
  assert.equal(acc.a, 2);
  assert.equal(acc.b, 1);
});

test('averageStrategy normalizes', () => {
  const avg = averageStrategy({ a: 2, b: 1 }, ['a', 'b']);
  assert.ok(Math.abs(avg.a - 2 / 3) < 1e-9);
  assert.ok(Math.abs(avg.b - 1 / 3) < 1e-9);
  assert.deepEqual(averageStrategy({}, ['a', 'b']), { a: 0.5, b: 0.5 });
});

test('strategyDelta is L1 distance', () => {
  assert.equal(strategyDelta({ a: 1, b: 0 }, { a: 0.5, b: 0.5 }), 1);
  assert.equal(strategyDelta({ a: 1 }, { a: 1 }), 0);
});