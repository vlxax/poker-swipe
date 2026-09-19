/**
 * Knowledge layer metadata — does not merge layers automatically.
 */

export const LAYER_IDS = {
  PREFLOP_ATLAS: 'PREFLOP_ATLAS',
  REFERENCE_6MAX: 'REFERENCE_6MAX',
  UO_TRAINER: 'UO_TRAINER',
  TASK_LIBRARY: 'TASK_LIBRARY',
  POSTFLOP_ATLAS: 'POSTFLOP_ATLAS',
  EXACT_NODES: 'EXACT_NODES',
  LINE_REVIEWS: 'LINE_REVIEWS',
  SIZING_SPOTS: 'SIZING_SPOTS',
  EQUITY_ENGINE: 'EQUITY_ENGINE',
  ICM: 'ICM',
  PKO: 'PKO',
  PUSH_FOLD: 'PUSH_FOLD',
  INTERNAL_SOLVER: 'INTERNAL_SOLVER',
  XRAY: 'XRAY'
};

export const KNOWLEDGE_LAYERS = [
  {
    id: LAYER_IDS.PREFLOP_ATLAS,
    domain: 'PREFLOP',
    capabilities: ['recommendFrequency', 'canGrade', 'canExplain'],
    contextRequirements: ['hero.position', 'hero.cards', 'effectiveStackBB'],
    provenance: 'CURATED_UNKNOWN',
    trustLevel: 'MEDIUM',
    solverValidated: false,
    canGrade: true,
    canExplain: true,
    canRecommendFrequency: true,
    stackSpecific: 'PARTIAL',
    notes: 'strategy_pack_v17.js — RFI stack-sensitive; BB_DEFEND/VS_OPEN/VS_3BET invariant 20-50 in dataset'
  },
  {
    id: LAYER_IDS.REFERENCE_6MAX,
    domain: 'PREFLOP',
    capabilities: ['recommendFrequency'],
    contextRequirements: ['hero.position'],
    provenance: 'REFERENCE_CHART',
    trustLevel: 'LOW',
    solverValidated: false,
    stackSpecific: false,
    canGrade: false,
    canExplain: false,
    canRecommendFrequency: true
  },
  {
    id: LAYER_IDS.UO_TRAINER,
    domain: 'PREFLOP',
    capabilities: ['recommendFrequency'],
    provenance: 'IMPORTED_UNKNOWN',
    trustLevel: 'MEDIUM',
    solverValidated: false,
    canGrade: false,
    canExplain: false,
    canRecommendFrequency: true
  },
  {
    id: LAYER_IDS.TASK_LIBRARY,
    domain: 'MIXED',
    capabilities: ['canGrade'],
    provenance: 'LIBRARY_CURATED',
    trustLevel: 'HIGH',
    solverValidated: false,
    canGrade: true,
    canExplain: true,
    canRecommendFrequency: false
  },
  {
    id: LAYER_IDS.POSTFLOP_ATLAS,
    domain: 'POSTFLOP',
    capabilities: ['recommendFrequency', 'canGrade'],
    provenance: 'CURATED_UNKNOWN',
    solverValidated: false,
    canGrade: true,
    canExplain: true,
    canRecommendFrequency: true
  },
  {
    id: LAYER_IDS.EXACT_NODES,
    domain: 'MIXED',
    capabilities: ['canGrade', 'canExplain'],
    provenance: 'EXACT_REFERENCE',
    solverValidated: false,
    canGrade: true,
    canExplain: true,
    canRecommendFrequency: true
  },
  {
    id: LAYER_IDS.PUSH_FOLD,
    domain: 'PREFLOP_PUSH_FOLD',
    capabilities: ['recommendFrequency'],
    provenance: 'HEURISTIC',
    solverValidated: false,
    canGrade: false,
    canExplain: true,
    canRecommendFrequency: true
  },
  {
    id: LAYER_IDS.INTERNAL_SOLVER,
    domain: 'MIXED',
    capabilities: ['recommendFrequency', 'canGrade'],
    provenance: 'CFR_HU',
    trustLevel: 'MEDIUM',
    solverValidated: true,
    authoritativeForBrain: false,
    canGrade: true,
    canExplain: false,
    canRecommendFrequency: true
  },
  {
    id: LAYER_IDS.EQUITY_ENGINE,
    domain: 'SUPPORT',
    capabilities: ['equity'],
    provenance: 'MATH',
    solverValidated: true,
    canGrade: false,
    canExplain: false,
    canRecommendFrequency: false
  },
  {
    id: LAYER_IDS.ICM,
    domain: 'ICM',
    capabilities: ['canExplain'],
    provenance: 'NARRATIVE',
    solverValidated: false,
    canGrade: false,
    canExplain: true,
    canRecommendFrequency: false
  }
];

export function getLayer(id) {
  return KNOWLEDGE_LAYERS.find((l) => l.id === id) || null;
}

export function layersForDomain(domain) {
  return KNOWLEDGE_LAYERS.filter((l) => l.domain === domain || l.domain === 'MIXED' || (domain.startsWith('PREFLOP') && l.domain === 'PREFLOP'));
}
