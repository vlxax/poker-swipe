import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solverConfidence } from '../src/analysis/confidence.js';

test('solverConfidence never reports high when the solver did not converge', () => {
  for (const stopReason of ['max_iterations', 'time_limit']) {
    const r = solverConfidence({ converged: false, stopReason });
    assert.notEqual(r.level, 'high');
    assert.ok(r.score < 0.8);
    assert.ok(r.reasons.some((x) => x.includes('не сошлось')));
  }
});

test('a converged solve with tight exploitability can reach high', () => {
  const r = solverConfidence({
    converged: true,
    stopReason: 'converged',
    exploitabilityBB: 0.004,
    iterations: 2000,
    minIterations: 200,
    chanceAbstraction: Infinity,
    betAbstraction: 0.5,
    rangeAbstraction: 0,
    evSeparationBB: 0.5
  });
  assert.equal(r.level, 'high');
  assert.ok(r.score >= 0.8);
});

test('coarse chance abstraction caps confidence below high', () => {
  const coarse = solverConfidence({
    converged: true,
    stopReason: 'converged',
    exploitabilityBB: 0.004,
    iterations: 2000,
    minIterations: 200,
    chanceAbstraction: 1,
    betAbstraction: 0.5,
    rangeAbstraction: 0,
    evSeparationBB: 0.5
  });
  assert.notEqual(coarse.level, 'high');
  assert.ok(coarse.score < 0.8);
});

test('near-tied top-action EVs reduce confidence', () => {
  const tied = solverConfidence({
    converged: true,
    stopReason: 'converged',
    exploitabilityBB: 0.004,
    iterations: 2000,
    minIterations: 200,
    chanceAbstraction: Infinity,
    betAbstraction: 0.5,
    rangeAbstraction: 0,
    evSeparationBB: 0.001
  });
  const clear = solverConfidence({
    converged: true,
    stopReason: 'converged',
    exploitabilityBB: 0.004,
    iterations: 2000,
    minIterations: 200,
    chanceAbstraction: Infinity,
    betAbstraction: 0.5,
    rangeAbstraction: 0,
    evSeparationBB: 0.5
  });
  assert.ok(tied.score < clear.score);
});

test('range abstraction and large bet sizes penalize the score', () => {
  const a = solverConfidence({ converged: true, rangeAbstraction: 0.3, betAbstraction: 0.33 });
  const b = solverConfidence({ converged: true, rangeAbstraction: 0, betAbstraction: 0.5 });
  assert.ok(a.score < b.score);
});

test('score is clamped into the valid range', () => {
  const worst = solverConfidence({
    converged: false,
    stopReason: 'time_limit',
    exploitabilityBB: 2,
    iterations: 10,
    minIterations: 200,
    chanceAbstraction: 1,
    betAbstraction: 0.25,
    rangeAbstraction: 1,
    evSeparationBB: 0
  });
  assert.ok(worst.score >= 0.05 && worst.score <= 0.97);
  assert.ok(Number.isFinite(worst.score));
  for (const level of [worst.level, solverConfidence({}).level]) {
    assert.ok(['high', 'medium', 'low'].includes(level));
  }
});