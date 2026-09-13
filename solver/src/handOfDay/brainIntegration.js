// Hand of the Day → PokerSwipe Brain Integration
// Coordinates recording HOD attempts into Mistake Memory with deduplication.
// Single source of truth: recordTrainingResult() from personalizedTraining.js

import { recordTrainingResult } from '../training/personalizedTraining.js';
import { getConceptForScenario } from './scenarioConceptMapping.js';
import { buildMistakeMemoryAttempt, areHodAttemptsIdentical } from './gradingAdapter.js';

/**
 * Central coordinator for Hand of the Day attempt recording.
 * Ensures exactly-once semantics despite reload, back button, animation callbacks.
 */
export class HandOfDayBrainIntegration {
  constructor({ store, now = Date.now } = {}) {
    if (!store) throw new Error('HandOfDayBrainIntegration: store required');
    this.store = store;
    this.now = now;
    this.lastRecordedAttempt = null;  // Tracks last successful recording
  }

  /**
   * Record a Hand of the Day decision/result to Mistake Memory.
   *
   * Guarantees:
   * - Exactly one Mistake Memory entry per unique decision
   * - Duplicate calls (reload, back, animation callback) are silently ignored
   * - Returns { recorded: true/false, reason: string }
   *
   * Input:
   *   {
   *     scenarioId: string,
   *     userActions: string[],     (ordered decisions: ['raise', 'bet', 'call'])
   *     hodGrade: { grade, classification?, explanation? },
   *     timestamp?: number         (defaults to now())
   *   }
   */
  record({
    scenarioId,
    userActions = [],
    hodGrade = {},
    timestamp = null
  } = {}) {
    const ts = timestamp || this.now();

    // (1) Validate inputs
    if (!scenarioId) {
      return { recorded: false, reason: 'missing_scenario_id' };
    }
    if (!hodGrade || !hodGrade.grade) {
      return { recorded: false, reason: 'missing_grade' };
    }

    // (2) Check for duplicate (exact-once guard)
    const attempt = buildMistakeMemoryAttempt({
      scenarioId,
      userActions,
      timestamp: ts,
      hodGrade,
      concept: getConceptForScenario(scenarioId)
    });

    if (this.lastRecordedAttempt && areHodAttemptsIdentical(attempt, this.lastRecordedAttempt)) {
      // Same scenario + same actions within 5s = duplicate
      return { recorded: false, reason: 'duplicate', deduped: true };
    }

    // (3) Unmapped scenarios are still playable but excluded from learning
    if (!attempt.drill.concept || attempt.drill.concept === 'hand_of_day_unclassified') {
      // Scenario exists but has no canonical concept mapping
      // Store in history for reference but don't feed learning system
      this._recordUnmappedAttempt(attempt);
      this.lastRecordedAttempt = attempt;
      return { recorded: true, reason: 'unmapped_scenario', learning: false };
    }

    // (4) Record to Mistake Memory via canonical path
    try {
      const result = recordTrainingResult(this.store, {
        drill: attempt.drill,
        grade: attempt.grade,
        evLossBb: attempt.evLossBb,
        now: ts
      });

      if (result.recorded) {
        this.lastRecordedAttempt = attempt;
        return {
          recorded: true,
          reason: 'success',
          learning: true,
          concept: attempt.drill.concept,
          grade: attempt.grade,
          metadata: attempt.hodMetadata
        };
      } else {
        return {
          recorded: false,
          reason: 'training_result_failed',
          detail: result.reason
        };
      }
    } catch (e) {
      return {
        recorded: false,
        reason: 'exception',
        error: e.message
      };
    }
  }

  /**
   * Internal: Record unmapped scenario to history without touching learning system.
   * Preserves the attempt for analytics/debugging but excludes it from mastery.
   */
  _recordUnmappedAttempt(attempt) {
    try {
      if (typeof this.store.addHistoryEntry === 'function') {
        this.store.addHistoryEntry({
          concept: 'hand_of_day_unmapped',
          street: 'unknown',
          drillId: attempt.drill.drillId,
          spotId: attempt.drill.spotId,
          contentFingerprint: attempt.hodMetadata.scenarioId,
          grade: attempt.grade,
          evLossBb: attempt.evLossBb,
          skillTags: ['hand_of_day'],
          at: attempt.hodMetadata.timestamp,
          metadata: attempt.hodMetadata
        });
      }
    } catch (e) {
      // Never block on metadata recording
    }
  }

  /**
   * Get the last recorded attempt (for testing/debugging).
   */
  getLastAttempt() {
    return this.lastRecordedAttempt;
  }

  /**
   * Reset internal state (for testing).
   */
  reset() {
    this.lastRecordedAttempt = null;
  }
}

/**
 * Singleton instance for use by SessionController / UI.
 * Do NOT create multiple instances; always use getIntegration().
 */
let _integration = null;

export function initHandOfDayIntegration(store) {
  if (!_integration) {
    _integration = new HandOfDayBrainIntegration({ store });
  }
  return _integration;
}

export function getHandOfDayIntegration() {
  return _integration;
}

export function resetHandOfDayIntegration() {
  if (_integration) {
    _integration.reset();
  }
}
