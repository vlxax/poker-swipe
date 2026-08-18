import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHand } from '../src/hand/handAnalyzer.js';
import { SolverError } from '../src/api/errors.js';

const baseInput = {
  hero: 'hero',
  villain: 'villain',
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

function hand(actions) {
  return analyzeHand({ ...baseInput, actions }, opts);
}

test('analyzeHand solves multiple Hero decisions across streets', () => {
  const r = hand([
    { player: 'hero', type: 'bet', amountBB: 3.4 },
    { player: 'villain', type: 'call', amountBB: 3.4 },
    { player: 'hero', type: 'check' },
    { player: 'villain', type: 'check' },
    { player: 'hero', type: 'bet', amountBB: 6 },
    { player: 'villain', type: 'fold' }
  ]);
  assert.ok(r.decisions.length >= 3);
  assert.deepEqual(r.decisions.map((d) => d.street), ['flop', 'turn', 'river']);
  for (const d of r.decisions) {
    assert.equal(d.solved, true);
    assert.equal(d.street, d.street);
    assert.ok(d.legalActions.length > 0);
    assert.ok(d.recommendedAction);
    assert.ok(d.explanation);
    assert.equal(typeof d.explanation.summary, 'string');
    assert.ok(d.confidence.level);
  }
});

test('recommended action is the highest-EV legal action', () => {
  const r = hand([
    { player: 'hero', type: 'check' },
    { player: 'villain', type: 'check' }
  ]);
  const d = r.decisions[0];
  const best = d.legalActions[0];
  assert.equal(d.recommendedAction.type, best.action.type);
  // Best EV legal action is at the front (sorted desc).
  const evs = d.legalActions.map((a) => a.evBB);
  assert.deepEqual(evs, [...evs].sort((a, b) => b - a));
});

test('actionTaken reflects what Hero actually played', () => {
  const r = hand([
    { player: 'hero', type: 'bet', amountBB: 3.4 },
    { player: 'villain', type: 'fold' }
  ]);
  const d = r.decisions[0];
  assert.equal(d.actionTaken.type, 'bet');
  assert.ok(d.actionTaken.sizePot > 0);
});

test('EV loss is reported in BB for solved decisions', () => {
  const r = hand([
    { player: 'hero', type: 'bet', amountBB: 3.4 },
    { player: 'villain', type: 'fold' }
  ]);
  const d = r.decisions[0];
  assert.equal(typeof d.evLossBB, 'number');
  assert.ok(Number.isFinite(d.evLossBB));
  assert.ok(d.evLossBB >= 0);
});

test('pot and SPR are present per decision', () => {
  const r = hand([
    { player: 'hero', type: 'check' },
    { player: 'villain', type: 'check' }
  ]);
  const d = r.decisions[0];
  assert.ok(d.potBB > 0);
  assert.ok(d.spr > 0);
});

test('missing ranges throws a structured error', () => {
  assert.throws(
    () => analyzeHand({ ...baseInput, ranges: { hero: { AA: 1 } } }, opts),
    (e) => e instanceof SolverError && e.code === 'MISSING_INPUT'
  );
});

test('a hand with no Hero postflop decisions throws', () => {
  // Folds the hand before the flop.
  assert.throws(
    () => analyzeHand({
      ...baseInput,
      preflopActions: [
        { player: 'hero', type: 'raise', amountBB: 2.5 },
        { player: 'villain', type: 'fold' }
      ]
    }, opts),
    (e) => e instanceof SolverError && e.code === 'INVALID_INPUT'
  );
});