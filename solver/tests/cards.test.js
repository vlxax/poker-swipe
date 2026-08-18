import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCard, isValidCard, rankOf, suitOf, cardLabel, assertNoDuplicates, assertValidBoard } from '../src/cards/cardParser.js';
import { createDeck, deckAfter } from '../src/cards/deck.js';
import { SolverError } from '../src/api/errors.js';

test('parseCard accepts valid cards', () => {
  assert.equal(parseCard('As'), 'As');
  assert.equal(parseCard('10d'), 'Td');
  assert.equal(parseCard('Kh'), 'Kh');
  assert.equal(parseCard('qc'), 'Qc');
  assert.equal(parseCard('  Ts  '), 'Ts');
});

test('parseCard rejects invalid cards', () => {
  assert.equal(parseCard('1s'), null);
  assert.equal(parseCard('A'), null);
  assert.equal(parseCard('Ax'), null);
  assert.equal(parseCard('Ss'), null);
  assert.equal(parseCard(''), null);
  assert.equal(parseCard(null), null);
  assert.equal(parseCard('Ace'), null);
});

test('rankValue and suit', () => {
  assert.equal(rankOf('As'), 14);
  assert.equal(rankOf('2c'), 2);
  assert.equal(rankOf('Td'), 10);
  assert.equal(suitOf('Kh'), 'h');
  assert.equal(suitOf('Qc'), 'c');
});

test('cardLabel renders unicode suit', () => {
  assert.equal(cardLabel('As'), 'A♠');
  assert.equal(cardLabel('Td'), '10♦');
});

test('createDeck has 52 unique cards', () => {
  const d = createDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d).size, 52);
  assert.ok(d.includes('As') && d.includes('2c'));
});

test('deckAfter removes known cards', () => {
  const d = deckAfter(['As', 'Kh']);
  assert.equal(d.length, 50);
  assert.ok(!d.includes('As'));
  assert.ok(d.includes('2c'));
});

test('duplicate detection across groups', () => {
  assert.throws(
    () => assertNoDuplicates([['heroHand', ['As', 'Kh']], ['board', ['As', '2c']]]),
    (err) => err instanceof SolverError && err.code === 'DUPLICATE_CARD'
  );
});

test('valid board passes', () => {
  const b = assertValidBoard(['As', 'Kh', 'Qd'], 'flop');
  assert.equal(b.length, 3);
});

test('invalid board count throws', () => {
  assert.throws(() => assertValidBoard(['As', 'Kh'], 'flop'), SolverError);
  assert.throws(() => assertValidBoard([], 'flop'), SolverError);
});