import { SolverError, assert } from '../api/errors.js';
import { normalizeBetSize } from '../math/betMath.js';
import { ACTION_TYPES } from '../config/defaults.js';

export const CANONICAL_ACTIONS = ACTION_TYPES;

export function normalizeAction(action, potBB = 0) {
  if (!action || typeof action !== 'object') {
    throw new SolverError('INVALID_ACTION', 'action must be an object like { type, sizePot|amountBB }');
  }
  const type = String(action.type || '').toLowerCase();
  if (!CANONICAL_ACTIONS.includes(type)) {
    throw new SolverError('INVALID_ACTION', `unsupported action type: ${type}`);
  }
  if (type === 'bet' || type === 'raise' || type === 'all_in') {
    return { type, ...normalizeBetSize(action, potBB) };
  }
  return { type, amountBB: 0, sizePot: null };
}

export function actionToString(action, potBB = 0) {
  const a = normalizeAction(action, potBB);
  if (a.amountBB != null && a.type !== 'fold' && a.type !== 'check' && a.type !== 'call') {
    return `${a.type}_${a.sizePot != null ? Math.round(a.sizePot * 100) : Math.round(a.amountBB)}`;
  }
  return a.type;
}