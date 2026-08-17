import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  legalActions,
  applyAction,
  otherPlayer,
  toCallFor,
  remainingStack
} from '../src/tree/betSizing.js';
import { DEFAULT_TREE_CONFIG } from '../src/tree/treeConfig.js';

const BASE = { committed: { hero: 5, villain: 5 }, stack: 10, pot: 10, street: 'river' };

test('otherPlayer inverts identity', () => {
  assert.equal(otherPlayer('hero'), 'villain');
  assert.equal(otherPlayer('villain'), 'hero');
});

test('toCallFor and remainingStack math', () => {
  assert.equal(toCallFor({ hero: 5, villain: 5 }, 'hero'), 0);
  assert.equal(toCallFor({ hero: 5, villain: 10 }, 'hero'), 5);
  assert.equal(remainingStack({ hero: 5, villain: 5 }, 20, 'hero'), 15);
});

test('opening round offers check and bets', () => {
  const acts = legalActions({ ...BASE, stack: 30, playerToAct: 'hero', cfg: DEFAULT_TREE_CONFIG });
  const ids = acts.map((a) => a.id);
  assert.ok(ids.includes('check'));
  assert.ok(ids.includes('bet_50'));
  assert.ok(ids.includes('bet_100'));
});

test('multiple oversized bets collapse into a single all_in action', () => {
  const acts = legalActions({ ...BASE, playerToAct: 'hero', cfg: DEFAULT_TREE_CONFIG });
  const allIns = acts.filter((a) => a.id === 'all_in');
  assert.equal(allIns.length, 1);
  assert.equal(allIns[0].type, 'all_in');
  assert.equal(allIns[0].amountBB, 5);
});

test('facing a bet: fold, call and optional raise', () => {
  const facing = { ...BASE, stack: 30, committed: { hero: 5, villain: 10 } };
  const acts = legalActions({ ...facing, playerToAct: 'hero', cfg: DEFAULT_TREE_CONFIG });
  const ids = acts.map((a) => a.id);
  assert.ok(ids.includes('fold'));
  assert.ok(ids.includes('call'));
  assert.ok(ids.some((i) => i.startsWith('raise_') || i === 'all_in'));
});

test('applyAction adds chips and updates pot/committed', () => {
  const state = { playerToAct: 'hero', committed: { hero: 5, villain: 5 }, pot: 10, stack: 20, raisesThisStreet: 0 };
  const next = applyAction(state, { id: 'bet_50', type: 'bet', amountBB: 5, allIn: false });
  assert.equal(next.pot, 15);
  assert.equal(next.committed.hero, 10);
  assert.equal(next.toCall, 5);
  assert.equal(next.playerToAct, 'villain');
  assert.equal(next.raisesThisStreet, 1);
});

test('all-in leaves no remaining chips', () => {
  const state = { playerToAct: 'hero', committed: { hero: 5, villain: 5 }, pot: 10, stack: 10, raisesThisStreet: 0 };
  const next = applyAction(state, { id: 'all_in', type: 'all_in', amountBB: 5, allIn: true });
  assert.equal(next.toCall, 5);
  assert.equal(next.allIn, true);
});