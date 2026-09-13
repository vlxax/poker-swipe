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
    if (entryMatches(entry, rawAction, legendScheme)) return { ...entry };
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

/**
 * Resolve nAI with chart-context metadata.
 * gradingAllowed=true only when sourceMode + chartHasAI uniquely determine action.
 */
export function resolveNaiContextualAction(sourceMode, { chartHasAI = false } = {}) {
  const legend = loadTrainerSemanticLegend();
  const cfg = legend.contextualActions?.nAI;
  if (!cfg) {
    return {
      normalizedAction: 'NON_ALL_IN',
      contextualAction: null,
      status: 'NEEDS_CLARIFICATION',
      gradingAllowed: false,
      dataStatus: 'NEEDS_CLARIFICATION',
      provenance: null
    };
  }

  const base = {
    normalizedAction: cfg.baseNormalizedAction || 'NON_ALL_IN',
    contextualAction: null,
    status: cfg.status || 'TRAINER_CONFIRMED',
    provenance: cfg.provenance || 'TRAINER_CONFIRMED',
    semanticId: 'nAI'
  };

  if (!chartHasAI || !cfg.requiresChartHasAI) {
    return {
      ...base,
      gradingAllowed: false,
      dataStatus: 'NEEDS_CLARIFICATION'
    };
  }

  const modeRule = cfg.bySourceMode?.[sourceMode];
  if (!modeRule) {
    return {
      ...base,
      gradingAllowed: false,
      dataStatus: 'NEEDS_CLARIFICATION'
    };
  }

  return {
    ...base,
    contextualAction: modeRule.contextualAction || null,
    gradingAllowed: Boolean(modeRule.gradingAllowed),
    dataStatus: modeRule.dataStatus || 'EXACT_TRAINER_DATA'
  };
}

function enrichEntryForContext(entry, rawAction, { sourceMode, chartHasAI } = {}) {
  if (rawAction !== 'nAI') return entry;

  const nai = resolveNaiContextualAction(sourceMode, { chartHasAI });
  return {
    ...entry,
    normalizedAction: nai.normalizedAction,
    contextualAction: nai.contextualAction,
    status: nai.status,
    gradingAllowed: nai.gradingAllowed,
    dataStatus: nai.dataStatus,
    provenance: nai.provenance
  };
}

export function applySemanticsToStrategy(
  strategy,
  legendScheme,
  { isMixed = false, sourceMode = null, chartHasAI = false } = {}
) {
  const rawAction = strategy.rawAction ?? strategy.a;
  let entry = enrichEntryForContext(
    resolveSemanticEntry(rawAction, legendScheme),
    rawAction,
    { sourceMode, chartHasAI }
  );

  // Mixed components never enable cell-level grading; component semantics still apply.
  const gradingAllowed = Boolean(entry.gradingAllowed) && !isMixed;

  return {
    ...strategy,
    rawAction,
    normalizedAction: entry.normalizedAction ?? null,
    contextualAction: entry.contextualAction ?? null,
    semanticId: entry.id,
    semanticStatus: entry.status,
    dataStatus: entry.dataStatus,
    provenance: entry.provenance ?? null,
    gradingAllowed,
    frequencyType: strategy.frequencyType || (strategy.t === 'E' ? 'EXACT' : 'VISUAL_APPROX')
  };
}

export function applySemanticsToCell(
  cell,
  legendScheme,
  { sourceMode = null, chartHasAI = false } = {}
) {
  const isMixed = Boolean(cell.isMixed || cell.m === 1);
  const strategies = (cell.strategies || []).map((st) =>
    applySemanticsToStrategy(
      typeof st.a !== 'undefined'
        ? {
            rawAction: st.a,
            frequency: st.f,
            frequencyType: st.t === 'E' ? 'EXACT' : 'VISUAL_APPROX',
            gradingAllowed: st.g === 1
          }
        : st,
      legendScheme,
      { isMixed, sourceMode, chartHasAI }
    )
  );

  const rawAction = cell.actionRaw ?? cell.a ?? strategies[0]?.rawAction ?? null;
  let primaryEntry = enrichEntryForContext(
    resolveSemanticEntry(rawAction, legendScheme),
    rawAction,
    { sourceMode, chartHasAI }
  );

  const legend = loadTrainerSemanticLegend();
  const mixedPolicy = legend.mixedPolicy || {};

  if (isMixed) {
    return {
      ...cell,
      actionRaw: rawAction,
      normalizedAction: mixedPolicy.normalizedAction || 'MIXED',
      contextualAction: null,
      semanticId: 'MIXED',
      semanticStatus: mixedPolicy.status || 'TRAINER_CONFIRMED',
      dataStatus: 'NEEDS_CLARIFICATION',
      provenance: mixedPolicy.provenance || 'TRAINER_CONFIRMED',
      frequencySemantics: mixedPolicy.frequencySemantics || 'UNKNOWN_OR_CONDITIONAL',
      gradingAllowed: false,
      strategies: strategies.length ? strategies : cell.strategies,
      isMixed: true,
      frequencyType: strategies[0]?.frequencyType || cell.frequencyType || null
    };
  }

  return {
    ...cell,
    actionRaw: rawAction,
    normalizedAction: primaryEntry.normalizedAction ?? null,
    contextualAction: primaryEntry.contextualAction ?? null,
    semanticId: primaryEntry.id,
    semanticStatus: primaryEntry.status,
    dataStatus: primaryEntry.dataStatus,
    provenance: primaryEntry.provenance ?? null,
    gradingAllowed: Boolean(primaryEntry.gradingAllowed),
    strategies: strategies.length ? strategies : cell.strategies,
    isMixed: false,
    frequencyType: strategies[0]?.frequencyType || cell.frequencyType || null
  };
}

export function getLegendSchemeForChart(chartId) {
  const data = loadBatch2LegendSchemes();
  return data.schemes?.[chartId] || 'UNKNOWN';
}

export function chartHasAiAction(chart) {
  for (const cell of Object.values(chart.hands || {})) {
    const raw = cell.actionRaw ?? cell.a;
    if (raw === 'AI') return true;
    if (Array.isArray(cell.strategies)) {
      for (const st of cell.strategies) {
        if ((st.rawAction ?? st.a) === 'AI') return true;
      }
    }
  }
  return false;
}
