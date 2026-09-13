/**
 * Range-learning runtime — single entry for trainers.
 *
 * recordCanonicalAttempts() is the only write path into Mistake Memory
 * from production trainers (idempotent via attemptId).
 */

import { getLearnerMemory } from './persistence.js';
import { getProductionStrategyMap, signalsForItem } from './strategyMapRuntime.js';
import { buildFinalReviewQueue, strategyMapSignalsForHand } from './combinedPriority.js';
import { parseCanonicalItemId } from './itemId.js';

export function recordCanonicalAttempts(attempts, options = {}) {
  if (!attempts || !attempts.length) {
    return { processed: 0, received: 0, applied: 0, duplicates: 0, rejected: 0, errors: [], updatedItemIds: [] };
  }
  const mem = options.memory || getLearnerMemory(options.memoryOptions || {});
  return mem.recordAttempts(attempts, options);
}

export function recordOneAttempt(attempt, options = {}) {
  return recordCanonicalAttempts([attempt], options);
}

export function reviewQueueForUser({ now, recentTasks = [], maxItems = 20, memory = null } = {}) {
  const mem = memory || getLearnerMemory();
  const cache = getProductionStrategyMap();
  const strategyMapByItem = {};
  for (const state of mem.allStates()) {
    const parsed = parseCanonicalItemId(state.itemId);
    if (!parsed) continue;
    const adapted = cache.byId.get(parsed.rangeId);
    const extra = signalsForItem(parsed.rangeId, parsed.hand) || {};
    strategyMapByItem[state.itemId] = adapted
      ? strategyMapSignalsForHand(adapted, parsed.hand, extra)
      : extra;
  }
  return buildFinalReviewQueue({
    memoryStates: mem.allStates(),
    now,
    recentTasks,
    strategyMapByItem,
    maxItems
  });
}

export {
  getLearnerMemory,
  getProductionStrategyMap
};
