import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHandExplanation } from '../src/hand/handExplanation.js';

const base = {
  street: 'flop',
  potBB: 10,
  spr: 5,
  actionTaken: { type: 'bet', sizePot: 0.5 },
  recommendedAction: { type: 'bet', sizePot: 0.75 },
  recommendedFrequency: 0.8,
  evLossBB: 0.4,
  evSeparationBB: 0.01,
  legalActions: [
    { action: { type: 'check' }, evBB: 5 },
    { action: { type: 'bet', sizePot: 0.33 }, evBB: 5.1 },
    { action: { type: 'bet', sizePot: 0.75 }, evBB: 5.4 }
  ],
  confidence: { level: 'medium', score: 0.6 },
  convergence: { converged: true, iterationsRun: 500, stopReason: 'converged' },
  exploitabilityBB: 0.01,
  chanceBranches: 1,
  analysisMethod: 'cfr',
  mistakeSeverity: 'notable'
};

test('explanation describes the mistake and lost EV', () => {
  const e = buildHandExplanation(base);
  assert.ok(e.summary.includes('costs about'));
  assert.ok(e.why.some((s) => s.includes('loses')));
  assert.equal(typeof e.reliability, 'string');
});

test('explanation states when the solve did not converge', () => {
  const e = buildHandExplanation({ ...base, convergence: { converged: false, stopReason: 'max_iterations' } });
  assert.ok(e.reliability.includes('did not converge'));
});

test('explanation flags a coarse chance abstraction', () => {
  const e = buildHandExplanation({ ...base, chanceBranches: 1 });
  assert.ok(e.reliability.includes('Coarse chance abstraction'));
});

test('explanation for a matching line says it is recommended', () => {
  const e = buildHandExplanation({
    ...base,
    actionTaken: { type: 'bet', sizePot: 0.75 },
    recommendedAction: { type: 'bet', sizePot: 0.75 },
    evLossBB: 0
  });
  assert.ok(e.summary.includes('recommended line'));
});

test('river bluff-catch wording appears for river call decisions', () => {
  const e = buildHandExplanation({
    ...base,
    street: 'river',
    actionTaken: { type: 'call' },
    recommendedAction: { type: 'fold' },
    evLossBB: 0.2
  });
  assert.ok(e.why.some((s) => s.includes('bluff-catch')));
});

test('every explanation carries a summary, why list and key concept', () => {
  const e = buildHandExplanation(base);
  assert.equal(typeof e.summary, 'string');
  assert.ok(Array.isArray(e.why));
  assert.equal(typeof e.keyConcept, 'string');
  assert.ok(Array.isArray(e.concepts));
});