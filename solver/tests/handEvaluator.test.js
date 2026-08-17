import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand, compareHands, handName } from '../src/cards/handEvaluator.js';

const cat = (h) => h.category;

test('high card', () => {
  const h = evaluateHand(['As', 'Kd', '7h', '4c', '2s']);
  assert.equal(cat(h), 'high_card');
  assert.equal(h.value[0], 0);
});

test('one pair', () => {
  const h = evaluateHand(['As', 'Ad', '7h', '4c', '2s']);
  assert.equal(cat(h), 'one_pair');
});

test('two pair', () => {
  const h = evaluateHand(['As', 'Ad', '7h', '7c', '2s']);
  assert.equal(cat(h), 'two_pair');
});

test('three of a kind', () => {
  const h = evaluateHand(['As', 'Ad', 'Ah', '7c', '2s']);
  assert.equal(cat(h), 'three_of_a_kind');
});

test('straight', () => {
  const h = evaluateHand(['9s', '8d', '7h', '6c', '5s']);
  assert.equal(cat(h), 'straight');
});

test('wheel A2345 is a straight', () => {
  const h = evaluateHand(['As', '2d', '3h', '4c', '5s']);
  assert.equal(cat(h), 'straight');
  assert.equal(h.value[1], 5);
});

test('flush', () => {
  const h = evaluateHand(['As', 'Ks', '7s', '4s', '2s']);
  assert.equal(cat(h), 'flush');
});

test('full house', () => {
  const h = evaluateHand(['As', 'Ad', 'Ah', '7c', '7s']);
  assert.equal(cat(h), 'full_house');
});

test('four of a kind', () => {
  const h = evaluateHand(['As', 'Ad', 'Ah', 'Ac', '7s']);
  assert.equal(cat(h), 'four_of_a_kind');
});

test('straight flush', () => {
  const h = evaluateHand(['9s', '8s', '7s', '6s', '5s']);
  assert.equal(cat(h), 'straight_flush');
});

test('best 5 out of 7 (pair + board quads)', () => {
  const h = evaluateHand(['As', 'Ad', 'Ah', 'Ac', '7s', '7h', '7d']);
  assert.equal(cat(h), 'four_of_a_kind');
});

test('best 5 of 7 picks straight over two pair', () => {
  const h = evaluateHand(['As', 'Ks', 'Qd', 'Js', 'Td', '7c', '7h']);
  assert.equal(cat(h), 'straight');
});

test('compareHands ordering', () => {
  const straight = evaluateHand(['9s', '8d', '7h', '6c', '5s']);
  const pair = evaluateHand(['As', 'Ad', '7h', '4c', '2s']);
  assert.equal(compareHands(straight, pair), 1);
  assert.equal(compareHands(pair, straight), -1);
});

test('compareHands tie', () => {
  const a = evaluateHand(['As', 'Ad', '7h', '4c', '2s']);
  const b = evaluateHand(['Ac', 'Ah', '7d', '4s', '2h']);
  assert.equal(compareHands(a, b), 0);
});

test('kicker decides equal category', () => {
  const a = evaluateHand(['As', 'Ad', '7h', '4c', '2s']);
  const b = evaluateHand(['As', 'Ad', '8h', '4c', '2s']);
  assert.equal(compareHands(a, b), -1);
});

test('handName maps categories', () => {
  assert.equal(handName('full_house'), 'фулл-хаус');
  assert.equal(handName('straight_flush'), 'стрит-флеш');
});