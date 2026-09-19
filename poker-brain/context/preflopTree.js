import { UNKNOWN, isUnknown } from './DecisionContext.js';
import { normalizePosition } from './normalize.js';

function lastByAction(history, actions) {
  const set = new Set(actions);
  for (let i = history.length - 1; i >= 0; i--) {
    const a = history[i];
    if (set.has(a.action)) return a;
  }
  return null;
}

/**
 * Derive preflop sequence metadata from normalized action history.
 */
export function derivePreflopTree(actionHistory = []) {
  const pre = actionHistory.filter((a) => String(a.street).toUpperCase() === 'PREFLOP' || a.street === UNKNOWN);
  const open = lastByAction(pre, ['OPEN', 'RAISE']);
  const three = lastByAction(pre, ['3BET']);
  const four = lastByAction(pre, ['4BET', 'JAM']);

  return {
    openerPosition: open ? normalizePosition(open.position) : UNKNOWN,
    openSizeBB: open?.amountBB ?? open?.raiseToBB ?? UNKNOWN,
    threeBettorPosition: three ? normalizePosition(three.position) : UNKNOWN,
    threeBetSizeBB: three?.amountBB ?? three?.raiseToBB ?? UNKNOWN,
    fourBettorPosition: four ? normalizePosition(four.position) : UNKNOWN,
    fourBetSizeBB: four?.amountBB ?? four?.raiseToBB ?? UNKNOWN
  };
}
