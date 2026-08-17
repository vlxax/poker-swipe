import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSolverExplanation } from '../src/explanations/explanationBuilder.js';

function collectStrings(obj, acc = []) {
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') acc.push(v);
    else if (Array.isArray(v)) for (const e of v) collectStrings({ _: e }, acc);
    else if (v && typeof v === 'object') collectStrings(v, acc);
  }
  return acc;
}

test('buildSolverExplanation returns the full production shape', () => {
  const r = buildSolverExplanation({
    best: { type: 'bet', sizePot: 0.5 },
    bestFrequency: 0.8,
    heroAction: { type: 'check' },
    evLossBB: 0.4,
    convergence: { converged: true, iterationsRun: 1200, stopReason: 'converged' },
    exploitabilityBB: 0.01,
    chanceBranches: 4,
    confidence: { level: 'high', score: 0.91 }
  });
  assert.ok(typeof r.summary === 'string' && r.summary.length > 0);
  assert.ok(Array.isArray(r.why) && r.why.length > 0);
  assert.ok(typeof r.alternative === 'string');
  assert.ok(typeof r.reliability === 'string');
  assert.ok('keyConcept' in r && 'recommendedPractice' in r);
});

test('converged solves mention that the solve converged', () => {
  const r = buildSolverExplanation({
    best: { type: 'bet', sizePot: 0.5 },
    bestFrequency: 0.8,
    heroAction: { type: 'check' },
    evLossBB: 0.4,
    convergence: { converged: true, iterationsRun: 1200, stopReason: 'converged' },
    exploitabilityBB: 0.01,
    chanceBranches: 4,
    confidence: { level: 'high', score: 0.91 }
  });
  const text = [r.summary, ...r.why, r.alternative, r.reliability].join(' ');
  assert.match(text, /сошлось/);
  assert.match(text, /1200/);
});

test('non-converged solves explicitly say they did not converge', () => {
  const r = buildSolverExplanation({
    best: { type: 'bet', sizePot: 0.5 },
    heroAction: null,
    convergence: { converged: false, stopReason: 'time_limit' },
    exploitabilityBB: 0.3
  });
  const text = [r.summary, ...r.why, r.alternative, r.reliability].join(' ');
  assert.match(text, /не сошлось/);
  assert.match(text, /time_limit/);
});

test('explanation never claims exact GTO or perfect play', () => {
  const cases = [
    { best: { type: 'bet', sizePot: 0.5 }, heroAction: { type: 'check' }, evLossBB: 0.4, convergence: { converged: true } },
    { best: { type: 'check' }, heroAction: { type: 'check' }, evLossBB: 0.0, convergence: { converged: true } },
    { best: { type: 'call' }, heroAction: { type: 'fold' }, evLossBB: 1.2, convergence: { converged: true } },
    { best: { type: 'bet', sizePot: 0.5 }, heroAction: null, convergence: { converged: false } }
  ];
  for (const c of cases) {
    const r = buildSolverExplanation(c);
    const text = collectStrings(r).join(' ').toLowerCase();
    assert.ok(!text.includes('exact gto'), `found forbidden wording in: ${text}`);
    assert.ok(!text.includes('perfect play'), `found forbidden wording in: ${text}`);
    assert.ok(!text.includes('optimal line for all'), `found forbidden wording in: ${text}`);
  }
});

test('mixed strategy is described for a non-best but viable hero action', () => {
  const r = buildSolverExplanation({
    best: { type: 'bet', sizePot: 0.5 },
    bestFrequency: 0.8,
    heroAction: { type: 'bet', sizePot: 0.5 },
    evLossBB: 0.0,
    convergence: { converged: true, iterationsRun: 1000, stopReason: 'converged' },
    exploitabilityBB: 0.01,
    confidence: { level: 'medium', score: 0.7 }
  });
  const text = [r.summary, ...r.why, r.alternative, r.reliability].join(' ');
  assert.match(text, /уверенность/i);
  assert.ok(text.includes('0.01'));
});

test('best action is still reported when heroAction is absent', () => {
  const r = buildSolverExplanation({
    best: { type: 'check' },
    bestFrequency: 0.5,
    heroAction: null,
    convergence: { converged: true, iterationsRun: 900, stopReason: 'converged' }
  });
  assert.ok(r.summary.includes('Solver предпочитает'));
  assert.ok(r.why.length > 0);
});