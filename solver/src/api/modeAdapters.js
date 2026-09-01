/**
 * Mode-specific adapters for unified grading
 * Converts each training mode's data format to unified grading format.
 *
 * Used by: SWIPE, SIZING, QUICK, DAILY, ASSESSMENT
 */

import { gradeDecision, validateGradingContext } from './unifiedGrading.js';

/**
 * SIZING mode adapter
 * Input: {spotId, spot, action, sizePct}
 * Output: unified grade result
 */
export function gradeSwipeSizing(input = {}) {
  const { spot = {}, action, sizePct } = input;

  const gradingContext = {
    mode: 'sizing',
    scenario: {
      id: spot.id,
      spotId: spot.spotId,
      street: spot.street,
      heroCards: spot.hero,
      villainCards: spot.villain,
      board: spot.board,
      heroPosition: spot.pos,
      villainPosition: spot.villainPos,
      effectiveStackBb: spot.stack,
      potBb: spot.pot,
      description: spot.ctx || spot.description || ''
    },
    chosenActionType: action,
    chosenSize: sizePct,
    useLegacyBrain: true  // SIZING uses legacy brain for now
  };

  const validation = validateGradingContext(gradingContext);
  if (!validation.valid) {
    return { grade: 'INACCURACY', gradeClass: 'y', source: 'error', errors: validation.errors };
  }

  return gradeDecision(gradingContext);
}

/**
 * SWIPE mode adapter (10 hands training)
 * Input: {scenario, action}
 * Output: unified grade result
 */
export function gradeSwipeDecision(input = {}) {
  const { scenario = {}, action, sizePct = null } = input;

  const gradingContext = {
    mode: input.mode || 'swipe',
    scenario: {
      id: scenario.id || scenario.spotId,
      spotId: scenario.spotId || scenario.id,
      street: scenario.street,
      heroCards: scenario.hero || scenario.heroCards,
      villainCards: scenario.villain,
      board: scenario.board,
      heroPosition: scenario.pos || scenario.heroPosition,
      villainPosition: scenario.villainPos || scenario.villainPosition,
      effectiveStackBb: scenario.stack || scenario.effectiveStackBb,
      potBb: scenario.pot || scenario.potBb,
      description: scenario.ctx || scenario.description || ''
    },
    chosenActionType: action,
    chosenSize: sizePct,
    useLegacyBrain: true  // SWIPE uses legacy brain for now
  };

  const validation = validateGradingContext(gradingContext);
  if (!validation.valid) {
    return { grade: 'INACCURACY', gradeClass: 'y', source: 'error', errors: validation.errors };
  }

  return gradeDecision(gradingContext);
}

/**
 * QUICK mode adapter (fast training mix)
 * Input: same as SWIPE
 * Output: unified grade result
 */
export function gradeQuickDecision(input = {}) {
  return gradeSwipeDecision({ ...input, mode: 'quick' });
}

/**
 * DAILY mode adapter (personalized daily training)
 * Input: {drill, chosenActionId, chosenAction, solution}
 * Output: unified grade result
 */
export function gradeDailyDrill(input = {}) {
  const { drill = {}, chosenActionId, chosenAction, solution = {} } = input;

  const gradingContext = {
    mode: 'daily',
    drill,
    solution,
    chosenActionId,
    chosenAction,
    scenario: drill.scenario || {},
    thresholdPreset: drill.preset || 'mtt',
    useLegacyBrain: false  // DAILY uses solver grading
  };

  const validation = validateGradingContext(gradingContext);
  if (!validation.valid) {
    return { grade: 'INACCURACY', gradeClass: 'y', source: 'error', errors: validation.errors };
  }

  return gradeDecision(gradingContext);
}

/**
 * ASSESSMENT mode adapter
 * Input: {item, chosenOptionId, solution}
 * Output: unified grade result
 */
export function gradeAssessmentItem(input = {}) {
  const { item = {}, chosenOptionId, solution = {} } = input;

  const gradingContext = {
    mode: 'assessment',
    drill: item,
    solution,
    chosenActionId: chosenOptionId,
    scenario: item.scenario || {},
    thresholdPreset: item.preset || 'mtt',
    useLegacyBrain: false  // ASSESSMENT uses solver grading
  };

  const validation = validateGradingContext(gradingContext);
  if (!validation.valid) {
    return { grade: 'INACCURACY', gradeClass: 'y', source: 'error', errors: validation.errors };
  }

  return gradeDecision(gradingContext);
}

/**
 * Construct scenario from compact format (used by mini-app-compact)
 */
export function scenarioFromCompact(compactSpot = {}) {
  return {
    id: compactSpot.id || compactSpot.spotId,
    spotId: compactSpot.spotId,
    street: compactSpot.street,
    heroCards: compactSpot.hero,
    villainCards: compactSpot.villain,
    board: compactSpot.board,
    heroPosition: compactSpot.pos,
    villainPosition: compactSpot.villainPos,
    effectiveStackBb: compactSpot.stack,
    potBb: compactSpot.pot,
    description: compactSpot.ctx || ''
  };
}

export default {
  gradeSwipeSizing,
  gradeSwipeDecision,
  gradeQuickDecision,
  gradeDailyDrill,
  gradeAssessmentItem,
  scenarioFromCompact
};
