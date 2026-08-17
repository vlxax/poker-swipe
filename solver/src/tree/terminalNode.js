import { makeNode, NODE_TYPES } from './node.js';

export const TERMINAL_TYPES = {
  FOLD: 'fold',
  SHOWDOWN: 'showdown',
  ALL_IN: 'all_in',
  EQUITY: 'equity'
};

// Create a TERMINAL node.
//   terminalType: 'fold' | 'showdown' | 'all_in' | 'equity'
//   equity: resolved via check-down runout enumeration (preflop flop transition).
//   winner: player who wins (null for ties / not-yet-resolved showdowns)
export function createTerminalNode({
  id, depth, street, board, pot, committed, stack, actionHistory, terminalType, winner = null, chanceAbstraction = null
}) {
  return makeNode({
    id, type: NODE_TYPES.TERMINAL, depth, street, board, pot, committed, stack,
    actionHistory, terminalType, winner, children: [], chanceAbstraction
  });
}

export function isTerminalNode(node) {
  return node && node.type === NODE_TYPES.TERMINAL;
}