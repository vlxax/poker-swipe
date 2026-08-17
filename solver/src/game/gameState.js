import { parseCard, assertNoDuplicates, assertValidBoard } from '../cards/cardParser.js';
import { assertValidRange } from '../ranges/rangeParser.js';
import { normalizeStreet, boardLengthForStreet } from './street.js';
import { normalizePosition } from './positions.js';
import { normalizeAction } from './actionState.js';
import { SolverError, assert } from '../api/errors.js';

// Creates a canonical, validated game state. Not tied to any UI.
export function createGameState(input = {}) {
  const street = normalizeStreet(input.street);
  const board = (input.board || []).map(parseCard).filter(Boolean);
  assert(board.length === boardLengthForStreet(street), 'INVALID_BOARD', `street ${street} requires ${boardLengthForStreet(street)} board cards`);

  const heroHand = (input.heroHand || []).map(parseCard).filter(Boolean);
  if (heroHand.length !== 2) throw new SolverError('INVALID_HAND', 'heroHand must contain exactly 2 cards');
  if (street !== 'preflop') assertNoDuplicates([['heroHand', heroHand], ['board', board]]);

  if (input.villainRange != null) assertValidRange(input.villainRange, 'villainRange');

  const potBB = Number(input.potBB ?? input.pot ?? 0);
  if (!Number.isFinite(potBB) || potBB < 0) throw new SolverError('INVALID_POT', 'potBB must be non-negative');

  const effectiveStackBB = Number(input.effectiveStackBB ?? 100);
  if (!Number.isFinite(effectiveStackBB) || effectiveStackBB <= 0) throw new SolverError('INVALID_STACK', 'effectiveStackBB must be positive');

  const heroPosition = normalizePosition(input.heroPosition);
  const villainPosition = normalizePosition(input.villainPosition);

  const availableActions = (input.availableActions || []).map((a) => normalizeAction(a, potBB));
  if (!availableActions.length && street === 'preflop') {
    // allow empty; decisionAnalyzer will report NO_AVAILABLE_ACTIONS if needed
  }

  return {
    gameType: String(input.gameType || 'NLH').toUpperCase(),
    tableSize: Number(input.tableSize) || 6,
    heroPosition,
    villainPosition,
    effectiveStackBB,
    street,
    potBB,
    heroHand,
    board,
    villainRange: input.villainRange || null,
    availableActions,
    heroAction: input.heroAction ? normalizeAction(input.heroAction, potBB) : null,
    deadCards: (input.deadCards || []).map(parseCard).filter(Boolean)
  };
}