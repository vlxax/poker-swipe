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

/** Actions that must not drive correct/incorrect grading until confirmed. */
export const NON_GRADABLE_ACTIONS = new Set([
  'nAI',
  'LOW_PLAYABILITY',
  'UO'
]);

export function actionGradingStatus(rawAction, normalizedAction = null) {
  const raw = String(rawAction || '').trim();
  const normalized = String(normalizedAction || '').trim();
  if (!raw) return TRAINER_STATUS.MISSING_TRAINER_DATA;
  if (normalized === 'FOLD') return TRAINER_STATUS.EXACT_TRAINER_DATA;
  if (raw === 'UNSELECTED') return TRAINER_STATUS.EXACT_TRAINER_DATA;
  if (raw === 'nAI' || raw === 'LOW_PLAYABILITY' || raw === 'UO') {
    return TRAINER_STATUS.NEEDS_CLARIFICATION;
  }
  if (raw === 'AI' || raw === 'RAISE') {
    return TRAINER_STATUS.EXACT_TRAINER_DATA;
  }
  return TRAINER_STATUS.NEEDS_CLARIFICATION;
}

export function canGradeWithTrainerAction(rawAction, normalizedAction = null) {
  return actionGradingStatus(rawAction, normalizedAction) === TRAINER_STATUS.EXACT_TRAINER_DATA;
}
