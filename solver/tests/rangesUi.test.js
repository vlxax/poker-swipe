// Focused tests for the ranges onboarding / viewer UX.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

import { RangeController } from '../../ranges-ui/controller.js';
import { isSelectionComplete, getCatalog, nextCtaLabel } from '../../ranges-ui/catalog.js';
import { buildAtlasMatrix } from '../../ranges-ui/preflopAtlas.js';
import { buildPushFoldMatrix } from '../../ranges-ui/pushFold.js';
import { loadOnboarding, completeOnboarding, saveOnboarding, HINTS } from '../../ranges-ui/storage.js';
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

function fieldOrder(html) {
  const labels = ['ФОРМАТ', 'ПОЗИЦИЯ', 'СИТУАЦИЯ', 'ОТКРЫТИЕ С', 'СТЕК'];
  return labels
    .map((label) => ({ label, idx: html.indexOf(label) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.label);
}

function selectComplete(ctl, { situation = 'rfi', position = 'BTN', stack = 20 } = {}) {
  ctl.setField('position', position);
  ctl.setField('situation', situation);
  ctl.setField('stack', stack);
}

const pack = loadPack();
const rangesCss = readFileSync(new URL('../../ranges-ui/ranges.css', import.meta.url), 'utf8');

test('first visit shows position-first onboarding hint', () => {
  const storage = memStorage();
  const ctl = new RangeController({ pack, storage });
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'selector');
  assert.equal(vm.title, 'РЕНДЖИ');
  assert.match(vm.intro, /позици/i);
  assert.equal(vm.hints.length, 1);
  assert.equal(vm.hints[0].text, HINTS[0].text);
  assert.equal(vm.cta, 'ВЫБЕРИ ПОЗИЦИЮ');
});

test('onboarding hints follow field completion order', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  assert.equal(ctl.viewModel().hints[0].text, HINTS[0].text);

  ctl.setField('position', 'BTN');
  assert.equal(ctl.viewModel().hints[0].text, HINTS[1].text);

  ctl.setField('situation', 'rfi');
  assert.equal(ctl.viewModel().hints[0].text, HINTS[2].text);

  selectComplete(ctl);
  ctl.showRange();
  const vm = ctl.viewModel();
  assert.equal(vm.hints.length, 1);
  assert.equal(vm.hints[0].text, HINTS[3].text);
});

test('progressive CTA reflects the next missing field', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  assert.equal(ctl.viewModel().cta, 'ВЫБЕРИ ПОЗИЦИЮ');
  assert.equal(nextCtaLabel(ctl.selection), 'ВЫБЕРИ ПОЗИЦИЮ');

  ctl.setField('position', 'BTN');
  assert.equal(ctl.viewModel().cta, 'ВЫБЕРИ СИТУАЦИЮ');

  ctl.setField('situation', 'vs_open');
  assert.equal(ctl.viewModel().cta, 'ВЫБЕРИ ОТКРЫТИЕ');

  ctl.setField('opener', 'CO');
  assert.equal(ctl.viewModel().cta, 'ВЫБЕРИ СТЕК');

  ctl.setField('stack', 20);
  assert.equal(ctl.viewModel().cta, 'ПОКАЗАТЬ РЕНДЖ');
  assert.equal(ctl.viewModel().ctaEnabled, true);
});

test('user can choose position + stack + situation', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  selectComplete(ctl);
  assert.equal(isSelectionComplete(ctl.selection), true);
  const vm = ctl.viewModel();
  assert.equal(vm.cta, 'ПОКАЗАТЬ РЕНДЖ');
  assert.equal(vm.ctaEnabled, true);
});

test('matrix does not render before sufficient selection', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('position', 'BTN');
  ctl.setField('situation', 'rfi');
  assert.equal(ctl.phase, 'selector');
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'selector');
  assert.equal(vm.ctaEnabled, false);
});

