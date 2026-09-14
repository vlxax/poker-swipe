import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand, compareHands } from '../src/cards/handEvaluator.js';

test('six-high straight 23456', () => {
  const h = evaluateHand(['2s', '3d', '4h', '5c', '6s']);
  assert.equal(h.category, 'straight');
  assert.equal(h.value[1], 6);
});

test('best straight of seven picks ten-high over nine-high', () => {
  const h = evaluateHand(['5s', '6d', '7h', '8c', '9s', 'Td', '2c']);
  assert.equal(h.category, 'straight');
  assert.equal(h.value[1], 10);
});

test('double trips full house AAAKKK', () => {
  const h = evaluateHand(['As', 'Ad', 'Ah', 'Ks', 'Kd', 'Kc', '2h']);
  assert.equal(h.category, 'full_house');
  assert.deepEqual(h.value.slice(0, 3), [6, 14, 13]);
});

test('wheel A2345', () => {
  const h = evaluateHand(['As', '2d', '3h', '4c', '5s']);
  assert.equal(h.category, 'straight');
  assert.equal(h.value[1], 5);
});

test('flush beats straight', () => {
  const flush = evaluateHand(['As', 'Ks', 'Qs', 'Js', '9s', '8d', '7h']);
  const straight = evaluateHand(['9c', '8d', '7h', '6s', '5d', '2c', '3h']);
  assert.equal(flush.category, 'flush');
  assert.equal(straight.category, 'straight');
  assert.equal(compareHands(flush, straight), 1);
});
