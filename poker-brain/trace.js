export function createBrainTrace({ domain, context, collected, resolved }) {
  return {
    domain,
    context,
    layersConsidered: collected?.layersConsidered || [],
    layersRejected: collected?.layersRejected || [],
    selectedSource: resolved?.primary?.source || null,
    confidenceReasons: resolved?.flags || [],
    evidenceCount: collected?.evidence?.length || 0
  };
}
