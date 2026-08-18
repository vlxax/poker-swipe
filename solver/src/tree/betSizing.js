// Legal action generation and pot/stack accounting for the heads-up betting round.
// Player identity is 'hero' | 'villain'. Committed amounts include the initial
// preflop pot split, so pot === committed.hero + committed.villain at all times.

const OTHER = { hero: 'villain', villain: 'hero' };

export function otherPlayer(p) {
  return OTHER[p] || p;
}

// Compute the amount the acting player must add to stay in the hand.
export function toCallFor(committed, playerToAct) {
  const other = OTHER[playerToAct];
  return Math.max(0, committed[other] - committed[playerToAct]);
}

export function remainingStack(committed, stack, p) {
  return stack - committed[p];
}

// Generate the list of legal actions for the acting player at a betting state.
export function legalActions({
  committed,
  stack,
  pot,
  playerToAct,
  street,
  raisesThisStreet = 0,
  lastAggressorAllIn = false,
  cfg
}) {
  const acts = [];
  const p = playerToAct;
  const other = OTHER[p];
  const rem = remainingStack(committed, stack, p);
  const toCall = toCallFor(committed, p);

  if (rem <= 0) return acts; // all-in player cannot act

  if (toCall <= 0) {
    // Opening action: check or bet (or all-in if the bet covers the stack).
    acts.push({ id: 'check', type: 'check', amountBB: 0, allIn: false });
    for (const f of (cfg.betSizes[street] || [])) {
      const amt = f * pot;
      if (amt <= 0) continue;
      if (amt >= rem) {
        if (!acts.some((a) => a.id === 'all_in')) {
          acts.push({ id: 'all_in', type: 'all_in', amountBB: rem, allIn: true });
        }
      } else {
        acts.push({ id: `bet_${Math.round(f * 100)}`, type: 'bet', amountBB: amt, sizePot: f, allIn: false });
      }
    }
    return acts;
  }

  // Facing a bet: fold / call / (all-in call) / raise.
  acts.push({ id: 'fold', type: 'fold', amountBB: 0, allIn: false });

  if (rem <= toCall) {
    // Can only call all-in.
    acts.push({ id: 'call', type: 'call', amountBB: rem, allIn: true });
    return acts;
  }

  acts.push({ id: 'call', type: 'call', amountBB: toCall, allIn: false });

  if (!lastAggressorAllIn && raisesThisStreet < cfg.maxRaisesPerStreet) {
    for (const r of (cfg.raiseSizes[street] || [])) {
      const S = r * toCall; // total bet size (raise to)
      if (S <= toCall) continue;
      const amt = S;
      if (amt >= rem) {
        if (!acts.some((a) => a.id === 'all_in')) {
          acts.push({ id: 'all_in', type: 'all_in', amountBB: rem, allIn: true });
        }
      } else {
        acts.push({ id: `raise_${Math.round(r * 100)}`, type: 'raise', amountBB: amt, allIn: false });
      }
    }
  }
  return acts;
}

// Apply an action to a betting state and return the resulting state.
export function applyAction(state, action) {
  const p = state.playerToAct;
  const other = OTHER[p];
  const committed = { ...state.committed };
  const pot = state.pot + action.amountBB;
  committed[p] += action.amountBB;

  const remP = remainingStack(committed, state.stack, p);
  const allIn = remP <= 0;
  const toCallOther = Math.max(0, committed[p] - committed[other]);

  const aggressive = action.type === 'bet' || action.type === 'raise' || action.type === 'all_in';
  const raisesThisStreet = state.raisesThisStreet + (aggressive ? 1 : 0);

  return {
    committed,
    pot,
    stack: state.stack,
    playerToAct: other,
    toCall: toCallOther,
    lastAggressorAllIn: allIn,
    raisesThisStreet,
    allIn
  };
}