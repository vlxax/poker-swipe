// Reference 6-max range import validation and UI coverage tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { matrixClasses, isMixedPolicy } from '../../ranges-ui/matrix.js';
import {
  getReferenceRanges,
  getReferenceMetadata,
  lookupReferenceRange,
  lookupReferencePolicy,
  buildReferenceMatrix,
  inventoryReference,
  referenceCoverageReport,
  buildUiCoverageReport,
  validateReferenceRange,
  handDetailFromReference
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
  openersForSituation,
  sanitizeSelection
} from '../../ranges-ui/catalog.js';
import { RangeController } from '../../ranges-ui/controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const REF_DIR = join(ROOT, 'data/ranges/reference/6max/ranges');

function loadPack() {
  const raw = readFileSync(new URL('../../strategy_pack_v17.js', import.meta.url), 'utf8');
  return JSON.parse(raw.replace(/^window\.POKER_BRAIN_PACK=/, '').replace(/;?\s*$/, ''));
}

function loadCanonicalRange(id) {
  const path = join(REF_DIR, `${id}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
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

test('all 37 imported ranges are renderable with 169-hand matrices', () => {
  for (const rangeObj of ranges) {
    const sel = {
      dataSource: 'reference',
      format: '6max',
      position: rangeObj.heroPosition,
      situation: rangeObj.situation,
      opener: rangeObj.villainPosition || null
    };
    assert.equal(lookupReferenceRange(sel)?.id, rangeObj.id, rangeObj.id);
    const matrix = buildReferenceMatrix(sel);
    assert.equal(matrix.supported, true, rangeObj.id);
    assert.equal(Object.keys(matrix.cells).length, 169, rangeObj.id);
    for (const hand of matrixClasses()) {
      const cell = matrix.cells[hand];
      assert.ok(cell?.supported, `${rangeObj.id} missing ${hand}`);
      const sum = (cell.policy.FOLD || 0) + (cell.policy.CALL || 0) + (cell.policy.RAISE || 0);
      assert.ok(Math.abs(sum - 1) <= 0.001, `${rangeObj.id} ${hand} sum=${sum}`);
    }
    assert.equal(matrix.sourceType, 'reference');
    assert.equal(sel.stack, undefined);
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

test('mixed strategies are preserved in matrix cells', () => {
  const sel = { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'vs_open', opener: 'UTG' };
  const matrix = buildReferenceMatrix(sel);
  assert.ok(matrix.cells['55'].isMixed);
  assert.ok(isMixedPolicy(matrix.cells['55'].policy));
  assert.equal(matrix.cells['55'].policy.FOLD, 0.5);
  assert.equal(matrix.cells['55'].policy.RAISE, 0.5);
});

test('hand detail exposes real action frequencies and source label', () => {
  const sel = { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'vs_open', opener: 'UTG' };
  const detail = handDetailFromReference(sel, '55');
  assert.equal(detail.hand, '55');
  assert.equal(detail.sourceLabel, 'Базовая стратегия');
  assert.deepEqual(
    detail.actions.map((a) => `${a.label}:${a.pct}`).sort(),
    ['Рейз:50', 'Фолд:50']
  );
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

test('UI coverage report lists real user scenarios', () => {
  const ui = buildUiCoverageReport();
  assert.deepEqual(ui.rfi, ['UTG', 'MP', 'CO', 'BTN', 'SB']);
  assert.equal(Object.values(ui.vsOpen).flat().length, 12);
  assert.equal(Object.values(ui.vs3bet).flat().length, 15);
  assert.equal(Object.values(ui.vs4bet).flat().length, 5);
});

test('reference catalog exposes MP not HJ and hides push_fold', () => {
  const catalog = getCatalog(pack, '6max', 'reference');
  assert.ok(catalog.positions.includes('MP'));
  assert.ok(!catalog.positions.includes('HJ'));
  const btnSit = situationsForPosition(catalog, 'BTN').map((s) => s.id);
  assert.ok(!btnSit.includes('push_fold'));
  assert.ok(!btnSit.includes('bb_defend'));
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

test('sanitizeSelection drops invalid reference combinations', () => {
  const catalog = getCatalog(pack, '6max', 'reference');
  const bad = sanitizeSelection({
    dataSource: 'reference',
    format: '6max',
    position: 'BTN',
    situation: 'vs_open',
    opener: 'SB',
    stack: 20
  }, catalog);
  assert.equal(bad.opener, null);
  assert.equal(bad.stack, null);
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
  { id: 'utg-rfi', sel: { dataSource: 'reference', format: '6max', position: 'UTG', situation: 'rfi' }, hands: ['AA', '72o', 'ATo', '87s'] },
  { id: 'btn-rfi', sel: { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'rfi' }, hands: ['AA', '22', 'K8o'] },
  { id: 'btn-vs-open-utg', sel: { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'vs_open', opener: 'UTG' }, hands: ['AA', 'KQs', 'JTs', '55'] },
  { id: 'bb-vs-open-btn', sel: { dataSource: 'reference', format: '6max', position: 'BB', situation: 'vs_open', opener: 'BTN' }, hands: ['AA', '72o', 'A5s'] },
  { id: 'utg-vs-3bet-bb', sel: { dataSource: 'reference', format: '6max', position: 'UTG', situation: 'vs_3bet', opener: 'BB' }, hands: ['AA', 'AKs', 'QJs'] },
  { id: 'co-vs-3bet-btn', sel: { dataSource: 'reference', format: '6max', position: 'CO', situation: 'vs_3bet', opener: 'BTN' }, hands: ['AA', 'AQs', 'KJo'] },
  { id: 'bb-vs-4bet-utg', sel: { dataSource: 'reference', format: '6max', position: 'BB', situation: 'vs_4bet', opener: 'UTG' }, hands: ['AA', 'AKs', 'QQ'] },
  { id: 'sb-vs-open-co', sel: { dataSource: 'reference', format: '6max', position: 'SB', situation: 'vs_open', opener: 'CO' }, hands: ['AA', 'TT', '76s'] },
  { id: 'mp-rfi', sel: { dataSource: 'reference', format: '6max', position: 'MP', situation: 'rfi' }, hands: ['AA', '22', 'T8s'] },
  { id: 'mp-vs-3bet-co', sel: { dataSource: 'reference', format: '6max', position: 'MP', situation: 'vs_3bet', opener: 'CO' }, hands: ['AA', 'JJ', 'ATs'] },
  { id: 'btn-vs-open-co', sel: { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'vs_open', opener: 'CO' }, hands: ['AA', 'A9s', 'KJo'] },
  { id: 'bb-vs-open-sb', sel: { dataSource: 'reference', format: '6max', position: 'BB', situation: 'vs_open', opener: 'SB' }, hands: ['AA', '54s', 'J8o'] }
];

for (const spot of spotChecks) {
  test(`canonical JSON matches pack for ${spot.id}`, () => {
    const canonical = loadCanonicalRange(spot.id);
    const rangeObj = lookupReferenceRange(spot.sel);
    assert.ok(rangeObj, `missing imported range for ${spot.id}`);
    assert.equal(rangeObj.id, spot.id);
    for (const hand of spot.hands) {
      assert.deepEqual(rangeObj.range[hand], canonical.range[hand], `${hand}`);
    }
  });
}

test('controller opens narrowing trainer instead of reference chart browser', () => {
  const ctl = new RangeController({ pack, storage: null });
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'intro');
  assert.equal(vm.title, 'СУЖЕНИЕ ДИАПАЗОНА');
  assert.ok(vm.headline);
  assert.ok(!vm.cells);

  ctl.startScenario('read-open-btn');
  ctl.beginPlay();
  const play = ctl.viewModel();
  assert.equal(play.phase, 'play');
  assert.ok(play.matrix.length >= 169);
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
          assert.ok(r, `${pos} ${sit.id} vs ${opener}`);
          seen.add(r.id);
        }
      } else {
        const sel = { dataSource: 'reference', format: '6max', position: pos, situation: sit.id };
        const r = lookupReferenceRange(sel);
        assert.ok(r, `${pos} ${sit.id}`);
        seen.add(r.id);
      }
    }
  }
  assert.equal(seen.size, 37);
});
