export function createBrainTrace({ domain, context, collected, resolved }) {
  return {
    domain,
    contextCompleteness: context?.contextQuality?.level || null,
    layersConsidered: collected?.layersConsidered || [],
    layersRejected: collected?.layersRejected || [],
    providersConsidered: (collected?.evidence || []).map((e) => e.layerId || e.source),
    providersRejected: collected?.layersRejected || [],
    selectedSource: resolved?.primary?.source || null,
    selectedLayer: resolved?.primary?.layerId || null,
    actualStackBB: context?.stackBucket?.actualStackBB ?? context?.effectiveStackBB,
    lookupStackBB: context?.stackBucket?.lookupStackBB,
    ignoredMaterialFields: context?.contextCompatibility?.ignoredMaterialFields
      || resolved?.primary?.contextCompatibility?.ignoredMaterialFields
      || [],
    conflicts: resolved?.conflicts || [],
    recommendationAvailable: !!resolved?.primary?.policy,
    confidenceReasons: resolved?.flags || [],
    evidenceCount: collected?.evidence?.length || 0
  };
}

export function traceDecision(decision) {
  if (!decision) return null;
  return {
    engineVersion: decision.engineVersion,
    domain: decision.domain,
    contextQuality: decision.contextQuality,
    provenance: decision.provenance,
    contextCompatibility: decision.contextCompatibility,
    conflicts: decision.conflicts,
    flags: decision.flags,
    trace: decision.trace
  };
}
