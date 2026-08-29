/**
 * Action Mastery model.
 *
 * Distinguishes legal vs illegal strategic actions.
 *
 * Classification semantics:
 * - PURE_MATCH     : correct highest-frequency (or only) action → strong positive
 * - IN_MIX         : legal mixed action (not necessarily highest) → positive but lower weight
 * - RARE_MIX       : legal but rare → mild positive / low confidence contribution
 * - OUT_OF_STRATEGY: illegal → real action error, strong negative
 *
 * Do NOT punish IN_MIX simply because it was not the highest-frequency action.
 *
 * Mastery and confidence are SEPARATE:
 * - mastery ≈ estimated probability of correct action knowledge
 * - confidence ≈ how much evidence we have (sample size + recency)
 *
 * Formula (documented):
 *
 * We maintain running Bayesian success rate with severity weights.
 *
 * successWeight:
 *   PURE_MATCH   = 1.0
 *   IN_MIX       = 0.85
 *   RARE_MIX     = 0.55
 *   OUT_OF_STRATEGY = 0.0
 *
 * failureWeight for OUT_OF_STRATEGY = 1.0 (full error)
 *
 * actionMastery = bayesianRate(weightedSuccesses, totalWeight)
 * confidence    = sampleConfidence(attempts)
 *
 * Recency is applied via exponential moving weight in the update.
 */

import { bayesianRate, sampleConfidence, clamp } from './math.js';
import { gradeAttempt } from './grading.js';

export const ACTION_WEIGHTS = {
  PURE_MATCH: 1.0,
  IN_MIX: 0.85,
  RARE_MIX: 0.55,
  OUT_OF_STRATEGY: 0.0
};

/**
 * Compute contribution of a single attempt to action success.
 * @param {Object} attempt
 * @returns {{ successContribution: number, weight: number, isError: boolean }}
 */
export function actionAttemptContribution(attempt) {
  const g = gradeAttempt(attempt);
  if (g.classification === 'OUT_OF_STRATEGY') {
    return { successContribution: 0, weight: 1.0, isError: true };
  }
  if (g.classification === 'PURE_MATCH') {
    return { successContribution: 1.0, weight: 1.0, isError: false };
  }
  if (g.classification === 'IN_MIX') {
    return { successContribution: 0.85, weight: 1.0, isError: false };
  }
  if (g.classification === 'RARE_MIX') {
    return { successContribution: 0.55, weight: 0.8, isError: false };
  }
  return { successContribution: 0.5, weight: 0.5, isError: false };
}

/**
 * Update action mastery from previous state + new attempt.
 *
 * We keep a simple running total of weighted successes and total weight.
 * For transparency we also keep raw counts.
 *
 * @param {Object} previousState
 * @param {Object} attempt
 * @param {Object} [options]
 * @returns {{
 *   actionMastery: number,
 *   actionConfidence: number,
 *   weightedSuccesses: number,
 *   totalWeight: number,
 *   isActionError: boolean
 * }}
 */
export function updateActionMastery(previousState, attempt, options = {}) {
  const prevWeighted = previousState._actionWeightedSuccesses ?? 0;
  const prevTotalW = previousState._actionTotalWeight ?? 0;
  const prevAttempts = previousState.attempts ?? 0;

  const { successContribution, weight, isError } = actionAttemptContribution(attempt);

  // Optional recency discount on old mass (very light)
  const recencyDecay = options.recencyDecay ?? 0.995;
  const decayedWeighted = prevWeighted * recencyDecay;
  const decayedTotal = prevTotalW * recencyDecay;

  const newWeighted = decayedWeighted + successContribution * weight;
  const newTotal = decayedTotal + weight;

  // Bayesian rate with prior (1 success / 2 total ≈ 0.5 prior)
  const actionMastery = bayesianRate(newWeighted, newTotal, 1, 2);
  const actionConfidence = sampleConfidence(prevAttempts + 1, options.confidenceScale ?? 12);

  return {
    actionMastery: clamp(actionMastery, 0, 1),
    actionConfidence: clamp(actionConfidence, 0, 1),
    weightedSuccesses: newWeighted,
    totalWeight: newTotal,
    isActionError: isError
  };
}

/**
 * Combined mastery from action + frequency.
 *
 * When frequencyMastery is null (no frequency target / N/A):
 *   combinedMastery = actionMastery  (frequency does not constrain)
 *
 * Otherwise: weighted geometric mean.
 *
 * @param {number} actionMastery
 * @param {number|null} frequencyMastery
 * @param {number} [actionWeight=0.55]
 * @returns {number}
 */
export function computeCombinedMastery(actionMastery, frequencyMastery, actionWeight = 0.55) {
  const a = clamp(actionMastery, 0.01, 1);
  if (frequencyMastery == null || !Number.isFinite(frequencyMastery)) {
    return clamp(actionMastery, 0, 1);
  }
  const f = clamp(frequencyMastery, 0.01, 1);
  const w = clamp(actionWeight, 0, 1);
  return Math.pow(a, w) * Math.pow(f, 1 - w);
}
