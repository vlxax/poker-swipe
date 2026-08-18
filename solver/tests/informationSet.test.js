import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  informationSetKey,
  informationSetHash,
  emptyInfoSetStore
} from '../src/tree/informationSet.js';
import { InformationSetMap } from '../src/tree/informationSetMap.js';

test('informationSetKey ignores opponent hidden cards', () => {
  const base = { street: 'river', board: ['2c', '4d', '7h'], pot: 10, stack: 10, toCall: 0, actionHistory: [] };
  const a = informationSetKey({ ...base, board: ['2c', '4d', '7h'] });
  const b = informationSetKey({ ...base, board: ['2c', '4d', '7h'] });
  assert.equal(a, b);
  assert.notEqual(a, informationSetKey({ ...base, board: ['2c', '4d', '8h'] }));
});

test('informationSetKey reflects action history', () => {
  const base = { street: 'flop', board: ['2c', '4d', '7h'], pot: 10, stack: 10, toCall: 0 };
  const a = informationSetKey({ ...base, actionHistory: ['check', 'bet_50'] });
  const b = informationSetKey({ ...base, actionHistory: ['check'] });
  assert.notEqual(a, b);
});

test('informationSetHash is stable and unique-ish', () => {
  assert.equal(informationSetHash('abc'), informationSetHash('abc'));
  assert.notEqual(informationSetHash('abc'), informationSetHash('abd'));
});

test('emptyInfoSetStore initializes collections', () => {
  const s = emptyInfoSetStore(['check', 'bet_50']);
  assert.deepEqual(s.actionIds, ['check', 'bet_50']);
  assert.deepEqual(s.regrets, {});
  assert.deepEqual(s.strategySum, {});
  assert.deepEqual(s.currentStrategy, {});
});

test('InformationSetMap dedupes and reports size', () => {
  const map = new InformationSetMap();
  const a = map.get('k1', ['a', 'b']);
  const b = map.get('k1', ['a', 'b']);
  assert.equal(a, b);
  assert.equal(map.size(), 1);
  assert.ok(map.has('k1'));
  assert.ok(!map.has('k2'));
  map.get('k2');
  assert.equal(map.size(), 2);
});