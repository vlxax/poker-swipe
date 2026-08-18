import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectDecision, detectInterestingSpots } from '../src/hand/interestingSpots.js';

function decision(overrides = {}) {
  return {
    street: 'flop',
    board: ['As', 'Kd', '2h'],
    evSeparationBB: 0.2,
    recommendedFrequency: 0.5,
    evLossBB: 0,
    actionTaken: { type: 'check' },
    legalActions: [
      { action: { type: 'check' }, evBB: 5 },
      { action: { type: 'bet', sizePot: 0.33 }, evBB: 5.2 },
      { action: { type: 'bet', sizePot: 0.75 }, evBB: 5.1 }
    ],
    ...overrides
  };
}

test('close-EV decision is interesting with difficulty > baseline', () => {
  const insp = inspectDecision(decision({ evSeparationBB: 0.01 }));
  assert.ok(insp);
  assert.ok(insp.reason.includes('close_ev'));
  assert.ok(insp.difficultyScore >= 0.3);
  assert.equal(insp.trainingPrompt.drill, 'spot_review');
});

test('significant EV loss is flagged as interesting', () => {
  const insp = inspectDecision(decision({ evLossBB: 0.6, severity: 'large' }));
  assert.ok(insp.reason.includes('significant_ev_loss'));
});

test('river bluff-catch is detected when call and fold are close', () => {
  const insp = inspectDecision(decision({
    street: 'river',
    actionTaken: { type: 'call' },
    actionEV: { call: 4.01, fold: 4.0 },
    evSeparationBB: 0.01
  }));
  assert.ok(insp && insp.reason.includes('river_bluff_catch'));
});

test('sizing-sensitive spot is flagged when bet size spreads EV', () => {
  const insp = inspectDecision(decision({
    legalActions: [
      { action: { type: 'check' }, evBB: 3 },
      { action: { type: 'bet', sizePot: 0.33 }, evBB: 3.1 },
      { action: { type: 'bet', sizePot: 1.5 }, evBB: 4.2 }
    ]
  }));
  assert.ok(insp && insp.reason.includes('sizing_sensitive'));
});

test('a clear, large-EV, single-line decision is not interesting', () => {
  const insp = inspectDecision(decision({
    evSeparationBB: 1.5,
    recommendedFrequency: 0.95,
    evLossBB: 0,
    legalActions: [{ action: { type: 'check' }, evBB: 6 }]
  }));
  assert.equal(insp, null);
});

test('detectInterestingSpots returns spots in order with street', () => {
  const spots = detectInterestingSpots([
    decision({ evSeparationBB: 0.01, street: 'flop' }),
    decision({ evSeparationBB: 0.5, street: 'turn', recommendedFrequency: 0.9,
      legalActions: [{ action: { type: 'check' }, evBB: 6 }] })
  ]);
  assert.equal(spots.length, 1);
  assert.equal(spots[0].street, 'flop');
  assert.ok(spots[0].reason.includes('close_ev'));
});