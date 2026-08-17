import { calculateFinalPot } from './potOdds.js';
import { SolverError, assert } from '../api/errors.js';

function eq(v) {
  const n = Number(v);
  assert(Number.isFinite(n) && n >= 0 && n <= 1, 'INVALID_INPUT', 'equity must be between 0 and 1');
  return n;
}

// EV of calling a bet. EV = equity * finalPot - callAmount.
export function calculateCallEV({ potBeforeBet = 0, bet = 0, call = 0, equity = 0 }) {
  const finalPot = calculateFinalPot({ potBeforeBet, bet, call });
  return eq(equity) * finalPot - call;
}

// EV of folding is 0 (relative to current decision point).
export function calculateFoldEV() {
  return 0;
}

// EV of betting: foldEquity wins the pot; when called we win/lose the enlarged pot.
// EV = fe*pot + (1-fe)*(equity*(pot + 2*bet) - bet)
export function calculateBetEV({
  potBeforeBet = 0,
  bet = 0,
  equityWhenCalled = 0,
  foldEquity = 0
}) {
  assert(Number.isFinite(foldEquity) && foldEquity >= 0 && foldEquity <= 1, 'INVALID_INPUT', 'foldEquity must be 0..1');
  const fe = foldEquity;
  const pot = Number(potBeforeBet) || 0;
  const b = Number(bet) || 0;
  const eqC = eq(equityWhenCalled);
  const winWhenCalled = eqC * (pot + 2 * b) - b;
  return fe * pot + (1 - fe) * winWhenCalled;
}

// EV of raising (simplified headsup model). total commitment = call + raise size.
export function calculateRaiseEV({
  potBeforeBet = 0,
  facingBet = 0,
  raiseSize = 0,
  equityWhenCalled = 0,
  foldEquity = 0
}) {
  const pot = Number(potBeforeBet) || 0;
  const facing = Number(facingBet) || 0;
  const raiseAmt = Number(raiseSize) || 0;
  const totalCommit = facing + raiseAmt;
  const finalPot = pot + 2 * totalCommit; // villain calls the raise
  const fe = foldEquity;
  const eqC = eq(equityWhenCalled);
  return fe * pot + (1 - fe) * (eqC * finalPot - totalCommit);
}