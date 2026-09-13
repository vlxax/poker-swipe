/**
 * Due Queue builder.
 *
 * buildReviewQueue({ memoryStates, now, recentTasks, maxItems })
 *
 * Priority order (documented):
 * 1. overdue reviews
 * 2. high forgetting risk
 * 3. demonstrated weakness
 * 4. recent lapses
 * 5. low frequency mastery
 * 6. low action mastery
 * 7. insufficient evidence
 * 8. variety / anti-repeat
 *
 * Returns score breakdown for every item.
 * Avoids over-reviewing strong items (reviewBurden).
 */

import { scheduleNextReview } from './scheduler.js';
import { estimateForgettingRisk } from './forgetting.js';
import { scheduleRetry } from './retryScheduler.js';
import { clamp } from './math.js';

/**
 * Compute a composite priority score for one memory state.
 * Higher = more urgent.
 * @param {Object} state
 * @param {number} now
 * @param {Object[]} recentTasks
 * @returns {{ score: number, breakdown: Object, schedule: Object, retry: Object }}
 */
export function scoreItem(state, now, recentTasks = []) {
  const schedule = scheduleNextReview(state, now);
  const forgettingRisk = estimateForgettingRisk(state, now);
  const retry = scheduleRetry(state, recentTasks, { now });

  const overdueMs = Math.max(0, now - (schedule.dueAt ?? now));
  const overdueScore = Math.min(1, overdueMs / (6 * 60 * 60 * 1000)); // saturate at 6h

  const weakness = 1 - (state.combinedMastery ?? 0.5);
  const lowEvidence = 1 - (state.confidence ?? 0);
  // P0-3: no frequency target → frequency weakness contribution = 0
  const hasFreq = state.hasFrequencyTarget === true;
  const lowFreq = (hasFreq && state.frequencyMastery != null)
    ? 1 - state.frequencyMastery
    : 0;
  const lowAction = 1 - (state.actionMastery ?? 0.5);
  const lapseBoost = state.status === 'LAPSED' ? 0.35 : (state.lapseCount ?? 0) > 0 ? 0.15 : 0;

  // Anti-repeat from recentTasks
  let antiRepeat = 0;
  const recentCount = (recentTasks || []).filter(t => t.itemId === state.itemId).length;
  if (recentCount > 0) {
    antiRepeat = Math.min(0.6, 0.2 * recentCount);
  }

  // Review burden: strong items get score suppression
  let burdenPenalty = 0;
  if (state.status === 'MASTERED' && forgettingRisk < 0.25) {
    burdenPenalty = 0.55;
  } else if (state.status === 'STABLE' && forgettingRisk < 0.2) {
    burdenPenalty = 0.3;
  }

  const score =
    0.28 * overdueScore +
    0.22 * forgettingRisk +
    0.15 * weakness +
    0.10 * lapseBoost +
    0.08 * lowFreq +
    0.07 * lowAction +
    0.05 * lowEvidence +
    0.05 * (retry.shouldRetry ? retry.priority : 0) -
    antiRepeat -
    burdenPenalty;

  const breakdown = {
    overdueScore,
    forgettingRisk,
    weakness,
    lapseBoost,
    lowFreq,
    lowAction,
    lowEvidence,
    retryPriority: retry.shouldRetry ? retry.priority : 0,
    antiRepeat,
    burdenPenalty,
    rawScore: score
  };

  return {
    score: clamp(score, -1, 2),
    breakdown,
    schedule,
    retry
  };
}

/**
 * Build ordered review queue.
 * @param {Object} params
 * @param {Object[]} params.memoryStates
 * @param {number} params.now
 * @param {Object[]} [params.recentTasks]
 * @param {number} [params.maxItems=20]
 * @returns {{ items: Object[], scores: Object[] }}
 */
export function buildReviewQueue({ memoryStates, now, recentTasks = [], maxItems = 20 }) {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error('buildReviewQueue: now must be a finite number');
  }

  const scored = (memoryStates || []).map(state => {
    const s = scoreItem(state, now, recentTasks);
    return {
      itemId: state.itemId,
      state,
      ...s
    };
  });

  // Sort descending score
  scored.sort((a, b) => b.score - a.score);

  const limited = scored.slice(0, maxItems);

  return {
    items: limited.map(x => x.state),
    scores: limited.map(x => ({
      itemId: x.itemId,
      score: x.score,
      breakdown: x.breakdown,
      dueAt: x.schedule.dueAt,
      urgency: x.schedule.urgency,
      retry: x.retry
    }))
  };
}
