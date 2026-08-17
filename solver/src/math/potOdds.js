import { SolverError, assert } from '../api/errors.js';

function num(v, code, msg) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new SolverError(code, msg);
  return n;
}

export function calculateFinalPot({ potBeforeBet = 0, bet = 0, call = 0 }) {
  return num(potBeforeBet, 'INVALID_POT', 'potBeforeBet must be a non-negative number') +
    num(bet, 'INVALID_POT', 'bet must be a non-negative number') +
    num(call, 'INVALID_POT', 'call must be a non-negative number');
}

// pot odds = call / (potBeforeBet + bet + call)
export function calculatePotOdds({ potBeforeBet = 0, bet = 0, call = 0 }) {
  const finalPot = calculateFinalPot({ potBeforeBet, bet, call });
  if (finalPot <= 0) throw new SolverError('INVALID_POT', 'final pot must be positive');
  return call / finalPot;
}