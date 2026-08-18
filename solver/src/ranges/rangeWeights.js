import { expandRange } from './rangeExpander.js';

// Normalize weights so max weight = 1 (or sum of weights = 1). maxNorm is default.
export function normalizeRange(range, blockedCards = [], mode = 'max') {
  const ex = expandRange(range, blockedCards);
  if (!ex.comboCount) return { combos: [], totalWeight: 0, comboCount: 0 };
  const maxW = Math.max(...ex.combos.map((c) => c.weight));
  const sumW = ex.totalWeight;
  const factor = mode === 'sum' ? sumW : maxW;
  const combos = ex.combos.map((c) => ({ ...c, weight: factor ? c.weight / factor : 0 }));
  return {
    combos,
    totalWeight: combos.reduce((s, c) => s + c.weight, 0),
    comboCount: combos.length
  };
}

// Build a probability distribution over combos (weights sum to 1). Used for sampling.
export function toWeightedDistribution(range, blockedCards = []) {
  const ex = expandRange(range, blockedCards);
  if (!ex.totalWeight) return [];
  return ex.combos.map((c) => ({ ...c, weight: c.weight / ex.totalWeight }));
}