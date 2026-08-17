import { makeNode, NODE_TYPES } from './node.js';

// Create an ACTION node where `playerToAct` chooses among `actions`.
export function createActionNode({
  id, depth, street, board, playerToAct, pot, committed, stack, toCall,
  raisesThisStreet, lastAggressorAllIn, actionHistory, actions
}) {
  return makeNode({
    id, type: NODE_TYPES.ACTION, depth, street, board, playerToAct, pot, committed,
    stack, toCall, raisesThisStreet, lastAggressorAllIn, actionHistory, actions, children: []
  });
}

export function isActionNode(node) {
  return node && node.type === NODE_TYPES.ACTION;
}