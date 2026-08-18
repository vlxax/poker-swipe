import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayHand } from '../src/hand/replayHand.js';

const base = {
  heroPosition: 'BTN',
  villainPosition: 'BB',
  effectiveStackBB: 100,
  preflopActions: [
    { player: 'hero', type: 'raise', amountBB: 2.5 },
    { player: 'villain', type: 'call', amountBB: 1.5 }
  ]
};

test('pot and committed split carry forward across streets', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h', 'Qs', '3c'],
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'call', amountBB: 3.4 },
      { player: 'hero', type: 'bet', amountBB: 6 },
      { player: 'villain', type: 'fold' }
    ]
  });
  const [flop, turn] = r.decisions;
  // Flop pot grows by the flop bet+call.
  assert.equal(flop.potBB, 5.5);
  assert.equal(turn.potBB, 12.3);
  // Committed split reflects the carried money, and always sums to the pot.
  const sumFlop = flop.startingCommitted.hero + flop.startingCommitted.villain;
  const sumTurn = turn.startingCommitted.hero + turn.startingCommitted.villain;
  assert.ok(Math.abs(sumFlop - flop.potBB) < 1e-6);
  assert.ok(Math.abs(sumTurn - turn.potBB) < 1e-6);
});

test('effective stack is preserved on every decision', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h', 'Qs', '3c'],
    actions: [
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' }
    ]
  });
  for (const d of r.decisions) assert.equal(d.effectiveStackBB, 100);
});

test('startingCommitted honors a facing bet carried from an earlier street', () => {
  // Hero limps, villain checks back, then villain bets the flop so Hero faces a
  // bet (toCall > 0) that is carried into the decision spot's committed split.
  const r = replayHand({
    heroPosition: 'BTN',
    villainPosition: 'BB',
    effectiveStackBB: 100,
    preflopActions: [
      { player: 'hero', type: 'call', amountBB: 0.5 },
      { player: 'villain', type: 'check' }
    ],
    board: ['As', 'Kd', '2h'],
    actions: [
      { player: 'villain', type: 'bet', amountBB: 4 },
      { player: 'hero', type: 'call', amountBB: 4 }
    ]
  });
  assert.equal(r.decisions.length, 1);
  const flop = r.decisions[0];
  assert.equal(flop.street, 'flop');
  assert.equal(flop.toCall, 4);
  assert.deepEqual(flop.heroAction, { type: 'call' });
  // Villain has committed more (bet), Hero less (preflop call): split sums to pot.
  assert.ok(Math.abs(flop.startingCommitted.hero + flop.startingCommitted.villain - flop.potBB) < 1e-6);
  assert.ok(flop.startingCommitted.villain > flop.startingCommitted.hero);
});