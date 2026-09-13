// Honest strategy-source labels. Never claim SOLVER_VERIFIED unless a real
// on-device solve produced the frequencies (CFR/toy equilibrium), not atlas lookup.

export const STRATEGY_SOURCE = {
  SOLVER_VERIFIED: 'SOLVER_VERIFIED',
  TRAINER_VERIFIED: 'TRAINER_VERIFIED',
  CURATED_REFERENCE: 'CURATED_REFERENCE',
  HEURISTIC: 'HEURISTIC',
  EXPLOIT: 'EXPLOIT',
  TOURNAMENT_HEURISTIC: 'TOURNAMENT_HEURISTIC',
  ICM_EDUCATIONAL_MODEL: 'ICM_EDUCATIONAL_MODEL'
};

export const USER_SOURCE_LABEL = {
  SOLVER_VERIFIED: 'Solver-verified (on-device calculation)',
  TRAINER_VERIFIED: 'Trainer chart',
  CURATED_REFERENCE: 'Curated reference atlas',
  HEURISTIC: 'Heuristic model',
  EXPLOIT: 'Exploit adjustment',
  TOURNAMENT_HEURISTIC: 'Tournament heuristic',
  ICM_EDUCATIONAL_MODEL: 'ICM educational model'
};

const GTO_CLAIM_RE = /\b(gto\s+solver(\s+result)?|exact\s+gto|solver\s+output|nash\s+equilibrium\s+export)\b/i;

export function isForbiddenGtoClaim(text = '') {
  return GTO_CLAIM_RE.test(String(text));
}

export function mapLegacySource(legacy = {}, { cfrConverged = false } = {}) {
  const s = String(legacy.source || legacy.gradingSource || legacy.engine || '').toUpperCase();
  if (cfrConverged && (s.includes('CFR') || s.includes('SOLVER_CORE') || s === 'SOLVER')) {
    return STRATEGY_SOURCE.SOLVER_VERIFIED;
  }
  if (s.includes('TRAINER') || s === 'TRAINER_EXACT' || s === 'TRAINER_CONFIRMED') {
    return STRATEGY_SOURCE.TRAINER_VERIFIED;
  }
  if (s.includes('EXACT_REFERENCE') || s.includes('PREFLOP_ATLAS') || s.includes('POSTFLOP_ATLAS')
    || s.includes('STATIC_CURATED') || s.includes('POKER_BRAIN') || s.includes('PRO_REVIEWED')) {
    return STRATEGY_SOURCE.CURATED_REFERENCE;
  }
  if (s.includes('EXPLOIT') || s === 'PROCEDURAL') return STRATEGY_SOURCE.EXPLOIT;
  if (s.includes('ICM') && !s.includes('SOLVER')) return STRATEGY_SOURCE.ICM_EDUCATIONAL_MODEL;
  if (s.includes('HEURISTIC') || s.includes('ESTIMATE') || s.includes('NEAREST') || !s) {
    return STRATEGY_SOURCE.HEURISTIC;
  }
  return STRATEGY_SOURCE.HEURISTIC;
}

export function attachStrategySource(result = {}, extras = {}) {
  const strategySource = extras.strategySource
    || mapLegacySource(result, extras);
  return {
    ...result,
    strategySource,
    strategySourceLabel: USER_SOURCE_LABEL[strategySource] || strategySource,
    solverOutput: strategySource === STRATEGY_SOURCE.SOLVER_VERIFIED
  };
}
