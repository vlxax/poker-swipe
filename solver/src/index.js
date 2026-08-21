import { PokerSwipeSolver } from './api/solverApi.js';

export const VERSION = 'solver-core';
export { PokerSwipeSolver } from './api/solverApi.js';
export { calculateEquity } from './equity/index.js';
export { evaluateCards, compareHands, compareEvaluations, handName } from './cards/handEvaluator.js';
export { expandRange, removeBlockedCombos, comboCountForRange } from './ranges/rangeExpander.js';
export { calculatePotOdds } from './math/potOdds.js';
export { calculateRequiredEquity } from './math/requiredEquity.js';
export { calculateSPR } from './math/spr.js';
export { calculateCallEV, calculateBetEV, calculateRaiseEV, calculateFoldEV } from './math/ev.js';
export { analyzeDecision } from './analysis/decisionAnalyzer.js';
export { buildExplanation } from './explanations/explanationBuilder.js';
export { classifyMistake } from './analysis/mistakeClassifier.js';
export { SolverError } from './api/errors.js';
// Strategic CFR solver surface.
export { buildGameTree } from './tree/treeBuilder.js';
export { solveCFR, solvePreflop } from './cfr/cfrSolver.js';
export { analyzeHand } from './hand/handAnalyzer.js';
export { replayHand } from './hand/replayHand.js';
export { buildHandExplanation } from './hand/handExplanation.js';
export { inspectDecision, detectInterestingSpots } from './hand/interestingSpots.js';
export { conceptFor, conceptList } from './hand/concepts.js';
export { buildBetSizingModel, calculateGeometricSizing, pruneSizes, pickSpread, mergeNearDuplicates } from './abstraction/betSizingModel.js';
export { preflopLegalActions, preflopApplyAction } from './preflop/preflopActions.js';
export { CFRTrainer } from './cfr/cfrTrainer.js';
export { computeExploitability, rootActionEV } from './cfr/exploitability.js';
export { regretMatching } from './cfr/regretMatching.js';
export { averageStrategy } from './cfr/strategyAccumulator.js';
export { aggregateStrategy, normalizeReach } from './ranges/rangePropagation.js';
export { AdaptiveConvergence, buildAdaptiveConfig, DEFAULT_ADAPTIVE_CONFIG } from './cfr/adaptiveConvergence.js';
export { solverConfidence, confidenceFor } from './analysis/confidence.js';
export { classifySeverity, classifyLoss, SEVERITY_ORDER } from './config/thresholds.js';
export {
  computeReachSnapshot, rangeEquilibrationDelta, rangeEquilibrationStable, rangeEquilibrationResult
} from './analysis/rangeEquilibration.js';
export { buildSolverExplanation } from './explanations/explanationBuilder.js';
export { adaptPokerSwipeHand, defaultRangesFor, handContentKey, stableHash } from './integration/pokerSwipeHandAdapter.js';
export { buildReviewModel, reviewPokerSwipeHandAsync } from './integration/reviewModel.js';
export { createHandCache, stableHash as cacheHash } from './integration/cache.js';
// Personalised training layer.
export {
  LEAKS, classifyConcept, leakLabelRu, leakDefinitionRu, isKnownLeak, conceptFamilyLabelRu
} from './training/concepts.js';
export { normalizeCandidate, candidateIdentity, ANALYZER_VERSION } from './training/candidateNormalizer.js';
export {
  createLeakProfile, recordLeakEvent, buildLeakProfile, leakEventFromCandidate, TREND_MIN_SAMPLE
} from './training/leakProfile.js';
export { computePriority, rankLeaks } from './training/priority.js';
export { isTrivialDecision, validateDrillDecision, distinctActions } from './training/drillValidator.js';
export {
  dealCards, nextVariant, buildScenarioInput, classifyDifficulty, actionLabelRu,
  buildDrillModel, generateDrill
} from './training/drillGenerator.js';
export {
  gradeForLoss, feedbackForGrade, gradeAnswer, GRADE_ORDER
} from './training/answerEvaluator.js';
export {
  createConceptProgress, recordAttempt, buildProgress, MIN_SAMPLE as PROGRESS_MIN_SAMPLE
} from './training/progress.js';
export { buildTrainingSession, getDailyPersonalizedTraining as planDailyTraining, recentDrilledKeys } from './training/sessionBuilder.js';
export { createTrainingStore, STORE_VERSION } from './training/trainingStore.js';
export {
  getTopLeaks, recordCandidate, recordTrainingResult,
  getDailyPersonalizedTraining, getDailyPersonalizedTrainingAsync, buildPersonalizedSessionAsync
} from './training/personalizedTraining.js';
// P0 night-build additions.
export {
  SKILLS, SKILL_TO_CONCEPTS, skillLabelRu, skillDefinitionRu, conceptsForSkill,
  skillsForConcept, normalizeSkill, createSkillEvidence, recordSkillEvidence,
  scoreFromEvidence, confidenceFromEvidence, trendFromEvidence, buildSkillProfile,
  overallLabel, confidenceLabel, skillProfileId, updateSkillProfileInStore,
  seedSkillEvidenceFromAssessment, recordSkillEvidenceForTags, scoredSkillFromEvidence
} from './training/skillProfile.js';
export {
  ERROR_CAUSES, errorCauseLabelRu, errorCauseTipRu, classifyErrorCause, errorCauseFromMistake
} from './training/errorCause.js';
export {
  ASSESSMENT_POOL, REQUIRED_SKILLS, buildAssessmentSet, buildAssessmentEligiblePool,
  getAssessmentEligiblePool, getDiagnosticEligiblePool, getPlacementEligiblePool,
  gradeAssessmentItem, runAssessment,
  createDiagnosticSession, createDiagnosticSessionSeed, selectNextDiagnosticItem,
  submitDiagnosticAnswer, simulateDiagnosticRun, validateDiagnosticItem, validateDiagnosticPool,
  getDiagnosticPoolSize, DIAGNOSTIC_COUNT_DEFAULT, DIAGNOSTIC_COUNT_MIN, DIAGNOSTIC_COUNT_MAX,
  PLACEMENT_TEST_V2, PLACEMENT_COUNT_DEFAULT, PLACEMENT_COUNT_MIN, PLACEMENT_COUNT_MAX,
  createPlacementSession, createPlacementSessionSeed, selectNextPlacementItem,
  submitPlacementAnswer, simulatePlacementRun, placementSessionSummary, placementEvidenceWeight,
  getPlacementPoolStats
} from './training/assessment.js';
export {
  PLACEMENT_MODES, getValidatedMttTasks, libraryTaskToPlacementItem,
  assignMiniAppMode, formatPlacementContext
} from './training/placementTaskAdapter.js';
export {
  PLACEMENT_SKILLS, CALIBRATION_TIERS
} from './training/placementTestV2.js';
export {
  DIAGNOSTIC_CATEGORIES, DIAGNOSTIC_CATEGORY_IDS, getDiagnosticPool,
  getDiagnosticPoolByCategory, formatDiagnosticQuestion
} from './training/diagnosticPool.js';
export {
  recommendedStartingDifficulty, diagnosticSessionSummary, evidenceWeight,
  getDiagnosticCategoryCoverage, getDiagnosticDifficultyCoverage, getDiagnosticSkillCoverage
} from './training/diagnosticSelection.js';
export {
  SPOT_KINDS, normalizeSpot, masteryOf, isMastered, recentAccuracy, adaptiveDifficulty,
  spacedInterval, conceptDue, spotEligible, sessionGoal, earliestMeaningful, selectSpots,
  SESSION_SLOT_KINDS, buildSkillTiers, sessionSlotOrder
} from './training/spotSelector.js';
export {
  getTargetDifficulty, getSpotTargetDifficulty, scoreToBaseDifficulty, spotDifficultyScore,
  difficultyFit, pickRelevantSkillForSpot, recentResultsForSkill, adjustDifficultyFromPerformance,
  DIFFICULTY_MIN, DIFFICULTY_MAX
} from './training/adaptiveDifficulty.js';
export {
  MASTERY_STATES, REVIEW_INTERVAL_DAYS, DAY_MS, createSkillMasteryRecord,
  deriveMasteryState, buildSkillMasteryStates, applySkillMasteryTraining,
  applyTrainingToMasteryStore, masteryBoostForSpot, updateSkillMasteryAfterTraining,
  syncSkillMasteryStore, meetsMasteredCriteria, reviewIntervalDays, intervalMsForIndex
} from './training/skillMastery.js';
export { poolFromLibrary, buildDailyPlan, planSummaryRu, deriveSkillTags, mapLeakConceptForTask, computeSkillTargets } from './training/planner.js';
export { buildMiniAppPlan, MINI_APP_SPECS } from './training/miniAppPlanner.js';
export {
  buildPlayerStore, buildDifferentiationReport, generateDifferentiationPlan,
  taskDistribution, topWeaknesses, overlapCount, uniqueSkillCount,
  classifyTrainingBucket, PLAYER_PROFILE_SEEDS, DIFFERENTIATION_PLAN_COUNT,
  DIFFERENTIATION_PLAN_NOW
} from './training/playerDifferentiationFixtures.js';
export { getTaskPool, loadTaskLibrary, auditTaskMetadata, hasUsablePlayerProfile } from './training/taskLibraryBridge.js';
export {
  drillFromLibraryTask,
  libraryTaskToBrainSpot,
  choiceToActionType,
  explanationMatchesTask
} from './training/libraryDrill.js';
export { buildTaskFeedback, skillScoresForHome } from './training/taskFeedback.js';
export { spotFingerprint, contentFingerprint, diversityPenalty, isTooSimilar, sessionRepetitionPenalty, recentFingerprints } from './training/sessionDiversity.js';
export { createPersonalizationSeed, seededRng, seedToNumber } from './training/personalizationSeed.js';
export { leakBoostForSpot, spotMatchesLeakConcept, LEAK_SPOT_MATCHERS } from './training/leakSpotMapping.js';
export { createAnalytics, isKnownEvent } from './training/analytics.js';

export default PokerSwipeSolver;