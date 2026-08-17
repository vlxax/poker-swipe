import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePotOdds, calculateFinalPot } from '../src/math/potOdds.js';
import { calculateRequiredEquity } from '../src/math/requiredEquity.js';
import { calculateSPR } from '../src/math/spr.js';

test('pot = 100, bet 50, call 50 -> final 200', () => {
  assert.equal(calculateFinalPot({ potBeforeBet: 100, bet: 50, call: 50 }), 200);
});

test('pot odds 50/200 = 25%', () => {
  assert.equal(calculatePotOdds({ potBeforeBet: 100, bet: 50, call: 50 }), 0.25);
});

test('required equity 20,15,15 -> 30%', () => {
  assert.equal(calculateRequiredEquity({ potBeforeBet: 20, bet: 15, call: 15 }), 0.3);
});

test('required equity 24,18,18 -> 30%', () => {
  assert.equal(calculateRequiredEquity({ potBeforeBet: 24, bet: 18, call: 18 }), 0.3);
});

test('pot odds 100,50,50 gives same as required equity', () => {
  assert.equal(calculatePotOdds({ potBeforeBet: 100, bet: 50, call: 50 }), calculateRequiredEquity({ potBeforeBet: 100, bet: 50, call: 50 }));
});

test('SPR 25 stack / 8 pot = 3.125', () => {
  assert.equal(calculateSPR({ effectiveStackBB: 25, potBB: 8 }), 3.125);
});

test('SPR with pot 100, stack 200', () => {
  assert.equal(calculateSPR({ effectiveStackBB: 200, potBB: 100 }), 2);
});