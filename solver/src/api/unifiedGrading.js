/**
 * Unified Grading Layer
 * Consolidates hardcoded (legacy) and solver-based grading systems.
 *
 * Architecture:
 * - All training modes route through this API
 * - Solver-backed: uses EV-loss thresholds
 * - Legacy/hardcoded: uses adapter pattern, returns data in unified format
 * - Single grade scale: EXCELLENT, GOOD, INACCURACY, MISTAKE, BIG_MISTAKE
 * - evLossBB is null for legacy sources (no actual EV calculated)
 */

import { gradeAnswer } from '../training/answerEvaluator.js';
import { classifyLoss, classifySeverity } from '../config/thresholds.js';
import { SolverError } from './errors.js';
import { grade as unifiedBrainGrade } from '../../../poker-brain/grade.js';
import { loadPokerBrainPackFromStrategyFile } from '../../../trainer-knowledge/conflictDetector.js';

let _cachedPack = null;
function brainPack() {
  if (_cachedPack) return _cachedPack;
  try {
    _cachedPack = loadPokerBrainPackFromStrategyFile();
  } catch (_) {
    _cachedPack = null;
  }
  return _cachedPack;
}

// Grade order for UI (visual hierarchy)
export const GRADE_ORDER = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE'];

// Grade class for CSS (g/y/r mapping)
export const gradeToClass = (grade) => {
  if (grade === 'EXCELLENT' || grade === 'GOOD') return 'g';
  if (grade === 'INACCURACY') return 'y';
  return 'r';
};

// Legacy adapter: converts hardcoded brain output to unified format
function adaptLegacyBrainResult(legacyResult = {}) {
  if (!legacyResult || typeof legacyResult !== 'object') {
    return {
      grade: 'INACCURACY',
      evLossBB: null,
      source: 'legacy-unknown',
      confidence: 0,
      legacyGrade: null,
      actionFrequency: null
    };
  }

  // Map legacy single-letter grades to unified scale
  const legacyToUnified = {
    'g': 'GOOD',      // legacy 'g' → GOOD
    'y': 'INACCURACY', // legacy 'y' → INACCURACY
    'r': 'MISTAKE'    // legacy 'r' → MISTAKE (not BIG_MISTAKE, conservative)
  };

  const unifiedGrade = legacyToUnified[legacyResult.grade] || 'INACCURACY';

  return {
    grade: unifiedGrade,
    evLossBB: null,  // Legacy system doesn't calculate EV
    source: legacyResult.source || 'legacy-policy',
    confidence: legacyResult.confidence || 0,
    legacyGrade: legacyResult.grade,
    actionFrequency: legacyResult.actionFrequency || null,
    explanation: legacyResult.explanation || null,
    actionGrade: legacyResult.actionGrade || null,
    sizeGrade: legacyResult.sizeGrade || null,
    score: legacyResult.score || null
  };
}

/**
 * Unified grading API - single entry point for all training modes
 *
 * @param {Object} input - Grading context
 * @param {Object} input.scenario - Game scenario (board, stacks, position, etc.)
 * @param {Object} input.solution - Solver solution (if available)
 * @param {Object} input.drill - Drill definition with options and metadata
 * @param {string} input.chosenActionId - User's chosen action ID or type
 * @param {Object} input.chosenAction - User's chosen action shape {type, sizePot, amountBB}
 * @param {string} input.mode - Training mode (swipe, sizing, daily, quick, etc.)
 * @param {string} input.thresholdPreset - Grade threshold preset (mtt, cash, shortStack)
 * @param {boolean} input.useLegacyBrain - Force use of hardcoded brain (for legacy modes)
 *
 * @returns {Object} Unified grade result
 * {
 *   grade: string,              // EXCELLENT | GOOD | INACCURACY | MISTAKE | BIG_MISTAKE
 *   gradeClass: string,         // CSS class: g | y | r
 *   evLossBB: number|null,      // EV loss in BB (null if legacy source)
 *   severity: string|null,      // negligible | small | medium | large | severe (null if legacy)
 *   source: string,             // cfr | cfr_plus | legacy-policy | legacy-unknown
 *   confidence: number,         // 0-100 (solver provides actual confidence, legacy is fixed)
 *   metadata: Object,           // Mode-specific data
 *   explanationData: Object     // Data for explanation generation
 * }
 */
