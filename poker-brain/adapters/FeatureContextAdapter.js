/**
 * Feature Context Adapters - V2.1 Context Recovery
 *
 * Converts feature-specific input to canonical DecisionContext.
 * Recovers ALL available context without loss.
 * Marks unavailable fields explicitly.
 *
 * Design: Adapters are pure functions. No side effects.
 * They document what they DON'T know via unknownFields.
 */

import { DecisionContext } from '../DecisionContext.js';

/**
 * Parse card strings safely
 */
function parseCards(input) {
  if (Array.isArray(input)) return input.filter(c => typeof c === 'string' && c.length === 2);
  if (typeof input === 'string') {
    const cards = [];
    let i = 0;
    const RANKS = 'AKQJT98765432';
    const SUITS = 'shdc';
    while (i < input.length) {
      if (i + 1 < input.length && RANKS.includes(input[i].toUpperCase()) && SUITS.includes(input[i + 1].toLowerCase())) {
        cards.push(input[i].toUpperCase() + input[i + 1].toLowerCase());
        i += 2;
      } else {
        i++;
      }
    }
    return cards;
  }
  return [];
}

/**
 * Normalize position string
 */
function normalizePosition(pos) {
  if (!pos) return null;
  const s = String(pos).toUpperCase().trim();
  const positions = ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  if (positions.includes(s)) return s;
  // Try to match partial
  for (const p of positions) {
    if (p.includes(s) || s.includes(p)) return p;
  }
  return null;
}

/**
 * SWIPE Feature Adapter
 * Input: {scenario, action, sizePct}
 * Recovers: full spot context + action history
 */
export function adapterSwipe(input = {}, options = {}) {
  const { scenario = {}, action, sizePct } = input;

  const heroCards = parseCards(scenario.hero || scenario.heroCards || []);
  const board = parseCards(scenario.board || []);
  const heroPos = normalizePosition(scenario.pos || scenario.heroPosition);
  const villainPos = normalizePosition(scenario.villainPos || scenario.villainPosition);
  const stack = scenario.stack || scenario.effectiveStackBb;

  const missing = [];
  if (!heroCards.length) missing.push('heroCards');
  if (!heroPos) missing.push('heroPosition');
  if (!stack) missing.push('stack');

  const street = String(scenario.street || 'PREFLOP').toUpperCase();
  const domain = street === 'PREFLOP' ? 'preflop' : street === 'FLOP' ? 'flop' : street === 'TURN' ? 'turn' : 'river';

  return new DecisionContext({
    contextId: `swipe-${scenario.id || scenario.spotId}`,
    featureSource: 'swipe',
    domain,

    heroCards,
    board,
    street,
    heroPosition: heroPos,
    villainPosition: villainPos,
    effectiveStack: stack,
    potBB: scenario.pot,

    contextQuality: missing.length === 0 ? 'FULL' : 'PARTIAL',
    unknownFields: missing,
    collapsedFields: villainPos ? [] : ['villainPosition'],

    sourceConstraints: {
      stackSpecific: false, // SWIPE doesn't use stack bucket in legacy
      actionTreeComplete: true, // action is current decision
      boardKnown: board.length > 0,
      villainKnown: !!villainPos
    }
  });
}

/**
 * SIZING Feature Adapter
 * Input: {spot, action, sizePct, streetInfo}
 * Recovers: full game state for sizing decision
 */
