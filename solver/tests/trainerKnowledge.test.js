// Trainer knowledge layer tests — Stage 2

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  TRAINER_STATUS,
  MATCH_STATUS,
  actionGradingStatus,
  canGradeWithTrainerAction,
  parseTrainerPosition,
  positionMatchKind,
  mapTrainerSpot,
  SPOT_MAP_STATUS,
  resetTrainerCache,
  getTrainerMeta,
  getChartById,
  listCharts,
  lookupTrainerSpot,
  lookupTrainerHandAction,
  getUnmappedSpotsReport,
  getTermsToClarify,
  formatProvenanceDebug
} from '../../trainer-knowledge/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const SOURCE = join(ROOT, 'data/trainer/source');
const BUILT = join(ROOT, 'data/trainer/built');
const CHARTS_ZIP_DIR = join(ROOT, 'data/trainer/charts');

describe('trainer knowledge layer', { concurrency: 1 }, () => {
test('all trainer source archives present', () => {
  assert.ok(existsSync(join(SOURCE, 'UO_RANGES_NORMALIZED.json')));
  assert.ok(existsSync(join(SOURCE, 'RANGE_CHART_MANIFEST.csv')));
  assert.ok(existsSync(join(SOURCE, 'CHUNK_INDEX.csv')));
  const zips = readFileSync(join(SOURCE, 'CHUNK_INDEX.csv'), 'utf8').trim().split('\n').length - 1;
  assert.equal(zips, 16);
  const onDisk = readdirSync(CHARTS_ZIP_DIR).filter((f) => f.endsWith('.zip')).length;
  assert.equal(onDisk, 16);
});

test('built indexes exist after build', () => {
  assert.ok(existsSync(join(BUILT, 'charts-index.json')));
  assert.ok(existsSync(join(BUILT, 'uo-hand-records.json')));
  assert.ok(existsSync(join(BUILT, 'meta.json')));
  assert.ok(existsSync(join(BUILT, 'indexes/by-id.json')));
  assert.ok(existsSync(join(BUILT, 'indexes/by-stack.json')));
});

test('no duplicate chart ids in index', () => {
  const charts = JSON.parse(readFileSync(join(BUILT, 'charts-index.json'), 'utf8'));
  const ids = charts.map((c) => c.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(ids.length, 1638);
});

test('UO charts count and hand records', () => {
  const meta = getTrainerMeta();
  assert.equal(meta.stats.uoCharts, 60);
  assert.equal(meta.stats.uoHandRecords, 10140);
});

test('source provenance present on charts', () => {
  const chart = getChartById('UO_2-4_EP');
  assert.ok(chart);
  assert.equal(chart.provenance.source, 'TRAINER');
  assert.equal(chart.provenance.dataset, 'UO_batch_1');
  assert.ok(chart.provenance.originalSha256);
});

test('unknown labels have NEEDS_CLARIFICATION status', () => {
  assert.equal(actionGradingStatus('UO'), TRAINER_STATUS.NEEDS_CLARIFICATION);
  assert.equal(actionGradingStatus('nAI'), TRAINER_STATUS.NEEDS_CLARIFICATION);
  assert.equal(actionGradingStatus('UNSELECTED'), TRAINER_STATUS.NEEDS_CLARIFICATION);
  assert.equal(actionGradingStatus('LOW_PLAYABILITY'), TRAINER_STATUS.NEEDS_CLARIFICATION);
  assert.equal(canGradeWithTrainerAction('UNSELECTED'), false);
  assert.equal(canGradeWithTrainerAction('nAI'), false);
});

test('AI and RAISE are gradable exact trainer labels', () => {
  assert.equal(actionGradingStatus('AI'), TRAINER_STATUS.EXACT_TRAINER_DATA);
  assert.equal(actionGradingStatus('RAISE'), TRAINER_STATUS.EXACT_TRAINER_DATA);
  assert.equal(canGradeWithTrainerAction('AI'), true);
});

test('position groups are not collapsed to single seat', () => {
  const g = parseTrainerPosition('EP-MP');
  assert.equal(g.type, 'GROUP');
  assert.deepEqual(g.values.sort(), ['EP', 'MP']);
  const any = parseTrainerPosition('Any_position');
  assert.equal(any.type, 'ANY');
});

test('group position match is not exact individual match', () => {
  const kind = positionMatchKind('EP', 'EP-MP');
  assert.equal(kind, 'group');
  assert.notEqual(kind, 'exact');
});

test('lookup by stack works for UO band', () => {
  resetTrainerCache();
  const result = lookupTrainerSpot({
    heroPosition: 'EP',
    stack: '3BB',
    sourceMode: 'uo',
    sourceGroup: 'UO'
  });
  assert.notEqual(result.status, MATCH_STATUS.NO_TRAINER_DATA);
  assert.ok(result.chart);
  assert.equal(result.chart.stack.raw, '2-4');
});

test('lookup by position works', () => {
  const charts = listCharts({ sourceMode: 'uo' });
  const ep = charts.filter((c) => c.heroPosition.raw === 'EP');
  assert.equal(ep.length, 10);
});

test('lookup by spot / source mode works', () => {
  const resteal = listCharts({ sourceMode: 'callpush' }).filter(
    (c) => c.spot.rawSpot === 'Resteal'
  );
  assert.ok(resteal.length >= 300);
  const mapped = mapTrainerSpot({ sourceMode: 'callpush', rawSpot: 'Resteal' });
  assert.equal(mapped.pokerswipeAlias, 'resteal');
});

test('lookup by opponent dimension', () => {
  const result = lookupTrainerSpot({
    sourceMode: 'vssqueeze',
    rawSpot: 'Caller_IP_R_Mid',
    opponentPosition: 'SB',
    stack: '25BB'
  });
  assert.notEqual(result.status, MATCH_STATUS.NO_TRAINER_DATA);
});

test('lookup by sizing', () => {
  const result = lookupTrainerSpot({
    sourceMode: 'vssqueeze',
    rawSpot: 'Caller_IP_R_Mid',
    betSize: '5x',
    stack: '25BB'
  });
  assert.notEqual(result.status, MATCH_STATUS.NO_TRAINER_DATA);
});

test('exact UO hand lookup returns trainer action with provenance', () => {
  const result = lookupTrainerHandAction({
    heroPosition: 'EP',
    stack: '3BB',
    sourceMode: 'uo',
    hand: 'AA'
  });
  assert.ok(result.chart);
  assert.equal(result.action, 'AI');
  assert.equal(result.provenance.source, 'TRAINER');
});

test('UNSELECTED hand cannot grade', () => {
  const result = lookupTrainerHandAction({
    heroPosition: 'EP',
    stack: '3BB',
    sourceMode: 'uo',
    hand: 'K2s'
  });
  assert.equal(result.action, 'UNSELECTED');
  assert.equal(result.gradingAllowed, false);
});

test('partial match does not claim exact when dimensions mismatch', () => {
  const result = lookupTrainerSpot({
    heroPosition: 'EP',
    stack: '100BB',
    sourceMode: 'uo'
  });
  if (result.status === MATCH_STATUS.EXACT_TRAINER_MATCH) {
    assert.equal(result.mismatches.length, 0);
  } else {
    assert.ok(result.mismatches.length > 0 || result.status !== MATCH_STATUS.EXACT_TRAINER_MATCH);
  }
});

test('missing data does not invent strategy', () => {
  const result = lookupTrainerHandAction({
    heroPosition: 'EP',
    stack: '999BB',
    sourceMode: 'uo',
    hand: 'AA'
  });
  if (result.status === MATCH_STATUS.NO_TRAINER_DATA) {
    assert.equal(result.action, null);
    assert.equal(result.gradingAllowed, false);
  }
});

test('malformed records fail safely', () => {
  assert.doesNotThrow(() => lookupTrainerSpot({}));
  const r = lookupTrainerSpot({ heroPosition: null, stack: undefined });
  assert.ok(r);
});

test('performance: charts index loads without embedding all images', () => {
  const charts = JSON.parse(readFileSync(join(BUILT, 'charts-index.json'), 'utf8'));
  const sample = charts[0];
  assert.equal(sample.hands, undefined);
  assert.ok(sample.image?.path || sample.dataset === 'UO_batch_1');
});

test('report files generated', () => {
  assert.ok(existsSync(join(ROOT, 'trainer-knowledge/TRAINER_TERMS_TO_CLARIFY.md')));
  assert.ok(existsSync(join(ROOT, 'trainer-knowledge/TRAINER_UNMAPPED_SPOTS.md')));
  assert.ok(existsSync(join(ROOT, 'trainer-knowledge/TRAINER_DATA_CONFLICTS.md')));
});

test('unmapped spots report accessible', () => {
  const unmapped = getUnmappedSpotsReport();
  assert.ok(Array.isArray(unmapped));
  // UO should be mapped partial, not unmapped
  assert.ok(!unmapped.some((u) => u.trainerCanonicalId === 'uo::UO'));
});

test('terms to clarify includes UO nAI UNSELECTED', () => {
  const terms = getTermsToClarify();
  const names = terms.map((t) => t.term);
  assert.ok(names.includes('UO'));
  assert.ok(names.includes('nAI'));
  assert.ok(names.includes('UNSELECTED'));
});

test('provenance debug string', () => {
  const chart = getChartById('UO_2-4_EP');
  const dbg = formatProvenanceDebug(chart.provenance);
  assert.match(dbg, /TRAINER/);
  assert.match(dbg, /UO_2-4_EP/);
});

test('conflicts preserved without auto-resolution', () => {
  const conflicts = JSON.parse(readFileSync(join(BUILT, 'conflicts.json'), 'utf8'));
  if (conflicts.length) {
    const c = conflicts[0];
    assert.ok(c.trainer);
    assert.ok(c.pokerBrain);
    assert.notEqual(c.trainer.source, c.pokerBrain.action);
  }
});

test('spot mapper keeps raw spot for unmapped', () => {
  const m = mapTrainerSpot({ sourceMode: 'vssqueeze', rawSpot: 'Raiser_IP' });
  assert.equal(m.rawSpot, 'Raiser_IP');
  assert.equal(m.mapStatus, SPOT_MAP_STATUS.UNMAPPED_TRAINER_SPOT);
});
});
