import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCallEV, calculateFoldEV, calculateBetEV, calculateRaiseEV } from '../src/math/ev.js';
import { normalizeBetSize, sizePotToAmount } from '../src/math/betMath.js';

test('call with positive EV', () => {
  // pot 100, bet 50, call 50, equity 0.5 -> final 200; EV = 0.5*200 - 50 = 50
  const ev = calculateCallEV({ potBeforeBet: 100, bet: 50, call: 50, equity: 0.5 });
  assert.equal(ev, 50);
});

test('call with negative EV', () => {
  // equity 0.2 -> EV = 0.2*200 - 50 = -10
  const ev = calculateCallEV({ potBeforeBet: 100, bet: 50, call: 50, equity: 0.2 });
  assert.equal(ev, -10);
});

test('call at required equity ~0', () => {
  const ev = calculateCallEV({ potBeforeBet: 100, bet: 50, call: 50, equity: 0.25 });
  assert.ok(Math.abs(ev) < 1e-9);
});

test('fold EV is 0', () => {
  assert.equal(calculateFoldEV(), 0);
});

test('bet scenario: fold equity wins pot', () => {
  // pot 100, bet 50, equityWhenCalled 0.5, foldEquity 0.5
  // EV = 0.5*100 + 0.5*(0.5*(200)-50) = 50 + 0.5*50 = 75
  const ev = calculateBetEV({ potBeforeBet: 100, bet: 50, equityWhenCalled: 0.5, foldEquity: 0.5 });
  assert.equal(ev, 75);
});

test('bet scenario: always called, 0 equity', () => {
  const ev = calculateBetEV({ potBeforeBet: 100, bet: 50, equityWhenCalled: 0, foldEquity: 0 });
  assert.equal(ev, -50);
});

test('raise EV basic', () => {
  const ev = calculateRaiseEV({ potBeforeBet: 100, facingBet: 0, raiseSize: 50, equityWhenCalled: 0.6, foldEquity: 0 });
  // finalPot = 100 + 2*50 = 200; EV = 0.6*200 - 50 = 70
  assert.equal(ev, 70);
});

test('normalizeBetSize sizePot to amountBB', () => {
  const a = normalizeBetSize({ type: 'bet', sizePot: 0.75 }, 8);
  assert.equal(a.amountBB, 6);
  assert.equal(a.sizePot, 0.75);
});

test('normalizeBetSize amountBB to sizePot', () => {
  const a = normalizeBetSize({ type: 'bet', amountBB: 6 }, 8);
  assert.equal(a.sizePot, 0.75);
  assert.equal(a.amountBB, 6);
});

test('sizePotToAmount', () => {
  assert.equal(sizePotToAmount({ potBB: 100, sizePot: 0.33 }), 33);
});