import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCFR } from '../src/cfr/cfrSolver.js';

const BOARD = ['2c', '4d', '7h', '9s', 'Td'];

// The "all nuts" toy game: hero always holds the best hand (AA/KK), villain is
// capped (QQ/JJ). Hero never needs to bet to extract value beyond the pot share,
// and the game is exactly zero-sum. Equilibrium: heroEV = +5, villainEV = -5,
// exploitability -> 0 as iterations grow.
test('all-nuts toy game converges to the zero-sum value', () => {
  const r = solveCFR({
    street: 'river',
    board: BOARD,
    heroRange: { AA: 1, KK: 1 },
    villainRange: { QQ: 1, JJ: 1 },
    pot: 10,
    effectiveStackBB: 10,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { river: [0.5] }
  }, { iterations: 4000, seed: 1 });

  assert.ok(Math.abs(r.exploitability.heroEV - 5) < 0.1, `heroEV=${r.exploitability.heroEV}`);
  assert.ok(Math.abs(r.exploitability.villainEV + 5) < 0.1);
  assert.ok(Math.abs(r.exploitability.heroEV + r.exploitability.villainEV) < 1e-6);
  assert.ok(r.exploitability.exploitabilityPerPlayerBB < 0.01);
});

// The polarized bluff game: hero holds both value (AA) and air (AKs), villain
// holds bluff-catchers (QQ/JJ). Hero must bluff some air and villain must call
// some fraction, so the root strategy is genuinely mixed (not all-check).
test('polarized toy game has a mixed root strategy', () => {
  const r = solveCFR({
    street: 'river',
    board: BOARD,
    heroRange: { AA: 1, AKs: 1 },
    villainRange: { QQ: 1, JJ: 1 },
    pot: 10,
    effectiveStackBB: 30,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { river: [0.5] }
  }, { iterations: 4000, seed: 1 });

  const bet = r.aggregateStrategy.bet_50 || 0;
  const check = r.aggregateStrategy.check || 0;
  assert.ok(bet > 0.05 && bet < 0.99, `expected mixed betting, got ${bet}`);
  assert.ok(Math.abs(bet + check - 1) < 1e-6);
  // Both value and bluff drives an interesting, solvable game.
  assert.ok(r.exploitability.exploitabilityPerPlayerBB < 0.2);
});

// Determinism holds across a full multi-street solve too.
test('multi-street toy game is deterministic', () => {
  const cfg = {
    street: 'flop',
    board: ['2c', '4d', '7h'],
    heroRange: { AA: 1, KK: 1 },
    villainRange: { QQ: 1, JJ: 1 },
    pot: 10,
    effectiveStackBB: 10,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    maxChanceBranches: 1,
    betSizes: { flop: [0.5], turn: [0.5], river: [0.5] }
  };
  const a = solveCFR(cfg, { iterations: 100, seed: 3 });
  const b = solveCFR(cfg, { iterations: 100, seed: 3 });
  assert.equal(a.exploitability.exploitabilityBB, b.exploitability.exploitabilityBB);
  assert.deepEqual(a.aggregateStrategy, b.aggregateStrategy);
});