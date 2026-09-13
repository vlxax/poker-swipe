/**
 * Frequency Mastery model.
 *
 * TVD distance; target versioning via hash.
 *
 * targetDistribution is the canonical multi-action frequency target.
 *
 * targetProbability (P0-2):
 *   Does NOT invent { [chosenAction]: p, __other__: 1-p }.
 *   That made target identity depend on chosenAction and reset counters
 *   on every action change.
 *   targetProbability alone is ignored for frequency target identity.
 *   Use full targetDistribution for multi-action frequency learning.
 */

import { clamp, sampleConfidence, totalVariationDistance, hashTargetDistribution } from './math.js';
import { validateTargetDistribution } from './frequencyValidation.js';

export function createEmptyCounters() {
  return {};
}

export function updateCounters(prevCounters, chosenAction) {
  if (!chosenAction || typeof chosenAction !== 'string') {
    return { ...prevCounters };
  }
  const next = { ...prevCounters };
  next[chosenAction] = (next[chosenAction] ?? 0) + 1;
  return next;
}

export function toEmpirical(counters) {
  const total = Object.values(counters).reduce((s, v) => s + v, 0);
  if (total === 0) return {};
  const emp = {};
  for (const [k, v] of Object.entries(counters)) {
    emp[k] = v / total;
  }
  return emp;
}

/**
 * Resolve stable target distribution.
 * Canonical: attempt.targetDistribution | context.targetDistribution | options.targetDistribution | persisted.
 * targetProbability alone does NOT create a target (P0-2).
 */
export function resolveTargetDistribution(previousState, attempt, options = {}) {
  const candidates = [
    attempt.targetDistribution,
    attempt.context && attempt.context.targetDistribution,
    options.targetDistribution
  ];

  for (const cand of candidates) {
    if (cand && typeof cand === 'object' && Object.keys(cand).length > 0) {
      const v = validateTargetDistribution(cand);
      if (!v.ok) {
        throw new Error('Invalid targetDistribution: ' + v.errors.join('; '));
      }
      const target = { ...cand };
      return { target, hash: hashTargetDistribution(target) };
    }
  }

  // Persist previous stable target
  if (previousState._targetDistribution && Object.keys(previousState._targetDistribution).length > 0) {
    const target = { ...previousState._targetDistribution };
    return { target, hash: previousState._frequencyTargetHash || hashTargetDistribution(target) };
  }

  return { target: null, hash: null };
}

export function computeFrequencyMastery(counters, targetDistribution, options = {}) {
  const sampleSize = Object.values(counters || {}).reduce((s, v) => s + v, 0);
  const empirical = toEmpirical(counters || {});
  const conf = sampleConfidence(sampleSize, options.confidenceScale ?? 15);

  const hasTarget =
    targetDistribution != null &&
    typeof targetDistribution === 'object' &&
    Object.keys(targetDistribution).length > 0;

  if (!hasTarget) {
    return {
      frequencyMastery: null,
      frequencyConfidence: 1,
      frequencyDeviation: 0,
      empirical,
      sampleSize,
      hasFrequencyTarget: false,
      targetHash: null
    };
  }

  const distance = totalVariationDistance(empirical, targetDistribution);
  const correctness = 1 - distance;
  const mastery = correctness * (0.35 + 0.65 * conf);

  return {
    frequencyMastery: clamp(mastery, 0, 1),
    frequencyConfidence: conf,
    frequencyDeviation: clamp(distance, 0, 1),
    empirical,
    sampleSize,
    hasFrequencyTarget: true,
    targetHash: hashTargetDistribution(targetDistribution)
  };
}

export function updateFrequencyMastery(previousState, attempt, options = {}) {
  const { target: resolvedTarget, hash: newHash } = resolveTargetDistribution(
    previousState,
    attempt,
    options
  );

  const prevHash = previousState._frequencyTargetHash ?? null;
  let counters = previousState._frequencyCounters ?? createEmptyCounters();

  if (newHash != null && prevHash != null && newHash !== prevHash) {
    counters = createEmptyCounters();
  } else if (newHash != null && prevHash == null && Object.keys(counters).length > 0) {
    counters = createEmptyCounters();
  }

  const chosen = attempt.chosenAction;
  const newCounters = updateCounters(counters, chosen);
  const result = computeFrequencyMastery(newCounters, resolvedTarget, options);

  return {
    ...result,
    _frequencyCounters: newCounters,
    _targetDistribution: resolvedTarget,
    _frequencyTargetHash: newHash
  };
}
