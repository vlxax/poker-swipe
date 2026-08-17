import { SolverError, assert } from '../api/errors.js';
import { assertValidRange } from '../ranges/rangeParser.js';
import { STREET_ORDER } from './treeConfig.js';

// Validates the game-tree config object before building. Throws structured errors.
export function validateTreeConfig(input = {}) {
  const street = String(input.street || 'flop').toLowerCase();
  assert(STREET_ORDER.includes(street), 'INVALID_STREET', `tree must start on flop, turn or river, got: ${input.street}`);

  const board = input.board || [];
  const expected = { flop: 3, turn: 4, river: 5 }[street];
  assert(board.length === expected, 'INVALID_BOARD', `street ${street} requires ${expected} board cards, got ${board.length}`);

  const potBB = Number(input.potBB ?? input.pot);
  assert(Number.isFinite(potBB) && potBB > 0, 'INVALID_POT', 'potBB must be a positive number');

  const effectiveStackBB = Number(input.effectiveStackBB);
  assert(Number.isFinite(effectiveStackBB) && effectiveStackBB > 0, 'INVALID_STACK', 'effectiveStackBB must be a positive number');

  assert(input.heroRange != null, 'MISSING_INPUT', 'heroRange is required');
  assert(input.villainRange != null, 'MISSING_INPUT', 'villainRange is required');
  assertValidRange(input.heroRange, 'heroRange');
  assertValidRange(input.villainRange, 'villainRange');

  assert(input.heroPosition != null && input.villainPosition != null,
    'MISSING_INPUT', 'heroPosition and villainPosition are required');

  return {
    street,
    board,
    potBB,
    effectiveStackBB,
    heroRange: input.heroRange,
    villainRange: input.villainRange,
    heroPosition: String(input.heroPosition).toUpperCase(),
    villainPosition: String(input.villainPosition).toUpperCase()
  };
}