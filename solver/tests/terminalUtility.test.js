import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  showdownPayoff,
  allInPayoff,
  terminalUtility,
  utilityForPlayer
} from '../src/cfr/utility.js';
import { createTerminalNode, TERMINAL_TYPES } from '../src/tree/terminalNode.js';

const board = ['2c', '4d', '7h', '9s', 'Td'];

test('showdownPayoff hero wins -> villainCommitted', () => {
  assert.equal(showdownPayoff(['As', 'Ad'], ['Ks', 'Kd'], board, 5, 5), 5);
});

test('showdownPayoff hero loses -> -heroCommitted', () => {
  assert.equal(showdownPayoff(['Ks', 'Kd'], ['As', 'Ad'], board, 5, 5), -5);
});

test('showdownPayoff tie -> (villainCommitted - heroCommitted)/2', () => {
  assert.equal(showdownPayoff(['As', 'Ad'], ['As', 'Ah'], board, 5, 5), 0);
});

test('showdownPayoff asymmetric commits splits the difference', () => {
  assert.equal(showdownPayoff(['As', 'Ad'], ['Ks', 'Kd'], board, 5, 10), 10);
});

test('terminalUtility fold winner hero -> hero wins villain committed', () => {
  const node = createTerminalNode({
    id: 't', depth: 3, street: 'river', board, pot: 15,
    committed: { hero: 5, villain: 10 }, stack: 10, actionHistory: [],
    terminalType: TERMINAL_TYPES.FOLD, winner: 'hero'
  });
  const u = terminalUtility(node, ['As', 'Ad'], ['Ks', 'Kd']);
  assert.equal(u.hero, 10);
  assert.equal(u.villain, -10);
});

test('terminalUtility fold winner villain -> hero loses own committed', () => {
  const node = createTerminalNode({
    id: 't', depth: 3, street: 'river', board, pot: 15,
    committed: { hero: 10, villain: 5 }, stack: 10, actionHistory: [],
    terminalType: TERMINAL_TYPES.FOLD, winner: 'villain'
  });
  const u = terminalUtility(node, ['As', 'Ad'], ['Ks', 'Kd']);
  assert.equal(u.hero, -10);
  assert.equal(u.villain, 10);
});

test('terminalUtility is zero-sum', () => {
  const node = createTerminalNode({
    id: 't', depth: 3, street: 'river', board, pot: 10,
    committed: { hero: 5, villain: 5 }, stack: 10, actionHistory: [],
    terminalType: TERMINAL_TYPES.SHOWDOWN
  });
  const u = terminalUtility(node, ['As', 'Ad'], ['Ks', 'Kd']);
  assert.equal(u.hero + u.villain, 0);
});

test('allInPayoff marginalizes over runout and stays bounded', () => {
  const flopBoard = ['2c', '4d', '7h'];
  const val = allInPayoff(['As', 'Ad'], ['Ks', 'Kd'], flopBoard, 10, 10);
  assert.ok(val >= -10 && val <= 10);
  assert.equal(Number.isFinite(val), true);
});

test('utilityForPlayer returns per-perspective sign', () => {
  const node = createTerminalNode({
    id: 't', depth: 3, street: 'river', board, pot: 15,
    committed: { hero: 5, villain: 10 }, stack: 10, actionHistory: [],
    terminalType: TERMINAL_TYPES.FOLD, winner: 'hero'
  });
  const hero = utilityForPlayer(node, ['As', 'Ad'], ['Ks', 'Kd'], 'hero');
  const villain = utilityForPlayer(node, ['As', 'Ad'], ['Ks', 'Kd'], 'villain');
  assert.equal(hero, 10);
  assert.equal(villain, -10);
});