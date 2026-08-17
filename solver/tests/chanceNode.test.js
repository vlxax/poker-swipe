import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChanceNode, nextCardPool, isChanceNode } from '../src/tree/chanceNode.js';
import { createActionNode } from '../src/tree/actionNode.js';
import { createTerminalNode, TERMINAL_TYPES } from '../src/tree/terminalNode.js';

test('nextCardPool excludes board cards', () => {
  const pool = nextCardPool(['2c', '4d', '7h']);
  assert.equal(pool.length, 49);
  assert.ok(!pool.includes('2c'));
  assert.ok(!pool.includes('4d'));
  assert.ok(!pool.includes('7h'));
});

test('nextCardPool from full board has full deck', () => {
  assert.equal(nextCardPool([]).length, 52);
});

test('chance node carries aligned chanceCards and children', () => {
  const node = createChanceNode({
    id: 'c1', depth: 2, street: 'turn', board: ['2c', '4d', '7h'],
    pot: 10, committed: { hero: 5, villain: 5 }, stack: 20, actionHistory: [],
    chanceCards: ['As', 'Ks'], children: [{ id: 'x' }, { id: 'y' }]
  });
  assert.ok(isChanceNode(node));
  assert.equal(node.type, 'CHANCE');
  assert.equal(node.chanceCards.length, 2);
  assert.equal(node.children.length, 2);
});

test('node types are distinguished', () => {
  const action = createActionNode({ id: 'a', depth: 0, street: 'flop', board: ['2c', '4d', '7h'], playerToAct: 'hero', pot: 10, committed: { hero: 5, villain: 5 }, stack: 20, toCall: 0, raisesThisStreet: 0, lastAggressorAllIn: false, actionHistory: [], actions: [] });
  const terminal = createTerminalNode({ id: 't', depth: 1, street: 'river', board: ['2c', '4d', '7h', '9s', 'Td'], pot: 10, committed: { hero: 5, villain: 5 }, stack: 10, actionHistory: [], terminalType: TERMINAL_TYPES.FOLD, winner: 'hero' });
  assert.equal(action.type, 'ACTION');
  assert.equal(terminal.type, 'TERMINAL');
  assert.equal(isChanceNode(action), false);
});