import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCFR } from '../src/cfr/cfrSolver.js';

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

test('adaptive solve converges and stops before maxIterations on a simple game', () => {
  const r = solveCFR(RIVER, {
    iterations: 'adaptive',
    seed: 1,
    minIterations: 200,
    maxIterations: 4000,
    checkEvery: 100,
    stableChecksRequired: 3,
    exploitabilityTargetBB: 0.02
  });

  assert.equal(r.adaptive, true);
  assert.equal(r.convergence.stopReason, 'converged');
  assert.equal(r.convergence.converged, true);
  assert.ok(r.convergence.iterationsRun >= 200, `ran ${r.convergence.iterationsRun}`);
  assert.ok(r.convergence.iterationsRun < 4000, `ran ${r.convergence.iterationsRun}`);
  assert.ok(r.convergence.exploitabilityBB != null && r.convergence.exploitabilityBB <= 0.02);
  assert.ok(Array.isArray(r.convergence.exploitabilityHistory) && r.convergence.exploitabilityHistory.length > 0);
  assert.ok(r.convergence.strategyDelta != null);
  assert.ok(r.convergence.evDeltaBB != null);
  assert.ok(r.convergence.stableChecks >= 3);
});

test('adaptive solve has the documented result shape', () => {
  const r = solveCFR(RIVER, { iterations: 'adaptive', seed: 1 });
  const c = r.convergence;
  for (const key of ['converged', 'iterationsRun', 'stopReason', 'exploitabilityBB', 'exploitabilityHistory', 'strategyDelta', 'evDeltaBB', 'stableChecks']) {
    assert.ok(key in c, `missing convergence.${key}`);
  }
  assert.ok(['converged', 'max_iterations', 'time_limit', 'node_limit', 'error'].includes(c.stopReason));
});

test('adaptive solve does not stop before minIterations', () => {
  const r = solveCFR(RIVER, {
    iterations: 'adaptive',
    seed: 1,
    minIterations: 800,
    maxIterations: 2000,
    checkEvery: 100,
    stableChecksRequired: 1
  });
  assert.ok(r.convergence.iterationsRun >= 800, `ran ${r.convergence.iterationsRun}`);
});

test('adaptive solve is deterministic for the same seed', () => {
  const opts = { iterations: 'adaptive', seed: 7, minIterations: 200, maxIterations: 2000, checkEvery: 100 };
  const a = solveCFR(RIVER, opts);
  const b = solveCFR(RIVER, opts);
  assert.equal(a.convergence.iterationsRun, b.convergence.iterationsRun);
  assert.equal(a.convergence.stopReason, b.convergence.stopReason);
  assert.equal(a.convergence.exploitabilityBB, b.convergence.exploitabilityBB);
  assert.deepEqual(a.aggregateStrategy, b.aggregateStrategy);
});

test('strict targets never converge -> runs to maxIterations', () => {
  const r = solveCFR(RIVER, {
    iterations: 'adaptive',
    seed: 1,
    minIterations: 200,
    maxIterations: 300,
    checkEvery: 50,
    stableChecksRequired: 3,
    exploitabilityTargetBB: 1e-9
  });
  assert.equal(r.convergence.stopReason, 'max_iterations');
  assert.equal(r.convergence.converged, false);
  assert.equal(r.convergence.iterationsRun, 300);
});

test('no NaN or Infinity in convergence metrics', () => {
  const r = solveCFR(RIVER, { iterations: 'adaptive', seed: 1 });
  const c = r.convergence;
  const nums = [c.exploitabilityBB, c.strategyDelta, c.evDeltaBB];
  for (const n of nums) {
    if (n != null) {
      assert.ok(Number.isFinite(n), `not finite: ${n}`);
    }
  }
  for (const h of c.exploitabilityHistory) assert.ok(Number.isFinite(h.exploitabilityBB));
});