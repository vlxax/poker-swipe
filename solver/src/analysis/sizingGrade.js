// Sizing grades by allowed sizes, purpose, SPR and EV — not numeric proximity alone.

import { STRATEGY_SOURCE } from './strategySource.js';

export const STRATEGIC_SIZE_FAMILIES = {
  25: 'small_probe',
  33: 'range_or_small_cbet',
  50: 'standard',
  66: 'value_or_protection',
  75: 'polar_or_protection',
  100: 'pot',
  125: 'overbet',
  150: 'overbet'
};

export function sizeFamily(pct) {
  const n = Number(pct);
  if (n >= 115) return 'overbet';
  if (n >= 90) return 'pot';
  if (n >= 70) return 'polar_or_protection';
  if (n >= 58) return 'value_or_protection';
  if (n >= 42) return 'standard';
  if (n >= 30) return 'range_or_small_cbet';
  return 'small_probe';
}

export function gradeSizing({
  chosenPct,
  allowedSizes = [],
  sizeWeights = [],
  evBySize = null,
  spr = null,
  purpose = null
} = {}) {
  if (chosenPct == null) {
    return {
      grade: null,
      reason: 'no_size',
      strategySource: STRATEGY_SOURCE.HEURISTIC
    };
  }
  const chosen = Number(chosenPct);
  const chosenFam = sizeFamily(chosen);

  if (evBySize && typeof evBySize === 'object') {
    const entries = Object.entries(evBySize)
      .map(([k, v]) => ({ pct: Number(k), ev: Number(v) }))
      .filter((e) => Number.isFinite(e.pct) && Number.isFinite(e.ev));
    if (entries.length) {
      const best = entries.reduce((a, b) => (b.ev > a.ev ? b : a));
      const chosenEv = entries.reduce((bestMatch, e) => {
        return Math.abs(e.pct - chosen) < Math.abs(bestMatch.pct - chosen) ? e : bestMatch;
      }, entries[0]);
      const evLoss = Math.max(0, best.ev - chosenEv.ev);
      const sameFamily = sizeFamily(chosenEv.pct) === sizeFamily(best.pct);
      let grade = 'r';
      if (evLoss <= 0.02 && sameFamily) grade = 'g';
      else if (evLoss <= 0.08 && sameFamily) grade = 'y';
      else if (evLoss <= 0.05) grade = 'y';
      return {
        grade,
        evLossBB: evLoss,
        bestPct: best.pct,
        chosenFamily: chosenFam,
        bestFamily: sizeFamily(best.pct),
        proximityOnly: false,
        strategySource: STRATEGY_SOURCE.SOLVER_VERIFIED,
        reason: 'ev_loss'
      };
    }
  }

  const allowed = (allowedSizes.length ? allowedSizes : sizeWeights.map((s) => s.pct))
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const weights = sizeWeights.length
    ? sizeWeights
    : allowed.map((pct) => ({ pct, weight: 1 }));
  const bestW = weights.reduce((a, b) => ((b.weight || 0) > (a.weight || 0) ? b : a), weights[0] || { pct: chosen, weight: 1 });
  const bestFam = sizeFamily(bestW.pct);
  const allowedFams = new Set(allowed.map(sizeFamily));

  // 50 vs 60 can be numerically close but 50 is standard and 60 is protection —
  // only mark green if same family AND among allowed, or weight is clearly preferred.
  const dist = Math.abs(chosen - bestW.pct);
  const sameFam = chosenFam === bestFam;
  const allowedHit = allowedFams.has(chosenFam);
  let grade = 'r';
  if (sameFam && allowedHit && (bestW.weight >= 0.45 || dist <= 8)) grade = 'g';
  else if (sameFam && allowedHit) grade = 'y';
  else if (allowedHit && dist <= 15) grade = 'y';
  else grade = 'r';

  if (purpose && STRATEGIC_SIZE_FAMILIES[Math.round(bestW.pct)] && purpose !== chosenFam && grade === 'g') {
    if (!sameFam) grade = 'y';
  }
  if (spr != null && spr < 1 && chosenFam === 'small_probe' && bestFam === 'overbet') {
    grade = 'r';
  }

  return {
    grade,
    bestPct: bestW.pct,
    chosenFamily: chosenFam,
    bestFamily: bestFam,
    distancePp: dist,
    proximityOnly: false,
    strategySource: STRATEGY_SOURCE.CURATED_REFERENCE,
    reason: 'reference_policy_family'
  };
}
