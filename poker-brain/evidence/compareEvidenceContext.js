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
  const detail = compareEvidenceContextDetail(evidence, context);
  return detail.match;
}

export function compareEvidenceContextDetail(evidence, context) {
  if (!evidence) {
    return {
      match: CONTEXT_MATCH.UNKNOWN,
      ignoredMaterialFields: [],
      missingMaterialFields: [],
      reasons: []
    };
  }
  const meta = evidence.meta || {};
  const reasons = [];
  const ignoredMaterialFields = [];
  const missingMaterialFields = [];

  if (meta.solverValidated === false && meta.requiresSolverMatch) {
    return {
      match: CONTEXT_MATCH.INCOMPATIBLE,
      ignoredMaterialFields,
      missingMaterialFields,
      reasons: ['SOLVER_REQUIRED']
    };
  }

  const tree = context.preflopTree || {};

  if (meta.villainPositionDimension === false && context.domainNeedsVillainPosition) {
    reasons.push('COLLAPSED_VILLAIN_CONTEXT');
    ignoredMaterialFields.push('threeBettorPosition');
  }

  if (meta.villainPositionDimension === false && !isUnknown(tree.threeBettorPosition)) {
    if (!ignoredMaterialFields.includes('threeBettorPosition')) ignoredMaterialFields.push('threeBettorPosition');
    reasons.push('COLLAPSED_VILLAIN_CONTEXT');
  }

  if (meta.openSizingDimension === false && !isUnknown(tree.openSizeBB)) {
    ignoredMaterialFields.push('openSizeBB');
    reasons.push('OPEN_SIZE_NOT_IN_SOURCE');
  }

  if (meta.threeBetSizingDimension === false && !isUnknown(tree.threeBetSizeBB)) {
    ignoredMaterialFields.push('threeBetSizeBB');
  }

  if (meta.stackSpecific === false && !isUnknown(context.effectiveStackBB)) {
    reasons.push('STACK_INVARIANT_SOURCE');
  }

  if (meta.stackSpecific === true && isUnknown(context.effectiveStackBB)) {
    reasons.push('STACK_CONTEXT_MISSING');
    missingMaterialFields.push('effectiveStackBB');
  }

  if ((meta.stackBucketDistanceBB ?? 0) > 0 || (context.stackBucket?.stackBucketDistanceBB ?? 0) > 0) {
    reasons.push('STACK_BUCKET_APPROXIMATION');
  }

  let match = CONTEXT_MATCH.COMPATIBLE;
  if (reasons.length === 0 && meta.contextComplete === true) match = CONTEXT_MATCH.EXACT;
  else if (reasons.length) match = CONTEXT_MATCH.PARTIAL;

  return {
    match,
    ignoredMaterialFields,
    missingMaterialFields,
    reasons,
    stackBucket: {
      actualStackBB: meta.actualStackBB ?? context.stackBucket?.actualStackBB,
      lookupStackBB: meta.lookupStackBB ?? context.stackBucket?.lookupStackBB,
      stackBucketDistanceBB: meta.stackBucketDistanceBB ?? context.stackBucket?.stackBucketDistanceBB
    }
  };
}

export { MATERIAL };
