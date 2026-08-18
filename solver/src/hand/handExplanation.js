// English structured explanations for hand-analysis decisions. These are built
// ONLY from computed facts (EV differences, frequencies, pot geometry, equity,
// convergence/abstraction reliability) — never invented certainty. When the
// solver did not converge or the abstraction is coarse, that is stated plainly.

import { conceptFor } from './concepts.js';

// Build a short, evidence-backed explanation for a single Hero decision.
export function buildHandExplanation({
  street = 'flop',
  potBB = 0,
  spr = null,
  actionTaken = null,
  recommendedAction = null,
  recommendedFrequency = null,
  legalActions = [],
  evLossBB = null,
  evSeparationBB = 0,
  equity = null,
  confidence = null,
  convergence = null,
  exploitabilityBB = null,
  chanceBranches = null,
  analysisMethod = 'cfr',
  mistakeSeverity = null
}) {
  const bestType = describe(recommendedAction);
  const heroType = actionTaken ? describe(actionTaken) : null;
  const same = actionTaken && recommendedAction && idOf(actionTaken) === idOf(recommendedAction);

  const why = [];
  const keyConcepts = new Set();

  // EV / mistake reasoning.
  if (!same && heroType && evLossBB != null && evLossBB > 0.0005) {
    why.push(`Playing ${heroType} loses ${bb(evLossBB)} vs. the best line (${bestType}).`);
    addConcept(keyConcepts, evLossBB >= 1 ? 'blunder' : 'mistake');
  } else if (same && heroType) {
    why.push(`The chosen ${heroType} matches the recommended line.`);
  }

  // Mixed strategy / frequency.
  if (recommendedFrequency != null && recommendedFrequency > 0.05 && recommendedFrequency < 0.95) {
    why.push(`The solver mixes ${bestType} at ${Math.round(recommendedFrequency * 100)}% — this spot is not decided by a single sizing.`);
    addConcept(keyConcepts, 'mixed_strategy');
  }

  // Close EV decision.
  if (evSeparationBB >= 0 && evSeparationBB < 0.03) {
    why.push(`The top actions are close in EV (within ${bb(evSeparationBB)}), so this is a near-tied decision.`);
    addConcept(keyConcepts, 'close_decision');
  }

  // Sizing efficiency.
  const sizes = sizingSpread(legalActions);
  if (sizes.length >= 2) {
    const spread = sizes[sizes.length - 1].evBB - sizes[0].evBB;
    if (spread > 0.05) {
      why.push(`Betting size materially changes EV here (spread ${bb(spread)}), so sizing efficiency matters.`);
      addConcept(keyConcepts, 'sizing_efficiency');
    } else if (spread >= 0 && spread <= 0.05) {
      why.push(`Betting sizes are near-EV-neutral (within ${bb(spread)}), so any reasonable sizing is fine.`);
    }
  }

  // Pot geometry.
  if (potBB > 0 && spr != null) {
    why.push(`Pot geometry: SPR ≈ ${Number(spr).toFixed(1)} at a ${potBB} BB pot.`);
    addConcept(keyConcepts, 'pot_geometry');
  }

  // Showdown value / equity.
  if (equity != null) {
    const pct = Math.round(equity * 100);
    if (pct >= 55) {
      why.push(`Hero holds ${pct}% equity — strong range/value profile for the spot.`);
      addConcept(keyConcepts, 'value');
    } else if (pct <= 40) {
      why.push(`Hero holds ~${pct}% equity — limited showdown value, so fold equity / bluffing matters more.`);
      addConcept(keyConcepts, 'fold_equity');
    }
  }

  // River bluff-catch.
  if (street === 'river' && actionTaken && ['call', 'fold'].includes(actionTaken.type)) {
    why.push('River bluff-catching: the call/fold decision hinges on value-to-bluff frequency and blockers.');
    addConcept(keyConcepts, 'bluff_catch');
  }

  if (why.length === 0) {
    why.push(`Best line by solver: ${bestType}.`);
  }

  // Reliability statement.
  const reliability = reliabilityPhrase({ confidence, convergence, exploitabilityBB, chanceBranches, analysisMethod });

  const summary = summarize({ same, heroType, bestType, evLossBB, mistakeSeverity });

  return {
    summary,
    why,
    alternative: alternativePhrase({ same, heroType, bestType, recommendedFrequency }),
    reliability,
    keyConcept: conceptFor(firstConcept(keyConcepts)).name,
    concepts: [...keyConcepts]
  };
}

