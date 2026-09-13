import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSwipeToAction, actionHintForDelta } from '../../swipe-gesture-core.js';

test('mapSwipeToAction picks fold left only if in actions', () => {
  const actions = ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'];
  assert.equal(mapSwipeToAction(-80, 5, actions), 'ФОЛД');
  assert.equal(mapSwipeToAction(-80, 5, ['КОЛЛ', 'РЕЙЗ']), null);
});

test('mapSwipeToAction picks call/check right', () => {
  const actions = ['ФОЛД', 'ЧЕК', 'СТАВКА'];
  assert.equal(mapSwipeToAction(90, 10, actions), 'ЧЕК');
});

test('mapSwipeToAction picks raise up', () => {
  const actions = ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'];
  assert.equal(mapSwipeToAction(5, -90, actions), 'РЕЙЗ');
});

test('short drag returns null', () => {
  assert.equal(mapSwipeToAction(20, 10, ['ФОЛД', 'КОЛЛ']), null);
});

test('actionHintForDelta exposes side without full threshold', () => {
  const h = actionHintForDelta(-50, 4, ['ФОЛД', 'КОЛЛ']);
  assert.equal(h.action, 'ФОЛД');
  assert.equal(h.side, 'left');
});

test('diagonal drag below dominance returns null', () => {
  const actions = ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'];
  assert.equal(mapSwipeToAction(-60, -60, actions), null);
});
