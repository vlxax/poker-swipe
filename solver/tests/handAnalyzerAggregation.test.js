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

test('total EV loss equals the sum of per-decision losses', () => {
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
  const sum = solved.reduce((a, d) => a + d.evLossBB, 0);
  assert.ok(Math.abs(r.totalEvLossBB - sum) < 1e-3);
});

test('meta reports how many decisions were analyzed and solved', () => {
  const r = analyzeHand({
    ...baseInput,
    actions: [
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' }
    ]
  }, opts);
  assert.equal(r.meta.analyzedDecisions, r.decisions.length);
  assert.equal(r.meta.solvedDecisions, r.decisions.filter((d) => d.solved).length);
  assert.equal(typeof r.meta.durationMs, 'number');
});

test('summary mentions the total EV lost when material', () => {
  const r = analyzeHand({
    ...baseInput,
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'fold' }
    ]
  }, opts);
  assert.equal(typeof r.summary, 'string');
  if (r.totalEvLossBB > 0.0005) assert.ok(r.summary.includes('Total EV lost'));
});

test('terminal info is surfaced for a fold end', () => {
  const r = analyzeHand({
    ...baseInput,
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'fold' }
    ]
  }, opts);
  assert.equal(r.terminal.type, 'fold');
});