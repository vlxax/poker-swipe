import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handBucketFromEvaluator } from '../src/cards/handBucket.js';

test('made flush is not DRAW', () => {
  const b = handBucketFromEvaluator(['As', 'Qs'], ['2s', '7s', 'Js', '4d', 'Kh']);
  assert.equal(b, 'NUTTED');
});

test('made straight is not DRAW', () => {
  const b = handBucketFromEvaluator(['9c', '8d'], ['7s', '6h', '5c', '2d', 'Kh']);
  assert.equal(b, 'NUTTED');
});

test('full house is TWO_PAIR_PLUS or NUTTED', () => {
  const b = handBucketFromEvaluator(['As', 'Ad'], ['Ah', 'Kc', 'Kd', 'Ks', '2h']);
  assert.ok(b === 'NUTTED' || b === 'TWO_PAIR_PLUS');
});
