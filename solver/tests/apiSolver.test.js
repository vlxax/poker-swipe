import { test } from 'node:test';
import assert from 'node:assert/strict';
import PokerSwipeSolver from '../src/index.js';

const S = PokerSwipeSolver;

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

test('buildTree returns game + tree summary + root actions', async () => {
  const r = await S.buildTree(INPUT);
  assert.ok(!r.error, JSON.stringify(r.error));
  assert.equal(r.game.street, 'river');
  assert.equal(r.tree.nodeCount > 0, true);
  assert.equal(r.root.type, 'ACTION');
  assert.ok(Array.isArray(r.root.actions));
  assert.ok(r.root.actions.some((a) => a.type === 'check'));
});

test('solveCFR returns the full strategic result shape', async () => {
  const r = await S.solveCFR(INPUT, { iterations: 50, seed: 1 });
  assert.ok(!r.error, JSON.stringify(r.error));
  assert.equal(r.algorithm, 'cfr');
  assert.equal(r.iterations, 50);
  assert.ok(r.aggregateStrategy && typeof r.aggregateStrategy === 'object');
  assert.ok(r.actionEV && typeof r.actionEV === 'object');
  assert.ok(r.exploitability.exploitabilityBB >= 0);
  assert.ok(r.convergence.status);
  assert.equal(r.meta.analysisMethod, 'cfr');
  assert.equal(r.meta.exactGame, true);
  assert.ok(r._trainer && r._tree);
});

test('solve dispatcher handles cfr_plus and rejects unknown algorithms', async () => {
  const plus = await S.solve(INPUT, { iterations: 50, algorithm: 'cfr_plus' });
  assert.ok(!plus.error, JSON.stringify(plus.error));
  assert.equal(plus.algorithm, 'cfr_plus');

  const bad = await S.solve(INPUT, { iterations: 50, algorithm: 'mccfr' });
  assert.ok(bad.error);
  assert.equal(bad.error.code, 'INVALID_CONFIG');
});

test('getStrategy and getActionEV reuse a prior solveCFR result', async () => {
  const r = await S.solveCFR(INPUT, { iterations: 50, seed: 2 });
  assert.ok(!r.error, JSON.stringify(r.error));

  const strat = await S.getStrategy(r);
  assert.ok(!strat.error, JSON.stringify(strat.error));
  assert.deepEqual(strat.rootStrategy, r.rootStrategy);
  assert.deepEqual(strat.aggregateStrategy, r.aggregateStrategy);

  const ev = await S.getActionEV(r);
  assert.ok(!ev.error, JSON.stringify(ev.error));
  assert.deepEqual(ev.actionEV, r.actionEV);
  assert.equal(ev.bestAction, r.bestAction);
});

test('getStrategy and getActionEV can re-solve from raw input', async () => {
  const strat = await S.getStrategy(INPUT, { iterations: 50, seed: 2 });
  assert.ok(!strat.error, JSON.stringify(strat.error));
  assert.ok(strat.aggregateStrategy && Object.keys(strat.aggregateStrategy).length > 0);

  const ev = await S.getActionEV(INPUT, { iterations: 50, seed: 2 });
  assert.ok(!ev.error, JSON.stringify(ev.error));
  assert.ok(ev.actionEV && Object.keys(ev.actionEV).length > 0);
});

test('solveCFR validates required inputs', async () => {
  const r = await S.solveCFR({ villainRange: { QQ: 1 } });
  assert.ok(r.error);
  assert.equal(r.error.code, 'MISSING_INPUT');
});

test('decisionAnalyzer solver mode returns a decision with solver EVs', async () => {
  const r = await S.analyzeDecision({
    mode: 'solver',
    street: 'river',
    board: ['2c', '4d', '7h', '9s', 'Td'],
    heroRange: { AA: 1, KK: 1 },
    villainRange: { QQ: 1, JJ: 1 },
    pot: 10,
    effectiveStackBB: 10,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { river: [0.5] },
    heroAction: { type: 'check' },
    iterations: 50,
    seed: 1
  });
  assert.ok(!r.error, JSON.stringify(r.error));
  assert.equal(r.calculation.analysisMethod, 'cfr');
  assert.ok(Array.isArray(r.calculation.actions) && r.calculation.actions.length > 0);
  assert.ok(r.calculation.bestAction);
  assert.ok(r.calculation.heroEV != null);
  assert.ok(r.calculation.evLossBB != null);
  assert.ok(r.meta.exploitabilityBB >= 0);
  assert.ok(r.meta.durationMs != null);
});

test('decisionAnalyzer solver mode validates ranges', async () => {
  const r = await S.analyzeDecision({ mode: 'solver', villainRange: { QQ: 1 } });
  assert.ok(r.error);
  assert.equal(r.error.code, 'MISSING_INPUT');
});