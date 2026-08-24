// Central trainer semantic legend — apply confirmed meanings to parsed cells.
// Update trainerSemanticLegend.json only; re-run reapplyTrainerSemantics.mjs to regenerate.

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _legend = null;
let _schemes = null;

export function loadTrainerSemanticLegend() {
  if (_legend) return _legend;
  const path = join(__dirname, 'trainerSemanticLegend.json');
  _legend = JSON.parse(readFileSync(path, 'utf8'));
  return _legend;
}

export function loadBatch2LegendSchemes() {
  if (_schemes) return _schemes;
  const path = join(__dirname, 'batch2-legend-schemes.json');
  _schemes = JSON.parse(readFileSync(path, 'utf8'));
  return _schemes;
}

function entryMatches(entry, rawAction, legendScheme) {
  const m = entry.match || {};
  if (m.rawAction && m.rawAction !== rawAction) return false;
  if (m.rawActionPrefix && !String(rawAction || '').startsWith(m.rawActionPrefix)) return false;
  if (m.legendScheme && m.legendScheme !== legendScheme) return false;
  return true;
}

export function resolveSemanticEntry(rawAction, legendScheme = null) {
  const legend = loadTrainerSemanticLegend();
  const entries = legend.entries || [];

  // Scheme-specific first, then generic
  const ranked = [
    ...entries.filter((e) => e.match?.legendScheme),
    ...entries.filter((e) => !e.match?.legendScheme)
  ];

  for (const entry of ranked) {
    if (entryMatches(entry, rawAction, legendScheme)) return entry;
  }
  return {
    id: 'UNMAPPED',
    rawLabel: rawAction,
    normalizedAction: null,
    status: 'NEEDS_CLARIFICATION',
    gradingAllowed: false,
    dataStatus: 'NEEDS_CLARIFICATION'
  };
}

export function applySemanticsToStrategy(strategy, legendScheme, { isMixed = false } = {}) {
  const entry = resolveSemanticEntry(strategy.rawAction ?? strategy.a, legendScheme);
  const gradingAllowed = Boolean(entry.gradingAllowed) && !isMixed;
  return {
    ...strategy,
    rawAction: strategy.rawAction ?? strategy.a,
    normalizedAction: entry.normalizedAction ?? null,
    semanticId: entry.id,
    semanticStatus: entry.status,
    dataStatus: entry.dataStatus,
    gradingAllowed,
    frequencyType: strategy.frequencyType || (strategy.t === 'E' ? 'EXACT' : 'VISUAL_APPROX')
  };
}

export function applySemanticsToCell(cell, legendScheme) {
  const isMixed = Boolean(cell.isMixed || cell.m === 1);
  const strategies = (cell.strategies || []).map((st) =>
    applySemanticsToStrategy(
      typeof st.a !== 'undefined'
        ? { rawAction: st.a, frequency: st.f, frequencyType: st.t === 'E' ? 'EXACT' : 'VISUAL_APPROX', gradingAllowed: st.g === 1 }
        : st,
      legendScheme,
      { isMixed }
    )
  );

  const primary = strategies[0];
  const rawAction = cell.actionRaw ?? cell.a ?? primary?.rawAction ?? null;
  const primaryEntry = resolveSemanticEntry(rawAction, legendScheme);

  const allVerified =
    strategies.length > 0 &&
    strategies.every((s) => s.semanticStatus === 'VERIFIED' && s.gradingAllowed);

  const gradingAllowed = isMixed ? allVerified : Boolean(primaryEntry.gradingAllowed);

  return {
    ...cell,
    actionRaw: rawAction,
    normalizedAction: primaryEntry.normalizedAction ?? null,
    semanticId: primaryEntry.id,
    semanticStatus: primaryEntry.status,
    dataStatus: primaryEntry.dataStatus,
    gradingAllowed,
    strategies: strategies.length ? strategies : cell.strategies,
    isMixed,
    frequencyType: primary?.frequencyType || cell.frequencyType || null
  };
}

export function getLegendSchemeForChart(chartId) {
  const data = loadBatch2LegendSchemes();
  return data.schemes?.[chartId] || 'UNKNOWN';
}
