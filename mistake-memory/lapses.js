/**
 * Lapse model — uses RECENT severe evidence, not lifetime (P1-5).
 *
 * Shared recent-window semantics with scheduler (RECENT_SEVERE_WINDOW_MS).
 */

import { classifySeverity } from './stability.js';

export const LAPSE_SEVERE_THRESHOLD = 2;
export const RECOVERY_SUCCESS_NEEDED = 4;

/**
 * Detect lapse using recent severe count, not lifetime severeErrors.
 */
export function detectLapse(previousState, attempt, masteryInfo = {}) {
  const severity = classifySeverity(attempt);
  const prevStatus = previousState.status;
  const wasStrong =
    prevStatus === 'MASTERED' ||
    prevStatus === 'STABLE' ||
    (previousState.combinedMastery ?? 0) >= 0.8;

  if (!wasStrong) {
    return { isLapse: false, reason: null };
  }

  if (severity !== 'severe' && !masteryInfo.isActionError) {
    return { isLapse: false, reason: null };
  }

  const evidence = previousState.attempts ?? 0;
  // RECENT severe, not lifetime
  const recentSevere = masteryInfo.recentSevereInWindow ?? previousState.recentSevereInWindow ?? 0;

  // First severe in recent window with low evidence → no lapse
  if (recentSevere === 0 && evidence < 8) {
    return { isLapse: false, reason: 'isolated_low_evidence' };
  }

  // Repeated severe WITHIN recent window
  if (recentSevere + 1 >= LAPSE_SEVERE_THRESHOLD) {
    return { isLapse: true, reason: 'repeated_severe_from_strong' };
  }

  // Single severe from very strong state → soft pass
  if (evidence >= 20 && (previousState.combinedMastery ?? 0) >= 0.9) {
    return { isLapse: false, reason: 'protected_strong_single' };
  }

  return { isLapse: false, reason: null };
}

export function applyLapse(state, timestamp) {
  return {
    lapseCount: (state.lapseCount ?? 0) + 1,
    lastLapseAt: timestamp,
    recoveryProgress: 0,
    status: 'LAPSED'
  };
}

export function updateRecovery(state, wasSuccess) {
  if (state.status !== 'LAPSED' && (state.lapseCount ?? 0) === 0) {
    return { recoveryProgress: state.recoveryProgress ?? 1 };
  }

  let progress = state.recoveryProgress ?? 0;
  if (wasSuccess) {
    progress = Math.min(1, progress + 1 / RECOVERY_SUCCESS_NEEDED);
  } else {
    progress = Math.max(0, progress - 0.25);
  }
  return { recoveryProgress: progress };
}
