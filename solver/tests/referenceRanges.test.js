// Reference 6-max range import validation and spot-by-spot comparison tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { matrixClasses } from '../../ranges-ui/matrix.js';
import {
  getReferenceRanges,
  getReferenceMetadata,
  lookupReferenceRange,
  lookupReferencePolicy,
  buildReferenceMatrix,
  inventoryReference,
  referenceCoverageReport,
  validateReferenceRange
} from '../../ranges-ui/referenceRanges.js';
import {
  resolveRangeMatrix,
  pickBestSource,
  SOURCE_TYPES,
  DATA_SOURCES
} from '../../ranges-ui/rangeSources.js';
import {
  getCatalog,
  isSelectionComplete,
  situationsForPosition,
  openersForSituation
} from '../../ranges-ui/catalog.js';
import { RangeController } from '../../ranges-ui/controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const REF_DIR = join(ROOT, 'data/ranges/reference/6max/ranges');
const GREENLINE = readFileSync('/tmp/poker-charts/src/data/ranges/greenline.ts', 'utf8');

function loadPack() {
  const raw = readFileSync(new URL('../../strategy_pack_v17.js', import.meta.url), 'utf8');
  return JSON.parse(raw.replace(/^window\.POKER_BRAIN_PACK=/, '').replace(/;?\s*$/, ''));
}

function parseExternalCell(raw) {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw;
  return raw;
}

function externalPolicyForKey(chartKey, hand) {
  const keyRe = new RegExp(`'${chartKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
  const block = keyRe.exec(GREENLINE);
  if (!block) return null;
  const handRe = new RegExp(`'${hand}':\\s*(?:'([^']+)'|\\[([^\\]]+)\\])`);
  const hm = handRe.exec(block[1]);
  if (!hm) return 'fold';
  if (hm[1]) return hm[1];
  return hm[2].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
}

function externalPlayFreq(cell) {
  if (cell === 'fold') return 0;
  if (typeof cell === 'string') return cell === 'raise' || cell === 'call' || cell === 'allin' ? 1 : 0;
  if (Array.isArray(cell)) {
    const playActions = cell.filter((a) => a !== 'fold');
    return playActions.length / cell.length;
  }
  return 0;
}

function importedPlayFreq(sel, hand) {
  const p = lookupReferencePolicy(sel, hand);
  return (p.CALL || 0) + (p.RAISE || 0);
}

const pack = loadPack();
const ranges = getReferenceRanges();
const meta = getReferenceMetadata();

test('metadata marks reference dataset honestly', () => {
  assert.equal(meta.sourceType, 'reference');
  assert.equal(meta.verified, false);
  assert.equal(meta.solverVerified, false);
  assert.equal(meta.userLabel, 'Базовая стратегия');
  assert.match(meta.disclaimer, /solver/i);
  assert.equal(meta.stackSpecific, false);
  assert.equal(meta.frequencySupport, true);
});

test('imported 37 greenline ranges excluding ISO', () => {
  assert.equal(ranges.length, 37);
  assert.equal(readdirSync(REF_DIR).filter((f) => f.endsWith('.json')).length, 37);
  assert.ok(!ranges.some((r) => r.sourceChartKey.includes('ISO')));
});

test('all range objects have required metadata fields', () => {
  for (const r of ranges) {
    assert.equal(r.format, '6max');
    assert.equal(r.source, 'AHTOOOXA/poker-charts');
    assert.equal(r.sourceType, 'reference');
    assert.equal(r.verified, false);
    assert.equal(r.solverVerified, false);
    assert.equal(r.stackBB, null);
    assert.ok(r.id);
    assert.ok(r.heroPosition);
    assert.ok(r.situation);
  }
});

