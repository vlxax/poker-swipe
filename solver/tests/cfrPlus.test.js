import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCFR } from '../src/cfr/cfrSolver.js';
import { SolverError } from '../src/api/errors.js';

const BOARD = ['2c', '4d', '7h', '9s', 'Td'];

function nutsConfig() {
  return {
    street: 'river',
    board: BOARD,
    heroRange: { AA: 1, KK: 1 },
    villainRange: { QQ: 1, JJ: 1 },
    pot: 10,
    effectiveStackBB: 10,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { river: [0.5] }
  };
}

test('cfr_plus runs and reports the algorithm', () => {
  const r = solveCFR(nutsConfig(), { algorithm: 'cfr_plus', iterations: 300, seed: 1 });
  assert.equal(r.algorithm, 'cfr_plus');
  assert.equal(r.meta.analysisMethod, 'cfr_plus');
});

test('cfr_plus aggregate strategy sums to 1', () => {
  const r = solveCFR(nutsConfig(), { algorithm: 'cfr_plus', iterations: 400, seed: 1 });
  const total = Object.values(r.aggregateStrategy).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-6);
});

test('cfr_plus game stays zero-sum', () => {
  const r = solveCFR(nutsConfig(), { algorithm: 'cfr_plus', iterations: 300, seed: 1 });
  const sum = r.exploitability.heroEV + r.exploitability.villainEV;
  assert.ok(Math.abs(sum) < 1e-6);
});

test('cfr_plus converges on the nuts game', () => {
  const r = solveCFR(nutsConfig(), { algorithm: 'cfr_plus', iterations: 1500, seed: 1 });
  assert.ok(r.exploitability.exploitabilityPerPlayerBB < 0.01);
});

test('cfr_plus is deterministic for the same seed', () => {
  const a = solveCFR(nutsConfig(), { algorithm: 'cfr_plus', iterations: 300, seed: 7 });
  const b = solveCFR(nutsConfig(), { algorithm: 'cfr_plus', iterations: 300, seed: 7 });
  assert.equal(a.exploitability.exploitabilityBB, b.exploitability.exploitabilityBB);
  assert.deepEqual(a.aggregateStrategy, b.aggregateStrategy);
});

test('cfr_plus also solves a mixed-strategy bluffing game', () => {
  const r = solveCFR({
    street: 'river',
    board: BOARD,
    heroRange: { AA: 1, AKs: 1 },
    villainRange: { QQ: 1, JJ: 1 },
    pot: 10,
    effectiveStackBB: 30,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { river: [0.5] }
  }, { algorithm: 'cfr_plus', iterations: 2000, seed: 1 });
  // Hero holds both value (AA) and air (AKs), so the root strategy is mixed.
  const bet = r.aggregateStrategy.bet_50 || 0;
  const check = r.aggregateStrategy.check || 0;
  assert.ok(bet > 0.1 && bet < 0.99, `expected a mixed bet, got ${bet}`);
  assert.ok(Math.abs(bet + check - 1) < 1e-6);
});

test('invalid algorithm is rejected for cfr_plus path too', () => {
  assert.throws(
    () => solveCFR(nutsConfig(), { algorithm: 'montecarlo' }),
    (e) => e instanceof SolverError && e.code === 'INVALID_CONFIG'
  );
});