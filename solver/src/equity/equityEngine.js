import { evaluateHand, compareHands } from '../cards/handEvaluator.js';

// A single deal comparison. Returns 1 if hero wins, -1 if hero loses, 0 if tie.
export function compareBoards(heroHand, villainHand, board) {
  const hero = evaluateHand([...heroHand, ...board]);
  const villain = evaluateHand([...villainHand, ...board]);
  return compareHands(hero, villain);
}

export function accumulateResult(acc, result, weight = 1) {
  if (result > 0) acc.hero += weight;
  else if (result < 0) acc.villain += weight;
  else acc.tie += weight;
  acc.total += weight;
}

export function finalizeEquity(acc) {
  const total = acc.total || 1;
  return {
    equity: (acc.hero + acc.tie * 0.5) / total,
    winPct: acc.hero / total,
    tiePct: acc.tie / total,
    losePct: acc.villain / total,
    simulations: acc.total
  };
}