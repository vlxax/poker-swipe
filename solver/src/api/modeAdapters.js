/**
 * Mode-specific adapters for unified grading
 * Converts each training mode's data format to unified grading format.
 *
 * Used by: SWIPE, SIZING, QUICK, DAILY, ASSESSMENT
 */

import { gradeDecision, validateGradingContext } from './unifiedGrading.js';
import { PokerBrain } from '../../../poker-brain/PokerBrain.js';
import { LegacyPreflopProvider } from '../../../poker-brain/providers/LegacyPreflopProvider.js';

// Lazy-loaded PokerBrain instance for QUICK preflop routing
let _quickPokerBrainInstance = null;

function getQuickPokerBrainInstance() {
  if (!_quickPokerBrainInstance) {
    _quickPokerBrainInstance = new PokerBrain(new LegacyPreflopProvider());
  }
  return _quickPokerBrainInstance;
}

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
      description: scenario.ctx || scenario.description || '',
      preferred: scenario.preferred,
      live: scenario.live,
      actions: scenario.actions,
      _library: scenario._library,
      _drill: scenario._drill
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
 * Determine preflop situation from scenario context
 * Mimics legacy preflopLookup situation detection
 * Returns UNKNOWN for unrecognized situations (lossless requirement)
 */
function detectPreflopSituation(scenario = {}) {
  const ctx = String(scenario.ctx || scenario.description || '').toLowerCase();

  if (/сфолдили|unopened|first in/i.test(ctx)) {
    return 'RFI';
  } else if (/4-bet|4bet|3-бет|3bet/i.test(ctx)) {
    return 'VS_3BET';
  } else if (/open|открыл/i.test(ctx)) {
    // Could be VS_OPEN or BB_DEFEND depending on position
    const pos = String(scenario.pos || scenario.heroPosition || '').toUpperCase();
    if (pos === 'BB') {
      return 'BB_DEFEND';
    }
    return 'VS_OPEN';
  }

  // Unrecognized situation - return UNKNOWN to trigger fallback to legacy path
  return 'UNKNOWN';
}

/**
 * Extract villain/opener position from scenario for VS_OPEN situations
 */
function getVillainPosition(scenario = {}) {
  const ctx = String(scenario.ctx || scenario.description || '');
  const match = ctx.match(/(UTG|HJ|CO|BTN|SB)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Fallback to villainPos if available
  if (scenario.villainPos || scenario.villainPosition) {
    return String(scenario.villainPos || scenario.villainPosition).toUpperCase();
  }

  return 'CO'; // Default opener position
}

/**
 * QUICK mode adapter (fast training mix)
 * Preflop scenarios route through PokerBrain facade
 * Other scenarios use legacy path
 * Input: same as SWIPE
 * Output: unified grade result
 */
export function gradeQuickDecision(input = {}) {
  const { scenario = {}, action, sizePct = null } = input;
  const street = String(scenario.street || '').toUpperCase();

  // Only route preflop through PokerBrain
  // Non-preflop scenarios stay on legacy path
  if (street === 'PREFLOP' && typeof window !== 'undefined' && window.PokerBrain) {
    try {
      const pokerbrain = getQuickPokerBrainInstance();
      const legacyBrain = window.PokerBrain;

      // Verify required components
      if (!pokerbrain || !legacyBrain.gradeResolvedNode || !legacyBrain.classOf) {
        // Missing components, fall back to old path
        return gradeSwipeDecision({ ...input, mode: 'quick' });
      }

      // Extract hero hand class using legacy classOf
      const heroCards = scenario.hero || scenario.heroCards || [];
      if (!Array.isArray(heroCards) || heroCards.length < 2) {
        // Invalid cards, fall back to old path
        return gradeSwipeDecision({ ...input, mode: 'quick' });
      }

      const handClass = legacyBrain.classOf(heroCards);
      if (!handClass) {
        // Invalid hand, fall back to old path
        return gradeSwipeDecision({ ...input, mode: 'quick' });
      }

      // Determine situation
      const situation = detectPreflopSituation(scenario);

      // Lossless requirement: unknown situations stay on legacy path
      if (situation === 'UNKNOWN') {
        return gradeSwipeDecision({ ...input, mode: 'quick' });
      }

      const heroPosition = String(scenario.pos || scenario.heroPosition || 'BTN').toUpperCase();
      const heroStack = Number(scenario.stack || scenario.effectiveStackBb || 30);

      // Build PokerBrain context
      const pokerbrainContext = {
        street: 'PREFLOP',
        situation,
        heroPosition,
        heroStack,
        handClass
      };

      // Add villain position for VS_OPEN situations
      if (situation === 'VS_OPEN' || situation === 'BB_DEFEND') {
        pokerbrainContext.villainPosition = getVillainPosition(scenario);
      }

      // Call PokerBrain.analyze() to get policy
      const analysis = pokerbrain.analyze(pokerbrainContext);

      // Check if policy was resolved
      if (analysis.status !== 'POLICY_FOUND' || !analysis.recommendedActions) {
        // Policy not found, fall back to old path
        return gradeSwipeDecision({ ...input, mode: 'quick' });
      }

      // Policy found - grade using legacy gradeResolvedNode
      const policy = analysis.recommendedActions;
      const legacySpot = {
        street: 'PREFLOP',
        hero: heroCards,
        pos: heroPosition,
        stack: heroStack,
        ctx: scenario.ctx || scenario.description || ''
      };

      const gradeResult = legacyBrain.gradeResolvedNode(policy, action, sizePct, legacySpot);

      // Convert legacy grade result to unified format
      return {
        grade: gradeResult.grade === 'g' ? 'GOOD' : gradeResult.grade === 'y' ? 'INACCURACY' : 'MISTAKE',
        gradeClass: gradeResult.grade,
        evLossBB: null,
        severity: null,
        source: 'pokerbrain-preflop',
        confidence: gradeResult.confidence || 0,
        legacyResult: gradeResult,
        metadata: {
          legacyGrade: gradeResult.grade,
          actionFrequency: gradeResult.actionFrequency,
          actionGrade: gradeResult.actionGrade,
          sizeGrade: gradeResult.sizeGrade,
          score: gradeResult.score,
          mode: 'quick'
        },
        explanationData: {
          grade: gradeResult.grade === 'g' ? 'GOOD' : gradeResult.grade === 'y' ? 'INACCURACY' : 'MISTAKE',
          explanation: gradeResult.explanation,
          source: 'pokerbrain-preflop'
        }
      };
    } catch (err) {
      // Error in PokerBrain path, fall back to old path
      return gradeSwipeDecision({ ...input, mode: 'quick' });
    }
  }

  // Non-preflop or missing legacy brain - use old path
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
