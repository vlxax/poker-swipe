import { createDeck, removeCards } from '../cards/deck.js';
import { compareBoards, accumulateResult, finalizeEquity } from './equityEngine.js';

// Exact enumeration: every remaining board combination x every villain combo.
// Only feasible when the total number of (villain combos * runouts) is bounded.
export function exhaustive({
  heroHand,
  villainCombos,
  board = [],
  limit = 200000
}) {
  const hero = heroHand.slice();
  const known = [...hero, ...board];
  const deck = removeCards(createDeck(), known);
  const needed = 5 - board.length;
  const acc = { hero: 0, villain: 0, tie: 0, total: 0 };

  // enumerate runouts
  const runouts = [];
  const idx = [];
  const chooseRec = (start, count) => {
    if (idx.length === count) {
      runouts.push(idx.slice());
      return;
    }
    for (let i = start; i < deck.length; i++) {
      idx.push(i);
      chooseRec(i + 1, count);
      idx.pop();
    }
  };
  chooseRec(0, needed);

  for (const combo of villainCombos) {
    const vc = combo.cards;
    const blocked = new Set(vc);
    for (const runoutIdx of runouts) {
      if (runoutIdx.some((i) => blocked.has(deck[i]))) continue;
      const fullBoard = [...board, ...runoutIdx.map((i) => deck[i])];
      const res = compareBoards(hero, vc, fullBoard);
      accumulateResult(acc, res, combo.weight || 1);
    }
  }
  const equity = finalizeEquity(acc);
  const totalPossible = runouts.length * villainCombos.length;
  return { ...equity, exhaustiveCombinations: totalPossible };
}

export function estimateExhaustiveSize(heroHand, villainCombos, board = []) {
  const known = [...heroHand, ...board];
  const remaining = 52 - known.length;
  const needed = 5 - board.length;
  let runouts = 1;
  for (let i = 0; i < needed; i++) runouts *= remaining - i;
  for (let i = 1; i <= needed; i++) runouts /= i;
  return runouts * villainCombos.length;
}