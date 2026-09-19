import { contextQualityLevel, listMissingContextFields } from '../context/DecisionContext.js';
import { assessContextCompatibility } from '../context/contextMatchQuality.js';

function dominantFromPolicy(policy) {
  if (!policy || typeof policy !== 'object') return null;
  const entries = Object.entries(policy).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { action: entries[0][0], frequencies: Object.fromEntries(entries), topFreq: entries[0][1] };
}

function brainKnowsSnapshot(context) {
  const tree = context.preflopTree || {};
  return {
    effectiveStackBB: context.effectiveStackBB,
    heroPosition: context.hero?.position,
    heroCards: context.hero?.cards,
    villainPositions: (context.villains || []).map((v) => v.position),
    openSizeBB: tree.openSizeBB,
    threeBettorPosition: tree.threeBettorPosition,
    threeBetSizeBB: tree.threeBetSizeBB,
    potBB: context.potBB,
    spr: context.spr,
    actionHistoryLength: context.actionHistory?.length || 0,
    stackBucket: context.stackBucket
  };
}

function sourceKnowsSnapshot(primary) {
  const meta = primary?.meta || {};
  return {
    lookupKey: primary?.key,
    lookupStackBB: meta.lookupStackBB,
    stackBucketDistanceBB: meta.stackBucketDistanceBB,
    encodesVillainPosition: meta.villainPositionDimension !== false,
    encodesOpenSize: meta.openSizingDimension === true,
    encodesThreeBetSize: meta.threeBetSizingDimension === true
  };
}

export function buildDecisionResult({ context, domain, resolved, collected, trace }) {
  const primary = resolved?.primary;
  const policy = primary?.policy;
  const dom = dominantFromPolicy(policy);

  const recommendation = dom
    ? {
      action: dom.action,
      frequencies: dom.frequencies,
      sizing: primary?.sizes ? { available: true, sizes: primary.sizes } : { available: false }
    }
    : {
      action: null,
      frequencies: null,
      sizing: { available: false }
    };

  const missing = listMissingContextFields(context);
  const cq = contextQualityLevel(context);
  const compat = assessContextCompatibility(context, domain, primary?.meta || {});
  const evidenceCompat = primary?.contextCompatibility;

  const ignored = [
    ...(evidenceCompat?.ignoredMaterialFields || []),
    ...compat.ignoredMaterialFields
  ].filter((x, i, a) => a.indexOf(x) === i);

  return {
    domain,
    recommendation,
    grading: {
      available: false,
      acceptedActions: policy ? Object.keys(policy) : [],
      grade: null
    },
    confidence: {
      level: primary?.solverValidated ? 'HIGH' : (primary ? 'MEDIUM' : 'LOW'),
      reasons: resolved?.flags || []
    },
    provenance: {
      primarySource: primary?.source || null,
      supportingSources: (resolved?.supporting || []).map((s) => s.source),
      solverValidated: !!primary?.solverValidated
    },
    contextQuality: {
      level: cq,
      missingFields: missing,
      effectiveStackMeta: context.effectiveStackMeta,
      potMeta: context.potMeta,
      ambiguity: context.effectiveStackMeta?.ambiguity || false
    },
    contextCompatibility: {
      matchLevel: evidenceCompat?.match || compat.matchLevel,
      ignoredMaterialFields: ignored,
      missingMaterialFields: evidenceCompat?.missingMaterialFields || compat.missingMaterialFields,
      stackBucket: evidenceCompat?.stackBucket || compat.stackBucket,
      flags: [...new Set([...(compat.flags || []), ...(resolved?.flags || [])])]
    },
    brainKnows: brainKnowsSnapshot(context),
    strategySourceKnows: primary ? sourceKnowsSnapshot(primary) : null,
    conflicts: resolved?.conflicts || [],
    explanation: {
      short: primary ? `Policy from ${primary.source} (${primary.contextMatch || 'UNKNOWN'})` : 'No compatible strategy source',
      technical: primary?.key || primary?.layerId || null
    },
    equity: { available: false },
    trace: trace || null,
    flags: resolved?.flags || (primary ? [] : ['NO_STRATEGY_AVAILABLE'])
  };
}
