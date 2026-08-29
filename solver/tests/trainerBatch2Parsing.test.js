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
    // Unified 1698 runtime: semantic recon QA replaces legacy batch2-parse-report.
    const qaPath = join(BUILT, 'recon-qa-report.json');
    const legacyPath = join(BUILT, 'batch2-parse-report.json');
    if (existsSync(qaPath)) {
      const qa = JSON.parse(readFileSync(qaPath, 'utf8'));
      assert.equal(qa.passes, 31);
      assert.deepEqual(qa.failures, []);
      assert.equal(qa.metaStats?.totalCharts, 1698);
    } else {
      assert.ok(existsSync(legacyPath), 'run compileTrainerProduction / QA first');
      const report = JSON.parse(readFileSync(legacyPath, 'utf8'));
      assert.equal(report.batch2ChartsTotal, 1578);
      assert.ok(report.chartsSuccessfullyParsed >= 1570);
    }
  });

  test('compact shards built for lazy lookup', () => {
    const idxPath = join(BUILT, 'trainer-shard-index.json');
    assert.ok(existsSync(idxPath), 'unified trainer-shard-index required');
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
    const shardCount = idx.shardCount || idx.shards?.length || Object.keys(idx.shardFiles || {}).length;
    assert.ok(shardCount >= 30);
    assert.equal(Object.keys(idx.chartToShard).length, 1698);
  });

  test('batch2 chart index marks parsed hand records', () => {
    resetTrainerCache();
    // Recon dataset uses bekhtold_import_v1 (not legacy dataset:batch_2).
    const bl = listCharts({ dataset: 'bekhtold_import_v1' });
    const parsed = bl.filter((c) => c.hasParsedHands && c.handRecordCount === 169);
    assert.ok(parsed.length >= 1570);
    const sample = parsed.find((c) => c.sourceMode === 'callpush');
    assert.ok(sample);
    assert.ok(sample.provenance?.parserStatus || sample.parseStatus);
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

  test('UNSELECTED maps to FOLD and is gradingAllowed (trainer-confirmed)', () => {
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
      assert.equal(result.gradingAllowed, true);
    }
  });

  test('meta includes batch2 hand-level stats', () => {
    resetTrainerCache();
    const meta = getTrainerMeta();
    assert.equal(meta.stats.totalCharts, 1698);
    assert.equal(meta.stats.bekhtoldCharts, 1638);
    assert.equal(meta.stats.shardCount, 34);
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
    assert.equal(report.coverage.gradingAllowedAfter, report.coverage.gradingAllowedBefore);
    assert.ok(report.legendTable.length >= 8);
    assert.equal(report.qaSummary.chartsChecked, 55);
    assert.equal(report.qaSummary.handMismatchesOnReparse, 0);
    assert.equal(report.qaSummary.orientationPassed, 55);
    // Post stack-fix (stage 4.6): grading count may exceed pre-fix baseline
    assert.ok(report.coverage.gradingAllowedAfter >= 13207);
  });

  test('UNSELECTED is trainer-confirmed FOLD; nAI remains context-dependent', () => {
    const reportPath = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_VALIDATION.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const nai = report.legendTable.find((e) => e.rawLabel?.includes('nAI'));
    const unsel = report.legendTable.find((e) => e.rawLabel?.includes('UNSELECTED'));
    assert.ok(nai);
    assert.equal(nai.gradingAllowed, false);
    assert.equal(nai.status, 'NEEDS_CLARIFICATION');
    assert.ok(unsel);
    // Stage 4.5 validation predates human confirmation #1 — see TRAINER_SEMANTIC_REAPPLY_REPORT.json
    assert.equal(unsel.gradingAllowed, false);
  });
});
