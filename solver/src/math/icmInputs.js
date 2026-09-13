import { STRATEGY_SOURCE } from '../analysis/strategySource.js';

export function validateIcmInputs({
  stacks = null,
  payouts = null,
  playersRemaining = null
} = {}) {
  const missing = [];
  if (!Array.isArray(stacks) || stacks.length < 2) missing.push('all_player_stacks');
  if (!Array.isArray(payouts) || payouts.length < 2) missing.push('payout_structure');
  if (playersRemaining == null || !Number.isFinite(Number(playersRemaining))) {
    missing.push('players_remaining');
  }
  if (Array.isArray(stacks) && playersRemaining != null && stacks.length !== Number(playersRemaining)) {
    missing.push('stacks_count_mismatch');
  }
  const ok = missing.length === 0;
  return {
    ok,
    missing,
    strategySource: ok ? STRATEGY_SOURCE.ICM_EDUCATIONAL_MODEL : STRATEGY_SOURCE.TOURNAMENT_HEURISTIC,
    canRunIcm: ok
  };
}

export function assertIcmRunnable(input) {
  const v = validateIcmInputs(input);
  if (!v.canRunIcm) {
    return { ...v, refused: true, message: 'ICM calculation refused: missing tournament inputs.' };
  }
  return { ...v, refused: false };
}
