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

test('flop to turn transition advances the street after both act', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h', 'Qs'],
    actions: [
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'bet', amountBB: 5 },
      { player: 'villain', type: 'fold' }
    ]
  });
  assert.deepEqual(r.decisions.map((d) => d.street), ['flop', 'turn']);
  // Turn pot: flop pot (5.5) + flop check-down (0) = 5.5 at the turn decision.
  assert.equal(r.decisions[1].potBB, 5.5);
  assert.equal(r.decisions[1].street, 'turn');
});

test('turn to river transition requires four board cards then five', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h', 'Qs', '3c'],
    actions: [
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' }
    ]
  });
  assert.deepEqual(r.decisions.map((d) => d.street), ['flop', 'turn', 'river']);
  assert.equal(r.decisions[1].board.length, 4);
  assert.equal(r.decisions[2].board.length, 5);
});

test('street does not advance past the last dealt board card', () => {
  // Only 3 board cards: after the flop round closes there is no turn card, so
  // the hand cannot move to the turn.
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h'],
    actions: [
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' }
    ]
  });
  assert.deepEqual(r.decisions.map((d) => d.street), ['flop']);
});

test('flop-only hand with no preflop round seeds blinds and opens on flop', () => {
  const r = replayHand({
    heroPosition: 'BB',
    villainPosition: 'BTN',
    effectiveStackBB: 50,
    preflopActions: [],
    board: ['As', 'Kd', '2h'],
    actions: [{ player: 'hero', type: 'bet', amountBB: 2 }, { player: 'villain', type: 'fold' }]
  });
  assert.equal(r.decisions.length, 1);
  assert.equal(r.decisions[0].street, 'flop');
  // Hero is BB (committed 1), villain BTN (committed 0.5): pot 1.5.
  assert.equal(r.decisions[0].potBB, 1.5);
});

test('no preflop round still advances streets on check-down', () => {
  // With no preflop round the blind gap is settled money in the pot, not an
  // outstanding bet, so a flop check-down must not stall on the flop.
  const r = replayHand({
    heroPosition: 'BTN',
    villainPosition: 'BB',
    effectiveStackBB: 100,
    preflopActions: [],
    board: ['As', 'Kd', '2h', 'Qs', '3c'],
    actions: [
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' }
    ]
  });
  assert.deepEqual(r.decisions.map((d) => d.street), ['flop', 'turn', 'river']);
  assert.deepEqual(r.decisions.map((d) => d.board.length), [3, 4, 5]);
});