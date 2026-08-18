import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayHand } from '../src/hand/replayHand.js';
import { SolverError } from '../src/api/errors.js';

const base = {
  hero: 'hero',
  villain: 'villain',
  heroPosition: 'BTN',
  villainPosition: 'BB',
  effectiveStackBB: 100,
  preflopActions: [
    { player: 'hero', type: 'raise', amountBB: 2.5 },
    { player: 'villain', type: 'call', amountBB: 1.5 }
  ]
};

test('replayHand captures a Hero decision spot per postflop street', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h', 'Qs', '3c'],
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'call', amountBB: 3.4 },
      { player: 'hero', type: 'check' },
      { player: 'villain', type: 'check' },
      { player: 'hero', type: 'bet', amountBB: 6 },
      { player: 'villain', type: 'fold' }
    ]
  });
  assert.equal(r.decisions.length, 3);
  assert.deepEqual(r.decisions.map((d) => d.street), ['flop', 'turn', 'river']);
});

test('each Hero decision carries the live pot, committed split and board', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h', 'Qs'],
    actions: [
      { player: 'hero', type: 'bet', amountBB: 3.4 },
      { player: 'villain', type: 'call', amountBB: 3.4 },
      { player: 'hero', type: 'bet', amountBB: 6 },
      { player: 'villain', type: 'fold' }
    ]
  });
  const flop = r.decisions[0];
  const turn = r.decisions[1];
  assert.equal(flop.street, 'flop');
  assert.equal(flop.potBB, 5.5);
  assert.deepEqual(flop.startingCommitted, { hero: 3, villain: 2.5 });
  assert.equal(flop.toCall, 0);
  assert.equal(flop.firstToAct, 'hero');
  assert.deepEqual(flop.board, ['As', 'Kd', '2h']);
  assert.equal(turn.street, 'turn');
  assert.equal(turn.potBB, 12.3);
  assert.deepEqual(turn.board, ['As', 'Kd', '2h', 'Qs']);
});

test('action legality by street: Hero bet expressed as pot fraction', () => {
  const r = replayHand({
    ...base,
    board: ['As', 'Kd', '2h'],
    actions: [{ player: 'hero', type: 'bet', amountBB: 2.75 }, { player: 'villain', type: 'fold' }]
  });
  // pot 5.5, bet 2.75 => 0.5 pot.
  assert.deepEqual(r.decisions[0].heroAction, { type: 'bet', sizePot: 0.5 });
});

test('invalid action type throws a structured error', () => {
  assert.throws(
    () => replayHand({
      ...base,
      board: ['As', 'Kd', '2h'],
      actions: [{ player: 'hero', type: 'shove', amountBB: 5 }]
    }),
    (e) => e instanceof SolverError && e.code === 'INVALID_ACTION'
  );
});

test('unknown player throws a structured error', () => {
  assert.throws(
    () => replayHand({
      ...base,
      board: ['As', 'Kd', '2h'],
      actions: [{ player: 'bob', type: 'bet', amountBB: 5 }]
    }),
    (e) => e instanceof SolverError && e.code === 'INVALID_ACTION'
  );
});

test('non-positive effective stack is rejected', () => {
  assert.throws(
    () => replayHand({ ...base, effectiveStackBB: -5 }),
    (e) => e instanceof SolverError && e.code === 'INVALID_STACK'
  );
});