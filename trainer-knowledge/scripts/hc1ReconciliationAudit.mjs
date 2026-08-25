#!/usr/bin/env node
/**
 * Human Confirmation #1 — full reconciliation audit (no image reparse).
 * Run after: reapplyTrainerSemantics → compactBatch2Shards → buildTrainerKnowledge
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  applySemanticsToCell,
  chartHasAiAction,
  getLegendSchemeForChart,
  loadTrainerSemanticLegend
} from '../semanticLegend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const PARSED = join(ROOT, 'data/trainer/built/batch2-parsed-hands.json');
const OUT = join(ROOT, 'trainer-knowledge/TRAINER_HC1_RECONCILIATION.json');

const ORANGE = 'ORANGE_208_160_32';
const YELLOW = 'YELLOW_240_240_48';
const PRE_BASELINE = {
  verified: 14358,
  grading: 14358,
  needsClarification: 252324
};

function cellComponents(cell) {
  const raw = cell.actionRaw ?? cell.a;
  if (cell.isMixed && Array.isArray(cell.strategies)) {
    return cell.strategies.map((s) => s.rawAction ?? s.a).filter(Boolean);
  }
  return raw ? [raw] : [];
}

function auditDataset(charts) {
  const stats = {
    total: 0,
    verified: 0,
    grading: 0,
    needsClarification: 0,
    fold: 0,
    ai: 0,
    naiRaw: 0,
    naiContextuallyResolved: 0,
    naiBlocked: 0,
    naiGradingAllowed: 0,
    naiGradingBlocked: 0,
    unselectedRaw: 0,
    unselectedNonMixed: 0,
    unselectedMixedPrimary: 0,
    unselectedMixedStrategyComponents: 0,
    unselectedNonMixedFold: 0,
    mixed: 0,
    mixedGradable: 0,
    mixedWithUnselected: 0,
    mixedWithNai: 0,
    mixedWithOrange: 0,
    mixedWithYellow: 0,
    mixedOther: 0,
    raise: 0,
    orangeRaw: 0,
    orangeGrading: 0,
    yellowRaw: 0,
    yellowGrading: 0,
    otherUnknown: 0,
    gradingByProvenance: {},
    gradingBySemanticId: {},
    naiByMode: {},
    naiResolvedByMode: {},
    naiBlockedByMode: {}
  };

  const examples = {
    unselectedToFold: [],
    naiResolved: [],
    naiBlocked: [],
    mixedBlocked: [],
    orangeYellowSafe: []
  };

  for (const [chartId, chart] of Object.entries(charts)) {
    const mode = chart.sourceMode || null;
    const stack = chart.stackBand || chart.stack?.raw || chart.stack || null;
    const position = chart.heroPosition?.raw || chart.position || null;

    for (const [hand, cell] of Object.entries(chart.hands || {})) {
      stats.total += 1;
      const raw = cell.actionRaw ?? cell.a;
      const na = cell.normalizedAction;
      const comps = cellComponents(cell);

      if (raw === 'AI') stats.ai += 1;
      if (raw === 'RAISE') stats.raise += 1;
      if (raw === ORANGE) {
        stats.orangeRaw += 1;
        if (cell.gradingAllowed) stats.orangeGrading += 1;
      }
      if (raw === YELLOW) {
        stats.yellowRaw += 1;
        if (cell.gradingAllowed) stats.yellowGrading += 1;
      }
      if (na === 'FOLD') stats.fold += 1;

      if (raw === 'UNSELECTED') {
        stats.unselectedRaw += 1;
        if (cell.isMixed) stats.unselectedMixedPrimary += 1;
        else {
          stats.unselectedNonMixed += 1;
          if (na === 'FOLD' && cell.gradingAllowed) stats.unselectedNonMixedFold += 1;
        }
      }
      if (cell.isMixed && comps.includes('UNSELECTED')) {
        stats.unselectedMixedStrategyComponents += comps.filter((c) => c === 'UNSELECTED').length;
        stats.mixedWithUnselected += 1;
      }
      if (comps.includes('nAI') && cell.isMixed) stats.mixedWithNai += 1;
      if (comps.includes('nAI') && cell.isMixed) stats.mixedWithNai += 1;
      if (comps.includes(ORANGE) && cell.isMixed) stats.mixedWithOrange += 1;
      if (comps.includes(YELLOW) && cell.isMixed) stats.mixedWithYellow += 1;

      if (raw === 'nAI') {
        stats.naiRaw += 1;
        stats.naiByMode[mode || 'unknown'] = (stats.naiByMode[mode || 'unknown'] || 0) + 1;
        if (cell.contextualAction && cell.gradingAllowed) {
          stats.naiContextuallyResolved += 1;
          stats.naiGradingAllowed += 1;
          stats.naiResolvedByMode[mode || 'unknown'] = (stats.naiResolvedByMode[mode || 'unknown'] || 0) + 1;
        } else {
          stats.naiBlocked += 1;
          stats.naiGradingBlocked += 1;
          stats.naiBlockedByMode[mode || 'unknown'] = (stats.naiBlockedByMode[mode || 'unknown'] || 0) + 1;
        }
      }

      if (cell.isMixed) {
        stats.mixed += 1;
        if (cell.gradingAllowed) stats.mixedGradable += 1;
        else if (!comps.includes('UNSELECTED') && !comps.includes('nAI') && !comps.includes(ORANGE) && !comps.includes(YELLOW)) {
          stats.mixedOther += 1;
        }
      }

      if (cell.gradingAllowed) {
        stats.grading += 1;
        const prov = cell.provenance || cell.semanticStatus || 'UNKNOWN';
        stats.gradingByProvenance[prov] = (stats.gradingByProvenance[prov] || 0) + 1;
        stats.gradingBySemanticId[cell.semanticId || raw] = (stats.gradingBySemanticId[cell.semanticId || raw] || 0) + 1;
      }

      if (cell.dataStatus === 'EXACT_TRAINER_DATA' && cell.gradingAllowed && !cell.isMixed) {
        stats.verified += 1;
      } else {
        stats.needsClarification += 1;
      }

      if (
        !['AI', 'RAISE', 'UNSELECTED', 'nAI', 'LOW_PLAYABILITY', ORANGE, YELLOW].includes(raw) &&
        !String(raw || '').startsWith('COLOR_')
      ) {
        stats.otherUnknown += 1;
      }

      const ex = { chartId, hand, sourceMode: mode, stack, position, actionRaw: raw, normalizedAction: na, contextualAction: cell.contextualAction || null, gradingAllowed: cell.gradingAllowed, provenance: cell.provenance || null, isMixed: cell.isMixed || false, components: comps };

      if (examples.unselectedToFold.length < 5 && raw === 'UNSELECTED' && !cell.isMixed && na === 'FOLD') {
        examples.unselectedToFold.push({ ...ex, reason: 'Trainer-confirmed gray = FOLD (non-mixed)' });
      }
      if (examples.naiResolved.length < 5 && raw === 'nAI' && cell.contextualAction && cell.gradingAllowed) {
        examples.naiResolved.push({ ...ex, reason: `Contextual ${cell.contextualAction} via sourceMode=${mode} + chartHasAI` });
      }
      if (examples.naiBlocked.length < 5 && raw === 'nAI' && !cell.gradingAllowed) {
        examples.naiBlocked.push({ ...ex, reason: cell.contextualAction ? 'mixed/blocked component' : 'Insufficient chart context for actionable nAI' });
      }
      if (examples.mixedBlocked.length < 5 && cell.isMixed) {
        examples.mixedBlocked.push({ ...ex, reason: 'MIXED policy — frequencySemantics UNKNOWN_OR_CONDITIONAL' });
      }
      if (examples.orangeYellowSafe.length < 6 && (raw === ORANGE || raw === YELLOW || comps.includes(ORANGE) || comps.includes(YELLOW))) {
        if (!cell.gradingAllowed || (raw !== ORANGE && raw !== YELLOW)) {
          examples.orangeYellowSafe.push({ ...ex, reason: raw === ORANGE || raw === YELLOW ? 'Orange/yellow not guessed — grading blocked' : 'Orange/yellow component in mixed — cell blocked' });
        }
      }
    }
  }

  return { stats, examples };
}

function idempotencyCheck(data) {
  const before = auditDataset(data.charts).stats;
  const charts = {};
  for (const [chartId, chart] of Object.entries(data.charts)) {
    const scheme = getLegendSchemeForChart(chartId);
    const hasAI = chartHasAiAction(chart);
    const hands = {};
    for (const [hand, cell] of Object.entries(chart.hands || {})) {
      hands[hand] = applySemanticsToCell(cell, scheme, {
        sourceMode: chart.sourceMode || null,
        chartHasAI: hasAI
      });
    }
    charts[chartId] = { ...chart, hands, legendScheme: scheme };
  }
  const after = auditDataset(charts).stats;
  const delta = {
    grading: after.grading - before.grading,
    verified: after.verified - before.verified,
    fold: after.fold - before.fold,
    naiGradingAllowed: after.naiGradingAllowed - before.naiGradingAllowed,
    mixedGradable: after.mixedGradable - before.mixedGradable
  };
  return { before, after, delta, pass: Object.values(delta).every((v) => v === 0) };
}

function provenanceAudit(charts) {
  let unknownHeuristic = 0;
  const bad = [];
  for (const [chartId, chart] of Object.entries(charts)) {
    for (const [hand, cell] of Object.entries(chart.hands || {})) {
      if (!cell.gradingAllowed) continue;
      const prov = cell.provenance || '';
      const allowed = ['TRAINER_CONFIRMED', 'EXACT_TRAINER_DATA'].includes(prov) ||
        cell.dataStatus === 'EXACT_TRAINER_DATA' ||
        cell.semanticStatus === 'VERIFIED' ||
        cell.semanticStatus === 'TRAINER_CONFIRMED';
      if (!prov && cell.semanticStatus === 'VERIFIED') continue;
      if (!allowed && !['AI', 'RAISE'].includes(cell.semanticId)) {
        unknownHeuristic += 1;
        if (bad.length < 10) bad.push({ chartId, hand, provenance: prov, semanticId: cell.semanticId, dataStatus: cell.dataStatus });
      }
    }
  }
  return { pass: unknownHeuristic === 0, unknownHeuristic, samples: bad };
}

function main() {
  if (!existsSync(PARSED)) {
    console.error('Missing', PARSED);
    process.exit(1);
  }
  const legend = loadTrainerSemanticLegend();
  const data = JSON.parse(readFileSync(PARSED, 'utf8'));
  const { stats, examples } = auditDataset(data.charts);
  const idem = idempotencyCheck(data);
  const prov = provenanceAudit(data.charts);

  const newGradingFromFold = stats.unselectedNonMixedFold;
  const newGradingFromNai = stats.naiGradingAllowed;
  const newGradingFromOther = stats.grading - PRE_BASELINE.grading - newGradingFromFold - newGradingFromNai;

  const report = {
    generatedAt: new Date().toISOString(),
    trainerConfirmation: 'HUMAN_CONFIRMATION_1',
    semanticLegendVersion: legend.version,
    imageReparseRequired: false,
    preHumanConfirmationBaseline: PRE_BASELINE,
    postHumanConfirmation: stats,
    delta: {
      verified: stats.verified - PRE_BASELINE.verified,
      grading: stats.grading - PRE_BASELINE.grading,
      needsClarification: stats.needsClarification - PRE_BASELINE.needsClarification
    },
    unselectedReconciliation: {
      rawTotal: stats.unselectedRaw,
      nonMixedPrimary: stats.unselectedNonMixed,
      mixedPrimary: stats.unselectedMixedPrimary,
      mixedStrategyComponents: stats.unselectedMixedStrategyComponents,
      nonMixedConvertedToFold: stats.unselectedNonMixedFold,
      arithmeticCheckPrimary: stats.unselectedNonMixed + stats.unselectedMixedPrimary === stats.unselectedRaw,
      newGradingAllowed: newGradingFromFold
    },
    naiReconciliation: {
      rawTotal: stats.naiRaw,
      contextuallyResolved: stats.naiContextuallyResolved,
      stillBlocked: stats.naiBlocked,
      gradingAllowed: stats.naiGradingAllowed,
      gradingBlocked: stats.naiGradingBlocked,
      byMode: stats.naiByMode,
      resolvedByMode: stats.naiResolvedByMode,
      blockedByMode: stats.naiBlockedByMode,
      newGradingAllowed: newGradingFromNai
    },
    mixedSafety: {
      total: stats.mixed,
      gradable: stats.mixedGradable,
      expectedGradable: 0,
      pass: stats.mixedGradable === 0,
      withUnselectedComponent: stats.mixedWithUnselected,
      withNaiComponent: stats.mixedWithNai,
      withOrange: stats.mixedWithOrange,
      withYellow: stats.mixedWithYellow,
      other: stats.mixedOther
    },
    orangeYellowSafety: {
      orangeRaw: stats.orangeRaw,
      orangeNewGrading: stats.orangeGrading,
      yellowRaw: stats.yellowRaw,
      yellowNewGrading: stats.yellowGrading,
      pass: stats.orangeGrading === 0 && stats.yellowGrading === 0
    },
    gradingBreakdown: {
      newFromUnselectedFold: newGradingFromFold,
      newFromContextualNai: newGradingFromNai,
      newFromOtherConfirmed: newGradingFromOther,
      blockedMixed: stats.mixed,
      blockedOrange: stats.orangeRaw - stats.orangeGrading,
      blockedYellow: stats.yellowRaw - stats.yellowGrading
    },
    gradingByProvenance: stats.gradingByProvenance,
    gradingBySemanticId: stats.gradingBySemanticId,
    provenanceAudit: prov,
    idempotentReapply: idem,
    spotChecks: examples,
    safeToMerge: false
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    gradingAfter: stats.grading,
    verifiedAfter: stats.verified,
    mixedGradable: stats.mixedGradable,
    orangeGrading: stats.orangeGrading,
    yellowGrading: stats.yellowGrading,
    idempotent: idem.pass,
    provenancePass: prov.pass,
    arithmeticCheck: report.unselectedReconciliation.arithmeticCheckPrimary,
    out: OUT
  }, null, 2));
}

main();
