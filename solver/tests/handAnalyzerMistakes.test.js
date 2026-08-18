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
  board: ['As', 'Kd', '2h', 'Qs', '3c']
};

const opts = { adaptive: false, iterations: 100, maxChanceBranches: 1 };

test('biggestMistake points to the decision with the largest EV loss', () => {
  const r = analyzeHand({
    ...baseInput,
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'call', amountBB: 3.4 },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'bet', amountBB: 6 },
      { player: 'villain', type: 'fold' }
    ]
  }, opts);

  const solved = r.decisions.filter((d) => d.solved && d.evLossBB != null);
  assert.ok(solved.length >= 1);
  assert.ok(r.biggestMistake);
  const max = Math.max(...solved.map((d) => d.evLossBB));
  assert.ok(Math.abs(r.biggestMistake.evLossBB - max) < 1e-4);
  const target = r.decisions.find((d) => d.index === r.biggestMistake.decisionIndex);
  assert.ok(target);
  assert.equal(target.evLossBB, r.biggestMistake.evLossBB);
  assert.equal(r.biggestMistake.street, target.street);
});

test('a near-optimal hand reports a negligible biggest mistake', () => {
  // Hero only checks through — likely near-optimal in the abstraction.
  const r = analyzeHand({
    ...baseInput,
    actions: [
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' }
    ]
  }, opts);
  assert.ok(r.biggestMistake == null || r.biggestMistake.evLossBB <= 0.5);
});