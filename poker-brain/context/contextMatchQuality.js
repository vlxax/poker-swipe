import { isUnknown } from './DecisionContext.js';
import { nearestStackBucket } from './stackBucket.js';
import { POKER_DOMAINS } from '../routing/resolvePokerDomain.js';

/**
 * Compare brain material context vs what legacy evidence can encode.
 */
export function assessContextCompatibility(context, domain, evidenceMeta = {}) {
  const ignoredMaterialFields = [];
  const missingMaterialFields = [];
  const flags = [];

  const tree = context.preflopTree || {};
  const stackInfo = context.stackBucket || nearestStackBucket(context.effectiveStackBB);

  if (evidenceMeta.villainPositionDimension === false) {
    if (!isUnknown(tree.threeBettorPosition) || !isUnknown(context.villains?.[0]?.position)) {
      ignoredMaterialFields.push('threeBettorPosition');
      flags.push('COLLAPSED_VILLAIN_CONTEXT');
    }
  }

  if (evidenceMeta.openSizingDimension === false && !isUnknown(tree.openSizeBB)) {
    ignoredMaterialFields.push('openSizeBB');
  }
  if (evidenceMeta.threeBetSizingDimension === false && !isUnknown(tree.threeBetSizeBB)) {
    ignoredMaterialFields.push('threeBetSizeBB');
  }
  if (evidenceMeta.fourBetSizingDimension === false && !isUnknown(tree.fourBetSizeBB)) {
    ignoredMaterialFields.push('fourBetSizeBB');
  }

  if (domain === POKER_DOMAINS.PREFLOP_VS_3BET) {
    if (!isUnknown(tree.threeBettorPosition)) {
      if (!ignoredMaterialFields.includes('threeBettorPosition')) {
        ignoredMaterialFields.push('threeBettorPosition');
      }
      flags.push('COLLAPSED_VILLAIN_CONTEXT');
    }
    if (!isUnknown(tree.threeBetSizeBB) && !ignoredMaterialFields.includes('threeBetSizeBB')) {
      ignoredMaterialFields.push('threeBetSizeBB');
    }
    if (!isUnknown(tree.openSizeBB) && !ignoredMaterialFields.includes('openSizeBB')) {
      ignoredMaterialFields.push('openSizeBB');
    }
  }

  if (stackInfo.stackBucketDistanceBB > 0) {
    flags.push('STACK_BUCKET_APPROXIMATION');
  }

  if (isUnknown(context.effectiveStackBB)) missingMaterialFields.push('effectiveStackBB');
  if (isUnknown(context.hero?.position)) missingMaterialFields.push('hero.position');

  let matchLevel = 'COMPATIBLE';
  if (ignoredMaterialFields.length && stackInfo.stackBucketDistanceBB > 0) matchLevel = 'PARTIAL';
  else if (ignoredMaterialFields.length) matchLevel = 'PARTIAL';
  else if (missingMaterialFields.length) matchLevel = 'PARTIAL';
  else if (evidenceMeta.contextComplete) matchLevel = 'EXACT';

  return {
    ignoredMaterialFields,
    missingMaterialFields,
    flags,
    matchLevel,
    stackBucket: stackInfo
  };
}
