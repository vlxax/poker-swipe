// Trainer knowledge data quality statuses — do not invent semantics.

export const TRAINER_STATUS = {
  EXACT_TRAINER_DATA: 'EXACT_TRAINER_DATA',
  PARTIAL_TRAINER_DATA: 'PARTIAL_TRAINER_DATA',
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
  MISSING_TRAINER_DATA: 'MISSING_TRAINER_DATA'
};

export const SPOT_MAP_STATUS = {
  MAPPED_EXACT: 'MAPPED_EXACT',
  MAPPED_PARTIAL: 'MAPPED_PARTIAL',
  UNMAPPED_TRAINER_SPOT: 'UNMAPPED_TRAINER_SPOT'
};

export const MATCH_STATUS = {
  EXACT_TRAINER_MATCH: 'EXACT_TRAINER_MATCH',
  PARTIAL_TRAINER_MATCH: 'PARTIAL_TRAINER_MATCH',
  GROUP_POSITION_MATCH: 'GROUP_POSITION_MATCH',
  NO_TRAINER_DATA: 'NO_TRAINER_DATA',
  AMBIGUOUS_UO_FAMILY: 'AMBIGUOUS_UO_FAMILY'
};

export const STRATEGY_SOURCE = {
  TRAINER: 'TRAINER',
  POKER_BRAIN: 'POKER_BRAIN',
  REFERENCE: 'REFERENCE',
  HEURISTIC: 'HEURISTIC'
};

export const RECOMMENDATION_SOURCE = {
  SOLVER_VERIFIED: 'SOLVER_VERIFIED',
  TRAINER_VERIFIED: 'TRAINER_VERIFIED',
  CURATED_REFERENCE: 'CURATED_REFERENCE',
  HEURISTIC: 'HEURISTIC',
  EXPLOIT: 'EXPLOIT'
};

/** Actions that must not drive correct/incorrect grading until confirmed. */
export const NON_GRADABLE_ACTIONS = new Set([
  'nAI',
  'LOW_PLAYABILITY',
  'UO'
]);

export function actionGradingStatus(rawAction, normalizedAction = null, contextualAction = null) {
  const raw = String(rawAction || '').trim();
  const normalized = String(normalizedAction || '').trim();
  const contextual = String(contextualAction || '').trim();
  if (!raw) return TRAINER_STATUS.MISSING_TRAINER_DATA;
  if (normalized === 'FOLD' || normalized === 'CALL') return TRAINER_STATUS.EXACT_TRAINER_DATA;
  if (contextual === 'NON_ALL_IN_CALL' && (normalized === 'CALL' || normalized === 'NON_ALL_IN' || raw === 'nAI')) {
    return TRAINER_STATUS.EXACT_TRAINER_DATA;
  }
  if (raw === 'UNSELECTED') return TRAINER_STATUS.EXACT_TRAINER_DATA;
  if (raw === 'ORANGE_208_160_32' && normalized === 'CALL') return TRAINER_STATUS.EXACT_TRAINER_DATA;
  if (raw === 'nAI' || raw === 'LOW_PLAYABILITY' || raw === 'UO') {
    return TRAINER_STATUS.NEEDS_CLARIFICATION;
  }
  if (raw === 'AI' || raw === 'RAISE') {
    return TRAINER_STATUS.EXACT_TRAINER_DATA;
  }
  return TRAINER_STATUS.NEEDS_CLARIFICATION;
}

export function canGradeWithTrainerAction(rawAction, normalizedAction = null, contextualAction = null) {
  return actionGradingStatus(rawAction, normalizedAction, contextualAction) === TRAINER_STATUS.EXACT_TRAINER_DATA;
}
