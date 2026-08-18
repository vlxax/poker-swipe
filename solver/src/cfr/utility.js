import { evaluateCards, compareEvaluations } from '../cards/handEvaluator.js';
import { nextCardPool } from '../tree/chanceNode.js';
import { SolverError } from '../api/errors.js';

// Zero-sum terminal utilities in BB. committed amounts include the initial pot
// split, so pot === committed.hero + committed.villain and hero + villain = 0.
//
//   fold by villain : hero wins villainCommitted
//   fold by hero    : hero loses heroCommitted
//   showdown win    : hero wins villainCommitted
//   showdown lose   : hero loses heroCommitted
//   showdown tie    : (villainCommitted - heroCommitted) / 2

export function showdownPayoff(heroHand, villainHand, board, heroCommitted, villainCommitted) {
  const hero = evaluateCards([...heroHand, ...board]);
  const vill = evaluateCards([...villainHand, ...board]);
  const cmp = compareEvaluations(hero, vill);
  if (cmp > 0) return villainCommitted;
  if (cmp < 0) return -heroCommitted;
  return (villainCommitted - heroCommitted) / 2;
}

// Cached hero pot-share fraction for a (hand, hand, board) runout to the river.
// The runout enumeration depends only on the two hands, the board and the chance
// cap — not on the committed amounts — so we compute each unique combination
// once and reuse it across every terminal node that shares that board. This is a
// pure memoization; results are identical to an uncached enumeration.
const runoutShareCache = new Map();

function runoutHeroShare(heroHand, villainHand, board, cap) {
  const key = [
    [...board].map((c) => c.toString()).sort().join(','),
    [...heroHand].map((c) => c.toString()).sort().join(','),
    [...villainHand].map((c) => c.toString()).sort().join(','),
    cap
  ].join('|');
  let share = runoutShareCache.get(key);
  if (share != null) return share;

  const known = new Set([...heroHand, ...villainHand, ...board].map((c) => c.toString()));
  let wins = 0;
  let ties = 0;
  let total = 0;
  const rec = (b) => {
    if (b.length >= 5) {
      total++;
      const cmp = compareEvaluations(evaluateCards([...heroHand, ...b]), evaluateCards([...villainHand, ...b]));
      if (cmp > 0) wins++;
      else if (cmp === 0) ties++;
      return;
    }
    const avail = nextCardPool(b).filter((c) => !known.has(c));
    const pool = cap === Infinity ? avail : avail.slice(0, cap);
    if (pool.length === 0) throw new SolverError('UNSUPPORTED', 'no possible runout under chance abstraction');
    for (const card of pool) rec([...b, card]);
  };
  rec([...board]);
  share = total ? (wins + 0.5 * ties) / total : 0.5;
  runoutShareCache.set(key, share);
  return share;
}

// Marginalize an all-in / check-down showdown over every possible runout to the
// river. `maxChanceBranches` caps the number of cards considered per remaining
// street, mirroring the tree's chance-branch abstraction
// (cfg.maxChanceBranches). When absent/infinite the exact full-runout average is
// used. Because pot === heroCommitted + villainCommitted, the hero payoff is
// (hero pot share * pot) - heroCommitted.
export function allInPayoff(heroHand, villainHand, board, heroCommitted, villainCommitted, maxChanceBranches = Infinity) {
  const cap = Number.isFinite(maxChanceBranches) && maxChanceBranches < Infinity
    ? Math.max(1, Math.floor(maxChanceBranches))
    : Infinity;
  const share = runoutHeroShare(heroHand, villainHand, board, cap);
  const pot = heroCommitted + villainCommitted;
  return share * pot - heroCommitted;
}

// Terminal utility from the hero's perspective. Returns { hero, villain } (zero-sum).
export function terminalUtility(node, heroHand, villainHand) {
  const { hero, villain } = node.committed;
  let heroVal;
  switch (node.terminalType) {
    case 'fold':
      heroVal = node.winner === 'hero' ? villain : -hero;
      break;
    case 'showdown':
      heroVal = showdownPayoff(heroHand, villainHand, node.board, hero, villain);
      break;
    case 'all_in':
      heroVal = allInPayoff(heroHand, villainHand, node.board, hero, villain, node.chanceAbstraction);
      break;
    case 'equity':
      // Preflop flop transition: no more betting, split the current pot by
      // equity over the remaining runout (check-down to the river).
      heroVal = allInPayoff(heroHand, villainHand, node.board, hero, villain, node.chanceAbstraction);
      break;
    default:
      throw new SolverError('UNSUPPORTED', `unknown terminal type: ${node.terminalType}`);
  }
  return { hero: heroVal, villain: -heroVal };
}

// Utility for an arbitrary player id ('hero' | 'villain').
export function utilityForPlayer(node, heroHand, villainHand, player) {
  const u = terminalUtility(node, heroHand, villainHand);
  return player === 'hero' ? u.hero : u.villain;
}