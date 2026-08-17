// Deterministic, configurable, validated bet-sizing abstraction.
//
// Postflop betting in the tree is expressed as a small set of bet sizes (as
// fractions of pot) and raise sizes (as multipliers). This module builds that
// set from the user's requested sizes, prunes near-duplicates / oversized bets,
// caps the number of sizes per node, and (when appropriate) injects a geometric
// sizing that would put both players all-in by the river. It never uses random
// numbers, so identical inputs always produce identical abstractions.

const DEFAULT_MAX_BET_SIZES = 4;
const DEFAULT_MERGE_TOLERANCE = 0.05;

function isFinitePositive(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function normalizeSizeArray(sizes) {
  return (sizes || [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

// Merge sizes that are within `tolerance` (relative) of an earlier size. Keeps
// the first (smallest) of each cluster, so the output is a canonical ascending
// list with no near-duplicates.
export function mergeNearDuplicates(sorted, tolerance) {
  const t = Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : DEFAULT_MERGE_TOLERANCE;
  const out = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    if (prev != null && Math.abs(s - prev) / Math.max(prev, 1e-9) <= t) continue;
    out.push(s);
  }
  return out;
}

// Select at most `max` sizes while preserving the smallest, the largest and a
// spread of intermediate values ("small / medium / large").
export function pickSpread(sorted, max) {
  const m = Math.max(1, Math.floor(max));
  if (m <= 1) return sorted.slice(0, 1);
  if (sorted.length <= m) return sorted.slice();
  const out = [sorted[0]];
  const inner = m - 2;
  if (inner <= 0) {
    out.push(sorted[sorted.length - 1]);
    return out;
  }
  const step = (sorted.length - 1) / (inner + 1);
  const seen = new Set([0]);
  for (let i = 1; i <= inner; i++) {
    const idx = Math.round(i * step);
    if (!seen.has(idx) && idx >= 1 && idx < sorted.length - 1) {
      out.push(sorted[idx]);
      seen.add(idx);
    }
  }
  if (!seen.has(sorted.length - 1)) out.push(sorted[sorted.length - 1]);
  return out.sort((a, b) => a - b);
}

// Prune a set of candidate sizes (as fractions of pot) against the remaining
// stack. Returns the sizes actually usable in the tree plus the sizes dropped.
export function pruneSizes({
  sizes,
  pot,
  stack,
  minBet = 0,
  maxPerNode = DEFAULT_MAX_BET_SIZES,
  tolerance = DEFAULT_MERGE_TOLERANCE
}) {
  const P = Math.max(Number(pot) || 0, 0);
  const S = Math.max(Number(stack) || 0, 0);
  const min = Math.max(Number(minBet) || 0, 0);
  const max = Number.isFinite(maxPerNode) && maxPerNode > 0 ? Math.floor(maxPerNode) : DEFAULT_MAX_BET_SIZES;

  const requested = normalizeSizeArray(sizes);

  // A bet is a real bet only if it exceeds the minimum and fits in the stack.
  // A size that reaches the stack is an all-in; it is kept (and flagged) rather
  // than dropped, because "jam" is a first-class action in the abstraction.
  const usable = [];
  const pruned = [];
  for (const f of requested) {
    const amt = f * P;
    if (amt <= min || amt <= 0) {
      pruned.push({ size: f, reason: 'below_min_bet' });
    } else if (amt >= S) {
      usable.push({ size: f, allIn: true });
    } else {
      usable.push({ size: f, allIn: false });
    }
  }

  // Merge near-duplicates among the non-all-in real bets.
  const realBets = usable.filter((u) => !u.allIn).map((u) => u.size);
  const deduped = mergeNearDuplicates(realBets, tolerance);
  const allInSizes = usable.filter((u) => u.allIn).map((u) => u.size);

  const spread = pickSpread(deduped, max);
  const usedSizes = [...spread, ...allInSizes].sort((a, b) => a - b);

  const prunedSizes = [
    ...pruned.map((p) => ({ size: p.size, reason: p.reason })),
    ...realBets.filter((s) => !spread.includes(s)).map((s) => ({ size: s, reason: 'max_sizes_exceeded' }))
  ];

  return { usedSizes, prunedSizes, allInSizes };
}

// Geometric bet sizing: the fraction of pot f that, if bet and called on each of
// the remaining streets, puts both players all-in on the river.
//
//   pot_final = pot * (1 + 2f)^streetsRemaining
//   we require pot_final = pot + 2 * stack  (both remaining stacks committed)
//   => (1 + 2f)^streetsRemaining = 1 + 2*stack/pot
//   => f = ((1 + 2*stack/pot)^(1/streetsRemaining) - 1) / 2
export function calculateGeometricSizing({
  pot,
  stack,
  streetsRemaining = 3,
  targetAllInByRiver = true
}) {
  const P = Math.max(Number(pot) || 0, 0);
  const s = Math.max(Number(stack) || 0, 0);
  const R = Number.isFinite(streetsRemaining) && streetsRemaining > 0 ? Math.floor(streetsRemaining) : 1;

  if (!targetAllInByRiver || P <= 0 || s <= 0) {
    return { fraction: 0, allInForced: false };
  }

  const ratio = 1 + (2 * s) / P;
  const f = (Math.pow(ratio, 1 / R) - 1) / 2;
  if (!Number.isFinite(f) || f <= 0) return { fraction: 0, allInForced: false };

  // A fraction >= 1 means the geometric path would bet more than the pot on
  // some street; that is effectively a jam-forcing line, not a normal sizing.
  if (f >= 1) return { fraction: Math.min(f, 1), allInForced: true };

  return { fraction: f, allInForced: false };
}

// Build the complete, deterministic bet-sizing abstraction for a node context.
// `stack` is the smaller remaining stack (what each player has left to bet).
export function buildBetSizingModel({
  street,
  pot,
  stack,
  requestedBetSizes = [],
  requestedRaiseSizes = [],
  maxBetSizesPerNode = DEFAULT_MAX_BET_SIZES,
  sizeMergeTolerance = DEFAULT_MERGE_TOLERANCE,
  geometricStreetsRemaining = null,
  targetAllInByRiver = true
}) {
  const streetKey = String(street || '').toLowerCase();

  // Validate inputs deterministically.
  if (!Number.isFinite(Number(pot)) || Number(pot) < 0) {
    throw new Error('INVALID_POT: bet sizing model requires a non-negative pot');
  }
  if (!Number.isFinite(Number(stack)) || Number(stack) < 0) {
    throw new Error('INVALID_STACK: bet sizing model requires a non-negative stack');
  }

  const maxPerNode = Number.isFinite(maxBetSizesPerNode) && maxBetSizesPerNode > 0
    ? Math.floor(maxBetSizesPerNode)
    : DEFAULT_MAX_BET_SIZES;
  const tolerance = Number.isFinite(sizeMergeTolerance) && sizeMergeTolerance >= 0
    ? sizeMergeTolerance
    : DEFAULT_MERGE_TOLERANCE;

  const requestedSizes = normalizeSizeArray(requestedBetSizes);

  const pruned = pruneSizes({
    sizes: requestedSizes,
    pot,
    stack,
    minBet: 0,
    maxPerNode,
    tolerance
  });
  let usedSizes = pruned.usedSizes;

  // Context-aware geometric sizing. Only meaningful when there is a street to
  // act on and some stack left to bet.
  let geometricSizeUsed = null;
  const remainingStreets = geometricStreetsRemaining != null
    ? Math.floor(geometricStreetsRemaining)
    : (streetKey === 'flop' ? 3 : streetKey === 'turn' ? 2 : streetKey === 'river' ? 1 : 0);

  if (remainingStreets > 1 && pruned.allInSizes.length === 0 && stack > 0 && pot > 0) {
    const geo = calculateGeometricSizing({
      pot,
      stack,
      streetsRemaining: remainingStreets,
      targetAllInByRiver
    });
    if (geo.fraction > 0 && !geo.allInForced) {
      geometricSizeUsed = Number(geo.fraction.toFixed(4));
      usedSizes = pickSpread(
        mergeNearDuplicates([...usedSizes.filter((s) => s < 1), geometricSizeUsed].sort((a, b) => a - b), tolerance),
        maxPerNode
      ).sort((a, b) => a - b);
    } else if (geo.allInForced) {
      // The stack is so short that a geometric line is just a jam.
      geometricSizeUsed = null;
    }
  }

  return {
    model: {
      street: streetKey,
      type: 'fraction_of_pot',
      maxBetSizesPerNode: maxPerNode,
      sizeMergeTolerance: tolerance,
      targetAllInByRiver
    },
    requestedSizes,
    usedSizes,
    prunedSizes: pruned.prunedSizes,
    geometricSizeUsed
  };
}