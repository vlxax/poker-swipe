import { calculatePotOdds } from '../math/potOdds.js';
import { calculateRequiredEquity } from '../math/requiredEquity.js';
import { STRATEGY_SOURCE } from './strategySource.js';

export function riverBluffCatchReport({
  potBB,
  betBB,
  valueCombos = null,
  bluffCombos = null,
  blockerNotes = [],
  heroBlockers = null
} = {}) {
  const potOdds = (potBB != null && betBB != null)
    ? calculatePotOdds({ potBeforeBet: potBB, bet: betBB, call: betBB })
    : null;
  const required = (potBB != null && betBB != null)
    ? calculateRequiredEquity({ potBeforeBet: potBB, bet: betBB, call: betBB })
    : null;

  const hasComboCounts = Number.isFinite(valueCombos) && Number.isFinite(bluffCombos);
  let bluffShare = null;
  if (hasComboCounts && (valueCombos + bluffCombos) > 0) {
    bluffShare = bluffCombos / (valueCombos + bluffCombos);
  }

  return {
    potOdds,
    requiredEquity: required,
    valueCombos: hasComboCounts ? valueCombos : null,
    bluffCombos: hasComboCounts ? bluffCombos : null,
    bluffShare,
    blockers: blockerNotes,
    heroBlockers,
    inventedComboCount: false,
    strategySource: hasComboCounts ? STRATEGY_SOURCE.CURATED_REFERENCE : STRATEGY_SOURCE.HEURISTIC,
    explanation: explainCatch({ potOdds, required, hasComboCounts, valueCombos, bluffCombos, bluffShare, blockerNotes })
  };
}

function explainCatch({ potOdds, required, hasComboCounts, valueCombos, bluffCombos, bluffShare, blockerNotes }) {
  const parts = [];
  if (required != null) {
    parts.push(`Pot odds require about ${Math.round(required * 100)}% equity to call.`);
  }
  if (hasComboCounts) {
    parts.push(`Value combos ${valueCombos} vs bluff combos ${bluffCombos} (bluff share ${Math.round(bluffShare * 100)}%).`);
  } else {
    parts.push('Exact value/bluff combo counts were not computed — not invented.');
  }
  if (blockerNotes && blockerNotes.length) parts.push(blockerNotes.join(' '));
  return parts.join(' ');
}
