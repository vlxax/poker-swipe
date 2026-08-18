// Preflop legal action generation and betting-state transitions for heads-up
// NLH. Reuses the shared zero-sum invariant (pot === committed.hero + committed.
// villain) so the CFR utility and exploitability layers work unchanged.
//
// Sizing semantics (a documented abstraction):
//   - Open raise: absolute raise-to amounts in BB (cfg.betSizes.preflop).
//   - 3bet/4bet/5bet: raise-to = lastRaiseTo * multiplier (cfg.raiseSizes.preflop),
//     floored to at least a min-raise (2x the last raise-to).
//   - All-in is always available as a raise (jam) once the player has enough
//     stack to do more than call.

const OTHER = { hero: 'villain', villain: 'hero' };

export function otherPlayer(p) {
  return OTHER[p] || p;
}

export function toCallFor(committed, p) {
  return Math.max(0, committed[OTHER[p]] - committed[p]);
}

export function remainingStack(committed, stack, p) {
  return stack - committed[p];
}

function pushAllIn(acts, amountBB) {
  if (!acts.some((a) => a.id === 'all_in')) {
    acts.push({ id: 'all_in', type: 'all_in', amountBB, allIn: true, semantic: 'jam' });
  }
}

function fmt(n) {
  return Math.round(n * 10) / 10;
}

// Generate legal preflop actions for the acting player.
export function preflopLegalActions({
  committed,
  stack,
  playerToAct,
  raisesThisStreet = 0,
  lastAggressorAllIn = false,
  lastRaiseTo = 0,
  cfg
}) {
  const acts = [];
  const p = playerToAct;
  const other = OTHER[p];
  const rem = remainingStack(committed, stack, p);
  const toCall = toCallFor(committed, p);

  if (rem <= 0) return acts; // all-in player cannot act

  const openSizes = (cfg.betSizes && cfg.betSizes.preflop) || [2.5, 3.0];
  const raiseMults = (cfg.raiseSizes && cfg.raiseSizes.preflop) || [3.0];
  const maxRaises = cfg.maxRaisesPerStreet != null ? cfg.maxRaisesPerStreet : 1;

  if (toCall <= 0) {
    // Opening / option spot (e.g. BB facing a completed limp): check or raise.
    acts.push({ id: 'check', type: 'check', amountBB: 0, allIn: false, semantic: 'check' });
  } else {
    acts.push({ id: 'fold', type: 'fold', amountBB: 0, allIn: false, semantic: 'fold' });

    // Call. If the call is all-in, that's the only option besides folding.
    if (rem <= toCall) {
      acts.push({ id: 'call', type: 'call', amountBB: rem, allIn: true, semantic: 'call' });
      return acts;
    }
    acts.push({ id: 'call', type: 'call', amountBB: toCall, allIn: false, semantic: 'call' });
  }

  if (raisesThisStreet === 0) {
    // Opening raise: absolute raise-to sizes. `amountBB` is the additive chips
    // put in (raiseTo - committed); `sizeBB` keeps the absolute raise-to target.
    for (const size of openSizes) {
      const raiseTo = Number(size);
      if (!Number.isFinite(raiseTo) || raiseTo <= committed[p] + toCall) continue;
      const add = raiseTo - committed[p];
      if (add >= rem) pushAllIn(acts, rem);
      else acts.push({
        id: `open_${fmt(raiseTo)}`, type: 'raise', amountBB: add,
        allIn: false, semantic: 'open', sizeBB: raiseTo
      });
    }
  } else if (!lastAggressorAllIn && raisesThisStreet < maxRaises) {
    // 3bet/4bet/5bet: multiplier on the last raise-to, floored to a min-raise.
    const base = lastRaiseTo > 0 ? lastRaiseTo : Math.max(1, committed[p] + toCall);
    for (const mult of raiseMults) {
      const target = Math.max(base * Number(mult), base * 2);
      if (!Number.isFinite(target) || target <= committed[p] + toCall) continue;
      const add = target - committed[p];
      if (add >= rem) pushAllIn(acts, rem);
      else acts.push({
        id: `raise_${fmt(Number(mult))}`, type: 'raise', amountBB: add,
        allIn: false, semantic: 'raise', sizeBB: target, mult: Number(mult)
      });
    }
  }

  // All-in is always a legal raise once there is more to do than call.
  if (toCall < rem && !acts.some((a) => a.id === 'all_in')) {
    pushAllIn(acts, rem);
  }

  return acts;
}

// Apply a preflop action and return the next betting state. `lastRaiseTo` is
// tracked as the raise-to amount of the most recent aggressive action (or the
// current high committed amount after a limp) so 3bet/4bet sizing stays correct.
export function preflopApplyAction(state, action) {
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

  let lastRaiseTo = state.lastRaiseTo || 0;
  if (aggressive) {
    // Raise actions carry the absolute raise-to in sizeBB (all-in: the total
    // committed, i.e. the stack); fall back to the additive amount for legacy.
    lastRaiseTo = action.type === 'all_in' || action.semantic === 'jam'
      ? committed[p]
      : (action.sizeBB != null ? action.sizeBB : action.amountBB);
  } else {
    const high = Math.max(committed.hero, committed.villain);
    if (high > lastRaiseTo) lastRaiseTo = high;
  }

  return {
    committed,
    pot,
    stack: state.stack,
    playerToAct: other,
    toCall: toCallOther,
    lastAggressorAllIn: allIn,
    raisesThisStreet,
    lastRaiseTo,
    allIn
  };
}