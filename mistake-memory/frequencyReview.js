/**
 * Frequency Review Plan builder.
 *
 * Uses validateTargetDistribution() as sole distribution validator.
 */

import { clamp } from './math.js';
import { validateTargetDistribution } from './frequencyValidation.js';

/**
 * @param {Object} item
 * @param {Record<string, number>} targetDistribution
 * @param {Object} [options]
 */
export function buildFrequencyReviewPlan(item, targetDistribution, options = {}) {
  if (targetDistribution == null) {
    throw new Error('targetDistribution is required');
  }
  const v = validateTargetDistribution(targetDistribution);
  if (!v.ok) {
    throw new Error('Invalid targetDistribution: ' + v.errors.join('; '));
  }

  const actions = Object.keys(targetDistribution).filter(
    a => typeof targetDistribution[a] === 'number' && targetDistribution[a] > 0
  );

  if (actions.length === 0) {
    throw new Error('targetDistribution must contain at least one positive probability');
  }

  const entropyish = actions.length;
  const minSamples = options.minSamples ?? 8;
  const maxSamples = options.maxSamples ?? 25;
  const base = 6 + entropyish * 3;
  const sampleTarget = clamp(base, minSamples, maxSamples);
  const tolerance = options.tolerance ?? (sampleTarget >= 15 ? 0.12 : 0.18);
  const requiredObservations = sampleTarget;

  return {
    sampleTarget,
    actions,
    requiredObservations,
    tolerance,
    completionCriteria: {
      minObservations: requiredObservations,
      maxAbsDeviation: tolerance,
      requirePresenceFor: actions.filter(a => targetDistribution[a] >= 0.15),
      successWhen: 'empirical_within_tolerance'
    },
    itemId: item.itemId || item.id || null,
    targetDistribution: { ...targetDistribution }
  };
}