test('valid selection renders a range matrix', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  selectComplete(ctl);
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
  const emptyPack = { preflop: {} };
  const ctl = new RangeController({ pack: emptyPack, storage: memStorage() });
  selectComplete(ctl);
  ctl.showRange();
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'unsupported');
  assert.match(vm.unsupportedMessage, /нет готового ренджа/i);

  const root = setupDom();
  Renderer.renderResult(root, vm, {});
  assert.ok(root.innerHTML.includes('нет готового ренджа') || root.innerHTML.includes('НЕТ'));
});

test('tapping a hand shows action detail', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  selectComplete(ctl);
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
  ctl.setField('position', 'BTN');
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

test('selector renders fields in spec order and hides irrelevant selectors', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });

  Renderer.renderSelector(root, ctl.viewModel(), {});
  let order = fieldOrder(root.innerHTML);
  assert.deepEqual(order, ['ФОРМАТ', 'ПОЗИЦИЯ']);
  assert.ok(!root.innerHTML.includes('СИТУАЦИЯ'));
  assert.ok(!root.innerHTML.includes('СТЕК'));

  ctl.setField('position', 'BTN');
  Renderer.renderSelector(root, ctl.viewModel(), {});
  order = fieldOrder(root.innerHTML);
  assert.deepEqual(order, ['ФОРМАТ', 'ПОЗИЦИЯ', 'СИТУАЦИЯ']);
  assert.ok(!root.innerHTML.includes('СТЕК'));

  ctl.setField('situation', 'vs_open');
  Renderer.renderSelector(root, ctl.viewModel(), {});
  order = fieldOrder(root.innerHTML);
  assert.deepEqual(order, ['ФОРМАТ', 'ПОЗИЦИЯ', 'СИТУАЦИЯ', 'ОТКРЫТИЕ С']);
  assert.ok(!root.innerHTML.includes('СТЕК'));

  ctl.setField('opener', 'CO');
  Renderer.renderSelector(root, ctl.viewModel(), {});
  order = fieldOrder(root.innerHTML);
  assert.deepEqual(order, ['ФОРМАТ', 'ПОЗИЦИЯ', 'СИТУАЦИЯ', 'ОТКРЫТИЕ С', 'СТЕК']);
});

test('mobile matrix uses full-width grid with expanded touch targets', () => {
  assert.match(rangesCss, /grid-template-columns:\s*repeat\(13,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(rangesCss, /touch-action:\s*manipulation/);
  assert.match(rangesCss, /\.rangesCell::before/);
  assert.doesNotMatch(rangesCss, /width:\s*max-content/);
  assert.match(rangesCss, /overflow-x:\s*hidden/);

  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });
  selectComplete(ctl);
  ctl.showRange();
  Renderer.renderResult(root, ctl.viewModel(), {});

  const matrix = root.querySelector('.rangesMatrix');
  const cells = root.querySelectorAll('.rangesCell');
  assert.ok(matrix);
  assert.equal(cells.length, 169);
  assert.ok(root.querySelector('.rangesMatrixWrap'));
  assert.ok(root.clientWidth <= 390 || root.clientWidth === 0);
});

test('9-max format exposes MP/LJ positions and honest unsupported for missing atlas', () => {
  const catalog = getCatalog(pack, '9max');
  assert.ok(catalog.positions.includes('MP'));
  assert.ok(catalog.positions.includes('LJ'));
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('format', '9max');
  ctl.setField('position', 'MP');
  ctl.setField('situation', 'rfi');
  ctl.setField('stack', 20);
  ctl.showRange();
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'unsupported');
  assert.match(vm.unsupportedMessage, /пока нет/i);
});

test('mobile 390x844 has no horizontal overflow on selector and result', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });
  selectComplete(ctl);
  Renderer.renderSelector(root, ctl.viewModel(), {});
  assert.ok(root.querySelector('#rangesShow'));
  ctl.showRange();
  Renderer.renderResult(root, ctl.viewModel(), {});
  const matrix = root.querySelector('.rangesMatrixWrap');
  assert.ok(matrix);
  assert.ok(root.clientWidth <= 390 || root.clientWidth === 0);
});
