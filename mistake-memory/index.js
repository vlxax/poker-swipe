/**
 * Mistake Memory + Spaced Repetition Engine
 * Standalone module for PokerSwipe (or any learner).
 *
 * Public API surface.
 */

export {
  createInitialMemoryState,
  updateMemoryState,
  isMastered,
  deriveStatus,
  hasFrequencyTarget,
  rebuildFromEventLog,
  snapshotCheckpoint,
  semanticSnapshot,
  successWeight,
  SCHEMA_VERSION,
  SEEN_ATTEMPT_ID_LIMIT,
  EVENT_LOG_LIMIT,
  RECENT_SEVERE_WINDOW_MS
} from './memoryState.js';

export {
  estimateRetention,
  estimateForgettingRisk,
  MIN_STABILITY_MS,
  MAX_STABILITY_MS
} from './forgetting.js';

export {
  updateStability,
  classifySeverity,
  BASE_STABILITY_MS
} from './stability.js';

export {
  updateActionMastery,
  computeCombinedMastery,
  actionAttemptContribution,
  ACTION_WEIGHTS
} from './mastery.js';

export {
  computeFrequencyMastery,
  updateFrequencyMastery,
  toEmpirical,
  createEmptyCounters,
  resolveTargetDistribution
} from './frequencyMastery.js';

export {
  scheduleNextReview,
  resolveSchedulerNow,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS
} from './scheduler.js';

export {
  scheduleRetry,
  SAME_SESSION_WINDOW_MS,
  MIN_RETRY_GAP_MS
} from './retryScheduler.js';

export {
  detectLapse,
  applyLapse,
  updateRecovery
} from './lapses.js';

export {
  buildReviewQueue,
  scoreItem
} from './reviewQueue.js';

export {
  buildReviewSession
} from './sessionBuilder.js';

export {
  buildFrequencyReviewPlan
} from './frequencyReview.js';

export {
  MemoryStore,
  processAttempts,
  migrateMemoryState
} from './memoryStore.js';

export {
  adaptRangeIntelligence
} from './rangeIntelligenceAdapter.js';

export {
  adaptStrategyMapSignals,
  applyStrategyMapBoost
} from './strategyMapAdapter.js';

export {
  clamp,
  expDecay,
  bayesianRate,
  sampleConfidence,
  frequencyAbsDeviation,
  totalVariationDistance,
  hashTargetDistribution,
  klDivergence,
  createMulberry32,
  simpleHash
} from './math.js';

export {
  validateAttempt,
  validateTimestamp,
  validateMemoryState
} from './validation.js';

export {
  validateTargetDistribution,
  validateTargetProbability,
  assertFrequencyTargetContract,
  PROB_SUM_TOLERANCE
} from './frequencyValidation.js';

export { gradeAttempt, WEAKNESS_SEVERE, WEAKNESS_RARE, WEAKNESS_IN_MIX } from './grading.js';
