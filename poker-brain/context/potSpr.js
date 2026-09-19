import { UNKNOWN, isUnknown } from './DecisionContext.js';

const PREFLOP_ANTE_GUESS = false;

/**
 * Reconstruct pot from normalized action history when explicit pot missing.
 * Conservative: only adds known BB amounts; does not invent antes unless passed.
 */
export function reconstructPotBB(actionHistory = [], { anteBB = 0, sb = 0.5, bb = 1, players = 2 } = {}) {
  if (!Array.isArray(actionHistory) || !actionHistory.length) return { potBB: UNKNOWN, reliable: false };

  let pot = (Number(sb) || 0) + (Number(bb) || 0);
  if (PREFLOP_ANTE_GUESS && anteBB) pot += Number(anteBB) * players;

  let reliable = true;
  for (const a of actionHistory) {
    const amt = a.amountBB;
    if (isUnknown(amt)) {
      if (['OPEN', '3BET', '4BET', 'BET', 'RAISE', 'CALL', 'JAM'].includes(a.action)) {
        reliable = false;
      }
      continue;
    }
    const n = Number(amt);
    if (a.action === 'CALL') pot += n;
    else if (['BET', 'OPEN', 'RAISE', '3BET', '4BET', 'JAM'].includes(a.action)) {
      pot += n;
    }
  }
  return { potBB: pot, reliable };
}

export function derivePotAndSpr({ potBB, effectiveStackBB, actionHistory, street }) {
  let pot = potBB;
  let potReliable = !isUnknown(potBB);
  if (isUnknown(pot)) {
    const rec = reconstructPotBB(actionHistory);
    if (!isUnknown(rec.potBB)) {
      pot = rec.potBB;
      potReliable = rec.reliable;
    }
  }

  const spr = (!isUnknown(pot) && !isUnknown(effectiveStackBB) && Number(pot) > 0 && potReliable)
    ? Number(effectiveStackBB) / Number(pot)
    : UNKNOWN;

  const postflop = ['FLOP', 'TURN', 'RIVER'].includes(String(street || '').toUpperCase());

  return {
    potBB: pot,
    effectiveStackBB,
    spr,
    sprReliable: spr !== UNKNOWN,
    potSource: potReliable ? (isUnknown(potBB) ? 'RECONSTRUCTED' : 'SOURCE') : 'PARTIAL'
  };
}
