/**
 * Short-term / same-session retry scheduler.
 *
 * Horizons (P1):
 *   SAME_SESSION_WINDOW_MS — only this window activates retry via lastErrorAt.
 *   recentSevereInWindow (14-day) is a LONG-TERM operational signal for
 *   review queue / main scheduler — NOT a short-term retry trigger.
 *
 * Candidates:
 *   - lastErrorAt within SAME_SESSION_WINDOW_MS
 *   - status WEAK or LAPSED
 */

import { clamp } from './math.js';

export const SAME_SESSION_WINDOW_MS = 25 * 60 * 1000;
export const MIN_RETRY_GAP_MS = 90 * 1000;

export function scheduleRetry(memoryState, recentTasks = [], options = {}) {
  const now = options.now;
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new Error('scheduleRetry: options.now must be a finite number');
  }

  const lastError = memoryState.lastErrorAt;
  const status = memoryState.status;

  const recentError =
    lastError != null &&
    (now - lastError) >= 0 &&
    (now - lastError) < SAME_SESSION_WINDOW_MS;

  const isCandidate =
    recentError ||
    status === 'WEAK' ||
    status === 'LAPSED';

  if (!isCandidate) {
    return {
      shouldRetry: false,
      retryAt: null,
      priority: 0,
      reason: 'not_candidate',
      antiRepeatPenalty: 0
    };
  }

  let antiRepeatPenalty = 0;
  const itemId = memoryState.itemId;
  const recentSame = (recentTasks || []).filter(
    t => t.itemId === itemId && (now - t.timestamp) < SAME_SESSION_WINDOW_MS
  );

  if (recentSame.length > 0) {
    const mostRecent = Math.max(...recentSame.map(t => t.timestamp));
    const gap = now - mostRecent;
    if (gap < MIN_RETRY_GAP_MS) {
      antiRepeatPenalty = 0.7;
    } else if (gap < 5 * 60 * 1000) {
      antiRepeatPenalty = 0.35;
    } else {
      antiRepeatPenalty = 0.15 * recentSame.length;
    }
  }

  let priority = 0.5;
  if (status === 'LAPSED') priority = 0.9;
  else if (status === 'WEAK') priority = 0.75;
  else if (recentError) priority = 0.6;

  priority = clamp(priority * (1 - antiRepeatPenalty), 0, 1);

  const baseDelay = antiRepeatPenalty > 0.5 ? 3 * 60 * 1000 : 90 * 1000;
  const retryAt = now + baseDelay;

  let reason = 'not_candidate';
  if (recentError) reason = 'recent_error';
  else if (status === 'LAPSED') reason = 'lapsed';
  else if (status === 'WEAK') reason = 'weak';
  if (antiRepeatPenalty > 0.4) reason = 'soft_anti_repeat';

  return {
    shouldRetry: priority > 0.25,
    retryAt,
    priority,
    reason,
    antiRepeatPenalty
  };
}
