import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDecision } from '../src/analysis/decisionAnalyzer.js';
import { classifyMistake } from '../src/analysis/mistakeClassifier.js';
import { confidenceFor } from '../src/analysis/confidence.js';

test('analyzeDecision returns structured result', () => {
  const r = analyzeDecision({
    gameType: 'NLH',
    tableSize: 6,
    heroPosition: 'BB',
    villainPosition: 'BTN',
    effectiveStackBB: 25,
    street: 'flop',
    potBB: 8,
    heroHand: ['As', 'Jh'],
    board: ['Jd', '7c', '2s'],
    villainRange: { AA: 1, KK: 1, QQ: 1, AJo: 1 },
    availableActions: [
      { type: 'check' },
      { type: 'bet', sizePot: 0.33 },
      { type: 'bet', sizePot: 0.75 }
    ],
    heroAction: { type: 'bet', sizePot: 0.75 },
    iterations: 2000
  });
  assert.equal(r.version, 'solver-core');
  assert.ok(r.game.potBB === 8);
  assert.ok(Array.isArray(r.calculation.actions) && r.calculation.actions.length === 3);
  assert.ok(typeof r.calculation.bestAction.type === 'string');
  assert.ok(typeof r.calculation.heroEV === 'number');
  assert.ok(typeof r.calculation.evLossBB === 'number');
  assert.ok(['GOOD', 'INACCURACY', 'MISTAKE', 'BLUNDER'].includes(r.calculation.severity));
  assert.equal(r.calculation.analysisMethod, 'heuristic');
  assert.equal(r.meta.analysisMethod, 'heuristic');
  assert.ok(['high', 'medium', 'low'].includes(r.meta.confidence));
  // bestAction EV >= heroEV
  const bestEv = r.calculation.actions.find((a) => a.action.type === r.calculation.bestAction.type && a.action.sizePot === r.calculation.bestAction.sizePot).evBB;
  assert.ok(bestEv >= r.calculation.heroEV - 1e-6);
});

test('analyzeDecision picks best among check/bet', () => {
  const r = analyzeDecision({
    heroPosition: 'BTN',
    villainPosition: 'BB',
    effectiveStackBB: 100,
    street: 'flop',
    potBB: 10,
    heroHand: ['Ah', 'Kh'],
    board: ['Qs', '8d', '3c'],
    villainRange: { JJ: 1, TT: 1, 99: 1, QJo: 1 },
    availableActions: [
      { type: 'check' },
      { type: 'bet', sizePot: 0.33 },
      { type: 'bet', sizePot: 0.75 }
    ],
    iterations: 2000
  });
  const evs = r.calculation.actions.map((a) => a.evBB);
  const bestIdx = evs.indexOf(Math.max(...evs));
  assert.ok(bestIdx >= 0);
});

test('no available actions throws', () => {
  assert.throws(() => {
    analyzeDecision({
      heroPosition: 'BTN',
      villainPosition: 'BB',
      effectiveStackBB: 100,
      street: 'flop',
      potBB: 10,
      heroHand: ['Ah', 'Kh'],
      board: ['Qs', '8d', '3c'],
      villainRange: { JJ: 1 },
      availableActions: []
    });
  }, (e) => e.code === 'NO_AVAILABLE_ACTIONS');
});

test('classifyMistake thresholds', () => {
  assert.equal(classifyMistake({ evLossBB: 0.01 }).severity, 'GOOD');
  assert.equal(classifyMistake({ evLossBB: 0.1 }).severity, 'INACCURACY');
  assert.equal(classifyMistake({ evLossBB: 0.5 }).severity, 'MISTAKE');
  assert.equal(classifyMistake({ evLossBB: 2 }).severity, 'BLUNDER');
});

test('classifyMistake shortStack stricter', () => {
  assert.equal(classifyMistake({ evLossBB: 0.04, preset: 'shortStack' }).severity, 'INACCURACY');
  assert.equal(classifyMistake({ evLossBB: 0.04, preset: 'cash' }).severity, 'GOOD');
});

test('confidence labels', () => {
  assert.equal(confidenceFor({ analysisMethod: 'exact' }).label, 'high');
  assert.equal(confidenceFor({ analysisMethod: 'monte_carlo', simulations: 50000 }).label, 'high');
  assert.equal(confidenceFor({ analysisMethod: 'monte_carlo', simulations: 500, heuristic: true }).label, 'low');
});