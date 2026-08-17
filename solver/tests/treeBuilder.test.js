import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGameTree } from '../src/tree/treeBuilder.js';
import { SolverError } from '../src/api/errors.js';

const RIVER = ['2c', '4d', '7h', '9s', 'Td'];
const base = {
  street: 'river',
  board: RIVER,
  heroRange: { AA: 1, KK: 1 },
  villainRange: { QQ: 1, JJ: 1 },
  pot: 10,
  effectiveStackBB: 10,
  heroPosition: 'BTN',
  villainPosition: 'BB',
  betSizes: { river: [0.5, 1.0] }
};

test('buildGameTree returns a GameTree with summary', () => {
  const tree = buildGameTree(base);
  assert.ok(tree.root);
  assert.ok(tree.summary().nodeCount > 0);
  assert.equal(tree.summary().heroComboCount, 12);
  assert.equal(tree.summary().villainComboCount, 12);
});

test('river root is an ACTION node for the first-to-act player', () => {
  const tree = buildGameTree(base);
  const root = tree.root;
  assert.equal(root.type, 'ACTION');
  assert.equal(root.playerToAct, 'hero');
});

test('root legal actions reflect bet sizing', () => {
  const tree = buildGameTree({ ...base, effectiveStackBB: 30 });
  const ids = tree.root.actions.map((a) => a.id);
  assert.ok(ids.includes('check'));
  assert.ok(ids.includes('bet_50'));
  assert.ok(ids.includes('bet_100'));
});

test('short stack collapses bets into a single all_in', () => {
  const tree = buildGameTree(base);
  const ids = tree.root.actions.map((a) => a.id);
  assert.deepEqual([...ids].filter((i) => i === 'all_in').length, 1);
  assert.ok(ids.includes('all_in'));
});

test('fold action leads to a terminal node with the correct winner', () => {
  const tree = buildGameTree({ ...base, effectiveStackBB: 30 });
  let sawFold = false;
  for (const node of tree.allNodes()) {
    if (node.type !== 'ACTION') continue;
    for (let i = 0; i < node.actions.length; i++) {
      if (node.actions[i].type !== 'fold') continue;
      const child = node.children[i];
      assert.equal(child.type, 'TERMINAL');
      assert.equal(child.terminalType, 'fold');
      assert.equal(child.winner, otherOf(node.playerToAct));
      sawFold = true;
    }
  }
  assert.ok(sawFold, 'expected at least one fold action');
});

test('all-in terminals have zero remaining committed gap', () => {
  const tree = buildGameTree({ ...base, effectiveStackBB: 30, betSizes: { river: [3.0] } });
  for (const node of tree.terminalNodes) {
    assert.ok(node.committed.hero <= 30);
    assert.ok(node.committed.villain <= 30);
  }
});

test('first-to-act check gives the opponent a free action, not an instant showdown', () => {
  const tree = buildGameTree({ ...base, effectiveStackBB: 30 });
  const root = tree.root;
  const checkIdx = root.actions.findIndex((a) => a.id === 'check');
  assert.ok(checkIdx >= 0, 'expected a check action at the root');
  const checkChild = root.children[checkIdx];

  // Hero checks first; villain must still get to act (check or bet).
  assert.equal(checkChild.type, 'ACTION');
  assert.equal(checkChild.playerToAct, 'villain');
  const villainCheckIdx = checkChild.actions.findIndex((a) => a.id === 'check');
  assert.ok(villainCheckIdx >= 0);
  const villainCheckChild = checkChild.children[villainCheckIdx];

  // Villain's check-back closes the round as a showdown.
  assert.equal(villainCheckChild.type, 'TERMINAL');
  assert.equal(villainCheckChild.terminalType, 'showdown');
});

test('flop tree contains chance nodes to deal the turn', () => {
  const tree = buildGameTree({
    ...base,
    street: 'flop',
    board: ['2c', '4d', '7h'],
    heroRange: { AA: 1 },
    villainRange: { KK: 1 },
    maxRaisesPerStreet: 0,
    betSizes: { flop: [0.5], turn: [0.5], river: [0.5] }
  });
  assert.ok(tree.chanceNodes.length > 0);
  assert.ok(tree.chanceNodes.some((n) => n.street === 'turn'));
  assert.ok(tree.chanceNodes.every((n) => n.street === 'turn' || n.street === 'river'));
});

test('invalid street throws structured error', () => {
  assert.throws(() => buildGameTree({ ...base, street: 'not_a_street' }), (e) => e instanceof SolverError && e.code === 'INVALID_STREET');
});

test('wrong board card count throws', () => {
  assert.throws(() => buildGameTree({ ...base, board: ['2c', '4d'] }), (e) => e instanceof SolverError && e.code === 'INVALID_BOARD');
});

test('missing range throws', () => {
  assert.throws(() => buildGameTree({ ...base, villainRange: undefined }), (e) => e instanceof SolverError && e.code === 'MISSING_INPUT');
});

test('non-positive stack throws', () => {
  assert.throws(() => buildGameTree({ ...base, effectiveStackBB: 0 }), (e) => e instanceof SolverError && e.code === 'INVALID_STACK');
});

function otherOf(p) {
  return p === 'hero' ? 'villain' : 'hero';
}