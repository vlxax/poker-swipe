import { calculatePotOdds } from './potOdds.js';

// Required equity to call = call / finalPot (same as pot odds).
export function calculateRequiredEquity({ potBeforeBet = 0, bet = 0, call = 0 }) {
  return calculatePotOdds({ potBeforeBet, bet, call });
}