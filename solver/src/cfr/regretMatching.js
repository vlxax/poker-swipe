// Standard regret matching. Given a per-combo regret map keyed by action id,
// return a probability distribution over the given action ids.
// If no action has positive regret, fall back to uniform.

export function regretMatching(regretMap, actionIds) {
  const ids = actionIds || Object.keys(regretMap || {});
  if (!ids.length) return {};
  const positive = ids.map((a) => Math.max(0, Number((regretMap || {})[a]) || 0));
  const total = positive.reduce((s, v) => s + v, 0);
  const out = {};
  if (total <= 0) {
    const u = 1 / ids.length;
    for (const a of ids) out[a] = u;
    return out;
  }
  for (let i = 0; i < ids.length; i++) out[ids[i]] = positive[i] / total;
  return out;
}

// True if at least one action carries positive regret (i.e. not a uniform fallback).
export function hasPositiveRegret(regretMap, actionIds) {
  return (actionIds || []).some((a) => (Number((regretMap || {})[a]) || 0) > 0);
}

// Validates that a strategy is a proper distribution (non-negative, sums to 1).
export function isValidStrategy(strategy, actionIds) {
  const ids = actionIds || Object.keys(strategy || {});
  if (!ids.length) return true;
  let sum = 0;
  for (const a of ids) {
    const v = Number(strategy[a]) || 0;
    if (v < 0) return false;
    sum += v;
  }
  return Math.abs(sum - 1) < 1e-6;
}