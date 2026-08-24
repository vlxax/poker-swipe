#!/usr/bin/env node
/**
 * Reapply central trainer semantic legend to parsed Batch 2 cells.
 * Does NOT re-read WEBP images — operates on batch2-parsed-hands.json only.
 *
 * Run: node trainer-knowledge/scripts/reapplyTrainerSemantics.mjs
 * Then: node trainer-knowledge/scripts/compactBatch2Shards.mjs
 *       node trainer-knowledge/scripts/buildTrainerKnowledge.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

import {
  applySemanticsToCell,
  getLegendSchemeForChart,
  loadTrainerSemanticLegend
} from '../semanticLegend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const PARSED = join(ROOT, 'data/trainer/built/batch2-parsed-hands.json');
const REPORT = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_REAPPLY_REPORT.json');

function summarize(charts) {
  let total = 0;
  let verified = 0;
  let grading = 0;
  let mixed = 0;
  let needs = 0;
  const byAction = {};

  for (const chart of Object.values(charts)) {
    for (const cell of Object.values(chart.hands || {})) {
      total += 1;
      const ar = cell.actionRaw || 'NONE';
      byAction[ar] = (byAction[ar] || 0) + 1;
      if (cell.gradingAllowed) grading += 1;
      if (cell.isMixed) mixed += 1;
      if (cell.dataStatus === 'EXACT_TRAINER_DATA' && !cell.isMixed) verified += 1;
      else needs += 1;
    }
  }
  return { total, verified, grading, mixed, needsClarification: needs, byAction };
}

function main() {
  if (!existsSync(PARSED)) {
    console.error('Missing', PARSED);
    process.exit(1);
  }

  const legend = loadTrainerSemanticLegend();
  const data = JSON.parse(readFileSync(PARSED, 'utf8'));
  const before = summarize(data.charts);

  for (const [chartId, chart] of Object.entries(data.charts)) {
    const scheme = getLegendSchemeForChart(chartId);
    const hands = {};
    for (const [hand, cell] of Object.entries(chart.hands || {})) {
      hands[hand] = applySemanticsToCell(cell, scheme);
    }
    chart.hands = hands;
    chart.legendScheme = scheme;
  }

  const after = summarize(data.charts);
  data.semanticLegendVersion = legend.version;
  data.semanticReappliedAt = new Date().toISOString();

  writeFileSync(PARSED, JSON.stringify(data));
  const report = {
    semanticLegendVersion: legend.version,
    reparseRequired: false,
    source: 'batch2-parsed-hands.json',
    before,
    after,
    delta: {
      verified: after.verified - before.verified,
      grading: after.grading - before.grading
    }
  };
  writeFileSync(REPORT, JSON.stringify(report, null, 2));

  console.log('Semantic reapply complete (no image reparse)');
  console.log('BEFORE grading', before.grading, 'verified', before.verified);
  console.log('AFTER  grading', after.grading, 'verified', after.verified);
  console.log('Wrote', REPORT);
}

main();
