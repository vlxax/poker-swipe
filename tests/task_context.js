import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyTask, isValidCard, hasDuplicates, cardsOf, positionLabel, blindsLabel, OPPONENT_PROFILES } from '../task-context/schema.js';
import { validateTask, validateLibrary, summary } from '../task-context/validator.js';
import { buildLibrary } from '../task-context/library.js';

test('schema: card validation', () => {
  assert.equal(isValidCard('A♠'), true);
  assert.equal(isValidCard('2♥'), true);
  assert.equal(isValidCard('10♠'), false);
  assert.equal(isValidCard('T♠'), true);
  assert.equal(isValidCard('A'), false);
  assert.equal(isValidCard('1♠'), false);
  assert.equal(isValidCard('Ax♠'), false);
  assert.equal(isValidCard(''), false);
});

test('schema: duplicates and cardsOf', () => {
  assert.equal(hasDuplicates({ hero: ['A♠', 'A♠'] }), true);
  assert.equal(hasDuplicates({ hero: ['A♠', 'K♥'] }), false);
  assert.deepEqual(cardsOf('A♠'), []);
  assert.deepEqual(cardsOf({ hero: ['A♠', 'K♥'] }), ['A♠', 'K♥']);
});

test('schema: position and blind labels', () => {
  assert.equal(positionLabel('BTN'), 'BTN · баттон');
  assert.equal(positionLabel('BB'), 'BB · большой блайнд');
  assert.equal(blindsLabel({ blinds: [500, 1000], ante: 0 }), '500/1000');
  assert.equal(blindsLabel({ blinds: [1200, 2400], ante: 300 }), '1200/2400 + анте 300');
});

test('schema: opponent profiles are complete', () => {
  for (const name of ['НИТ', 'РЕГ', 'АГРО-РЕГ', 'ЛЮБИТЕЛЬ', 'МАНИАК', 'СТЕЦИОНЕР']) {
    const p = OPPONENT_PROFILES[name];
    assert.ok(p, `missing profile ${name}`);
    assert.ok(p.vpip >= 0 && p.vpip <= 100, `${name} vpip out of range`);
    assert.ok(p.pfr >= 0 && p.pfr <= 100, `${name} pfr out of range`);
    assert.ok(p.pfr <= p.vpip, `${name} pfr > vpip`);
    assert.ok(typeof p.style === 'string' && p.style.length > 0, `${name} style`);
    assert.ok(p.sample > 0, `${name} sample`);
  }
});

test('validator: rejects a malformed task', () => {
  const bad = Object.assign(emptyTask(), {
    id: 'BAD', street: 'ПРЕФЛОП', format: 'MTT', blinds: [100, 200], ante: 0,
    stage: 'СРЕДНЯЯ', table: '6-MAX', left: '10 LEFT', position: 'BTN',
    hero: ['A♠', 'A♠'], heroStack: 20, villain: 'BB', villainStack: 20,
    opp: { name: 'РЕГ', vpip: 30, pfr: 20, sample: 100, style: 'АГР', note: '' },
    board: [], pot: 1.5, options: ['ФОЛД', 'КОЛЛ'], correct: 'ФОЛД', concept: 'x', explain: 'y'
  });
  const res = validateTask(bad);
  assert.ok(res.errors.length > 0);
  assert.ok(res.errors.some(e => /дубл/i.test(e)), JSON.stringify(res.errors));
});

test('validator: rejects duplicate IDs', () => {
  const lib = buildLibrary();
  const dup = validateLibrary([lib[0], lib[0], Object.assign({}, lib[1], { id: lib[0].id })]);
  assert.equal(dup.ok, false);
  assert.ok(dup.errors.some(e => /идентификатор/i.test(e) || /ID/i.test(e)), JSON.stringify(dup.errors));
});

test('validator: full library is clean', () => {
  const lib = buildLibrary();
  const res = validateLibrary(lib);
  assert.equal(res.ok, true, res.errors.join('\n'));
  assert.equal(res.count, lib.length);
  assert.equal(res.unique, lib.length);
  assert.equal(res.errors.length, 0);
  assert.equal(res.warns.length, 0);
});

test('summary: distribution totals', () => {
  const lib = buildLibrary();
  const s = summary(lib);
  assert.equal(s.total, lib.length);
  assert.ok(s.total >= 80, `expected >=80 tasks, got ${s.total}`);
  const streetSum = Object.values(s.street).reduce((a, b) => a + b, 0);
  assert.equal(streetSum, lib.length);
  const diffSum = Object.values(s.difficulty).reduce((a, b) => a + b, 0);
  assert.equal(diffSum, lib.length);
  assert.ok(s.position.BTN > 0 && s.position.BB > 0, 'missing key positions');
  assert.ok(Object.keys(s.concept).length >= 60, `only ${Object.keys(s.concept).length} unique concepts`);
});