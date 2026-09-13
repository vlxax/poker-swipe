/**
 * Core mathematical utilities for strategy map
 */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeActions(actions) {
  if (!actions) return {};
  const total = Object.values(actions).reduce((a, b) => a + b, 0);
  if (total === 0) return {};
  if (Math.abs(total - 1) < 0.001) return { ...actions };
  const result = {};
  for (const [key, val] of Object.entries(actions)) {
    result[key] = val / total;
  }
  return result;
}

export function positiveDistribution(actions) {
  if (!actions) return {};
  const result = {};
  for (const [key, val] of Object.entries(actions)) {
    if (val > 0) result[key] = val;
  }
  return result;
}

export function activeActionCount(actions) {
  return Object.keys(positiveDistribution(actions)).length;
}

export function validateActionDistribution(actions) {
  if (!actions || Object.keys(actions).length === 0) {
    return { valid: false, total: 0, reason: 'empty distribution' };
  }

  let total = 0;
  let hasNonFinite = false;
  let hasNegative = false;

  for (const val of Object.values(actions)) {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      hasNonFinite = true;
    }
    if (val < 0) {
      hasNegative = true;
    }
    total += val;
  }

  if (hasNonFinite) {
    return { valid: false, total, reason: 'contains non-finite value' };
  }

  if (hasNegative) {
    return { valid: false, total, reason: 'contains negative value' };
  }

  if (Math.abs(total - 1) > 0.001) {
    return { valid: false, total, reason: `total does not sum to 1 (${total})` };
  }

  return { valid: true, total, reason: 'valid' };
}

export function activeNormalizedEntropy(actions) {
  const active = positiveDistribution(actions);
  const count = Object.keys(active).length;
  if (count <= 1) return 0;
  const ent = entropy(active);
  return ent / Math.log2(count);
}

export function globalNormalizedEntropy(actions) {
  const totalPossible = 6;
  const active = positiveDistribution(actions);
  const ent = entropy(active);
  return ent / Math.log2(totalPossible);
}

export function entropy(probs) {
  let result = 0;
  for (const p of Object.values(probs)) {
    if (p > 0) {
      result -= p * Math.log2(p);
    }
  }
  return result;
}

export function normalizedEntropy(probs) {
  const active = positiveDistribution(probs);
  const values = Object.values(active);
  if (values.length === 0) return 0;
  const ent = entropy(active);
  const numActions = values.length;
  if (numActions <= 1) return 0;
  return ent / Math.log2(numActions);
}

export function jensenShannonDistance(p, q) {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  if (keys.size === 0) return 0;

  const m = {};
  for (const key of keys) {
    const pVal = p[key] || 0;
    const qVal = q[key] || 0;
    m[key] = (pVal + qVal) / 2;
  }

  const kl = (a, b) => {
    let result = 0;
    for (const key of keys) {
      const aVal = a[key] || 0;
      const bVal = b[key] || 0;
      if (aVal > 0 && bVal > 0) {
        result += aVal * Math.log2(aVal / bVal);
      }
    }
    return result;
  };

  return (kl(p, m) + kl(q, m)) / 2;
}

export function euclideanDistance(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let sum = 0;
  for (const key of keys) {
    const diff = (a[key] || 0) - (b[key] || 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const key of keys) {
    const valA = a[key] || 0;
    const valB = b[key] || 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function variance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
}

export function standardDeviation(values) {
  return Math.sqrt(variance(values));
}

export function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
