/**
 * ONE final review/session priority.
 *
 * Learner evidence (Mistake Memory reviewQueue.scoreItem) is the base.
 * Strategy Map signals may add a single bounded boost via applyStrategyMapBoost.
 *
 * Rules:
 *   - Do not apply SM boosts twice.
 *   - Do not let structural difficulty spam mastered items.
 *   - Boundary + demonstrated weakness may raise relevance.
 */

import { scoreItem } from '../mistake-memory/reviewQueue.js';
import { adaptStrategyMapSignals, applyStrategyMapBoost } from '../mistake-memory/strategyMapAdapter.js';
import { estimateForgettingRisk } from '../mistake-memory/forgetting.js';

export function finalReviewPriority({
  memoryState,
  now,
  recentTasks = [],
  strategyMapSignals = null
} = {}) {
  if (!memoryState) throw new Error('finalReviewPriority: memoryState required');
  const base = scoreItem(memoryState, now, recentTasks);
  const adapted = adaptStrategyMapSignals(memoryState, strategyMapSignals || {});
  let boost = adapted.priorityBoost || 0;

  const forgetting = typeof memoryState.forgettingRisk === 'number'
    ? memoryState.forgettingRisk
    : estimateForgettingRisk(memoryState, now);

  const masteredProtected =
    memoryState.status === 'MASTERED' && forgetting < 0.25;
  const stableProtected =
    memoryState.status === 'STABLE' && forgetting < 0.2;

  if (masteredProtected) {
    boost = 0;
  } else if (stableProtected) {
    boost = Math.min(boost, 0.03);
  }

  const weakness = 1 - (memoryState.combinedMastery ?? 0.5);
  if (strategyMapSignals?.boundaryHand && weakness > 0.35) {
    boost = Math.max(boost, Math.min(0.12, boost + 0.04));
    if (masteredProtected) boost = 0;
  }

  const score = applyStrategyMapBoost(base.score, boost);
  return {
    score,
    baseScore: base.score,
    strategyMapBoost: boost,
    signals: adapted.signals,
    breakdown: {
      ...base.breakdown,
      strategyMapBoost: boost
    },
    schedule: base.schedule,
    retry: base.retry,
    itemId: memoryState.itemId,
    state: memoryState
  };
}

export function buildFinalReviewQueue({
  memoryStates,
  now,
  recentTasks = [],
  strategyMapByItem = {},
  maxItems = 20
} = {}) {
  const scored = (memoryStates || []).map((state) =>
    finalReviewPriority({
      memoryState: state,
      now,
      recentTasks,
      strategyMapSignals: strategyMapByItem[state.itemId] || null
    })
  );
  scored.sort((a, b) => b.score - a.score);
  const limited = scored.slice(0, maxItems);
  return {
    items: limited.map((x) => x.state),
    scores: limited
  };
}

export function strategyMapSignalsForHand(adaptedRange, hand, extra = {}) {
  const actions = adaptedRange?.hands?.[hand]?.actions || {};
  const positive = Object.keys(actions).filter((a) => (actions[a] || 0) > 0);
  const mixed = positive.length > 1;
  const max = positive.length ? Math.max(...positive.map((a) => actions[a])) : 1;
  return {
    boundaryHand: mixed && max < 0.7,
    volatileEdge: mixed ? 1 - max : 0,
    structuralDifficulty: extra.structuralDifficulty ?? (mixed ? 0.45 : 0.1),
    transitionMagnitude: extra.transitionMagnitude || 0
  };
}
