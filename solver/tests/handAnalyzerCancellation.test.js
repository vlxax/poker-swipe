import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHand } from '../src/hand/handAnalyzer.js';

const baseInput = {
  heroPosition: 'BTN',
  villainPosition: 'BB',
  effectiveStackBB: 100,
  ranges: { hero: { AA: 1, KK: 1 }, villain: { QQ: 1, JJ: 1 } },
  preflopActions: [
    { player: 'hero', type: 'raise', amountBB: 2.5 },
    { player: 'villain', type: 'call', amountBB: 1.5 }
  ],
  board: ['As', 'Kd', '2h', 'Qs', '3c'],
  actions: [
    { player: 'hero', type: 'check' },
    { player: 'villain', type: 'check' },
    { player: 'hero', type: 'check' },
    { player: 'villain', type: 'check' }
  ]
};

test('an aborted signal cancels solves and marks decisions cancelled', () => {
  const controller = new AbortController();
  controller.abort(); // already aborted → solver cancels immediately
  const r = analyzeHand(baseInput, {
    adaptive: false,
    iterations: 50,
    maxChanceBranches: 1,
    signal: controller.signal
  });
  assert.ok(r.decisions.length >= 1);
  for (const d of r.decisions) {
    assert.equal(d.solved, false);
    assert.equal(d.error.code, 'CANCELLED');
  }
});

test('a live signal does not cancel normal analysis', () => {
  const controller = new AbortController();
  const r = analyzeHand(baseInput, {
    adaptive: false,
    iterations: 60,
    maxChanceBranches: 1,
    signal: controller.signal
  });
  assert.ok(r.decisions.some((d) => d.solved));
});