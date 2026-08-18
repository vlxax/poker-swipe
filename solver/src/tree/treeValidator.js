import { SolverError, assert } from '../api/errors.js';
import { assertValidRange } from '../ranges/rangeParser.js';
import { STREET_ORDER } from './treeConfig.js';
import { normalizePosition } from '../game/positions.js';

const DEFAULT_BLINDS = { sb: 0.5, bb: 1 };

// Which player posts the big blind in a heads-up preflop spot. The non-BB player
// posts the small blind and acts first preflop. Returns { sbPos, bbPos, firstToAct }.
export function preflopBlindAssignment(heroPosition, villainPosition) {
  const hero = normalizePosition(heroPosition);
  const villain = normalizePosition(villainPosition);
  if (hero === 'BB') return { sbPos: villain, bbPos: 'hero', firstToAct: 'villain' };
  if (villain === 'BB') return { sbPos: 'hero', bbPos: 'villain', firstToAct: 'hero' };
  // Neither is the BB: treat villain as the BB defender by default.
  return { sbPos: 'hero', bbPos: 'villain', firstToAct: 'hero' };
}

// Validates the game-tree config object before building. Throws structured errors.
export function validateTreeConfig(input = {}) {
  const street = String(input.street || 'flop').toLowerCase();
  const isPreflop = street === 'preflop';
  assert(isPreflop || STREET_ORDER.includes(street), 'INVALID_STREET',
    `tree must start on preflop, flop, turn or river, got: ${input.street}`);

  const board = input.board || [];
  const expected = { preflop: 0, flop: 3, turn: 4, river: 5 }[street];
  assert(board.length === expected, 'INVALID_BOARD',
    `street ${street} requires ${expected} board cards, got ${board.length}`);

  assert(input.heroPosition != null && input.villainPosition != null,
    'MISSING_INPUT', 'heroPosition and villainPosition are required');

  const heroPosition = normalizePosition(input.heroPosition);
  const villainPosition = normalizePosition(input.villainPosition);
  assert(heroPosition && villainPosition, 'INVALID_CONFIG', 'positions could not be normalized');

  const effectiveStackBB = Number(input.effectiveStackBB);
  assert(Number.isFinite(effectiveStackBB) && effectiveStackBB > 0,
    'INVALID_STACK', 'effectiveStackBB must be a positive number');

  let potBB;
  let blinds = null;
  if (isPreflop) {
    // Preflop pot is the dead money = sb + bb. The zero-sum tree model requires
    // pot === committed.hero + committed.villain, so blinds define the pot.
    const b = input.blinds || {};
    const sb = Number.isFinite(Number(b.sb)) && Number(b.sb) > 0 ? Number(b.sb) : DEFAULT_BLINDS.sb;
    const bb = Number.isFinite(Number(b.bb)) && Number(b.bb) > 0 ? Number(b.bb) : DEFAULT_BLINDS.bb;
    assert(sb < bb, 'INVALID_BLINDS', 'sb must be less than bb');
    blinds = { sb, bb };
    potBB = sb + bb;
    const bbCommitted = Math.max(sb, bb);
    assert(effectiveStackBB >= bbCommitted, 'INVALID_STACK',
      'effectiveStackBB must cover the blinds');
  } else {
    potBB = Number(input.potBB ?? input.pot);
    assert(Number.isFinite(potBB) && potBB > 0, 'INVALID_POT', 'potBB must be a positive number');
  }

  // Optional starting betting state for postflop roots. This lets a spot begin
  // with one player facing an outstanding bet (e.g. Hero facing a villain bet
  // mid-hand) rather than always starting from an equal pot split. The invariant
  // pot === committed.hero + committed.villain is preserved so the CFR payoff
  // math is unchanged. When absent the root starts with an equal split.
  let startingCommitted = null;
  if (!isPreflop && input.startingCommitted != null) {
    const sc = input.startingCommitted;
    const hero = Number(sc.hero);
    const villain = Number(sc.villain);
    assert(Number.isFinite(hero) && hero >= 0, 'INVALID_CONFIG',
      'startingCommitted.hero must be a non-negative number');
    assert(Number.isFinite(villain) && villain >= 0, 'INVALID_CONFIG',
      'startingCommitted.villain must be a non-negative number');
    assert(Math.abs(hero + villain - potBB) < 1e-6, 'INVALID_CONFIG',
      'startingCommitted must sum to potBB');
    assert(effectiveStackBB >= hero && effectiveStackBB >= villain, 'INVALID_CONFIG',
      'effectiveStackBB must cover startingCommitted');
    startingCommitted = { hero, villain };
  }

  assert(input.heroRange != null, 'MISSING_INPUT', 'heroRange is required');
  assert(input.villainRange != null, 'MISSING_INPUT', 'villainRange is required');
  assertValidRange(input.heroRange, 'heroRange');
  assertValidRange(input.villainRange, 'villainRange');

  return {
    street,
    board,
    potBB,
    effectiveStackBB,
    heroRange: input.heroRange,
    villainRange: input.villainRange,
    heroPosition,
    villainPosition,
    blinds,
    startingCommitted
  };
}