test('no duplicate range IDs', () => {
  const ids = ranges.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('each imported range validates frequencies 0..1', () => {
  for (const r of ranges) {
    const errors = validateReferenceRange(r);
    assert.deepEqual(errors, [], `${r.id}: ${errors.join('; ')}`);
  }
});

test('reference matrix covers all 169 starting-hand cells', () => {
  const sel = { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'rfi' };
  const matrix = buildReferenceMatrix(sel);
  assert.equal(matrix.supported, true);
  assert.equal(Object.keys(matrix.cells).length, 169);
  for (const hand of matrixClasses()) {
    assert.ok(matrix.cells[hand], `missing ${hand}`);
  }
});

test('pair suited offsuit hand keys are valid', () => {
  for (const r of ranges) {
    for (const hand of Object.keys(r.range)) {
      assert.match(hand, /^([2-9TJQKA])\1$|^([2-9TJQKA])([2-9TJQKA])s$|^([2-9TJQKA])([2-9TJQKA])o$/, `${r.id} bad hand ${hand}`);
    }
  }
});

test('coverage report counts by situation', () => {
  const report = referenceCoverageReport();
  assert.equal(report.rangeObjects, 37);
  assert.equal(report.rfi, 5);
  assert.equal(report.vsOpen, 12);
  assert.equal(report.vs3bet, 15);
  assert.equal(report.vs4bet, 5);
  assert.equal(report.frequencies, 'YES');
  assert.equal(report.stackSpecific, 'NO');
  assert.deepEqual(report.positions, ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']);
});

test('reference catalog exposes MP not HJ and hides push_fold', () => {
  const catalog = getCatalog(pack, '6max', 'reference');
  assert.ok(catalog.positions.includes('MP'));
  assert.ok(!catalog.positions.includes('HJ'));
  const btnSit = situationsForPosition(catalog, 'BTN').map((s) => s.id);
  assert.ok(!btnSit.includes('push_fold'));
  assert.ok(btnSit.includes('vs_3bet'));
});

test('reference vs_3bet requires villain opener', () => {
  const catalog = getCatalog(pack, '6max', 'reference');
  const sel = { dataSource: 'reference', format: '6max', position: 'UTG', situation: 'vs_3bet', opener: null };
  assert.equal(isSelectionComplete(sel), false);
  sel.opener = 'BB';
  assert.equal(isSelectionComplete(sel), true);
  const openers = openersForSituation(catalog, 'vs_3bet', 'UTG');
  assert.ok(openers.includes('BB'));
  assert.ok(openers.includes('BTN'));
});

test('reference mode does not require stack', () => {
  const sel = { dataSource: 'reference', format: '6max', position: 'CO', situation: 'rfi', stack: null };
  assert.equal(isSelectionComplete(sel), true);
});

test('reference lookup has no heuristic fallback', () => {
  const sel = { dataSource: 'reference', format: '6max', position: 'HJ', situation: 'rfi' };
  assert.equal(lookupReferenceRange(sel), null);
  const matrix = resolveRangeMatrix(pack, sel);
  assert.equal(matrix.supported, false);
});

test('source priority prefers verified over reference when both exist', () => {
  const sel = { format: '6max', position: 'BTN', situation: 'rfi', stack: 20 };
  assert.equal(pickBestSource(pack, sel, 'verified'), SOURCE_TYPES.VERIFIED);
});

test('reference source never labels as GTO in UI data sources', () => {
  for (const src of DATA_SOURCES) {
    const blob = JSON.stringify(src).toLowerCase();
    assert.ok(!blob.includes('gto'));
    assert.ok(!blob.includes('nash'));
    assert.ok(!blob.includes('solver verified'));
  }
});

const spotChecks = [
  { chartKey: 'UTG-RFI', sel: { dataSource: 'reference', format: '6max', position: 'UTG', situation: 'rfi' }, hands: ['AA', '72o', 'ATo', '87s'] },
  { chartKey: 'BTN-RFI', sel: { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'rfi' }, hands: ['AA', '22', 'K8o'] },
  { chartKey: 'BTN-vs-open-UTG', sel: { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'vs_open', opener: 'UTG' }, hands: ['AA', 'KQs', 'JTs'] },
  { chartKey: 'BB-vs-open-BTN', sel: { dataSource: 'reference', format: '6max', position: 'BB', situation: 'bb_defend', opener: 'BTN' }, hands: ['AA', '72o', 'A5s'] },
  { chartKey: 'UTG-vs-3bet-BB', sel: { dataSource: 'reference', format: '6max', position: 'UTG', situation: 'vs_3bet', opener: 'BB' }, hands: ['AA', 'AKs', 'QJs'] },
  { chartKey: 'CO-vs-3bet-BTN', sel: { dataSource: 'reference', format: '6max', position: 'CO', situation: 'vs_3bet', opener: 'BTN' }, hands: ['AA', 'AQs', 'KJo'] },
  { chartKey: 'BB-vs-4bet-UTG', sel: { dataSource: 'reference', format: '6max', position: 'BB', situation: 'vs_4bet', opener: 'UTG' }, hands: ['AA', 'AKs', 'QQ'] },
  { chartKey: 'SB-vs-open-CO', sel: { dataSource: 'reference', format: '6max', position: 'SB', situation: 'vs_open', opener: 'CO' }, hands: ['AA', 'TT', '76s'] },
  { chartKey: 'MP-RFI', sel: { dataSource: 'reference', format: '6max', position: 'MP', situation: 'rfi' }, hands: ['AA', '22', 'T8s'] },
  { chartKey: 'MP-vs-3bet-CO', sel: { dataSource: 'reference', format: '6max', position: 'MP', situation: 'vs_3bet', opener: 'CO' }, hands: ['AA', 'JJ', 'ATs'] },
  { chartKey: 'BTN-vs-open-CO', sel: { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'vs_open', opener: 'CO' }, hands: ['AA', 'A9s', 'KJo'] },
  { chartKey: 'BB-vs-open-SB', sel: { dataSource: 'reference', format: '6max', position: 'BB', situation: 'vs_open', opener: 'SB' }, hands: ['AA', '54s', 'J8o'] }
];

for (const spot of spotChecks) {
  test(`spot comparison matches source for ${spot.chartKey}`, () => {
    const rangeObj = lookupReferenceRange(spot.sel);
    assert.ok(rangeObj, `missing imported range for ${spot.chartKey}`);
    assert.equal(rangeObj.sourceChartKey, spot.chartKey);
    for (const hand of spot.hands) {
      const ext = externalPolicyForKey(spot.chartKey, hand);
      const extPlay = externalPlayFreq(parseExternalCell(ext));
      const impPlay = importedPlayFreq(spot.sel, hand);
      assert.ok(Math.abs(extPlay - impPlay) < 0.01, `${hand}: source=${extPlay} imported=${impPlay}`);
    }
  });
}

test('controller can show reference BTN RFI matrix', () => {
  const ctl = new RangeController({ pack, storage: null });
  ctl.setField('dataSource', 'reference');
  ctl.setField('position', 'BTN');
  ctl.setField('situation', 'rfi');
  assert.equal(isSelectionComplete(ctl.selection), true);
  ctl.showRange();
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'result');
  assert.equal(vm.sourceLabel, 'Базовая стратегия');
  assert.equal(vm.cells.AA.bucket, 'always');
});

test('UI reachable reference scenarios map to 37 unique ranges', () => {
  const catalog = getCatalog(pack, '6max', 'reference');
  const seen = new Set();
  for (const pos of catalog.positions) {
    for (const sit of situationsForPosition(catalog, pos)) {
      if (sit.needsOpener || sit.id === 'vs_3bet' || sit.id === 'vs_4bet') {
        for (const opener of openersForSituation(catalog, sit.id, pos)) {
          const sel = { dataSource: 'reference', format: '6max', position: pos, situation: sit.id, opener };
          const r = lookupReferenceRange(sel);
          if (r) seen.add(r.id);
        }
      } else {
        const sel = { dataSource: 'reference', format: '6max', position: pos, situation: sit.id };
        const r = lookupReferenceRange(sel);
        if (r) seen.add(r.id);
      }
    }
  }
  assert.equal(seen.size, 37);
});
