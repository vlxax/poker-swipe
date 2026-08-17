import { parseCard, assertNoDuplicates, assertValidBoard, RANKS, SUITS } from '../cards/cardParser.js';
import { assertValidRange } from '../ranges/rangeParser.js';
import { expandRange } from '../ranges/rangeExpander.js';
import { toWeightedDistribution } from '../ranges/rangeWeights.js';
import { monteCarlo, deriveSeed } from './monteCarlo.js';
import { exhaustive, estimateExhaustiveSize } from './exhaustive.js';
import { SolverError, assert } from '../api/errors.js';

const STREET_BOARD = { preflop: 0, flop: 3, turn: 4, river: 5 };

export function calculateEquity(input = {}) {
  const heroHand = (input.heroHand || []).map(parseCard).filter(Boolean);
  assert(heroHand.length === 2, 'INVALID_HAND', 'heroHand must contain exactly 2 valid cards');
  assertValidRange(input.villainRange, 'villainRange');

  const board = (input.board || []).map(parseCard).filter(Boolean);
  const street = String(input.street || (board.length === 0 ? 'preflop' : 'flop')).toLowerCase();
  const want = STREET_BOARD[street];
  if (want == null) throw new SolverError('INVALID_STREET', `unknown street: ${street}`);
  assert(board.length === want, 'INVALID_BOARD', `street ${street} requires ${want} board cards`);

  const deadCards = (input.deadCards || []).map(parseCard).filter(Boolean);
  assertNoDuplicates([
    ['heroHand', heroHand],
    ['board', board],
    ['deadCards', deadCards]
  ]);

  // expand villain range, blocked by board + dead (hero blocks his own cards automatically)
  const blocked = [...board, ...deadCards];
  const expanded = expandRange(input.villainRange, blocked);
  assert(expanded.comboCount > 0, 'INVALID_RANGE', 'villainRange has no remaining combos after blockers');

  const iterations = input.iterations || 50000;
  const exhaustiveLimit = input.exhaustiveLimit || 200000;
  const size = estimateExhaustiveSize(heroHand, expanded.combos, board);

  let result;
  let analysisMethod;
  if (size <= exhaustiveLimit) {
    result = exhaustive({ heroHand, villainCombos: expanded.combos, board, limit: exhaustiveLimit });
    analysisMethod = 'exact';
  } else {
    const distributions = toWeightedDistribution(input.villainRange, blocked);
    result = monteCarlo({
      heroHand,
      villainCombos: expanded.combos,
      distributions,
      board,
      iterations,
      seed: deriveSeed(input)
    });
    analysisMethod = 'monte_carlo';
  }

  return {
    equity: round(result.equity, 4),
    winPct: round(result.winPct, 4),
    tiePct: round(result.tiePct, 4),
    losePct: round(result.losePct, 4),
    simulations: result.simulations,
    analysisMethod,
    ...(result.exhaustiveCombinations != null ? { exhaustiveCombinations: result.exhaustiveCombinations } : {})
  };
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export { RANKS, SUITS };