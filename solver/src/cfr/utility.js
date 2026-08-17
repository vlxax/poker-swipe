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

// Marginalize an all-in showdown over every possible runout to the river.
// `maxChanceBranches` caps the number of cards considered per remaining street,
// mirroring the tree's chance-branch abstraction (cfg.maxChanceBranches). When
// absent/infinite the exact full-runout average is used.
export function allInPayoff(heroHand, villainHand, board, heroCommitted, villainCommitted, maxChanceBranches = Infinity) {
  const known = new Set([...heroHand, ...villainHand, ...board].map((c) => c.toString()));
  const cap = Number.isFinite(maxChanceBranches) && maxChanceBranches < Infinity
    ? Math.max(1, Math.floor(maxChanceBranches))
    : Infinity;

  const rec = (b) => {
    const need = 5 - b.length;
    if (need <= 0) return showdownPayoff(heroHand, villainHand, b, heroCommitted, villainCommitted);
    const avail = nextCardPool(b).filter((c) => !known.has(c));
    const pool = cap === Infinity ? avail : avail.slice(0, cap);
    if (pool.length === 0) throw new SolverError('UNSUPPORTED', 'no possible runout under chance abstraction');
    let sum = 0;
    for (const card of pool) sum += rec([...b, card]);
    return sum / pool.length;
  };
  return rec(board);
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