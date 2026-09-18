/**
 * V2 Integration Layer
 * Bridges existing gradeDecision flow with V2 engine
 *
 * This layer:
 * - Converts feature inputs to DecisionContext
 * - Runs V2 analysis
 * - Converts V2 results back to legacy format
 * - Maintains 100% backward compat while adding V2 diagnostics
 */

import PokerBrainV2 from '../PokerBrainV2.js';
import { adapterFromFeature } from '../adapters/FeatureContextAdapter.js';

let _brainV2Instance = null;

function getPokerBrainV2() {
  if (!_brainV2Instance) {
    const pack = typeof window !== 'undefined' ? window.POKER_BRAIN_PACK : null;
    _brainV2Instance = new PokerBrainV2({ pack, trace: false });
  }
  return _brainV2Instance;
}

/**
 * Run feature input through V2, return diagnostic result
 * Does NOT change actual grading - purely observational
 */
export function analyzeWithV2(featureSource, input, options = {}) {
  try {
    const brain = getPokerBrainV2();

    // Convert to canonical context
    const context = adapterFromFeature(featureSource, input, options);

    // Run V2 analysis
    const result = brain.analyze(context);

    return {
      v2Status: result.status,
      v2Domain: result.domain,
      v2ContextQuality: context.contextQuality,
      v2Recommendation: result.recommendation,
      v2Source: result.recommendationSource,
      v2Confidence: result.recommendationConfidence,
      v2ContextIgnored: result.contextIgnored,
      v2Evidence: result.allEvidence,
      v2Conflicts: result.conflicts,

      contextSummary: context.summary()
    };
  } catch (err) {
    return {
      v2Status: 'ERROR',
      v2Error: err.message
    };
  }
}

/**
 * For testing: get underlying decision context
 */
export function getDecisionContext(featureSource, input, options = {}) {
  return adapterFromFeature(featureSource, input, options);
}

/**
 * Reset V2 instance (useful for testing)
 */
export function resetBrainV2() {
  _brainV2Instance = null;
}

export default {
  analyzeWithV2,
  getDecisionContext,
  resetBrainV2,
  getPokerBrainV2
};
