/**
 * Frequency target validation — fail fast.
 *
 * Does NOT silently normalize 70 → 0.7.
 * Rejects negative, >1, NaN, Infinity, sums far from 1.
 *
 * Public contract:
 *   targetDistribution — ONLY canonical multi-action frequency target input.
 *   targetProbability  — NOT a frequency target. If present without
 *                        targetDistribution, updateMemoryState fails fast.
 *                        Do not invent {chosenAction: p, __other__: 1-p}.
 */

export const PROB_SUM_TOLERANCE = 0.02; // allow 0.1+0.2+0.7 style FP

/**
 * @param {Record<string, number>} dist
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateTargetDistribution(dist) {
  const errors = [];
  if (!dist || typeof dist !== 'object' || Array.isArray(dist)) {
    return { ok: false, errors: ['targetDistribution must be a plain object'] };
  }
  const keys = Object.keys(dist);
  if (keys.length === 0) {
    return { ok: false, errors: ['targetDistribution must have at least one action'] };
  }
  let sum = 0;
  for (const k of keys) {
    const p = dist[k];
    if (typeof p !== 'number' || !Number.isFinite(p)) {
      errors.push(`probability for "${k}" must be a finite number`);
      continue;
    }
    if (p < 0 || p > 1) {
      errors.push(`probability for "${k}" must be in [0,1], got ${p}`);
    }
    sum += p;
  }
  if (errors.length === 0 && Math.abs(sum - 1) > PROB_SUM_TOLERANCE) {
    errors.push(`probabilities must sum to ~1 (tolerance ${PROB_SUM_TOLERANCE}), got ${sum}`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validates the numeric range of targetProbability only.
 * Does NOT make it a frequency target — see module docs.
 */
export function validateTargetProbability(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) {
    return { ok: false, errors: ['targetProbability must be a finite number'] };
  }
  if (p < 0 || p > 1) {
    return { ok: false, errors: [`targetProbability must be in [0,1], got ${p}`] };
  }
  return { ok: true, errors: [] };
}

/**
 * Assert that targetProbability is not used as sole frequency target.
 * @throws if targetProbability present without any targetDistribution
 */
export function assertFrequencyTargetContract(attempt, options = {}) {
  const hasTp = typeof attempt.targetProbability === 'number';
  if (!hasTp) return;
  const hasTd =
    (attempt.targetDistribution && typeof attempt.targetDistribution === 'object') ||
    (attempt.context && attempt.context.targetDistribution && typeof attempt.context.targetDistribution === 'object') ||
    (options.targetDistribution && typeof options.targetDistribution === 'object');
  if (!hasTd) {
    throw new Error(
      'targetProbability alone is not a frequency target; provide targetDistribution for multi-action frequency learning'
    );
  }
}
