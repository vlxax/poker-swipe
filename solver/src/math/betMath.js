import { SolverError } from '../api/errors.js';

// Convert a sizePot fraction (e.g. 0.75) into an amount in BB given the pot.
export function sizePotToAmount({ potBB = 0, sizePot = 0 }) {
  const p = Number(potBB);
  if (!Number.isFinite(p) || p < 0) throw new SolverError('INVALID_POT', 'potBB must be a non-negative number');
  return p * Number(sizePot);
}

// Normalize an action's size to a canonical { amountBB, sizePot } given the pot.
// Accepts { type, amountBB } or { type, sizePot }.
export function normalizeBetSize(action, potBB) {
  const type = String(action.type || '').toLowerCase();
  if (action.amountBB != null) {
    const amountBB = Number(action.amountBB);
    if (!Number.isFinite(amountBB) || amountBB < 0) throw new SolverError('INVALID_ACTION', 'amountBB must be non-negative');
    return { type, amountBB, sizePot: potBB > 0 ? amountBB / potBB : null };
  }
  if (action.sizePot != null) {
    const sizePot = Number(action.sizePot);
    if (!Number.isFinite(sizePot) || sizePot < 0) throw new SolverError('INVALID_ACTION', 'sizePot must be non-negative');
    return { type, amountBB: sizePot * potBB, sizePot };
  }
  return { type, amountBB: null, sizePot: null };
}

export function potAfterAction(potBB, amountBB) {
  return potBB + (amountBB || 0);
}