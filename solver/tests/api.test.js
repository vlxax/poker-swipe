import { test } from 'node:test';
import assert from 'node:assert/strict';
import PokerSwipeSolver, { PokerSwipeSolver as NamedSolver } from '../src/index.js';

const S = NamedSolver || PokerSwipeSolver;

test('API evaluateHand works without DOM', () => {
  return S.evaluateHand({ cards: ['As', 'Ad', 'Ah', 'Ac', '7s'] }).then((r) => {
    assert.equal(r.category, 'four_of_a_kind');
    assert.equal(r.valid, true);
  });
});

test('API calculatePotOdds returns odds + required equity', () => {
  return S.calculatePotOdds({ potBeforeBet: 100, bet: 50, call: 50 }).then((r) => {
    assert.equal(r.potOdds, 0.25);
    assert.equal(r.requiredEquity, 0.25);
  });
});

test('API calculateEquity returns analysisMethod + simulations', () => {
  return S.calculateEquity({
    heroHand: ['As', 'Ad'],
    villainRange: { KK: 1 },
    street: 'preflop',
    iterations: 10000
  }).then((r) => {
    assert.ok(r.equity > 0.75 && r.equity < 0.9);
    assert.ok(['exact', 'monte_carlo'].includes(r.analysisMethod));
    assert.ok(r.simulations > 0);
  });
});

test('API expandRange', () => {
  return S.expandRange({ range: { AA: 1, AKs: 1 } }).then((r) => {
    assert.equal(r.comboCount, 6 + 4);
  });
});

test('API calculateEV call', () => {
  return S.calculateEV({ actionType: 'call', potBeforeBet: 100, bet: 50, call: 50, equity: 0.5 }).then((r) => {
    assert.equal(r.evBB, 50);
  });
});

test('API analyzeDecision returns full structure', () => {
  return S.analyzeDecision({
    heroPosition: 'BB',
    villainPosition: 'BTN',
    effectiveStackBB: 25,
    street: 'flop',
    potBB: 8,
    heroHand: ['As', 'Jh'],
    board: ['Jd', '7c', '2s'],
    villainRange: { AA: 1, KK: 1, QQ: 1, AJo: 1 },
    availableActions: [{ type: 'check' }, { type: 'bet', sizePot: 0.33 }, { type: 'bet', sizePot: 0.75 }],
    heroAction: { type: 'bet', sizePot: 0.75 },
    iterations: 1000
  }).then((r) => {
    assert.equal(r.version, 'solver-core');
    assert.ok(r.calculation.evLossBB != null);
    assert.ok(r.explanation.summary != null);
    assert.ok(r.explanation.why.length >= 0);
    assert.ok(r.meta.confidenceScore > 0);
    assert.ok(r.meta.durationMs == null); // not present in this shape
  });
});

test('API returns structured error for invalid cards', () => {
  return S.calculateEquity({
    heroHand: ['As', '1x'],
    villainRange: { KK: 1 },
    street: 'preflop'
  }).then((r) => {
    assert.ok(r.error);
    assert.equal(r.error.code, 'INVALID_HAND');
  });
});

test('API returns structured duplicate card error', () => {
  return S.calculateEquity({
    heroHand: ['As', 'Kh'],
    villainRange: { QQ: 1 },
    board: ['As', '2c', '3d'],
    street: 'flop'
  }).then((r) => {
    assert.ok(r.error);
    assert.equal(r.error.code, 'DUPLICATE_CARD');
  });
});

test('default export and named export are the same', () => {
  assert.ok(PokerSwipeSolver === NamedSolver);
});