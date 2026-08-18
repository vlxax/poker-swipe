import { test } from 'node:test';
import assert from 'node:assert/strict';
import PokerSwipeSolver from '../src/index.js';

const S = PokerSwipeSolver;

const INPUT = {
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
  iterations: 'adaptive',
  seed: 1
};

test('solver-mode analyzeDecision returns the full production shape', async () => {
  const r = await S.analyzeDecision(INPUT);
  assert.ok(!r.error, JSON.stringify(r.error));

  assert.equal(r.solverMode, true);
  assert.ok(['cfr', 'cfr_plus'].includes(r.analysisMethod));
  assert.ok(r.recommendedAction);
  assert.ok(typeof r.recommendedFrequency === 'number');

  // strategy + actionEV keyed by legal root action ids only.
  assert.ok(r.strategy && typeof r.strategy === 'object');
  assert.ok(r.actionEV && typeof r.actionEV === 'object');
  for (const id of Object.keys(r.strategy)) assert.ok(id in r.actionEV, `strategy key ${id} not in actionEV`);

  assert.ok(r.heroAction);
  assert.ok(r.heroActionFrequency != null);
  assert.ok(r.heroActionEVBB != null);
  assert.ok(r.bestActionEVBB != null);
  assert.ok(r.evLossBB != null && r.evLossBB >= -1e-6);

  assert.ok(r.exploitabilityBB >= 0);
  assert.ok(r.exploitabilityPerPlayerBB >= 0);

  assert.ok(r.convergence && 'converged' in r.convergence && 'iterationsRun' in r.convergence);
  assert.ok(r.convergence.stopReason);
  assert.ok(r.rangeEquilibration && 'stable' in r.rangeEquilibration);

  assert.ok(r.confidence && 'score' in r.confidence && 'level' in r.confidence);
  assert.ok(['high', 'medium', 'low'].includes(r.confidence.level));

  assert.ok(r.abstractions);
  assert.ok('treeAbstraction' in r.abstractions);
  assert.ok('betAbstraction' in r.abstractions);
  assert.ok('chanceMode' in r.abstractions);
  assert.ok('rangeAbstraction' in r.abstractions);

  assert.ok(r.explanation);
  assert.ok(typeof r.explanation.summary === 'string');
});

test('solver-mode strategy frequencies sum to 1', async () => {
  const r = await S.analyzeDecision(INPUT);
  assert.ok(!r.error, JSON.stringify(r.error));
  const total = Object.values(r.strategy).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `sum=${total}`);
});

test('only legal actions are returned', async () => {
  const r = await S.analyzeDecision(INPUT);
  assert.ok(!r.error, JSON.stringify(r.error));
  const legal = new Set(Object.keys(r.actionEV));
  for (const id of Object.keys(r.strategy)) {
    assert.ok(legal.has(id), `illegal action returned: ${id}`);
    assert.ok(/^(fold|check|call|bet_\d+|raise_\d+|all_in)$/.test(id), `unexpected id ${id}`);
  }
});

test('best action has near-zero EV loss and evLoss >= 0', async () => {
  const r = await S.analyzeDecision(INPUT);
  assert.ok(!r.error, JSON.stringify(r.error));
  const bestId = Object.keys(r.actionEV).reduce((a, b) => (r.actionEV[b] > r.actionEV[a] ? b : a));
  const bestEV = r.actionEV[bestId];
  assert.ok(Math.abs(bestEV - r.bestActionEVBB) < 1e-4);
  const loss = r.bestActionEVBB - bestEV;
  assert.ok(Math.abs(loss) < 1e-6);
});

test('solver mode computes mistake classification from EV loss', async () => {
  const r = await S.analyzeDecision({ ...INPUT, heroAction: { type: 'check' } });
  assert.ok(!r.error, JSON.stringify(r.error));
  assert.ok(r.calculation.mistakeSeverity != null);
  assert.ok(r.calculation.evLossBB != null);
  assert.ok(r.calculation.severity != null);
});

test('no NaN or Infinity in solver output numerics', async () => {
  const r = await S.analyzeDecision(INPUT);
  assert.ok(!r.error, JSON.stringify(r.error));
  const values = [
    r.recommendedFrequency, r.heroActionFrequency, r.heroActionEVBB,
    r.bestActionEVBB, r.evLossBB, r.exploitabilityBB,
    r.exploitabilityPerPlayerBB, r.confidence.score
  ];
  for (const v of values) {
    assert.ok(v == null || Number.isFinite(v), `not finite: ${v}`);
  }
  for (const id of Object.keys(r.actionEV)) assert.ok(Number.isFinite(r.actionEV[id]));
});