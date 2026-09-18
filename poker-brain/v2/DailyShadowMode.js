/**
 * Daily Shadow Mode - V2.16 Evidence Reconciliation
 *
 * Runs PokerBrain V2 against Daily tasks in SHADOW mode.
 * Does NOT change Daily grading.
 * Captures evidence for later reconciliation.
 *
 * Output: daily_brain_shadow_report.json with all conflicts and matches.
 */

import { analyzeWithV2, getDecisionContext } from './GradingIntegration.js';

/**
 * Daily task - wrapper for existing drill/assessment
 */
class DailyTaskShadow {
  constructor(task, taskIndex) {
    this.taskId = task.id || `task-${taskIndex}`;
    this.task = task;
    this.libraryGrade = task.grade || null; // What Daily grading said
    this.libraryReason = task.reason || null;

    this.v2Analysis = null;
    this.match = null; // 'EXACT' | 'ACCEPTABLE' | 'CONFLICT' | 'NOT_COMPARABLE'
  }

  /**
   * Run V2 analysis on this task
   */
  runV2(options = {}) {
    // Convert Daily drill/assessment to feature input
    const input = this._buildFeatureInput();
    if (!input) {
      this.match = 'NOT_COMPARABLE';
      return;
    }

    try {
      this.v2Analysis = analyzeWithV2('daily', input, options);

      // Compare with library grading
      this._compareResults();
    } catch (err) {
      this.v2Analysis = { error: err.message };
      this.match = 'ERROR';
    }
  }

  /**
   * Build PokerSwipe feature input from Daily task
   */
  _buildFeatureInput() {
    const task = this.task;

    // Accept various task formats
    if (task.drill) {
      // personalized drill
      return {
        drill: task.drill,
        chosenActionId: task.chosenId,
        solution: task.solution || {}
      };
    }

    if (task.scenario) {
      // assessment-like
      return {
        drill: {
          scenario: task.scenario,
          id: task.id,
          stack: task.stack,
          preset: task.preset
        },
        chosenActionId: task.chosenId
      };
    }

    // Unrecognized format
    return null;
  }

  /**
   * Compare Library grading with V2 recommendation
   */
  _compareResults() {
    if (!this.v2Analysis || !this.libraryGrade) {
      this.match = 'NOT_COMPARABLE';
      return;
    }

    const v2Rec = this.v2Analysis.v2Recommendation;
    const v2Source = this.v2Analysis.v2Source;

    if (!v2Rec) {
      this.match = 'NO_V2_EVIDENCE';
      return;
    }

    // Try to compare action recommendations
    const libraryAction = this._extractAction(this.libraryGrade);
    const v2Action = this._extractAction(v2Rec);

    if (!libraryAction || !v2Action) {
      this.match = 'NOT_COMPARABLE';
      return;
    }

    if (libraryAction === v2Action) {
      this.match = 'EXACT_MATCH';
    } else if (this._isAcceptableVariance(libraryAction, v2Action)) {
      this.match = 'ACCEPTABLE_VARIANCE';
    } else {
      this.match = 'POLICY_CONFLICT';
    }
  }

  /**
   * Extract action from policy/grade object
   */
  _extractAction(policy) {
    if (typeof policy === 'string') return policy;
    if (policy && policy.topActions && Array.isArray(policy.topActions)) {
      return policy.topActions[0]?.action || null;
    }
    if (policy && policy.recommendedAction) {
      return policy.recommendedAction;
    }
    return null;
  }

  /**
   * Is this variance acceptable?
   * (e.g., both are reasonable in similar context)
   */
  _isAcceptableVariance(libraryAction, v2Action) {
    // Check if both are in top actions
    if (this.v2Analysis.v2Recommendation && this.v2Analysis.v2Recommendation.topActions) {
      const topThree = this.v2Analysis.v2Recommendation.topActions.map(a => a.action);
      if (topThree.includes(libraryAction)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Export result for JSON report
   */
  toReport() {
    return {
      taskId: this.taskId,
      contextSummary: this.v2Analysis?.contextSummary || null,
      match: this.match,
      libraryGrade: this.libraryGrade,
      v2Status: this.v2Analysis?.v2Status,
      v2Recommendation: this.v2Analysis?.v2Recommendation,
      v2Source: this.v2Analysis?.v2Source,
      v2Confidence: this.v2Analysis?.v2Confidence,
      contextIgnored: this.v2Analysis?.v2ContextIgnored,
      evidence: this.v2Analysis?.v2Evidence || []
    };
  }
}

/**
 * Run Daily shadow analysis on task batch
 */
export function runDailyShadowBatch(tasks, options = {}) {
  const batch = [];
  const results = {
    totalTasks: tasks.length,
    analyzed: 0,
    matches: {
      EXACT_MATCH: 0,
      ACCEPTABLE_VARIANCE: 0,
      POLICY_CONFLICT: 0,
      NOT_COMPARABLE: 0,
      NO_V2_EVIDENCE: 0,
      ERROR: 0
    }
  };

  for (let i = 0; i < tasks.length; i++) {
    const shadow = new DailyTaskShadow(tasks[i], i);
    shadow.runV2(options);
    batch.push(shadow);

    results.analyzed++;
    results.matches[shadow.match] = (results.matches[shadow.match] || 0) + 1;
  }

  // Generate summary statistics
  results.summaryByMatch = {};
  for (const [match, count] of Object.entries(results.matches)) {
    results.summaryByMatch[match] = {
      count,
      percentage: (count / results.analyzed * 100).toFixed(1)
    };
  }

  return {
    results,
    tasks: batch,
    reportJson: () => ({
      timestamp: new Date().toISOString(),
      summary: results,
      tasks: batch.map(t => t.toReport())
    })
  };
}

export { DailyTaskShadow };
export default {
  runDailyShadowBatch,
  DailyTaskShadow
};
