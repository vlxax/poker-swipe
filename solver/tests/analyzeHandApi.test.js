import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PokerSwipeSolver } from '../src/api/solverApi.js';
import { analyzeHand, replayHand, buildHandExplanation, inspectDecision } from '../src/index.js';

test('PokerSwipeSolver.analyzeHand returns a full hand analysis', async () => {
  const r = await PokerSwipeSolver.analyzeHand({
    heroPosition: 'BTN',
    villainPosition: 'BB',
    effectiveStackBB: 100,
    ranges: { hero: { AA: 1, KK: 1 }, villain: { QQ: 1, JJ: 1 } },
    preflopActions: [
      { player: 'hero', type: 'raise', amountBB: 2.5 },
      { player: 'villain', type: 'call', amountBB: 1.5 }
    ],
    board: ['As', 'Kd', '2h'],
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'fold' }
    ]
  }, { adaptive: false, iterations: 60, maxChanceBranches: 1 });
  assert.ok(Array.isArray(r.decisions));
  assert.ok(r.decisions.length >= 1);
  assert.equal(r.meta.version, 'solver-core');
});

test('analyzeHand is exported from the package index', () => {
  assert.equal(typeof analyzeHand, 'function');
  assert.equal(typeof replayHand, 'function');
  assert.equal(typeof buildHandExplanation, 'function');
  assert.equal(typeof inspectDecision, 'function');
});

test('API analyzeHand returns an error object for missing ranges', async () => {
  const r = await PokerSwipeSolver.analyzeHand({
    heroPosition: 'BTN',
    villainPosition: 'BB',
    effectiveStackBB: 100,
    ranges: { hero: { AA: 1 } },
    board: ['As', 'Kd', '2h'],
    actions: []
  }, { adaptive: false, iterations: 10 });
  assert.ok(r.error);
  assert.equal(r.error.code, 'MISSING_INPUT');
});