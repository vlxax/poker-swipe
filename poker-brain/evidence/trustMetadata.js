/**
 * Descriptive trust fields — not fake GTO scores.
 */
export function trustMetaForLayer(layerId, overrides = {}) {
  const base = {
    provenanceQuality: 'UNKNOWN',
    contextSpecificity: 'PARTIAL',
    solverValidated: false,
    stackSpecific: 'PARTIAL',
    actionTreeSpecific: false,
    runtimeReliability: 'MEDIUM'
  };
  switch (layerId) {
    case 'PREFLOP_ATLAS':
      return {
        ...base,
        provenanceQuality: 'CURATED_UNKNOWN',
        stackSpecific: 'PARTIAL',
        runtimeReliability: 'HIGH',
        ...overrides
      };
    case 'REFERENCE_6MAX':
      return {
        ...base,
        provenanceQuality: 'REFERENCE_CHART',
        contextSpecificity: 'POSITION_SITUATION',
        stackSpecific: false,
        solverValidated: false,
        runtimeReliability: 'MEDIUM',
        ...overrides
      };
    case 'UO_TRAINER':
      return {
        ...base,
        provenanceQuality: 'IMPORTED_UNKNOWN',
        contextSpecificity: 'CHART_DEPENDENT',
        stackSpecific: 'BAND',
        runtimeReliability: 'MEDIUM',
        ...overrides
      };
    case 'EXACT_NODES':
      return {
        ...base,
        provenanceQuality: 'EXACT_REFERENCE',
        contextSpecificity: 'HIGH',
        runtimeReliability: 'HIGH',
        ...overrides
      };
    case 'POSTFLOP_ATLAS':
      return {
        ...base,
        provenanceQuality: 'CURATED_UNKNOWN',
        contextSpecificity: 'LOW',
        runtimeReliability: 'MEDIUM',
        ...overrides
      };
    default:
      return { ...base, ...overrides };
  }
}
