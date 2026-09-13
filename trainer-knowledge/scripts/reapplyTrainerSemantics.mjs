#!/usr/bin/env node
/**
 * Reapply central trainer semantic legend to parsed Batch 2 cells.
 * Does NOT re-read WEBP images — operates on batch2-parsed-hands.json only.
 *
 * Run: node trainer-knowledge/scripts/reapplyTrainerSemantics.mjs [--dry-run]
 * Then: node trainer-knowledge/scripts/compactBatch2Shards.mjs
 *       node trainer-knowledge/scripts/buildTrainerKnowledge.mjs
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
const REPORT = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_REAPPLY_REPORT.json');

const DRY_RUN = process.argv.includes('--dry-run');

function semanticsAlreadyApplied(charts) {
  for (const chart of Object.values(charts)) {
    for (const cell of Object.values(chart.hands || {})) {
      if ((cell.actionRaw || cell.a) === 'UNSELECTED' && cell.normalizedAction === 'FOLD') {
        return true;
      }
    }
  }
  return false;
}

function baselineFromLegend(legend) {
  return legend.baselineBeforeConfirmation1 || null;
}

function summarize(charts) {
  let total = 0;
  let verified = 0;
  let grading = 0;
  let mixed = 0;
  let needs = 0;
  let unselected = 0;
  let fold = 0;
  let nai = 0;
  let naiGradable = 0;
  let orange = 0;
  let yellow = 0;
  const byAction = {};
  const byNormalized = {};

  for (const chart of Object.values(charts)) {
    for (const cell of Object.values(chart.hands || {})) {
      total += 1;
      const ar = cell.actionRaw || 'NONE';
      byAction[ar] = (byAction[ar] || 0) + 1;
      const na = cell.normalizedAction || 'NONE';
      byNormalized[na] = (byNormalized[na] || 0) + 1;

      if (ar === 'UNSELECTED') unselected += 1;
      if (na === 'FOLD') fold += 1;
      if (ar === 'nAI') {
        nai += 1;
        if (cell.gradingAllowed) naiGradable += 1;
      }
      if (ar === 'ORANGE_208_160_32') orange += 1;
      if (ar === 'YELLOW_240_240_48') yellow += 1;

      if (cell.gradingAllowed) grading += 1;
      if (cell.isMixed) mixed += 1;
      if (
        cell.dataStatus === 'EXACT_TRAINER_DATA' &&
        !cell.isMixed &&
        cell.gradingAllowed
      ) {
        verified += 1;
      } else {
        needs += 1;
      }
    }
  }

  return {
    total,
    verified,
    grading,
    mixed,
    needsClarification: needs,
    unselected,
    fold,
    nai,
    naiGradable,
    orange,
    yellow,
    byAction,
    byNormalized
  };
}

function reapply(data) {
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
  return { ...data, charts };
}

function main() {
  if (!existsSync(PARSED)) {
    console.error('Missing', PARSED);
    process.exit(1);
  }

  const legend = loadTrainerSemanticLegend();
  const data = JSON.parse(readFileSync(PARSED, 'utf8'));
  const current = summarize(data.charts);
  const frozenBaseline = baselineFromLegend(legend);
  const alreadyApplied = semanticsAlreadyApplied(data.charts);
  const before = alreadyApplied && frozenBaseline ? { ...current, ...frozenBaseline } : current;

  const updated = reapply(data);
  const after = summarize(updated.charts);

  const unselectedBefore = before.unselected;
  const foldAfter = after.fold;
  const newlyGradingAllowed =
    after.grading - before.grading;
  const naiNewlyGradable = after.naiGradable - before.naiGradable;

  const report = {
    semanticLegendVersion: legend.version,
    reparseRequired: false,
    dryRun: DRY_RUN,
    source: 'batch2-parsed-hands.json',
    trainerConfirmation: 'HUMAN_CONFIRMATION_1',
    before,
    after,
    delta: {
      verified: after.verified - before.verified,
      grading: after.grading - before.grading,
      needsClarification: after.needsClarification - before.needsClarification,
      unselectedToFold: foldAfter - before.fold,
      naiNewlyGradable
    },
    humanConfirmation1: {
      naiSemanticRepresentation: 'NON_ALL_IN + contextualAction metadata (chart-context only)',
      naiNewlyGradable,
      unselectedBefore,
      foldAfter,
      newlyGradingAllowed,
      mixedPolicy: 'MIXED / frequencySemantics=UNKNOWN_OR_CONDITIONAL / gradingAllowed=false',
      orange: { before: before.orange, after: after.orange, modified: false },
      yellow: { before: before.yellow, after: after.yellow, modified: false },
      verifiedBefore: before.verified,
      verifiedAfter: after.verified,
      needsClarificationBefore: before.needsClarification,
      needsClarificationAfter: after.needsClarification,
      gradingBefore: before.grading,
      gradingAfter: after.grading
    },
    safeToMerge: false
  };

  if (!DRY_RUN) {
    updated.semanticLegendVersion = legend.version;
    updated.semanticReappliedAt = new Date().toISOString();
    writeFileSync(PARSED, JSON.stringify(updated));
  }

  writeFileSync(REPORT, JSON.stringify(report, null, 2));

  console.log(DRY_RUN ? 'DRY RUN — no files written except report' : 'Semantic reapply complete (no image reparse)');
  console.log('UNSELECTED BEFORE:', unselectedBefore);
  console.log('FOLD AFTER:', foldAfter);
  console.log('NEWLY GRADING-ALLOWED:', newlyGradingAllowed);
  console.log('nAI newly gradable:', naiNewlyGradable);
  console.log('VERIFIED BEFORE:', before.verified);
  console.log('VERIFIED AFTER:', after.verified);
  console.log('NEEDS CLARIFICATION BEFORE:', before.needsClarification);
  console.log('NEEDS CLARIFICATION AFTER:', after.needsClarification);
  console.log('GRADING BEFORE:', before.grading);
  console.log('GRADING AFTER:', after.grading);
  console.log('Wrote', REPORT);
}

main();
