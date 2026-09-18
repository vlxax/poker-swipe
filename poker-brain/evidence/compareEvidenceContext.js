import { isUnknown } from '../context/DecisionContext.js';

export const CONTEXT_MATCH = {
  EXACT: 'EXACT',
  COMPATIBLE: 'COMPATIBLE',
  PARTIAL: 'PARTIAL',
  INCOMPATIBLE: 'INCOMPATIBLE',
  UNKNOWN: 'UNKNOWN'
};

const MATERIAL = [
  'openSizing',
  'threeBetSizing',
  'fourBetSizing',
  'villainPosition',
  'effectiveStack',
  'ante',
  'rake',
  'icm',
  'tableFormat'
];

/**
 * Compare evidence metadata vs decision context.
 * evidence.meta may declare encoded dimensions.
 */
export function compareEvidenceContext(evidence, context) {
  if (!evidence) return CONTEXT_MATCH.UNKNOWN;
  const meta = evidence.meta || {};
  const reasons = [];

  if (meta.solverValidated === false && meta.requiresSolverMatch) {
    return CONTEXT_MATCH.INCOMPATIBLE;
  }

  if (meta.villainPositionDimension === false && context.domainNeedsVillainPosition) {
    reasons.push('COLLAPSED_VILLAIN_CONTEXT');
  }

  if (meta.openSizingDimension === false) {
    reasons.push('OPEN_SIZE_NOT_IN_SOURCE');
  }

  if (meta.stackSpecific === false && !isUnknown(context.effectiveStackBB)) {
    reasons.push('STACK_INVARIANT_SOURCE');
  }

  if (meta.stackSpecific === true && isUnknown(context.effectiveStackBB)) {
    reasons.push('STACK_CONTEXT_MISSING');
  }

  if (meta.stackSpecific === 'PARTIAL' && isUnknown(context.effectiveStackBB)) {
    reasons.push('STACK_BUCKET_REQUIRED');
  }

  if (reasons.length === 0) {
    if (meta.contextComplete === true) return CONTEXT_MATCH.EXACT;
    return CONTEXT_MATCH.COMPATIBLE;
  }

  if (reasons.includes('COLLAPSED_VILLAIN_CONTEXT') || reasons.includes('STACK_INVARIANT_SOURCE')) {
    return CONTEXT_MATCH.PARTIAL;
  }

  return CONTEXT_MATCH.PARTIAL;
}

export { MATERIAL };
