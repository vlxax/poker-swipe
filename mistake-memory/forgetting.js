/**
 * Forgetting curve implementation.
 *
 * Model family: exponential decay
 *   retention(t) = exp(-elapsedMs / stabilityMs)
 *
 * Properties (documented & enforced):
 * - retention(now) > retention(later) for stability > 0
 * - higher stability => slower forgetting
 * - no NaN, no Infinity for valid finite inputs
 * - retention ∈ (0, 1]
 *
 * Constants:
 * - MIN_STABILITY_MS = 60_000 (1 minute) to avoid div-by-zero and instant forget
 * - MAX_STABILITY_MS = 365 * 24 * 60 * 60 * 1000 (1 year) soft cap for practicality
 */

import { expDecay, clamp } from './math.js';

export const MIN_STABILITY_MS = 60 * 1000;          // 1 min
export const MAX_STABILITY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Estimate retention at a given timestamp.
 *
 * @param {Object} memoryState
 * @param {number} timestamp - absolute ms
 * @returns {{ retention: number, elapsedMs: number, stabilityMs: number }}
 */
export function estimateRetention(memoryState, timestamp) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    throw new Error('estimateRetention: timestamp must be a finite number');
  }

  const lastSeen = memoryState.lastSeenAt ?? memoryState.lastSuccessAt ?? memoryState.lastErrorAt;
  if (lastSeen == null || typeof lastSeen !== 'number') {
    // No history → full retention of "unknown"
    return { retention: 1, elapsedMs: 0, stabilityMs: MIN_STABILITY_MS };
  }

  const elapsedMs = Math.max(0, timestamp - lastSeen);
  let stabilityMs = memoryState.stability ?? MIN_STABILITY_MS;
  stabilityMs = clamp(stabilityMs, MIN_STABILITY_MS, MAX_STABILITY_MS);

  const retention = expDecay(elapsedMs, stabilityMs);

  return {
    retention,
    elapsedMs,
    stabilityMs
  };
}

/**
 * Compute forgetting risk (1 - retention), clamped.
 * Higher = more urgent to review.
 * @param {Object} memoryState
 * @param {number} timestamp
 * @returns {number} in [0,1]
 */
export function estimateForgettingRisk(memoryState, timestamp) {
  const { retention } = estimateRetention(memoryState, timestamp);
  return clamp(1 - retention, 0, 1);
}
