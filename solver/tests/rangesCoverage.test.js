// Coverage audit: every catalog-valid combination must render a supported matrix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

import { RangeController } from '../../ranges-ui/controller.js';
import {
  getCatalog, situationsForPosition, stacksForSituation, openersForSituation, isSelectionComplete
} from '../../ranges-ui/catalog.js';
import { buildAtlasMatrix, coverageAudit } from '../../ranges-ui/preflopAtlas.js';
import { buildPushFoldMatrix } from '../../ranges-ui/pushFold.js';
import * as Renderer from '../../ranges-ui/renderer.js';

function loadPack() {
  const raw = readFileSync(new URL('../../strategy_pack_v17.js', import.meta.url), 'utf8');
  return JSON.parse(raw.replace(/^window\.POKER_BRAIN_PACK=/, '').replace(/;?\s*$/, ''));
}

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k)
  };
}

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="rangesArea" style="width:390px;max-width:390px;overflow:hidden"></div></body></html>', {
    url: 'http://app.local/', pretendToBeVisual: true
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  window.innerWidth = 390;
  window.innerHeight = 844;
  return dom.window.document.querySelector('#rangesArea');
}

function matrixFor(pack, sel) {
  if (sel.situation === 'push_fold') return buildPushFoldMatrix(sel);
  return buildAtlasMatrix(pack, sel);
}

function* validSelections(pack, format) {
  const catalog = getCatalog(pack, format);
  for (const position of catalog.positions) {
    for (const sit of situationsForPosition(catalog, position)) {
      if (sit.id === 'push_fold') {
        for (const stack of catalog.pushStacks) {
          yield { format, position, situation: sit.id, stack, opener: null };
        }
        continue;
      }
      const openers = sit.needsOpener
        ? openersForSituation(catalog, sit.id, position)
        : [null];
      for (const opener of openers) {
        const probeSel = {
          format, position, situation: sit.id, opener, stack: 20
        };
        const stacks = stacksForSituation(sit.id, catalog, probeSel, pack);
        for (const stack of stacks) {
          yield { format, position, situation: sit.id, stack, opener };
        }
      }
    }
  }
}

const pack = loadPack();

test('coverage audit reports zero MISSING for catalog-valid atlas combos', () => {
  for (const format of ['6max', '9max']) {
    const audit = coverageAudit(pack, format);
    assert.equal(audit.summary.missing, 0, `${format} missing=${audit.summary.missing}`);
    assert.ok(audit.summary.supported > 0, `${format} has supported combos`);
  }
});

test('every catalog-valid combination yields a supported matrix', () => {
  const failures = [];
  let count = 0;
  for (const format of ['6max', '9max']) {
    for (const sel of validSelections(pack, format)) {
      count++;
      const matrix = matrixFor(pack, sel);
      if (!matrix.supported || matrix.found === 0) {
        failures.push(JSON.stringify(sel));
      }
    }
  }
  assert.ok(count >= 25, `expected at least 25 combos, got ${count}`);
  assert.deepEqual(failures, [], `unsupported combos: ${failures.slice(0, 5).join('; ')}`);
});

test('9-max UTG+1 and MP RFI resolve via atlas remap', () => {
  for (const position of ['UTG+1', 'MP']) {
    const matrix = buildAtlasMatrix(pack, {
      format: '9max', situation: 'rfi', position, stack: 20
    });
    assert.equal(matrix.supported, true, `${position} RFI`);
    assert.ok(matrix.found > 100);
  }
});

test('BTN vs open and BB defend vs open at 100 BB', () => {
  const btnVs = buildAtlasMatrix(pack, {
    format: '6max', situation: 'vs_open', position: 'BTN', opener: 'CO', stack: 100
  });
  assert.equal(btnVs.supported, true);
  assert.ok(btnVs.cells.AKs.supported);

  const bbVs = buildAtlasMatrix(pack, {
    format: '6max', situation: 'bb_defend', position: 'BB', opener: 'BTN', stack: 100
  });
  assert.equal(bbVs.supported, true);
  assert.ok(bbVs.cells['72o']);
});

