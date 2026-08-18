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

test('fold terminal records the winner and stops the replay', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h'],
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'fold' }
    ]
  });
  assert.deepEqual(r.terminal, { type: 'fold', winner: 'hero', street: 'flop', pot: 8.9 });
  // No further hero decision beyond the flop bet.
  assert.equal(r.decisions.length, 1);
});

test('all-in terminal stops the replay when both players are all-in', () => {
  const r = replayHand({
    heroPosition: 'BB',
    villainPosition: 'BTN',
    effectiveStackBB: 20,
    preflopActions: [
      { player: 'villain', type: 'raise', amountBB: 2 },
      { player: 'hero', type: 'call', amountBB: 1.5 }
    ],
    board: ['As', 'Kd', '2h'],
    actions: [
      { player: 'hero', type: 'all_in', amountBB: 18 },
      { player: 'villain', type: 'call', amountBB: 18 }
    ]
  });
  assert.equal(r.terminal.type, 'all_in');
  assert.equal(r.terminal.street, 'flop');
  assert.equal(r.terminal.pot, 40);
  assert.equal(r.decisions.length, 1);
});

test('all-in does not end the hand while the opponent can still act', () => {
  // Hero jams but villain has chips left: the hand continues (villain may call/fold).
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h'],
    actions: [
      { player: 'hero', type: 'all_in', amountBB: 20 },
      { player: 'villain', type: 'fold' }
    ]
  });
  assert.deepEqual(r.terminal, { type: 'fold', winner: 'hero', street: 'flop', pot: 25.5 });
});