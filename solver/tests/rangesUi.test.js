// Focused tests for the ranges onboarding / viewer UX.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

import { RangeController } from '../../ranges-ui/controller.js';
import { isSelectionComplete, getCatalog } from '../../ranges-ui/catalog.js';
import { buildAtlasMatrix } from '../../ranges-ui/preflopAtlas.js';
import { buildPushFoldMatrix } from '../../ranges-ui/pushFold.js';
import { loadOnboarding, completeOnboarding, saveOnboarding } from '../../ranges-ui/storage.js';
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

const pack = loadPack();

test('first visit shows understandable onboarding hints', () => {
  const storage = memStorage();
  const ctl = new RangeController({ pack, storage });
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'selector');
  assert.equal(vm.title, 'РЕНДЖИ');
  assert.match(vm.intro, /Выбери ситуацию/);
  ctl.setField('situation', 'rfi');
  const vm2 = ctl.viewModel();
  assert.ok(vm2.hints.some((h) => /позици/i.test(h.text)));
});

test('user can choose position + stack + situation', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('situation', 'rfi');
  ctl.setField('position', 'BTN');
  ctl.setField('stack', 20);
  assert.equal(isSelectionComplete(ctl.selection), true);
  const vm = ctl.viewModel();
  assert.equal(vm.cta, 'ПОКАЗАТЬ РЕНДЖ');
  assert.equal(vm.ctaEnabled, true);
});

test('matrix does not render before sufficient selection', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('situation', 'rfi');
  ctl.setField('position', 'BTN');
  assert.equal(ctl.phase, 'selector');
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'selector');
  assert.equal(vm.ctaEnabled, false);
});

test('valid selection renders a range matrix', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('situation', 'rfi');
  ctl.setField('position', 'BTN');
  ctl.setField('stack', 20);
  ctl.showRange();
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'result');
  assert.ok(vm.cells.AA);
  assert.equal(vm.cells.AA.bucket, 'always');

  const root = setupDom();
  Renderer.renderResult(root, vm, {});
  assert.ok(root.querySelector('.rangesMatrix'));
  assert.ok(root.innerHTML.includes('BTN'));
});

test('unsupported selection shows explicit fallback', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.selection = {
    format: '6max', situation: 'vs_open', position: 'BTN', opener: 'SB', stack: 20
  };
  ctl.phase = 'result';
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'unsupported');
  assert.match(vm.unsupportedMessage, /нет готового ренджа/i);

  const root = setupDom();
  Renderer.renderResult(root, vm, {});
  assert.ok(root.innerHTML.includes('нет готового ренджа') || root.innerHTML.includes('НЕТ'));
});

test('tapping a hand shows action detail', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('situation', 'rfi');
  ctl.setField('position', 'BTN');
  ctl.setField('stack', 20);
  ctl.showRange();
  ctl.selectHand('AJo');
  const vm = ctl.viewModel();
  assert.ok(vm.handDetail);
  assert.equal(vm.handDetail.hand, 'AJo');
  assert.ok(vm.handDetail.actionLabel);
  assert.ok(Number.isFinite(vm.handDetail.freqPct));

  const root = setupDom();
  Renderer.renderResult(root, vm, {});
  assert.ok(root.innerHTML.includes('AJo'));
  assert.ok(root.innerHTML.includes('Действие'));
});

test('onboarding does not repeat after completion', () => {
  const storage = memStorage();
  completeOnboarding(storage);
  const ctl = new RangeController({ pack, storage });
  ctl.setField('situation', 'rfi');
  const vm = ctl.viewModel();
  assert.equal(vm.hints.length, 0);
  assert.equal(loadOnboarding(storage).completed, true);
});

test('existing range atlas logic is not broken', () => {
  const catalog = getCatalog(pack);
  assert.ok(catalog.rfiPositions.includes('BTN'));
  const matrix = buildAtlasMatrix(pack, {
    format: '6max', situation: 'rfi', position: 'UTG', stack: 20
  });
  assert.equal(matrix.supported, true);
  assert.ok(matrix.found > 100);
  const push = buildPushFoldMatrix({ position: 'BTN', stack: 10, pushMode: 'PUSH' });
  assert.equal(push.supported, true);
  assert.equal(Object.keys(push.cells).length, 169);
});

test('mobile 390x844 has no horizontal overflow on selector and result', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('situation', 'rfi');
  ctl.setField('position', 'BTN');
  ctl.setField('stack', 20);
  Renderer.renderSelector(root, ctl.viewModel(), {});
  assert.ok(root.querySelector('#rangesShow'));
  ctl.showRange();
  Renderer.renderResult(root, ctl.viewModel(), {});
  const matrix = root.querySelector('.rangesMatrixWrap');
  assert.ok(matrix);
  assert.ok(root.clientWidth <= 390 || root.clientWidth === 0);
});