test('push/fold stays separate from deep-stack atlas ranges', () => {
  const pf = buildPushFoldMatrix({ format: '6max', position: 'BTN', stack: 10, situation: 'push_fold' });
  assert.equal(pf.supported, true);
  const deep = buildAtlasMatrix(pack, {
    format: '6max', situation: 'rfi', position: 'BTN', stack: 100
  });
  assert.equal(deep.supported, true);
  assert.notEqual(pf.cells['72o'].play, deep.cells['72o'].play);
});

test('controller never lands on unsupported for 25+ diverse catalog paths', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  const picks = [
    { format: '6max', position: 'UTG', situation: 'rfi', stack: 20 },
    { format: '6max', position: 'BTN', situation: 'vs_open', opener: 'CO', stack: 25 },
    { format: '6max', position: 'BB', situation: 'bb_defend', opener: 'BTN', stack: 30 },
    { format: '6max', position: 'SB', situation: 'push_fold', stack: 15 },
    { format: '9max', position: 'UTG+1', situation: 'rfi', stack: 40 },
    { format: '9max', position: 'MP', situation: 'vs_3bet', stack: 60 },
    { format: '9max', position: 'HJ', situation: 'vs_open', opener: 'UTG', stack: 100 },
    { format: '9max', position: 'CO', situation: 'vs_open', opener: 'HJ', stack: 20 },
    { format: '9max', position: 'BTN', situation: 'vs_open', opener: 'CO', stack: 25 },
    { format: '9max', position: 'BB', situation: 'bb_defend', opener: 'SB', stack: 15 },
    { format: '9max', position: 'SB', situation: 'push_fold', stack: 10 },
    { format: '6max', position: 'CO', situation: 'rfi', stack: 100 },
    { format: '6max', position: 'HJ', situation: 'vs_open', opener: 'UTG', stack: 10 },
    { format: '6max', position: 'SB', situation: 'vs_3bet', stack: 40 },
    { format: '9max', position: 'UTG', situation: 'rfi', stack: 25 },
    { format: '9max', position: 'MP', situation: 'vs_open', opener: 'UTG', stack: 30 },
    { format: '6max', position: 'BTN', situation: 'rfi', stack: 15 },
    { format: '6max', position: 'BB', situation: 'bb_defend', opener: 'UTG', stack: 60 },
    { format: '9max', position: 'CO', situation: 'rfi', stack: 20 },
    { format: '9max', position: 'BTN', situation: 'push_fold', stack: 20 },
    { format: '6max', position: 'UTG', situation: 'vs_3bet', stack: 40 },
    { format: '9max', position: 'HJ', situation: 'rfi', stack: 100 },
    { format: '6max', position: 'CO', situation: 'vs_3bet', stack: 20 },
    { format: '9max', position: 'SB', situation: 'rfi', stack: 10 },
    { format: '6max', position: 'HJ', situation: 'rfi', stack: 60 }
  ];
  assert.ok(picks.length >= 25);
  for (const pick of picks) {
    ctl.setField('format', pick.format);
    ctl.setField('position', pick.position);
    ctl.setField('situation', pick.situation);
    if (pick.opener) ctl.setField('opener', pick.opener);
    ctl.setField('stack', pick.stack);
    assert.equal(isSelectionComplete(ctl.selection), true, JSON.stringify(pick));
    ctl.showRange();
    const vm = ctl.viewModel();
    assert.notEqual(vm.phase, 'unsupported', JSON.stringify(pick));
    assert.ok(Object.keys(vm.cells).length > 0);
  }
});

test('mobile 390x844 renders 9-max MP RFI without NO_DATA screen', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('format', '9max');
  ctl.setField('position', 'MP');
  ctl.setField('situation', 'rfi');
  ctl.setField('stack', 20);
  ctl.showRange();
  Renderer.renderResult(root, ctl.viewModel(), {});
  assert.ok(root.querySelector('.rangesMatrix'));
  assert.ok(!root.innerHTML.includes('НЕТ'));
});
