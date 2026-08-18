import { makeNode, NODE_TYPES } from './node.js';
import { deckAfter } from '../cards/deck.js';

// Create a CHANCE node that deals the next board card. `chanceCards` lists the
// dealt card for each child (aligned with `children`). Cards that collide with a
// player's private hand are filtered during CFR traversal, not during building.
export function createChanceNode({
  id, depth, street, board, pot, committed, stack, actionHistory, chanceCards = [], children = []
}) {
  const node = makeNode({
    id, type: NODE_TYPES.CHANCE, depth, street, board, pot, committed, stack,
    actionHistory, chanceCards, children
  });
  return node;
}

// The pool of cards still available given the board (ignores private hands here;
// hand-based filtering happens in the traversal).
export function nextCardPool(board) {
  return deckAfter(board);
}

export function isChanceNode(node) {
  return node && node.type === NODE_TYPES.CHANCE;
}