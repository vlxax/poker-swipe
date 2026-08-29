/**
 * Pure math utilities for Mistake Memory Engine.
 * All functions are deterministic and side-effect free.
 * No Date.now(), no Math.random() without injected rng.
 */

/**
 * Clamp value to [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Safe exponential decay: retention = exp(-elapsed / stability)
 * Guarantees: 0 < result <= 1, never NaN/Infinity for finite positive inputs.
 * @param {number} elapsedMs - non-negative
 * @param {number} stabilityMs - positive
 * @returns {number} retention in (0, 1]
 */
export function expDecay(elapsedMs, stabilityMs) {
  if (stabilityMs <= 0) return 0;
  if (elapsedMs <= 0) return 1;
  const ratio = elapsedMs / stabilityMs;
  if (ratio > 40) return Number.MIN_VALUE;
  const r = Math.exp(-ratio);
  return r > 0 ? r : Number.MIN_VALUE;
}

/**
 * Softplus-like smooth positive mapping, but simple for transparency.
 */
export function softIncrease(base, delta, maxFactor = 2.0) {
  return base * (1 + clamp(delta, 0, maxFactor - 1));
}

/**
 * Weighted mean of numbers.
 * @param {number[]} values
 * @param {number[]} weights
 * @returns {number}
 */
export function weightedMean(values, weights) {
  if (!values.length) return 0;
  let sum = 0;
  let wSum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 1;
    sum += values[i] * w;
    wSum += w;
  }
  return wSum > 0 ? sum / wSum : 0;
}

/**
 * Simple Bayesian-style success rate with prior.
 * posterior = (successes + priorSuccess) / (total + priorTotal)
 * @param {number} successes
 * @param {number} total
 * @param {number} priorSuccess - default 1
 * @param {number} priorTotal - default 2
 * @returns {number} in [0,1]
 */
export function bayesianRate(successes, total, priorSuccess = 1, priorTotal = 2) {
  const s = Math.max(0, successes) + priorSuccess;
  const t = Math.max(0, total) + priorTotal;
  return clamp(s / t, 0, 1);
}

/**
 * Confidence from sample size (approaches 1 as n grows).
 * confidence = 1 - 1 / (1 + n / k)
 * @param {number} n
 * @param {number} k - scale, default 10 (half confidence at n=10)
 * @returns {number} in [0,1)
 */
export function sampleConfidence(n, k = 10) {
  if (n <= 0) return 0;
  return 1 - 1 / (1 + n / k);
}

/**
 * Total Variation Distance between two discrete distributions.
 *
 * TVD = 0.5 * Σ |p_i - q_i|  over union of keys
 *
 * Properties:
 * - D(P,Q) = D(Q,P)
 * - 0 <= D <= 1
 * - Perfect match → 0
 * - Completely disjoint → 1
 * - Extra unrelated categories do NOT artificially reduce distance
 *   (unlike mean-absolute which divides by n)
 *
 * @param {Record<string, number>} empirical
 * @param {Record<string, number>} target
 * @returns {number} in [0,1]
 */
export function totalVariationDistance(empirical, target) {
  const actions = new Set([...Object.keys(empirical || {}), ...Object.keys(target || {})]);
  let sum = 0;
  for (const a of actions) {
    const e = empirical[a] ?? 0;
    const t = target[a] ?? 0;
    sum += Math.abs(e - t);
  }
  return clamp(0.5 * sum, 0, 1);
}

/**
 * @deprecated Use totalVariationDistance. Kept for migration/compat tests.
 * Old incorrect metric: mean absolute difference (divides by n actions).
 */
export function frequencyAbsDeviation(empirical, target) {
  return totalVariationDistance(empirical, target);
}

/**
 * KL divergence (simplified, additive smoothing).
 * @param {Record<string, number>} empirical
 * @param {Record<string, number>} target
 * @param {number} eps
 * @returns {number}
 */
export function klDivergence(empirical, target, eps = 1e-6) {
  const actions = new Set([...Object.keys(empirical), ...Object.keys(target)]);
  let kl = 0;
  for (const a of actions) {
    const e = Math.max(eps, empirical[a] ?? 0);
    const t = Math.max(eps, target[a] ?? 0);
    kl += e * Math.log(e / t);
  }
  return Math.max(0, kl);
}

/**
 * Deterministic hash for seeding from string (simple).
 * @param {string} str
 * @returns {number}
 */
export function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Deterministic hash of a target distribution object.
 * Key order independent. Floats rounded to 6 decimal places.
 * @param {Record<string, number>|null} target
 * @returns {string|null}
 */
export function hashTargetDistribution(target) {
  if (!target || typeof target !== 'object') return null;
  const keys = Object.keys(target).sort();
  if (keys.length === 0) return null;
  const parts = keys.map(k => {
    const v = target[k];
    const rounded = typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v;
    return `${k}:${rounded}`;
  });
  return parts.join('|');
}

/**
 * Mulberry32 seeded PRNG.
 * @param {number} seed
 * @returns {() => number} function returning [0,1)
 */
export function createMulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
