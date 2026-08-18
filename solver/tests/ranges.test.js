import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClassToken, isValidClassToken, assertValidRange } from '../src/ranges/rangeParser.js';
import { expandRange, removeBlockedCombos, comboCountForRange } from '../src/ranges/rangeExpander.js';
import { countBlockedCombos } from '../src/ranges/blockers.js';
import { normalizeRange, toWeightedDistribution } from '../src/ranges/rangeWeights.js';
import { SolverError } from '../src/api/errors.js';

test('parser accepts pairs/suited/offsuit', () => {
  assert.deepEqual(parseClassToken('AA'), { hi: 'A', lo: 'A', kind: 'pair' });
  assert.equal(parseClassToken('77').hi, '7');
  assert.deepEqual(parseClassToken('AKs'), { hi: 'A', lo: 'K', kind: 's' });
  assert.deepEqual(parseClassToken('AKo'), { hi: 'A', lo: 'K', kind: 'o' });
  assert.equal(parseClassToken('QJs').kind, 's');
  assert.equal(parseClassToken('T9s').kind, 's');
});

test('parser rejects invalid notation', () => {
  assert.equal(parseClassToken('AK'), null);
  assert.equal(parseClassToken('AA s'), null);
  assert.equal(parseClassToken('AXs'), null);
  assert.equal(parseClassToken('1A'), null);
  assert.equal(parseClassToken(''), null);
  assert.equal(isValidClassToken('KK'), true);
  assert.equal(isValidClassToken('Kx'), false);
});

test('assertValidRange throws on empty or bad', () => {
  assert.throws(() => assertValidRange({}, 'r'), SolverError);
  assert.throws(() => assertValidRange(null, 'r'), SolverError);
  assert.throws(() => assertValidRange({ AK: 1 }, 'r'), SolverError);
  assert.throws(() => assertValidRange({ AKs: -1 }, 'r'), SolverError);
  assert.doesNotThrow(() => assertValidRange({ AKs: 1 }, 'r'));
});

test('AA = 6 combos without blockers', () => {
  const ex = expandRange({ AA: 1 }, []);
  assert.equal(ex.comboCount, 6);
});

test('AA blocker reduces combos', () => {
  assert.equal(countBlockedCombos('AA', ['As']), 3);
  assert.equal(expandRange({ AA: 1 }, ['As']).comboCount, 3);
});

test('AKs = 4 combos', () => {
  assert.equal(expandRange({ AKs: 1 }, []).comboCount, 4);
});

test('AKo = 12 combos', () => {
  assert.equal(expandRange({ AKo: 1 }, []).comboCount, 12);
});

test('blocked cards exclude combos', () => {
  const ex = expandRange({ AKo: 1 }, ['As', 'Ks']);
  // 12 offsuit combos; removing As blocks combos with As (3, since As paired with Kx not spade), removing Ks blocks combos with Ks
  // AKo combos: A-hi with offsuit K. As with Kc/Kd/Kh =3. Ks with Ac/Ad/Ah =3. AsKs is suited, not in AKo.
  assert.equal(ex.comboCount, 6);
});

test('removeBlockedCombos removes hero/board cards', () => {
  const ex = expandRange({ AA: 1 }, []);
  const filtered = removeBlockedCombos(ex, ['As']);
  assert.equal(filtered.comboCount, 3);
});

test('weights assigned and summed', () => {
  const ex = expandRange({ AA: 0.5, KK: 1.0 }, []);
  // 6 combos each
  assert.equal(ex.comboCount, 12);
  assert.equal(ex.totalWeight, 6 * 0.5 + 6 * 1.0);
});

test('normalizeRange scales max weight to 1', () => {
  const n = normalizeRange({ AA: 0.5, KK: 1.0 }, [], 'max');
  assert.equal(Math.max(...n.combos.map((c) => c.weight)), 1);
});

test('toWeightedDistribution sums to ~1', () => {
  const dist = toWeightedDistribution({ AA: 1, KK: 1 }, []);
  const sum = dist.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(dist.length, 12);
});