export function gradeDecision(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new SolverError('INVALID_INPUT', 'gradeDecision requires an object');
  }

  const mode = String(input.mode || 'unknown').toLowerCase();
  const useLegacy = input.useLegacyBrain === true;

  // Route to appropriate grading system
  if (useLegacy) {
    return gradeViaLegacy(input);
  }

  // Try solver-based grading first (for modes with drill/solution data)
  if (input.drill && input.solution) {
    return gradeViaSolver(input);
  }

  // Fallback to legacy for modes without solver data
  return gradeViaLegacy(input);
}

/**
 * Grade using solver-based EV analysis
 * @private
 */
function gradeViaSolver(input = {}) {
  const drill = input.drill || {};
  const solution = input.solution || {};
  const chosenId = input.chosenActionId;
  const chosenAction = input.chosenAction;
  const preset = input.thresholdPreset || 'mtt';

  try {
    // Use answerEvaluator to compute grade from EV loss
    const result = gradeAnswer({
      drill,
      chosenId,
      chosenAction,
      preset
    });

    if (!result) {
      return createDefaultGrade('legacy-unknown');
    }

    const severity = result.evLossBb != null
      ? classifySeverity(result.evLossBb, preset)
      : null;

    return {
      grade: result.grade,
      gradeClass: gradeToClass(result.grade),
      evLossBB: result.evLossBb,
      severity,
      source: 'cfr',
      confidence: result.confidence || 0,
      nearOptimal: result.nearOptimal || false,
      mixedStrategy: result.mixedStrategy || false,
      chosenRecommended: result.chosenRecommended || false,
      metadata: {
        chosenEV: result.chosenEV,
        bestEV: result.bestEV,
        chosenOption: result.chosenOption || null,
        mode: input.mode
      },
      explanationData: {
        grade: result.grade,
        evLossBb: result.evLossBb,
        severity,
        mixedStrategy: result.mixedStrategy,
        concept: drill.concept || null,
        chosenRecommended: result.chosenRecommended,
        feedbackRu: result.feedbackRu || null
      }
    };
  } catch (err) {
    // Solver failed, use legacy fallback
    return gradeViaLegacy(input);
  }
}

/**
 * Grade using legacy hardcoded brain
 * @private
 */
