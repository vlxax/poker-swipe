// Range propagation: how a combo's weight (reach probability) flows down the tree
// through strategy frequencies. The core distinguishes three quantities:
//
//   range weight        — the initial weight of a combo at the root (prior).
//   reach probability   — the absolute probability a combo reaches a node
//                         (product of the owner's own strategy probs along the path,
//                         scaled by the initial weight).
//   normalized display frequency — reach re-normalized over the range so it sums to
//                         1 for display purposes (NOT used in CFR math).

// Absolute reach update after taking an action with probability `freq`.
export function propagateRange(parentReach, freq) {
  const r = parentReach * freq;
  return Number.isFinite(r) ? r : 0;
}

// Compute a combo's reach probability at a node from its root weight and the
// list of the owner's action frequencies along the path.
export function calculateReachProbability(rootWeight, actionFrequencies) {
  let reach = rootWeight;
  for (const freq of actionFrequencies || []) reach = propagateRange(reach, freq);
  return reach;
}

// Normalize a map of reaches over a range so they sum to 1 (display only).
export function normalizeReach(reachMap) {
  const entries = Object.entries(reachMap).filter(([, v]) => Number.isFinite(v) && v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return {};
  const out = {};
  for (const [k, v] of entries) out[k] = v / total;
  return out;
}

// Weighted aggregate frequency of each action across a range: sums each combo's
// reach times the combo's strategy frequency, divided by total reach.
export function aggregateStrategy(reachMap, comboStrategies) {
  const freqSum = {};
  let totalReach = 0;
  for (const [combo, reach] of Object.entries(reachMap)) {
    if (!(reach > 0)) continue;
    totalReach += reach;
    const strat = comboStrategies[combo] || {};
    for (const [action, f] of Object.entries(strat)) {
      if (!(f > 0)) continue;
      freqSum[action] = (freqSum[action] || 0) + reach * f;
    }
  }
  if (totalReach <= 0) return {};
  const out = {};
  for (const [action, s] of Object.entries(freqSum)) out[action] = s / totalReach;
  return out;
}