export function adapterSizing(input = {}, options = {}) {
  const { spot = {}, action, sizePct } = input;

  const heroCards = parseCards(spot.hero || spot.heroCards || []);
  const board = parseCards(spot.board || []);
  const heroPos = normalizePosition(spot.pos || spot.heroPosition);
  const villainPos = normalizePosition(spot.villainPos || spot.villainPosition);
  const stack = spot.stack || spot.effectiveStackBb;
  const pot = spot.pot;

  const missing = [];
  if (!heroCards.length) missing.push('heroCards');
  if (!heroPos) missing.push('heroPosition');
  if (!stack) missing.push('stack');
  if (board.length === 0) missing.push('board');

  const street = String(spot.street || 'FLOP').toUpperCase();
  const domain = street === 'PREFLOP' ? 'preflop' : street === 'FLOP' ? 'flop' : street === 'TURN' ? 'turn' : 'river';

  // Sizing context requires action history (facing bet size, etc)
  const facingBetInfo = options.facingBetInfo || {};

  return new DecisionContext({
    contextId: `sizing-${spot.id || spot.spotId}`,
    featureSource: 'sizing',
    domain,

    heroCards,
    board,
    street,
    heroPosition: heroPos,
    villainPosition: villainPos,
    effectiveStack: stack,
    potBB: pot,
    facingBet: facingBetInfo.amount || null,
    facingBetPercent: facingBetInfo.percent || null,

    contextQuality: missing.length === 0 ? 'FULL' : 'PARTIAL',
    unknownFields: missing,
    collapsedFields: villainPos ? [] : ['villainPosition'],

    sourceConstraints: {
      stackSpecific: false,
      actionTreeComplete: true, // we know we're facing a bet
      boardKnown: board.length > 0,
      villainKnown: !!villainPos
    }
  });
}

/**
 * DAILY Drill Adapter
 * Input: {drill, chosenActionId, solution}
 * Recovers: full scenario + action history from drill
 */
export function adapterDaily(input = {}, options = {}) {
  const { drill = {}, chosenActionId, solution = {} } = input;
  const scenario = drill.scenario || {};

  const heroCards = parseCards(scenario.hero || scenario.heroCards || drill.hero || []);
  const board = parseCards(scenario.board || drill.board || []);
  const heroPos = normalizePosition(scenario.pos || scenario.heroPosition || drill.pos);
  const villainPos = normalizePosition(scenario.villainPos || scenario.villainPosition);
  const stack = scenario.stack || scenario.effectiveStackBb || drill.stack;
  const pot = scenario.pot || drill.pot;

  const missing = [];
  if (!heroCards.length) missing.push('heroCards');
  if (!heroPos) missing.push('heroPosition');
  if (!stack) missing.push('stack');

  const street = String(scenario.street || drill.street || 'PREFLOP').toUpperCase();
  const domain = street === 'PREFLOP' ? 'preflop' : street === 'FLOP' ? 'flop' : street === 'TURN' ? 'turn' : 'river';

  // Daily may have action history in solution or drill
  const actionHistory = [];
  if (drill.actions && Array.isArray(drill.actions)) {
    for (const action of drill.actions) {
      actionHistory.push({
        street: action.street,
        actor: action.actor || 'UNKNOWN',
        action: action.action,
        size: action.size,
        allIn: action.allIn || false
      });
    }
  }

  return new DecisionContext({
    contextId: `daily-${drill.id || drill.spotId}`,
    featureSource: 'daily',
    domain,

    heroCards,
    board,
    street,
    heroPosition: heroPos,
    villainPosition: villainPos,
    effectiveStack: stack,
    potBB: pot,
    actionHistory,

    contextQuality: missing.length === 0 ? 'FULL' : 'PARTIAL',
    unknownFields: missing,
    collapsedFields: villainPos ? [] : ['villainPosition'],

    sourceConstraints: {
      stackSpecific: drill.stackSpecific !== false,
      actionTreeComplete: actionHistory.length > 0,
      boardKnown: board.length > 0,
      villainKnown: !!villainPos
    },

    preset: drill.preset || options.preset || 'mtt'
  });
}

/**
 * MY HANDS Adapter
 * Input: {hand, actionDecision}
 * Recovers: full imported hand history + action analysis
 */
