import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEquity } from '../src/equity/index.js';
import { monteCarlo } from '../src/equity/monteCarlo.js';
import { mulberry32 } from '../src/equity/rng.js';

const tol = 0.03;

test('AA vs KK preflop ~82%', () => {
  const r = calculateEquity({ heroHand: ['As', 'Ad'], villainRange: { KK: 1 }, street: 'preflop', iterations: 30000 });
  assert.ok(Math.abs(r.equity - 0.82) < tol, `got ${r.equity}`);
  assert.equal(r.analysisMethod, 'monte_carlo');
});

test('set vs overpair (flop)', () => {
  const r = calculateEquity({
    heroHand: ['9s', '9d'],
    villainRange: { AA: 1 },
    board: ['9h', 'Kc', '2s'],
    street: 'flop',
    iterations: 30000
  });
  // set ~92% vs overpair with 2 cards to come
  assert.ok(r.equity > 0.85, `got ${r.equity}`);
});

test('flush draw has meaningful equity', () => {
  const r = calculateEquity({
    heroHand: ['Ah', 'Kh'],
    villainRange: { QQ: 1 },
    board: ['7h', '3h', '2d'],
    street: 'flop',
    iterations: 30000
  });
  // flush draw + two overs vs QQ is roughly a coin flip, slightly ahead
  assert.ok(r.equity > 0.4 && r.equity < 0.7, `got ${r.equity}`);
});

test('made flush river is exact and dominant', () => {
  const r = calculateEquity({
    heroHand: ['Ah', 'Kh'],
    villainRange: { KK: 1, QQ: 1 },
    board: ['2h', '5h', '9h', 'Tc', 'Jd'],
    street: 'river',
    iterations: 1000
  });
  assert.equal(r.analysisMethod, 'exact');
  assert.ok(Math.abs(r.equity - 1.0) < 1e-9, `got ${r.equity}`);
  assert.equal(r.simulations, 12);
});

test('split pot on river', () => {
  const r = calculateEquity({
    heroHand: ['As', 'Ks'],
    villainRange: { AKo: 1 },
    board: ['Ah', 'Kd', '2c', '7s', '8h'],
    street: 'river'
  });
  assert.equal(r.analysisMethod, 'exact');
  assert.ok(Math.abs(r.tiePct - 1.0) < 1e-9, `got ${r.tiePct}`);
  assert.ok(Math.abs(r.equity - 0.5) < 1e-9);
});

test('river exact equity with mixed range', () => {
  const r = calculateEquity({
    heroHand: ['Qc', 'Qd'],
    villainRange: { AA: 1, KK: 1, JJ: 1 },
    board: ['Qs', '7h', '4d', '2c', '9h'],
    street: 'river'
  });
  assert.equal(r.analysisMethod, 'exact');
  assert.ok(Math.abs(r.equity - 1.0) < 1e-9);
});

test('seed reproducibility', async () => {
  const input = {
    heroHand: ['As', 'Kd'],
    villainRange: { TT: 1, AQ: 1 },
    board: ['Jh', '8c', '3s'],
    street: 'flop',
    iterations: 20000,
    seed: 42
  };
  const a = await monteCarloFor(input);
  const b = await monteCarloFor(input);
  assert.equal(a.equity, b.equity);
});

async function monteCarloFor(input) {
  const { expandRange } = await import('../src/ranges/rangeExpander.js');
  const { monteCarlo, deriveSeed } = await import('../src/equity/monteCarlo.js');
  const expanded = expandRange(input.villainRange, [...input.board]);
  return monteCarlo({
    heroHand: input.heroHand,
    villainCombos: expanded.combos,
    distributions: expanded.combos.map((c) => ({ ...c, weight: c.weight / expanded.totalWeight })),
    board: input.board,
    iterations: input.iterations,
    seed: deriveSeed(input)
  });
}

test('duplicate hero/board cards rejected', () => {
  assert.throws(() => {
    calculateEquity({ heroHand: ['As', 'Kh'], villainRange: { QQ: 1 }, board: ['As', '2c', '3d'], street: 'flop' });
  }, (e) => e.code === 'DUPLICATE_CARD');
});

test('rng is deterministic and in [0,1)', () => {
  const r1 = mulberry32(5);
  const r2 = mulberry32(5);
  const s1 = Array.from({ length: 10 }, () => r1());
  const s2 = Array.from({ length: 10 }, () => r2());
  assert.deepEqual(s1, s2);
  assert.ok(s1.every((x) => x >= 0 && x < 1));
});