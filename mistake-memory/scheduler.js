/**
 * Review Scheduler.
 *
 * scheduleNextReview(memoryState, now, options)
 *
 * P0-2: `now` must be a valid processing/reference time.
 * Never pass an out-of-order event timestamp as now when lastSeenAt is newer.
 * processAttempts injects max(attempt.timestamp, state.lastSeenAt, options.now).
 *
 * P1-3: Scheduler uses recentSevereInWindow (not lifetime severeErrors).
 * After sufficient recovery, old severe mistakes no longer permanently
 * shorten intervals.
 */

import { estimateRetention, estimateForgettingRisk } from './forgetting.js';
import { clamp } from './math.js';
import { isMastered } from './memoryState.js';

export const MIN_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000;
export const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Sanitize scheduler reference time so it is never before relevant state timestamps.
 * @param {Object} memoryState
 * @param {number} now
 * @returns {number}
 */
export function resolveSchedulerNow(memoryState, now) {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error('scheduleNextReview: now must be a finite number');
  }
  let ref = now;
  if (memoryState.lastSeenAt != null && memoryState.lastSeenAt > ref) {
    ref = memoryState.lastSeenAt;
  }
  if (memoryState.lastErrorAt != null && memoryState.lastErrorAt > ref) {
    ref = memoryState.lastErrorAt;
  }
  return ref;
}

/**
 * Compute next interval and due time.
 */
export function scheduleNextReview(memoryState, now, options = {}) {
  const refNow = resolveSchedulerNow(memoryState, now);

  const stability = memoryState.stability ?? DEFAULT_INTERVAL_MS;
  const mastery = memoryState.combinedMastery ?? 0.5;
  const conf = memoryState.confidence ?? 0;
  const status = memoryState.status ?? 'NEW';
  const recentSevere = memoryState.recentSevereInWindow ?? 0;
  const attempts = memoryState.attempts ?? 0;

  const masteryFactor = 0.35 + 0.65 * mastery;
  const evidenceFactor = 0.45 + 0.55 * conf;

  let intervalMs = stability * masteryFactor * evidenceFactor;

  const reasons = {
    stability,
    masteryFactor,
    evidenceFactor,
    baseInterval: intervalMs,
    schedulerNow: refNow
  };

  // Recent error penalty — only if lastError is recent relative to refNow
  const lastError = memoryState.lastErrorAt;
  if (lastError != null && lastError <= refNow) {
    const age = refNow - lastError;
    if (age < 24 * 60 * 60 * 1000) {
      const recency = 1 - Math.min(1, age / (24 * 60 * 60 * 1000));
      const penalty = 0.35 + 0.3 * recency;
      intervalMs *= penalty;
      reasons.recentErrorPenalty = penalty;
    }
  }

  // Operational severe signal (NOT lifetime counter) — P1-3
  if (recentSevere >= 2) {
    intervalMs *= 0.6;
    reasons.recentSeverePenalty = 0.6;
    reasons.recentSevereInWindow = recentSevere;
  }

  if (status === 'LAPSED') {
    intervalMs *= 0.4;
    reasons.lapsePenalty = 0.4;
  }

  if (isMastered(memoryState) || status === 'MASTERED') {
    intervalMs *= 1.8;
    reasons.masteredStretch = 1.8;
  } else if (status === 'STABLE') {
    intervalMs *= 1.35;
    reasons.stableStretch = 1.35;
  }

  if (attempts < 3) {
    intervalMs = Math.min(intervalMs, 20 * 60 * 1000);
    reasons.newItemCap = true;
  }

  intervalMs = clamp(intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS);

  const anchor = memoryState.lastSeenAt ?? refNow;
  const dueAt = anchor + intervalMs;

  const { retention } = estimateRetention(memoryState, refNow);
  const forgettingRisk = estimateForgettingRisk(memoryState, refNow);
  const overdueRatio = dueAt < refNow ? Math.min(2, (refNow - dueAt) / intervalMs) : 0;

  let urgency =
    0.35 * forgettingRisk +
    0.25 * (1 - mastery) +
    0.20 * (1 - conf) +
    0.20 * Math.min(1, overdueRatio);

  if (status === 'LAPSED' || status === 'WEAK') urgency = Math.min(1, urgency + 0.25);
  if (status === 'MASTERED' && retention > 0.85) urgency *= 0.4;

  urgency = clamp(urgency, 0, 1);

  reasons.forgettingRisk = forgettingRisk;
  reasons.retention = retention;
  reasons.overdueRatio = overdueRatio;
  reasons.finalIntervalMs = intervalMs;
  reasons.urgency = urgency;

  return {
    dueAt,
    intervalMs,
    urgency,
    reasonBreakdown: reasons
  };
}
