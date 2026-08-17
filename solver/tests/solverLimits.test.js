import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCFR } from '../src/cfr/cfrSolver.js';
import { SolverError, ERROR_CODES } from '../src/api/errors.js';

const INPUT = {
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

test('maxSolveMs stops the solve with stopReason time_limit', () => {
  const r = solveCFR(INPUT, { iterations: 200000, seed: 1, maxSolveMs: 1 });
  assert.equal(r.convergence.stopReason, 'time_limit');
  assert.equal(r.meta.stopReason, 'time_limit');
  assert.equal(r.convergence.converged, false);
  assert.ok(r.iterations < 200000);
});

test('an aborted signal throws a CANCELLED SolverError', () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () => solveCFR(INPUT, { iterations: 500, seed: 1, signal: controller.signal }),
    (err) => err instanceof SolverError && err.code === ERROR_CODES.CANCELLED
  );
});

test('a non-AbortSignal signal object is rejected as invalid config', () => {
  assert.throws(
    () => solveCFR(INPUT, { iterations: 100, signal: { aborted: 'yes' } }),
    (err) => err instanceof SolverError && err.code === ERROR_CODES.INVALID_CONFIG
  );
});

test('invalid adaptive config (maxIterations < minIterations) is rejected', () => {
  assert.throws(
    () => solveCFR(INPUT, { adaptive: true, minIterations: 1000, maxIterations: 100 }),
    (err) => err instanceof SolverError && err.code === ERROR_CODES.INVALID_CONFIG
  );
});

test('invalid checkEvery and stableChecksRequired are rejected', () => {
  assert.throws(
    () => solveCFR(INPUT, { adaptive: true, checkEvery: 0 }),
    (err) => err instanceof SolverError && err.code === ERROR_CODES.INVALID_CONFIG
  );
  assert.throws(
    () => solveCFR(INPUT, { adaptive: true, stableChecksRequired: -1 }),
    (err) => err instanceof SolverError && err.code === ERROR_CODES.INVALID_CONFIG
  );
});

test('adaptive solve respects maxIterations and never runs forever', () => {
  const r = solveCFR(INPUT, {
    adaptive: true,
    seed: 1,
    minIterations: 100,
    maxIterations: 400,
    checkEvery: 100,
    stableChecksRequired: 3
  });
  assert.ok(r.iterations <= 400);
  assert.ok(r.iterations >= 100);
  assert.ok(['converged', 'max_iterations'].includes(r.convergence.stopReason));
  assert.equal(r.adaptive, true);
});