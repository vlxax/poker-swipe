// Stage 4 — Batch 2 hand-level parsing tests

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'node:perf_hooks';

import {
  resetTrainerCache,
  lookupTrainerSpot,
  lookupTrainerHandAction,
  getTrainerMeta,
  listCharts
} from '../../trainer-knowledge/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const BUILT = join(ROOT, 'data/trainer/built');

describe('batch 2 hand-level parsing', { concurrency: 1 }, () => {
  test('parse report exists with full chart count', () => {
    const reportPath = join(BUILT, 'batch2-parse-report.json');
    assert.ok(existsSync(reportPath), 'run buildTrainerKnowledge first');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.batch2ChartsTotal, 1578);
    assert.ok(report.chartsSuccessfullyParsed >= 1570);
    assert.equal(report.handCellsTotal, report.handCellsParsed);
    assert.ok(report.handCellsTotal >= 266000);
  });

  test('compact shards built for lazy lookup', () => {
    const idxPath = join(BUILT, 'batch2-shard-index.json');
    assert.ok(existsSync(idxPath));
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
    assert.ok(idx.shardCount >= 30);
    assert.equal(Object.keys(idx.chartToShard).length, idx.totalCharts);
    assert.ok(idx.totalShardMB < 90, `shards should be compact, got ${idx.totalShardMB}MB`);
  });

  test('batch2 chart index marks parsed hand records', () => {
    resetTrainerCache();
    const b2 = listCharts({ dataset: 'batch_2' });
    const parsed = b2.filter((c) => c.hasParsedHands && c.handRecordCount === 169);
    assert.ok(parsed.length >= 1570);
    const sample = parsed.find((c) => c.sourceMode === 'callpush');
    assert.ok(sample);
    assert.equal(sample.provenance.parserStatus, 'WEBP_MATRIX_PARSED');
  });

  test('lookup returns batch2 hand-level record (callpush)', () => {
    resetTrainerCache();
    const result = lookupTrainerHandAction({
      sourceMode: 'callpush',
      heroPosition: 'BB',
      stack: '27.5BB',
      hand: 'AA'
    });
    assert.notEqual(result.status, 'NO_TRAINER_DATA');
    assert.equal(result.chart?.sourceMode, 'callpush');
    assert.ok(result.action != null || result.dataStatus === 'NEEDS_CLARIFICATION');
  });

  test('mixed cell blocks grading', () => {
    resetTrainerCache();
    const result = lookupTrainerHandAction({
      sourceMode: 'vssqueeze',
      rawSpot: 'Caller_IP_R_Mid',
      heroPosition: 'Any_position',
      stack: '25BB',
      betSize: '5x',
      hand: 'AKs'
    });
    if (result.isMixed || result.strategies?.length > 1) {
      assert.equal(result.gradingAllowed, false);
    }
  });

  test('UNSELECTED never gradingAllowed', () => {
    resetTrainerCache();
    const result = lookupTrainerHandAction({
      sourceMode: 'vssqueeze',
      rawSpot: 'Caller_IP_R_Mid',
      heroPosition: 'Any_position',
      stack: '25BB',
      betSize: '5x',
      hand: 'AA'
    });
    if (result.action === 'UNSELECTED') {
      assert.equal(result.gradingAllowed, false);
    }
  });

  test('meta includes batch2 hand-level stats', () => {
    resetTrainerCache();
    const meta = getTrainerMeta();
    assert.ok(meta.stats.batch2HandRecords >= 266000);
    assert.ok(meta.stats.batch2ChartsParsed >= 1570);
    assert.ok(meta.batch2ParseReport);
  });

  test('lookup performance: 100 batch2 hand queries', () => {
    resetTrainerCache();
    const modes = ['callpush', 'vs1r', 'vssqueeze', 'huante', 'vs3bet', 'sbvsbb'];
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      lookupTrainerHandAction({
        sourceMode: modes[i % modes.length],
        stack: '25BB',
        hand: 'AKs'
      });
    }
    const ms = performance.now() - t0;
    assert.ok(ms < 5000, `lookup too slow: ${ms}ms`);
  });
});

describe('batch 2 semantic legend validation (stage 4.5)', { concurrency: 1 }, () => {
  test('semantic validation report exists with coverage breakdown', () => {
    const reportPath = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_VALIDATION.json');
    const mdPath = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_LEGEND.md');
    assert.ok(existsSync(reportPath), 'run batch2SemanticValidation.py first');
    assert.ok(existsSync(mdPath));
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.safeToMerge, false);
    assert.equal(report.coverage.totalCells, 266682);
    assert.equal(report.coverage.gradingAllowedAfter, 13207);
    assert.equal(report.coverage.gradingAllowedBefore, report.coverage.gradingAllowedAfter);
    assert.ok(report.legendTable.length >= 8);
    assert.equal(report.qaSummary.chartsChecked, 55);
    assert.equal(report.qaSummary.handMismatchesOnReparse, 0);
    assert.equal(report.qaSummary.orientationPassed, 55);
  });

  test('nAI and UNSELECTED remain non-gradable per validation policy', () => {
    const reportPath = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_VALIDATION.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const nai = report.legendTable.find((e) => e.rawLabel?.includes('nAI'));
    const unsel = report.legendTable.find((e) => e.rawLabel?.includes('UNSELECTED'));
    assert.ok(nai);
    assert.equal(nai.gradingAllowed, false);
    assert.equal(nai.status, 'NEEDS_CLARIFICATION');
    assert.ok(unsel);
    assert.equal(unsel.gradingAllowed, false);
  });
});
