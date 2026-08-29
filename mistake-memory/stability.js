/**
 * Stability model with spaced-recall growth.
 *
 * Uses gradeAttempt() as sole severity source (P0-1).
 *
 * PURE_MATCH  → full positive growth
 * IN_MIX      → positive growth (reduced), never a penalty
 * RARE_MIX    → tiny positive / near-neutral
 * OUT_OF_STRATEGY → real negative penalty
 */

import { clamp, sampleConfidence } from './math.js';
import { MIN_STABILITY_MS, MAX_STABILITY_MS } from './forgetting.js';
import { gradeAttempt } from './grading.js';

export const BASE_STABILITY_MS = 10 * 60 * 1000;
export const SUCCESS_GROWTH_FACTOR = 0.35;
export const IN_MIX_GROWTH_FACTOR = 0.22;
export const RARE_MIX_GROWTH_FACTOR = 0.05;
export const SEVERE_PENALTY_BASE = 0.28;
export const MAX_GROWTH_PER_REVIEW = 2.5;

/**
 * Map attempt to severity class via canonical grade.
 * @returns {'success'|'in_mix'|'rare'|'severe'}
 */
export function classifySeverity(attempt) {
  const g = gradeAttempt(attempt);
  if (g.classification === 'OUT_OF_STRATEGY') return 'severe';
  if (g.classification === 'RARE_MIX') return 'rare';
  if (g.classification === 'IN_MIX') return 'in_mix';
  return 'success';
}

export function updateStability(previousState, attempt, options = {}) {
  const stabilityBefore = clamp(
    previousState.stability ?? BASE_STABILITY_MS,
    MIN_STABILITY_MS,
    MAX_STABILITY_MS
  );

  const severity = classifySeverity(attempt);
  const attempts = (previousState.attempts ?? 0) + 1;
  const conf = sampleConfidence(attempts, options.confidenceScale ?? 12);

  const ts = attempt.timestamp;
  const lastSeen = previousState.lastSeenAt;
  const elapsed = (lastSeen != null && typeof ts === 'number' && ts >= lastSeen)
    ? ts - lastSeen
    : 0;

  const elapsedFactor = stabilityBefore > 0
    ? clamp(elapsed / stabilityBefore, 0, 1.5)
    : 0;
  const spacedScale = 0.15 + 0.85 * Math.min(1, elapsedFactor);

  let multiplier = 1;
  const reasonComponents = {
    severity,
    sampleConfidence: conf,
    attempts,
    elapsedMs: elapsed,
    spacedScale
  };

  if (severity === 'success') {
    const growth = Math.min(SUCCESS_GROWTH_FACTOR * conf * spacedScale, MAX_GROWTH_PER_REVIEW - 1);
    multiplier = 1 + growth;
    reasonComponents.growth = growth;
  } else if (severity === 'in_mix') {
    const growth = Math.min(IN_MIX_GROWTH_FACTOR * conf * spacedScale, MAX_GROWTH_PER_REVIEW - 1);
    multiplier = 1 + growth;
    reasonComponents.growth = growth;
  } else if (severity === 'rare') {
    const growth = Math.min(RARE_MIX_GROWTH_FACTOR * conf * spacedScale, MAX_GROWTH_PER_REVIEW - 1);
    multiplier = 1 + growth;
    reasonComponents.growth = growth;
  } else {
    const scaledPenalty = Math.max(0.08, SEVERE_PENALTY_BASE * (0.4 + 0.6 * conf));
    multiplier = 1 - scaledPenalty;
    reasonComponents.scaledPenalty = scaledPenalty;
  }

  let stabilityAfter = stabilityBefore * multiplier;
  stabilityAfter = clamp(stabilityAfter, MIN_STABILITY_MS, MAX_STABILITY_MS);

  if (
    severity === 'severe' &&
    (previousState.severeErrors ?? 0) === 0 &&
    stabilityBefore > 24 * 60 * 60 * 1000
  ) {
    const floor = stabilityBefore * 0.4;
    if (stabilityAfter < floor) {
      stabilityAfter = floor;
      reasonComponents.protectedFloorApplied = true;
    }
  }

  return {
    stabilityBefore,
    stabilityAfter,
    stabilityDelta: stabilityAfter - stabilityBefore,
    reasonComponents
  };
}
