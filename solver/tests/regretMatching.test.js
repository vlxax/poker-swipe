import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  regretMatching,
  hasPositiveRegret,
  isValidStrategy
} from '../src/cfr/regretMatching.js';

test('no positive regret -> uniform', () => {
  const s = regretMatching({ check: 0, bet_50: 0 }, ['check', 'bet_50']);
  assert.deepEqual(s, { check: 0.5, bet_50: 0.5 });
});

test('positive regrets scale proportionally', () => {
  const s = regretMatching({ check: 0, bet_50: 2, all_in: 1 }, ['check', 'bet_50', 'all_in']);
  assert.ok(isValidStrategy(s, ['check', 'bet_50', 'all_in']));
  assert.equal(s.check, 0);
  assert.ok(Math.abs(s.bet_50 - 2 / 3) < 1e-9);
  assert.ok(Math.abs(s.all_in - 1 / 3) < 1e-9);
});

test('negative regrets are clamped to zero', () => {
  const s = regretMatching({ a: -5, b: -1 }, ['a', 'b']);
  assert.deepEqual(s, { a: 0.5, b: 0.5 });
});

test('hasPositiveRegret', () => {
  assert.ok(hasPositiveRegret({ a: 0.1 }, ['a']));
  assert.ok(!hasPositiveRegret({ a: 0, b: -1 }, ['a', 'b']));
});

test('isValidStrategy checks sums', () => {
  assert.ok(isValidStrategy({ a: 0.3, b: 0.7 }, ['a', 'b']));
  assert.ok(!isValidStrategy({ a: 0.3, b: 0.3 }, ['a', 'b']));
  assert.ok(!isValidStrategy({ a: -0.1, b: 1.1 }, ['a', 'b']));
});