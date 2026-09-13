/**
 * Thin Strategy Map adapter.
 *
 * Optional data may contain:
 *   boundaryHand, transitionMagnitude, volatileEdge, structuralDifficulty
 *
 * Field contract (P1-4):
 *   priorityBoost     — PASSTHROUGH. Returned to caller; reviewQueue does NOT
 *                       apply it automatically. Consumer must call
 *                       applyStrategyMapBoost(score, boost) if desired.
 *   signals.*         — PASSTHROUGH metadata for external consumers.
 *
 * Learner evidence must dominate scheduling. No poker theoretical assumptions.
 */

import { clamp } from './math.js';

/**
 * Enrich with secondary strategy-map signals.
 * @returns {{ priorityBoost: number, signals: Object }}
 */
export function adaptStrategyMapSignals(memoryState, strategyMapSignals = {}) {
  if (!strategyMapSignals || typeof strategyMapSignals !== 'object') {
    return { priorityBoost: 0, signals: {} };
  }

  let boost = 0;
  const signals = {};

  if (typeof strategyMapSignals.structuralDifficulty === 'number') {
    const d = clamp(strategyMapSignals.structuralDifficulty, 0, 1);
    boost += 0.08 * d;
    signals.structuralDifficulty = d;
  }

  if (typeof strategyMapSignals.volatileEdge === 'number') {
    const v = clamp(strategyMapSignals.volatileEdge, 0, 1);
    boost += 0.06 * v;
    signals.volatileEdge = v;
  }

  if (typeof strategyMapSignals.transitionMagnitude === 'number') {
    const t = clamp(strategyMapSignals.transitionMagnitude, 0, 1);
    boost += 0.05 * t;
    signals.transitionMagnitude = t;
  }

  if (strategyMapSignals.boundaryHand === true) {
    boost += 0.04;
    signals.boundaryHand = true;
  }

  boost = clamp(boost, 0, 0.22);

  return { priorityBoost: boost, signals };
}

/**
 * Apply boost to an existing queue score (caller responsibility).
 */
export function applyStrategyMapBoost(baseScore, priorityBoost) {
  return baseScore + (priorityBoost || 0);
}
