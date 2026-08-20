// UX tests for range narrowing trainer flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

import { RangeController } from '../../ranges-ui/controller.js';
import { buildAtlasMatrix } from '../../ranges-ui/preflopAtlas.js';
import { buildPushFoldMatrix } from '../../ranges-ui/pushFold.js';
import { getCatalog } from '../../ranges-ui/catalog.js';
import { loadProgress, completeOnboarding, HINTS } from '../../ranges-ui/storage.js';
import {
  getScenarios,
  scenarioCount,
  allScenarioTruthIds,
  getScenarioById
} from '../../ranges-ui/narrowingScenarios.js';
import { selectionFromReference, scoreStep } from '../../ranges-ui/narrowingEngine.js';
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
const rangesCss = readFileSync(new URL('../../ranges-ui/ranges.css', import.meta.url), 'utf8');

test('entry point is narrowing trainer intro, not reference chart browser', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'intro');
  assert.equal(vm.title, 'СУЖЕНИЕ ДИАПАЗОНА');
  assert.ok(vm.headline);
  assert.ok(vm.cta.includes('НАЧАТЬ'));
  assert.ok(!vm.dataSources);
  assert.ok(!vm.showStack);
});

test('intro hides technical source selectors and reference labels', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });
  Renderer.renderIntro(root, ctl.viewModel(), {});
  const html = root.innerHTML.toLowerCase();
  assert.ok(html.includes('сужение диапазона'));
  assert.ok(!html.includes('источник'));
  assert.ok(!html.includes('базовая стратегия'));
  assert.ok(!html.includes('reference'));
  assert.ok(!html.includes('verified'));
  assert.ok(!html.includes('heuristic'));
});

test('first visit shows start hint', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  const vm = ctl.viewModel();
  assert.equal(vm.hints.length, 1);
  assert.equal(vm.hints[0].text, HINTS[0].text);
});

test('beginPlay opens interactive step with matrix task', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.startScenario('read-open-btn');
  ctl.beginPlay();
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'play');
  assert.ok(vm.question);
  assert.ok(vm.matrix.length >= 169);
  assert.ok(vm.candidateCount > 0);

  const root = setupDom();
  Renderer.renderPlay(root, vm, {});
  assert.ok(root.querySelector('.rangesMatrix'));
  assert.ok(root.querySelector('#rangesConfirm'));
  assert.ok(!root.innerHTML.includes('ИЗМЕНИТЬ СИТУАЦИЮ'));
});

test('user toggles hands and completes scenario to summary', () => {
  const storage = memStorage();
  const ctl = new RangeController({ pack, storage });
  ctl.startScenario('read-open-btn');
  ctl.beginPlay();

  const step = getScenarioById('read-open-btn').steps[0];
  const truth = step.truth.hands;
  for (const hand of ctl.userSelection) {
    if (!truth.has(hand)) ctl.toggleHand(hand);
  }

  ctl.confirmStep();
  const vm = ctl.viewModel();
  assert.equal(vm.phase, 'summary');
  assert.ok(vm.avgAccuracy >= 90);
  assert.ok(vm.steps[0].feedback.length > 0);
  assert.equal(loadProgress(storage).runs, 1);
});

test('two-step scenario narrows range across actions', () => {
  const scenario = getScenarioById('btn-open-vs-3bet-sb');
  assert.ok(scenario, 'expected btn vs sb 3bet scenario');
  assert.equal(scenario.stepCount, 2);

  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.scenario = scenario;
  ctl.beginPlay();

  const step1Truth = scenario.steps[0].truth.hands;
  for (const hand of [...ctl.userSelection]) {
    if (!step1Truth.has(hand)) ctl.toggleHand(hand);
  }
  ctl.confirmStep();
  assert.equal(ctl.stepIndex, 1);
  assert.ok(ctl.userSelection.size <= step1Truth.size);

  const step2Truth = scenario.steps[1].truth.hands;
  for (const hand of [...ctl.userSelection]) {
    if (!step2Truth.has(hand)) ctl.toggleHand(hand);
  }
  ctl.confirmStep();
  assert.equal(ctl.viewModel().phase, 'summary');
});

test('scenarios are built from greenline reference truth only', () => {
  assert.ok(scenarioCount() > 0);
  const truthIds = allScenarioTruthIds();
  assert.equal(truthIds.size, 37);
  for (const scenario of getScenarios()) {
    for (const step of scenario.steps) {
      assert.equal(step.truth.supported, true);
      assert.ok(step.truth.hands.size > 0);
    }
  }
});

test('mixed frequency policies stay visible in play matrix', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.startScenario('read-btn-open-from-bb');
  ctl.beginPlay();
  const mixed = ctl.viewModel().matrix.filter((c) => c.mixed);
  assert.ok(mixed.length > 0);
});

test('scoreStep reports kept and removed mistakes', () => {
  const scenario = getScenarioById('read-open-utg');
  const step = scenario.steps[0];
  const candidates = new Set(step.candidateHands);
  const truth = step.truth;
  const user = new Set(truth.hands);
  const extra = '72o';
  user.add(extra);
  const score = scoreStep(user, truth, candidates);
  assert.ok(score.keptWrong.includes(extra));
  assert.ok(score.accuracy < 100);
});

test('onboarding does not repeat after completion', () => {
  const storage = memStorage();
  completeOnboarding(storage);
  const ctl = new RangeController({ pack, storage });
  assert.equal(ctl.viewModel().hints.length, 0);
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

test('mobile matrix uses full-width grid with touch targets', () => {
  assert.match(rangesCss, /grid-template-columns:\s*repeat\(13,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(rangesCss, /touch-action:\s*manipulation/);
  assert.match(rangesCss, /\.rangesCell::before/);
  assert.match(rangesCss, /\.rangesMix/);
  assert.doesNotMatch(rangesCss, /width:\s*max-content/);
  assert.match(rangesCss, /overflow-x:\s*hidden/);
});

test('mobile 390px layout renders intro and play without chart selectors', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });
  Renderer.renderIntro(root, ctl.viewModel(), {});
  assert.ok(root.querySelector('#rangesStart'));
  ctl.beginPlay();
  Renderer.renderPlay(root, ctl.viewModel(), {});
  const matrix = root.querySelector('.rangesMatrixWrap');
  assert.ok(matrix);
  assert.equal(root.querySelectorAll('.rangesCell').length, 169);
  assert.ok(root.clientWidth <= 390 || root.clientWidth === 0);
});

test('reference selection helper still resolves greenline policies', () => {
  const sel = { dataSource: 'reference', format: '6max', position: 'BTN', situation: 'vs_open', opener: 'UTG' };
  const truth = selectionFromReference(sel);
  assert.equal(truth.supported, true);
  assert.ok(truth.hands.has('AA'));
  assert.ok(truth.policies['55']);
});
