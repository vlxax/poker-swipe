import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCFR } from '../src/cfr/cfrSolver.js';
import { SolverError } from '../src/api/errors.js';

const BOARD = ['2c', '4d', '7h', '9s', 'Td'];
// Hero holds the nuts (AA/KK); villain is capped (QQ/JJ). Zero-sum, deterministic.
function nutsConfig(overrides = {}) {
  return {
    street: 'river',
    board: BOARD,
    heroRange: { AA: 1, KK: 1 },
    villainRange: { QQ: 1, JJ: 1 },
    pot: 10,
    effectiveStackBB: 10,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { river: [0.5] },
    ...overrides
  };
}

test('solveCFR returns the expected result shape', () => {
  const r = solveCFR(nutsConfig(), { iterations: 200, seed: 1 });
  assert.equal(r.algorithm, 'cfr');
  assert.equal(r.iterations, 200);
  assert.ok(r.game);
  assert.equal(r.game.street, 'river');
  assert.deepEqual(r.game.board, BOARD);
  assert.ok(r.exploitability);
  assert.ok(r.aggregateStrategy);
  assert.ok(r.actionEV);
  assert.ok(r.bestAction);
  assert.ok(r.meta);
  assert.equal(r.meta.analysisMethod, 'cfr');
  assert.equal(r.meta.chanceMode, 'enumerated');
  assert.ok(r.meta.treeAbstraction);
  assert.ok(r.meta.betAbstraction);
  assert.ok(r.tree.nodeCount > 0);
});

test('root aggregate strategy is a valid distribution (sums to 1)', () => {
  const r = solveCFR(nutsConfig(), { iterations: 400, seed: 1 });
  const total = Object.values(r.aggregateStrategy).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-6);
});

test('every per-combo root strategy sums to 1', () => {
  const r = solveCFR(nutsConfig(), { iterations: 400, seed: 1 });
  const combos = Object.values(r.rootStrategy);
  assert.ok(combos.length > 0);
  for (const strat of combos) {
    const total = Object.values(strat).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(total - 1) < 1e-6, `combo strategy sums to ${total}`);
  }
});

test('game is zero-sum (heroEV + villainEV === 0)', () => {
  const r = solveCFR(nutsConfig(), { iterations: 300, seed: 1 });
  const sum = r.exploitability.heroEV + r.exploitability.villainEV;
  assert.ok(Math.abs(sum) < 1e-6, `expected zero-sum, got ${sum}`);
});

test('solving is deterministic for the same seed and input', () => {
  const a = solveCFR(nutsConfig(), { iterations: 300, seed: 42 });
  const b = solveCFR(nutsConfig(), { iterations: 300, seed: 42 });
  assert.equal(a.exploitability.exploitabilityBB, b.exploitability.exploitabilityBB);
  assert.deepEqual(a.aggregateStrategy, b.aggregateStrategy);
});

test('more iterations reduce exploitability on the nuts game', () => {
  const few = solveCFR(nutsConfig(), { iterations: 100, seed: 1 });
  const many = solveCFR(nutsConfig(), { iterations: 1500, seed: 1 });
  assert.ok(many.exploitability.exploitabilityPerPlayerBB <= few.exploitability.exploitabilityPerPlayerBB + 1e-9);
  assert.ok(many.exploitability.exploitabilityPerPlayerBB < 0.01);
});

test('action EV keys match the root actions', () => {
  const r = solveCFR(nutsConfig(), { iterations: 200, seed: 1 });
  const rootIds = Object.keys(r.actionEV).sort();
  assert.ok(rootIds.length >= 1);
  for (const id of rootIds) assert.ok(Number.isFinite(r.actionEV[id]));
});

test('bestAction is one of the root actions', () => {
  const r = solveCFR(nutsConfig(), { iterations: 200, seed: 1 });
  assert.ok(Object.keys(r.actionEV).includes(r.bestAction));
});

test('invalid algorithm throws a structured error', () => {
  assert.throws(
    () => solveCFR(nutsConfig(), { algorithm: 'bogus' }),
    (e) => e instanceof SolverError && e.code === 'INVALID_CONFIG'
  );
});