// Accumulates weighted average strategies per combo from reach-weighted samples,
// and retrieves the normalized average strategy for a combo.

// Add a weighted sample: avg[a] += reach * freq[a].
export function accumulateStrategy(avgMap, reach, strategy) {
  for (const [action, f] of Object.entries(strategy)) {
    if (!(f > 0)) continue;
    avgMap[action] = (avgMap[action] || 0) + reach * f;
  }
  return avgMap;
}

// Normalize an accumulated average-strategy map over the given action ids.
export function averageStrategy(avgMap, actionIds) {
  const ids = actionIds || Object.keys(avgMap || {});
  const total = ids.reduce((s, a) => s + (avgMap[a] || 0), 0);
  const out = {};
  if (total <= 0) {
    const u = ids.length ? 1 / ids.length : 0;
    for (const a of ids) out[a] = u;
    return out;
  }
  for (const a of ids) out[a] = (avgMap[a] || 0) / total;
  return out;
}

// L1 distance between two strategy maps over the union of their keys.
export function strategyDelta(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  let d = 0;
  for (const k of keys) d += Math.abs((a[k] || 0) - (b[k] || 0));
  return d;
}