export function adapterMyHands(input = {}, options = {}) {
  const { hand = {}, actionDecision } = input;

  const heroCards = parseCards(hand.hero || hand.heroCards || []);
  const board = parseCards(hand.board || []);
  const heroPos = normalizePosition(hand.heroPosition || hand.seat);
  const villainPos = normalizePosition(hand.villainPosition || hand.opponentSeat);
  const stack = hand.stack || hand.effectiveStack;
  const pot = hand.pot;

  const missing = [];
  if (!heroCards.length) missing.push('heroCards');
  if (!heroPos) missing.push('heroPosition');
  if (!stack) missing.push('stack');

  const street = String(hand.street || 'PREFLOP').toUpperCase();
  const domain = street === 'PREFLOP' ? 'preflop' : street === 'FLOP' ? 'flop' : street === 'TURN' ? 'turn' : 'river';

  // My Hands typically has full action history
  const actionHistory = (hand.actionHistory || []).map(a => ({
    street: a.street,
    actor: a.actor,
    action: a.action,
    size: a.size,
    allIn: a.allIn || false,
    position: a.position
  }));

  return new DecisionContext({
    contextId: `myhands-${hand.id || hand.handId}`,
    featureSource: 'myhands',
    domain,

    heroCards,
    board,
    street,
    heroPosition: heroPos,
    villainPosition: villainPos,
    effectiveStack: stack,
    potBB: pot,
    actionHistory,

    contextQuality: actionHistory.length > 0 ? 'FULL' : 'PARTIAL',
    unknownFields: missing,
    collapsedFields: [],

    sourceConstraints: {
      stackSpecific: true, // imported hands have exact stack
      actionTreeComplete: true, // full action history
      boardKnown: true,
      villainKnown: true
    }
  });
}

/**
 * RANGES Cell Adapter
 * Input: {hand, position, stack, ...}
 * Recovers: hypothetical context for range analysis
 */
export function adapterRanges(input = {}, options = {}) {
  const { hand, position, stack, board, street } = input;

  const heroCards = parseCards(hand || []);
  const boardCards = parseCards(board || []);
  const heroPos = normalizePosition(position);

  const missing = [];
  if (!heroCards.length) missing.push('heroCards');
  if (!heroPos) missing.push('heroPosition');
  if (!stack) missing.push('stack');

  const domainStr = String(street || (boardCards.length === 0 ? 'PREFLOP' : boardCards.length === 3 ? 'FLOP' : 'TURN')).toUpperCase();
  const domain = domainStr === 'PREFLOP' ? 'preflop' : domainStr === 'FLOP' ? 'flop' : domainStr === 'TURN' ? 'turn' : 'river';

  return new DecisionContext({
    contextId: `ranges-${hand}-${position}-${stack}`,
    featureSource: 'ranges',
    domain,

    heroCards,
    board: boardCards,
    street: domainStr,
    heroPosition: heroPos,
    effectiveStack: stack,

    // Ranges are hypothetical analysis, not concrete decisions
    contextQuality: missing.length === 0 ? 'FULL' : 'PARTIAL',
    unknownFields: missing,
    collapsedFields: ['villainPosition', 'potBB', 'actionHistory'],

    sourceConstraints: {
      stackSpecific: true,
      actionTreeComplete: false, // no action history for range matrix
      boardKnown: boardCards.length > 0,
      villainKnown: false // ranges don't know specific villain
    }
  });
}

/**
 * Factory to route inputs to correct adapter
 */
export function adapterFromFeature(featureSource, input = {}, options = {}) {
  const source = String(featureSource || '').toLowerCase();

  switch (source) {
    case 'swipe': return adapterSwipe(input, options);
    case 'sizing': return adapterSizing(input, options);
    case 'daily': return adapterDaily(input, options);
    case 'myhands': return adapterMyHands(input, options);
    case 'ranges': return adapterRanges(input, options);
    default:
      return new DecisionContext({
        contextQuality: 'UNKNOWN',
        unknownFields: ['featureSource']
      });
  }
}

export default {
  adapterSwipe,
  adapterSizing,
  adapterDaily,
  adapterMyHands,
  adapterRanges,
  adapterFromFeature
};
