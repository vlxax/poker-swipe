export { createEmptyDecisionContext, UNKNOWN, contextQualityLevel, listMissingContextFields } from './context/DecisionContext.js';
export { normalizeDecisionContext, adapters, normalizePosition, normalizeStreet } from './context/normalize.js';
export { KNOWLEDGE_LAYERS, LAYER_IDS, getLayer, layersForDomain } from './registry/knowledgeRegistry.js';
export { resolvePokerDomain, POKER_DOMAINS } from './routing/resolvePokerDomain.js';
export { collectPokerEvidence } from './evidence/collectPokerEvidence.js';
export { compareEvidenceContext, CONTEXT_MATCH } from './evidence/compareEvidenceContext.js';
export { resolvePokerEvidence } from './evidence/resolvePokerEvidence.js';
export { PREFLOP_ATLAS_LIMITATIONS, collectPreflopAtlasEvidence } from './evidence/preflopAtlasAdapter.js';
export { buildDecisionResult } from './contracts/DecisionResult.js';
export { SolverPolicyProvider, createSolverProviderStub } from './solver/SolverPolicyProvider.js';
export { analyze } from './analyze.js';
export { grade } from './grade.js';
export { createBrainTrace } from './trace.js';
export { spotFromContext } from './adapters/legacySpot.js';
export { shadowCompareDaily } from './integrations/dailyShadow.js';
export { LEGACY_BRAIN_OWNERSHIP } from './integrations/legacyOwnership.js';

import { analyze as analyzeFn } from './analyze.js';
import { grade as gradeFn } from './grade.js';

export function createPokerBrainEngine(deps = {}) {
  return {
    analyze: (input, opts = {}) => analyzeFn(input, { ...deps, ...opts }),
    grade: (input, userAction, opts = {}) => gradeFn(input, userAction, { ...deps, ...opts })
  };
}
