import { contextQualityLevel, listMissingContextFields } from '../context/DecisionContext.js';

function dominantFromPolicy(policy) {
  if (!policy || typeof policy !== 'object') return null;
  const entries = Object.entries(policy).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { action: entries[0][0], frequencies: Object.fromEntries(entries), topFreq: entries[0][1] };
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
      missingFields: missing
    },
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
