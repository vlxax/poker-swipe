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

export default PokerSwipeSolver;