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

test('maxNodes guard records a TREE_TOO_LARGE failed decision', () => {
  const r = analyzeHand({
    ...baseInput,
    config: { maxNodes: 5 }
  }, { adaptive: false, iterations: 20, maxChanceBranches: 1 });
  // Every decision fails to build its tree under the tiny node budget.
  assert.ok(r.decisions.length >= 1);
  const failed = r.decisions.filter((d) => !d.solved);
  assert.ok(failed.length >= 1);
  assert.equal(failed[0].error.code, 'TREE_TOO_LARGE');
});

test('chance abstraction cap keeps the hand fast and deterministic', () => {
  const start = Date.now();
  const r = analyzeHand(baseInput, { adaptive: false, iterations: 60, maxChanceBranches: 1, seed: 7 });
  const elapsed = Date.now() - start;
  assert.ok(r.decisions.length >= 1);
  assert.ok(elapsed < 30000, `expected <30s, got ${elapsed}ms`);
  for (const d of r.decisions) {
    if (d.meta && d.meta.maxChanceBranches != null) {
      assert.equal(d.meta.maxChanceBranches, 1);
    }
  }
});

test('adaptive solve still produces decisions', () => {
  const r = analyzeHand(baseInput, { adaptive: true, maxIterations: 300, maxChanceBranches: 1 });
  assert.ok(r.decisions.length >= 1);
  assert.equal(r.meta.adaptive, true);
});