/**
 * Integration layer: production PokerSwipe ranges ↔ Strategy Map ↔ Mistake Memory.
 * Not a second range library.
 */

export { ACTION_MAPPING_TABLE, mapProductionAction, mapProductionDistribution, isSupportedAction } from './actionMapping.js';
export {
  adaptProductionRange,
  adaptReferenceRange,
  adaptTrainerRange,
  adaptAtlasRange,
  adaptReferenceLibrary,
  inferSource,
  MISSING_HAND_SEMANTICS
} from './rangeAdapter.js';
export { canonicalItemId, parseCanonicalItemId, attemptIdFor } from './itemId.js';
export {
  handStrategyVersion,
  rangeStrategyVersion,
  datasetStrategyVersion,
  STRATEGY_VERSION_POLICY
} from './strategyVersion.js';
export {
  classifyChosenAction,
  targetDistributionForMemory,
  attemptFromReferencePolicy,
  attemptFromTrainerCell,
  attemptFromBattleshipTap,
  attemptsFromNarrowingGrade,
  PLAY_THRESHOLD
} from './attemptAdapter.js';
export { finalReviewPriority, buildFinalReviewQueue, strategyMapSignalsForHand } from './combinedPriority.js';
export {
  PersistentLearnerMemory,
  getLearnerMemory,
  resetLearnerMemorySingleton,
  resolveLearnerUserId,
  storageKeyForUser,
  createMemoryStorage,
  STORE_SCHEMA,
  STORAGE_PREFIX
} from './persistence.js';
export {
  getProductionStrategyMap,
  resetProductionStrategyMap,
  loadProductionLibraryInto,
  signalsForItem
} from './strategyMapRuntime.js';
export { recordCanonicalAttempts, recordOneAttempt, reviewQueueForUser } from './memoryRuntime.js';
export { RANGE_INTELLIGENCE_POLICY, maybeEnrichWithRangeIntelligence } from './rangeIntelligence.js';