function summarize({ same, heroType, bestType, evLossBB, mistakeSeverity }) {
  if (!heroType) return `The solver prefers ${bestType} here.`;
  if (same) return `${cap(heroType)} is the recommended line in this spot.`;
  if (evLossBB != null && evLossBB <= 0.0005) return `${cap(heroType)} is acceptable and near-optimal.`;
  const sev = mistakeSeverity || 'a notable';
  return `${cap(heroType)} costs about ${bb(evLossBB || 0)} (${sev} mistake) — ${bestType} is better.`;
}

function alternativePhrase({ same, heroType, bestType, recommendedFrequency }) {
  if (same || !heroType) return `Recommended line: ${bestType}.`;
  const mix = recommendedFrequency != null && recommendedFrequency > 0.05 && recommendedFrequency < 0.95
    ? ` ${cap(heroType)} remains a legitimate mix option.` : '';
  return `Recommended line: ${bestType}.${mix}`;
}

function reliabilityPhrase({ confidence, convergence, exploitabilityBB, chanceBranches, analysisMethod }) {
  const parts = [];
  const conv = convergence && convergence.converged;
  if (conv) parts.push(`The solve converged${convergence && convergence.iterationsRun ? ` (${convergence.iterationsRun} iterations)` : ''}.`);
  else if (convergence) parts.push(`The solve did not converge (${convergence.stopReason || 'max_iterations'}).`);
  else parts.push(`Based on ${analysisMethod} approximation.`);
  if (Number.isFinite(Number(exploitabilityBB))) parts.push(`Exploitability ${Number(exploitabilityBB).toFixed(3)} BB.`);
  if (chanceBranches != null && Number.isFinite(chanceBranches)) {
    parts.push(`Coarse chance abstraction (${chanceBranches} branch${chanceBranches === 1 ? '' : 'es'} per street).`);
  }
  if (confidence) parts.push(`Confidence: ${confidence.level} (${confidence.score}).`);
  return parts.join(' ');
}

// The spread of EV across distinct bet/raise sizes among the legal actions.
function sizingSpread(legalActions) {
  return (legalActions || [])
    .filter((a) => a && a.action && (a.action.type === 'bet' || a.action.type === 'raise'))
    .map((a) => ({ size: a.action.sizePot, evBB: a.evBB }))
    .filter((s) => s.size != null && Number.isFinite(s.evBB))
    .sort((a, b) => a.size - b.size);
}

function addConcept(set, key) {
  set.add(key);
}

function firstConcept(set) {
  for (const k of set) return k;
  return 'range_advantage_and_sizing';
}

function idOf(a) {
  if (!a) return '';
  if (a.type === 'bet') return `bet_${Math.round((a.sizePot || 0) * 100)}`;
  if (a.type === 'raise') return `raise_${Math.round((a.sizePot || 0) * 100)}`;
  return a.type;
}

function describe(a) {
  if (!a) return '—';
  if (a.type === 'bet') return `bet ${Math.round(a.sizePot * 100)}% pot`;
  if (a.type === 'raise') return `raise ${Math.round(a.sizePot * 100)}%`;
  const EN = { fold: 'fold', check: 'check', call: 'call', bet: 'bet', raise: 'raise', all_in: 'all-in' };
  return EN[a.type] || a.type;
}

function cap(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function bb(n) {
  return `${Number(n).toFixed(2)} BB`;
}