function gradeViaLegacy(input = {}) {
  const useLegacyBrain = typeof window !== 'undefined' && window.PokerBrain;

  if (!useLegacyBrain) {
    return createDefaultGrade('legacy-unknown');
  }

  try {
    const scenario = input.scenario || {};
    const action = input.chosenAction?.type || input.chosenActionType || 'CHECK';
    const size = input.chosenAction?.sizePct ?? input.chosenSize ?? null;
    const spotPayload = {
      mode: input.mode || 'swipe',
      scenario: {
        ...scenario,
        id: input.spotId || scenario.id,
        spotId: scenario.spotId || scenario.id,
        hero: scenario.heroCards || scenario.hero,
        pos: scenario.heroPosition,
        stack: scenario.effectiveStackBb,
        pot: scenario.potBb,
        ctx: scenario.description || ''
      }
    };

    const PB = window.PokerBrain;
    const legacyGradeDecision = PB._legacyGradeDecision || PB.gradeDecision?.bind(PB);
    const classOf = PB.classOf?.bind(PB);
    const legacyNodeFor = PB.nodeFor?.bind(PB);

    let unifiedDecision = null;
    let legacyResult = null;

    if (typeof PB.grade === 'function') {
      unifiedDecision = PB.grade(spotPayload, action, { trace: false });
      legacyResult = unifiedDecision.legacyGrade || unifiedDecision.grading?.legacyResult;
    } else {
      unifiedDecision = unifiedBrainGrade(spotPayload, action, {
        pack: brainPack() || window.POKER_BRAIN_PACK,
        classOf,
        legacyNodeFor,
        legacyGradeDecision
      });
      legacyResult = unifiedDecision.legacyGrade || unifiedDecision.grading?.legacyResult;
    }

    if (!legacyResult && legacyGradeDecision) {
      legacyResult = legacyGradeDecision(
        {
          spotId: spotPayload.scenario.spotId,
          id: spotPayload.scenario.id,
          street: spotPayload.scenario.street,
          hero: spotPayload.scenario.hero,
          board: spotPayload.scenario.board,
          pos: spotPayload.scenario.pos,
          stack: spotPayload.scenario.stack,
          pot: spotPayload.scenario.pot,
          ctx: spotPayload.scenario.ctx
        },
        action,
        size
      );
    }

    if (!legacyResult) {
      return createDefaultGrade('legacy-policy');
    }

    const adapted = adaptLegacyBrainResult(legacyResult);

    return {
      grade: adapted.grade,
      gradeClass: gradeToClass(adapted.grade),
      evLossBB: null,
      severity: null,
      source: adapted.source,
      confidence: adapted.confidence,
      legacyResult,
      metadata: {
        legacyGrade: adapted.legacyGrade,
        actionFrequency: adapted.actionFrequency,
        actionGrade: adapted.actionGrade,
        sizeGrade: adapted.sizeGrade,
        score: adapted.score,
        mode: input.mode,
        brainDecision: unifiedDecision
          ? {
            domain: unifiedDecision.domain,
            primarySource: unifiedDecision.provenance?.primarySource,
            flags: unifiedDecision.flags
          }
          : null
      },
      explanationData: {
        grade: adapted.grade,
        explanation: adapted.explanation,
        source: adapted.source
      }
    };
  } catch (err) {
    return createDefaultGrade('legacy-error');
  }
}

/**
 * Create default/fallback grade result
 * @private
 */
function createDefaultGrade(source = 'unknown') {
  return {
    grade: 'INACCURACY',
    gradeClass: 'y',
    evLossBB: null,
    severity: null,
    source,
    confidence: 0,
    metadata: {},
    explanationData: { grade: 'INACCURACY', source }
  };
}

/**
 * Compatibility function - maps old gradeClass call to new system
 * Used during migration to avoid breaking UI layers
 */
export function getGradeClass(grade) {
  return gradeToClass(grade);
}

/**
 * Convert unified grade to legacy single-letter format (for backward compat)
 */
export function gradeToLegacy(grade) {
  if (grade === 'EXCELLENT' || grade === 'GOOD') return 'g';
  if (grade === 'INACCURACY') return 'y';
  if (grade === 'MISTAKE' || grade === 'BIG_MISTAKE') return 'r';
  return 'y';
}

/**
 * Validate that a grading context is complete
 */
export function validateGradingContext(input = {}) {
  const errors = [];

  if (input.useLegacyBrain) {
    // Legacy mode needs: scenario, chosenAction or chosenActionType
    if (!input.scenario) errors.push('scenario is required');
    if (!input.chosenAction && !input.chosenActionType) {
      errors.push('chosenAction or chosenActionType is required');
    }
  } else {
    // Solver mode needs: drill, solution, chosen action
    if (!input.drill) errors.push('drill is required for solver grading');
    if (!input.solution) errors.push('solution is required for solver grading');
    if (!input.chosenActionId && !input.chosenAction) {
      errors.push('chosenActionId or chosenAction is required');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  gradeDecision,
  getGradeClass,
  gradeToLegacy,
  validateGradingContext,
  GRADE_ORDER,
  gradeToClass
};
