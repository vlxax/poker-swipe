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
  getTrainerStrategyMap,
  getReferenceStrategyMap,
  resetProductionStrategyMap,
  loadProductionLibraryInto,
  signalsForItem,
  neighborsForRange
} from './strategyMapRuntime.js';
export { recordCanonicalAttempts, recordOneAttempt, reviewQueueForUser } from './memoryRuntime.js';
export { RANGE_INTELLIGENCE_POLICY, maybeEnrichWithRangeIntelligence } from './rangeIntelligence.js';
export { getCombinedRangeInventory, countTrainerGradableHands } from './trainerInventory.js';
export { adaptTrainerLibrary, adaptTrainerChartById } from './trainerLibrary.js';
export {
  computeDatasetVersion,
  readStructuralCache,
  writeStructuralCache,
  cacheMatchesVersion,
  CACHE_SCHEMA,
  ADAPTER_VERSION
} from './strategyMapCache.js';
