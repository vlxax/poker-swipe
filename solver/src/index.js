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

export default PokerSwipeSolver;