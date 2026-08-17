import { calculateCallEV, calculateBetEV, calculateRaiseEV, calculateFoldEV } from '../math/ev.js';
import { SolverError } from '../api/errors.js';

// Heuristic opponent folding model (clearly labelled, NOT GTO).
// Larger bets fold more. Used only for bet/raise EV estimation until a real
// range-response model / game tree exists.
export function heuristicFoldEquity(sizePot, equity) {
  const base = 0.12 + (sizePot || 0) * 0.22;
  const strengthBoost = (equity - 0.4) * 0.25; // stronger hands: villain folds more to value bets
  return clamp(base + strengthBoost, 0.05, 0.85);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// Compute approximate EV for a single action. ctx = { potBB, equity, effectiveStackBB, facingBetBB }
export function evaluateAction(action, ctx) {
  const type = String(action.type || '').toLowerCase();
  const potBB = ctx.potBB || 0;
  const equity = ctx.equity != null ? ctx.equity : 0;

  if (type === 'fold') {
    return { action, evBB: calculateFoldEV(), analysisMethod: 'exact' };
  }
  if (type === 'check') {
    // check to showdown: hero wins pot with his equity (simplified hot/cold)
    return { action, evBB: equity * potBB, analysisMethod: 'heuristic' };
  }
  if (type === 'call') {
    const facing = ctx.facingBetBB != null ? ctx.facingBetBB : action.amountBB || 0;
    const evBB = calculateCallEV({ potBeforeBet: potBB, bet: facing, call: facing, equity });
    return { action, evBB, analysisMethod: 'exact' };
  }
  if (type === 'bet') {
    const amount = action.amountBB != null ? action.amountBB : (action.sizePot || 0) * potBB;
    const fe = heuristicFoldEquity(action.sizePot, equity);
    const evBB = calculateBetEV({
      potBeforeBet: potBB,
      bet: amount,
      equityWhenCalled: equity,
      foldEquity: fe
    });
    return { action, evBB, analysisMethod: 'heuristic', model: { foldEquity: round(fe, 4), equityWhenCalled: round(equity, 4) } };
  }
  if (type === 'raise') {
    const amount = action.amountBB != null ? action.amountBB : (action.sizePot || 0) * potBB;
    const fe = heuristicFoldEquity(action.sizePot, equity);
    const evBB = calculateRaiseEV({
      potBeforeBet: potBB,
      facingBet: ctx.facingBetBB != null ? ctx.facingBetBB : 0,
      raiseSize: amount,
      equityWhenCalled: equity,
      foldEquity: fe
    });
    return { action, evBB, analysisMethod: 'heuristic', model: { foldEquity: round(fe, 4) } };
  }
  if (type === 'all_in') {
    const amount = ctx.effectiveStackBB || 0;
    const fe = heuristicFoldEquity(amount / (potBB || 1), equity);
    const evBB = calculateRaiseEV({
      potBeforeBet: potBB,
      facingBet: ctx.facingBetBB != null ? ctx.facingBetBB : 0,
      raiseSize: amount,
      equityWhenCalled: equity,
      foldEquity: fe
    });
    return { action, evBB, analysisMethod: 'heuristic', model: { foldEquity: round(fe, 4) } };
  }
  throw new SolverError('INVALID_ACTION', `unsupported action type: ${type}`);
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}