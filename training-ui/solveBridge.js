// Browser wiring of the real CFR solver as the `solve` for drill generation.
// Bounded the same way the My Hands review bounds it (adaptive off, single
// chance branch, low iteration count) so drill generation stays responsive
// while remaining a genuine solver solve.

import { analyzeHand } from '../solver/src/index.js';

export const SOLVE_OPTS = { iterations: 8, adaptive: false, maxChanceBranches: 1, seed: 12345 };

export function solve(input, opts = {}) {
  return analyzeHand(input, { ...SOLVE_OPTS, ...opts });
}