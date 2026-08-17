import { createGameState } from '../game/gameState.js';
import { parseCard } from '../cards/cardParser.js';
import { assertValidRange } from '../ranges/rangeParser.js';
import { SolverError } from './errors.js';

// Validate inputs for each public API method and return a normalized input object.
export function validateEquityInput(input = {}) {
  if (!input.heroHand) throw new SolverError('MISSING_INPUT', 'heroHand is required');
  if (!input.villainRange) throw new SolverError('MISSING_INPUT', 'villainRange is required');
  // full validation happens in calculateEquity; here just shape checks
  return input;
}

export function validateAnalyzeInput(input = {}) {
  if (!input.villainRange) throw new SolverError('MISSING_INPUT', 'villainRange is required');
  if (!Array.isArray(input.availableActions) || input.availableActions.length === 0) {
    throw new SolverError('NO_AVAILABLE_ACTIONS', 'availableActions must be a non-empty array');
  }
  return input;
}

export function validateHandInput(input = {}) {
  const cards = (input.cards || input.hand || []).map(parseCard).filter(Boolean);
  if (cards.length < 5) throw new SolverError('INVALID_HAND', 'need at least 5 cards to evaluate');
  return { cards };
}

export function validateRangeInput(input = {}) {
  assertValidRange(input.range || input.villainRange, 'range');
  return input;
}