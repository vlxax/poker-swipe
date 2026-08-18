import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCFR } from '../src/cfr/cfrSolver.js';
import { buildAdaptiveConfig, DEFAULT_ADAPTIVE_CONFIG } from '../src/cfr/adaptiveConvergence.js';

const RIVER = {
  street: 'river',
  board: ['2c', '4d', '7h', '9s', 'Td'],
  heroRange: { AA: 1, KK: 1 },
  villainRange: { QQ: 1, JJ: 1 },
  pot: 10,
  effectiveStackBB: 10,
  heroPosition: 'BTN',
  villainPosition: 'BB',
  betSizes: { river: [0.5] }
};

test('iterations: "adaptive" triggers adaptive mode', () => {
  const r = solveCFR(RIVER, { iterations: 'adaptive', seed: 1 });
  assert.equal(r.adaptive, true);
  assert.equal(r.convergence.iterationsRun > 0, true);
});

test('fixed iterations (default) stays non-adaptive and runs the requested count', () => {
  const r = solveCFR(RIVER, { iterations: 100, seed: 1 });
  assert.equal(r.adaptive, null);
  assert.equal(r.iterations, 100);
  assert.equal(r.convergence.iterationsRun, 100);
});

test('adaptive config defaults are sensible and validated', () => {
  const cfg = buildAdaptiveConfig({}, { maxIterations: 100000 });
  assert.equal(cfg.minIterations, DEFAULT_ADAPTIVE_CONFIG.minIterations);
  assert.equal(cfg.maxIterations, DEFAULT_ADAPTIVE_CONFIG.maxIterations);
  assert.ok(cfg.checkEvery > 0);
  assert.ok(cfg.stableChecksRequired > 0);
});

test('adaptive config rejects invalid values', () => {
  assert.throws(() => buildAdaptiveConfig({ minIterations: 100, maxIterations: 50 }), (e) => e.code === 'INVALID_CONFIG');
  assert.throws(() => buildAdaptiveConfig({ checkEvery: 0 }), (e) => e.code === 'INVALID_CONFIG');
  assert.throws(() => buildAdaptiveConfig({ stableChecksRequired: 0 }), (e) => e.code === 'INVALID_CONFIG');
});

test('adaptive strategy frequencies sum to 1 for legal actions', () => {
  const r = solveCFR(RIVER, { iterations: 'adaptive', seed: 1 });
  const total = Object.values(r.aggregateStrategy).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `sum=${total}`);
});

test('difficult game does not prematurely converge', () => {
  // Wider ranges and an all-in spot take longer to stabilize; with a low iteration
  // cap and strict targets the solver should run to the cap rather than stop.
  const r = solveCFR({
    street: 'river',
    board: ['2c', '4d', '7h', '9s', 'Td'],
    heroRange: { AA: 1, KK: 1, QQ: 1 },
    villainRange: { JJ: 1, TT: 1, 99: 1 },
    pot: 10,
    effectiveStackBB: 30,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { river: [1.0] }
  }, {
    iterations: 'adaptive',
    seed: 1,
    minIterations: 200,
    maxIterations: 500,
    checkEvery: 50,
    stableChecksRequired: 3,
    exploitabilityTargetBB: 1e-9
  });
  assert.equal(r.convergence.stopReason, 'max_iterations');
  assert.ok(r.convergence.iterationsRun > 200, `ran ${r.convergence.iterationsRun}`);
});