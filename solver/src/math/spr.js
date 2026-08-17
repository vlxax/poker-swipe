import { SolverError } from '../api/errors.js';

export function calculateSPR({ effectiveStackBB = 0, potBB = 0 }) {
  if (!Number.isFinite(effectiveStackBB) || effectiveStackBB < 0) {
    throw new SolverError('INVALID_STACK', 'effectiveStackBB must be a non-negative number');
  }
  if (!Number.isFinite(potBB) || potBB <= 0) {
    throw new SolverError('INVALID_POT', 'potBB must be positive for SPR');
  }
  return effectiveStackBB / potBB;
}