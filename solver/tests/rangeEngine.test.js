// Exhaustive accuracy tests for the range engine.
//
// These check the *content* of what the section offers, not just that a screen
// renders: seat ordering, exact-data backing, structural validity of every
// matrix, and the absence of silently reused or substituted ranges.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

import {
  SEAT_ORDER, getValidOpeners, getValidThreeBettors, canBeFirstIn, canFaceOpen,
  actsBefore, positionsForFormat
} from '../../ranges-ui/positions.js';
import {
  evaluateCombination, enumerateSelectableCombinations, buildCoverageReport,
  getAvailability, openerOptionsFor, stackOptionsFor, situationOptionsFor,
  positionOptionsFor, formatOptionsFor, REASON
} from '../../ranges-ui/coverage.js';
import {
  atlasTupleKey, lookupPolicyExact, buildExactIndex, sourceIdFor,
  SOURCE_RFI, SOURCE_BB_DEFEND, SOURCE_VS_OPEN, SOURCE_VS_3BET, SOURCE_PUSHFOLD
} from '../../ranges-ui/rangeSources.js';
import { buildAtlasMatrix } from '../../ranges-ui/preflopAtlas.js';
import {
  buildPushFoldMatrix, pushFoldStacksFor, isPushFoldModelValid
} from '../../ranges-ui/pushFold.js';
import {
  validateRangeMatrix, validationProfileFor, rangeStats, rangeFingerprint, TOTAL_COMBOS
} from '../../ranges-ui/rangeValidation.js';
import { getCatalog, legalOpeners } from '../../ranges-ui/catalog.js';
import { RangeController } from '../../ranges-ui/controller.js';
import { matrixClasses } from '../../ranges-ui/matrix.js';
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
const selectable = enumerateSelectableCombinations(pack);

function matrixFor(sel) {
  return sel.situation === 'push_fold' ? buildPushFoldMatrix(sel) : buildAtlasMatrix(pack, sel);
}

// --- Task 2: position dependencies -----------------------------------------

test('getValidOpeners returns every earlier seat for all 6-max positions', () => {
  assert.deepEqual(getValidOpeners('6max', 'UTG'), []);
  assert.deepEqual(getValidOpeners('6max', 'HJ'), ['UTG']);
  assert.deepEqual(getValidOpeners('6max', 'CO'), ['UTG', 'HJ']);
  assert.deepEqual(getValidOpeners('6max', 'BTN'), ['UTG', 'HJ', 'CO']);
  assert.deepEqual(getValidOpeners('6max', 'SB'), ['UTG', 'HJ', 'CO', 'BTN']);
  assert.deepEqual(getValidOpeners('6max', 'BB'), ['UTG', 'HJ', 'CO', 'BTN', 'SB']);
});

test('getValidOpeners returns every earlier seat for all 9-max positions', () => {
  assert.deepEqual(getValidOpeners('9max', 'UTG'), []);
  assert.deepEqual(getValidOpeners('9max', 'UTG+1'), ['UTG']);
  assert.deepEqual(getValidOpeners('9max', 'MP'), ['UTG', 'UTG+1']);
  assert.deepEqual(getValidOpeners('9max', 'LJ'), ['UTG', 'UTG+1', 'MP']);
  assert.deepEqual(getValidOpeners('9max', 'HJ'), ['UTG', 'UTG+1', 'MP', 'LJ']);
  assert.deepEqual(getValidOpeners('9max', 'CO'), ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ']);
  assert.deepEqual(getValidOpeners('9max', 'BTN'), ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO']);
  assert.deepEqual(getValidOpeners('9max', 'SB'), ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN']);
  assert.deepEqual(getValidOpeners('9max', 'BB'), ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB']);
});

test('opener lists are always a strict prefix of the seat order', () => {
  for (const format of ['6max', '9max']) {
    const seats = SEAT_ORDER[format];
    for (const hero of seats) {
      const openers = getValidOpeners(format, hero);
      assert.deepEqual(openers, seats.slice(0, seats.indexOf(hero)));
      for (const opener of openers) {
        assert.equal(actsBefore(format, opener, hero), true, `${opener} must act before ${hero}`);
      }
      assert.equal(openers.includes(hero), false);
    }
  }
});

test('three-bettors are the seats acting after hero', () => {
  assert.deepEqual(getValidThreeBettors('6max', 'UTG'), ['HJ', 'CO', 'BTN', 'SB', 'BB']);
  assert.deepEqual(getValidThreeBettors('6max', 'BTN'), ['SB', 'BB']);
  assert.deepEqual(getValidThreeBettors('6max', 'BB'), []);
  assert.deepEqual(getValidThreeBettors('9max', 'BTN'), ['SB', 'BB']);
});

test('unknown formats and positions never produce openers', () => {
  assert.deepEqual(getValidOpeners('10max', 'BTN'), []);
  assert.deepEqual(getValidOpeners('6max', 'MP'), []);
  assert.deepEqual(getValidOpeners('6max', ''), []);
});

test('BB is never first in and UTG never faces an open', () => {
  for (const format of ['6max', '9max']) {
    assert.equal(canBeFirstIn(format, 'BB'), false);
    assert.equal(canFaceOpen(format, 'UTG'), false);
    for (const seat of positionsForFormat(format)) {
      if (seat !== 'BB') assert.equal(canBeFirstIn(format, seat), true, `${format} ${seat}`);
    }
  }
});

// --- Task 3: situation dependencies ----------------------------------------

test('first-in never asks for an opener and vs-open always requires a legal one', () => {
  for (const sel of selectable) {
    if (sel.situation === 'rfi' || sel.situation === 'push_fold' || sel.situation === 'vs_3bet') {
      assert.equal(sel.opener, null, `${sel.situation} must not carry an opener`);
    }
    if (sel.situation === 'vs_open') {
      assert.ok(sel.opener, 'vs_open must carry an opener');
      assert.ok(
        getValidOpeners(sel.format, sel.position).includes(sel.opener),
        `${sel.format} ${sel.position} vs ${sel.opener} is not a legal ordering`
      );
    }
  }
});

test('no offered combination violates seat ordering', () => {
  for (const sel of selectable) {
    const evaluation = evaluateCombination(pack, sel);
    assert.equal(evaluation.available, true, JSON.stringify(sel));
    assert.notEqual(evaluation.reason, REASON.ILLEGAL);
  }
});

test('illegal orderings are rejected even when the pack holds data for them', () => {
  // The atlas ships VS_OPEN|HJ|CO, but in 6-max the cutoff acts after the
  // hijack, so that spot cannot happen and must never be offered.
  assert.ok(pack.preflop['VS_OPEN|HJ|CO|20|AA'], 'fixture expects the bad tuple to exist');
  const evaluation = evaluateCombination(pack, {
    format: '6max', position: 'HJ', situation: 'vs_open', opener: 'CO', stack: 20
  });
  assert.equal(evaluation.available, false);
  assert.equal(evaluation.reason, REASON.ILLEGAL);
  assert.equal(openerOptionsFor(pack, { format: '6max', position: 'HJ', situation: 'vs_open' }).includes('CO'), false);
});

test('push/fold is kept separate from deep-stack ranges', () => {
  const pushCombos = selectable.filter((s) => s.situation === 'push_fold');
  assert.ok(pushCombos.length > 0);
  for (const sel of pushCombos) {
    assert.ok(sel.stack <= 20, `push/fold must stay short stacked, got ${sel.stack}`);
    assert.equal(isPushFoldModelValid(sel.position, sel.stack), true);
  }
  // Depths where the model degenerates are not offered at all.
  for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']) {
    for (const stack of [25, 30]) {
      assert.equal(pushFoldStacksFor(position).includes(stack), false, `${position} ${stack}bb`);
    }
  }
  // A push/fold matrix is never the same object as the deep-stack opening range.
  const push = buildPushFoldMatrix({ format: '6max', position: 'BTN', situation: 'push_fold', stack: 15 });
  const rfi = buildAtlasMatrix(pack, { format: '6max', position: 'BTN', situation: 'rfi', stack: 20 });
  assert.notEqual(rangeFingerprint(push.cells), rangeFingerprint(rfi.cells));
});

// --- Task 4: the ranges themselves ------------------------------------------

test('every offered combination produces a structurally valid 169-class matrix', () => {
  assert.ok(selectable.length >= 25, `expected 25+ combinations, got ${selectable.length}`);
  for (const sel of selectable) {
    const matrix = matrixFor(sel);
    assert.equal(matrix.supported, true, JSON.stringify(sel));
    assert.equal(Object.keys(matrix.cells).length, 169, JSON.stringify(sel));

    const validation = validateRangeMatrix(matrix.cells, {
      profile: validationProfileFor(sel.situation, sel.position)
    });
    assert.deepEqual(validation.errors, [], `${JSON.stringify(sel)} -> ${validation.errors.join('; ')}`);

    const stats = validation.stats;
    assert.equal(stats.classes, 169);
    assert.equal(stats.combos, TOTAL_COMBOS);
    assert.equal(stats.pairs.classes, 13);
    assert.equal(stats.suited.classes, 78);
    assert.equal(stats.offsuit.classes, 78);
    assert.equal(stats.pairs.combos, 78);
    assert.equal(stats.suited.combos, 312);
    assert.equal(stats.offsuit.combos, 936);
    assert.ok(stats.playPct > 0 && stats.playPct < 100, `${JSON.stringify(sel)} width ${stats.playPct}`);
  }
});

test('suited hands are never played less than the same offsuit hand', () => {
  for (const sel of selectable) {
    const { cells } = matrixFor(sel);
    for (const hand of matrixClasses()) {
      if (!hand.endsWith('s')) continue;
      const offsuit = cells[`${hand.slice(0, 2)}o`];
      assert.ok(
        cells[hand].play + 0.03 >= offsuit.play,
        `${JSON.stringify(sel)}: ${hand} ${cells[hand].play} < ${hand.slice(0, 2)}o ${offsuit.play}`
      );
    }
  }
});

test('earlier positions never open wider than later positions', () => {
  for (const stack of [20, 25, 30, 40, 50]) {
    const widths = ['UTG', 'HJ', 'CO', 'BTN'].map((position) => {
      const { cells } = buildAtlasMatrix(pack, { format: '6max', position, situation: 'rfi', stack });
      return { position, pct: rangeStats(cells).playPct };
    });
    for (let i = 0; i + 1 < widths.length; i++) {
      assert.ok(
        widths[i].pct <= widths[i + 1].pct,
        `${stack}bb: ${widths[i].position} ${widths[i].pct}% > ${widths[i + 1].position} ${widths[i + 1].pct}%`
      );
    }
  }
});

test('late positions do not reuse the UTG opening range', () => {
  const utg = rangeFingerprint(buildAtlasMatrix(pack, {
    format: '6max', position: 'UTG', situation: 'rfi', stack: 20
  }).cells);
  for (const position of ['HJ', 'CO', 'BTN', 'SB']) {
    const other = rangeFingerprint(buildAtlasMatrix(pack, {
      format: '6max', position, situation: 'rfi', stack: 20
    }).cells);
    assert.notEqual(other, utg, `${position} reuses the UTG range`);
  }
});

test('changing the stack changes the range wherever the stack chip is offered', () => {
  const grouped = new Map();
  for (const sel of selectable) {
    const key = [sel.format, sel.position, sel.situation, sel.opener].join('|');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(sel);
  }
  for (const [key, group] of grouped) {
    if (group.length < 2) continue;
    const fingerprints = new Set(group.map((sel) => rangeFingerprint(matrixFor(sel).cells)));
    assert.equal(
      fingerprints.size, group.length,
      `${key} offers ${group.length} depths but only ${fingerprints.size} distinct ranges`
    );
  }
});

test('no two offered combinations resolve to the same range', () => {
  const byFingerprint = new Map();
  for (const sel of selectable) {
    const fingerprint = rangeFingerprint(matrixFor(sel).cells);
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, []);
    byFingerprint.get(fingerprint).push(sel);
  }
  const collisions = [...byFingerprint.values()].filter((group) => group.length > 1);
  assert.deepEqual(
    collisions.map((group) => group.map((s) => `${s.format}/${s.position}/${s.situation}/${s.opener}/${s.stack}`)),
    [],
    'distinct selections must not share one range'
  );
  assert.equal(byFingerprint.size, selectable.length);
});

test('BB defends wider against later openers', () => {
  const widths = ['UTG', 'HJ', 'CO', 'BTN', 'SB'].map((opener) => {
    const { cells } = buildAtlasMatrix(pack, {
      format: '6max', position: 'BB', situation: 'vs_open', opener, stack: 20
    });
    return rangeStats(cells).playPct;
  });
  for (let i = 0; i + 1 < widths.length; i++) {
    assert.ok(widths[i] < widths[i + 1], `BB defence must widen: ${widths.join(' < ')}`);
  }
});

// --- Task 5: no fake fallbacks ----------------------------------------------

test('stacks outside the atlas are not snapped onto a neighbouring bucket', () => {
  for (const stack of [10, 15, 60, 100]) {
    const sel = { format: '6max', position: 'BTN', situation: 'rfi', stack };
    assert.equal(lookupPolicyExact(pack, sel, 'AA'), null, `${stack}bb must not resolve`);
    assert.equal(evaluateCombination(pack, sel).available, false);
  }
  const offered = stackOptionsFor(pack, {
    format: '6max', position: 'BTN', situation: 'rfi', opener: null
  }).map((s) => s.id);
  assert.deepEqual(offered, [20, 25, 30, 40, 50]);
});

test('9-max seats are not remapped onto 6-max atlas rows', () => {
  for (const position of ['UTG+1', 'MP', 'LJ']) {
    const sel = { format: '9max', position, situation: 'rfi', stack: 20 };
    assert.equal(atlasTupleKey(sel), null, `${position} must not build an atlas key`);
    assert.equal(lookupPolicyExact(pack, sel, 'AA'), null);
    assert.equal(evaluateCombination(pack, sel).reason, REASON.NO_DATA);
  }
  // Even seats that share a name with a 6-max seat must not borrow its data.
  for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
    const sel = { format: '9max', position, situation: 'rfi', stack: 20 };
    assert.equal(evaluateCombination(pack, sel).available, false, `9-max ${position}`);
    assert.equal(buildAtlasMatrix(pack, sel).supported, false);
  }
});

test('situations whose data ignores the chosen parameters are not offered', () => {
  const index = buildExactIndex(pack);
  // vs 3-bet: 25 tuples, one range behind all of them.
  assert.equal(index.sources[SOURCE_VS_3BET].tuples.length, 25);
  assert.equal(index.sources[SOURCE_VS_3BET].distinctRanges, 1);
  // vs open (non-BB hero): 35 tuples, one range behind all of them.
  assert.equal(index.sources[SOURCE_VS_OPEN].tuples.length, 35);
  assert.equal(index.sources[SOURCE_VS_OPEN].distinctRanges, 1);

  for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
    assert.equal(
      evaluateCombination(pack, { format: '6max', position, situation: 'vs_3bet', stack: 20 }).reason,
      REASON.NOT_DISCRIMINATED
    );
    assert.equal(situationOptionsFor(pack, { format: '6max', position }).includes('vs_3bet'), false);
  }
  for (const [position, opener] of [['CO', 'UTG'], ['BTN', 'CO'], ['BTN', 'HJ']]) {
    assert.equal(
      evaluateCombination(pack, { format: '6max', position, situation: 'vs_open', opener, stack: 20 }).reason,
      REASON.NOT_DISCRIMINATED
    );
  }
});

test('a depth axis that carries no information collapses into one band chip', () => {
  const stacks = stackOptionsFor(pack, {
    format: '6max', position: 'BB', situation: 'vs_open', opener: 'BTN'
  });
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].label, '20–50 ББ');
  assert.deepEqual(stacks[0].band, [20, 50]);
});

test('coverage report contains no fallback rows', () => {
  const report = buildCoverageReport(pack);
  assert.equal(report.summary.fallback, 0);
  assert.equal(report.summary.invalid, 0);
  assert.ok(report.summary.exact > 0);
  for (const row of report.rows.filter((r) => r.exact)) {
    assert.equal(row.fallback, false);
    assert.ok(row.source);
  }
});

// --- Task 6: dependency-aware UI --------------------------------------------

test('the selector only offers formats, positions, situations and stacks with data', () => {
  assert.deepEqual(formatOptionsFor(pack), ['6max']);
  assert.deepEqual(positionOptionsFor(pack, '9max'), []);
  assert.deepEqual(positionOptionsFor(pack, '6max'), ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);

  const availability = getAvailability(pack);
  for (const [format, info] of Object.entries(availability.byFormat)) {
    for (const [position, posInfo] of Object.entries(info.positions)) {
      for (const [situation, sitInfo] of Object.entries(posInfo.situations)) {
        const openers = sitInfo.openers.length ? sitInfo.openers : [null];
        for (const opener of openers) {
          const stacks = sitInfo.stacksByOpener[opener || '_'];
          assert.ok(stacks.length > 0, `${format}/${position}/${situation}/${opener} has no stacks`);
          for (const stack of stacks) {
            assert.equal(
              evaluateCombination(pack, { format, position, situation, opener, stack: stack.id }).available,
              true
            );
          }
        }
      }
    }
  }
});

test('walking every selectable path through the controller never shows NO DATA', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  let walked = 0;
  for (const sel of selectable) {
    ctl.setField('format', sel.format);
    ctl.setField('position', sel.position);
    ctl.setField('situation', sel.situation);
    if (sel.opener) ctl.setField('opener', sel.opener);
    ctl.setField('stack', sel.stack);
    ctl.showRange();
    const vm = ctl.viewModel();
    assert.equal(vm.phase, 'result', JSON.stringify(sel));
    assert.notEqual(vm.phase, 'unsupported');
    assert.ok(vm.statsLine);
    assert.equal(Object.keys(vm.cells).length, 169);
    walked++;
  }
  assert.ok(walked >= 25, `expected 25+ walked combinations, walked ${walked}`);
});

test('the selector chips themselves never lead to a missing range', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  const selector = ctl.viewModel();
  for (const position of selector.positions) {
    ctl.setField('position', position);
    for (const situation of ctl.viewModel().situations) {
      ctl.setField('situation', situation.id);
      const afterSituation = ctl.viewModel();
      const openers = afterSituation.needsOpener ? afterSituation.openers : [null];
      assert.ok(openers.length > 0, `${position}/${situation.id} exposes no opener`);
      for (const opener of openers) {
        if (opener) ctl.setField('opener', opener);
        const stacks = ctl.viewModel().stacks;
        assert.ok(stacks.length > 0, `${position}/${situation.id}/${opener} exposes no stack`);
        for (const stack of stacks) {
          ctl.setField('stack', stack.id);
          ctl.showRange();
          assert.equal(ctl.viewModel().phase, 'result', `${position}/${situation.id}/${opener}/${stack.id}`);
          ctl.backToSelector();
        }
      }
    }
  }
});

test('stale selections are dropped when an earlier chip changes', () => {
  const ctl = new RangeController({ pack, storage: memStorage() });
  ctl.setField('position', 'BB');
  ctl.setField('situation', 'vs_open');
  ctl.setField('opener', 'BTN');
  ctl.setField('stack', 20);
  assert.equal(ctl.viewModel().ctaEnabled, true);

  ctl.setField('position', 'UTG');
  const vm = ctl.viewModel();
  assert.equal(vm.selection.situation, null);
  assert.equal(vm.selection.opener, null);
  assert.equal(vm.selection.stack, null);
  assert.equal(vm.ctaEnabled, false);
});

// --- Task 7 regression: 9-max BTN vs open -----------------------------------

test('9-max BTN vs open exposes the complete opener model, never a CO/HJ/UTG subset', () => {
  const fullSet = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'];
  assert.deepEqual(getValidOpeners('9max', 'BTN'), fullSet);
  assert.deepEqual(legalOpeners('9max', 'BTN'), fullSet);

  // The pre-fix UI advertised exactly these three, backed by 6-max rows.
  const offered = openerOptionsFor(pack, { format: '9max', position: 'BTN', situation: 'vs_open' });
  assert.notDeepEqual(offered, ['CO', 'HJ', 'UTG']);
  assert.deepEqual(offered, [], '9-max has no verified data, so nothing may be offered');

  for (const opener of fullSet) {
    const evaluation = evaluateCombination(pack, {
      format: '9max', position: 'BTN', situation: 'vs_open', opener, stack: 20
    });
    assert.equal(evaluation.available, false);
    assert.equal(evaluation.reason, REASON.NO_DATA, `${opener} must be missing data, not remapped`);
  }
});

test('UTG+1, MP and LJ are modelled as their own seats', () => {
  for (const position of ['UTG+1', 'MP', 'LJ']) {
    assert.ok(SEAT_ORDER['9max'].includes(position));
    assert.equal(SEAT_ORDER['6max'].includes(position), false);
    assert.equal(canBeFirstIn('9max', position), true);
    assert.equal(canFaceOpen('9max', position), true);
    assert.ok(getValidOpeners('9max', position).length > 0);
    // No situation is offered for them, and nothing resolves to UTG or HJ data.
    assert.deepEqual(situationOptionsFor(pack, { format: '9max', position }), []);
    for (const situation of ['rfi', 'vs_3bet', 'push_fold']) {
      assert.equal(evaluateCombination(pack, {
        format: '9max', position, situation, stack: 20
      }).available, false);
    }
  }
  assert.deepEqual(getCatalog(pack, '9max').positions, SEAT_ORDER['9max']);
});

// --- Data-driven behaviour: the engine follows the pack ---------------------

const RANKS = [...'AKQJT98765432'];

function handStrength(hand) {
  const i = RANKS.indexOf(hand[0]);
  const j = RANKS.indexOf(hand[1]);
  if (hand.length === 2) return 400 - i;
  return (hand.endsWith('s') ? 200 : 100) - i * 6 - j;
}

// Builds a monotone, structurally valid range covering the strongest hands.
function syntheticTuple(target, threshold, { raiseShare = 0.4 } = {}) {
  const out = {};
  for (const hand of matrixClasses()) {
    const play = handStrength(hand) >= threshold ? 1 : 0;
    out[`${target}|${hand}`] = {
      FOLD: 1 - play,
      CALL: Number((play * (1 - raiseShare)).toFixed(3)),
      RAISE: Number((play * raiseShare).toFixed(3))
    };
  }
  return out;
}

test('vs open reappears automatically once the pack discriminates by opener', () => {
  const preflop = {};
  for (const stack of [20, 50]) {
    Object.assign(preflop, syntheticTuple(`RFI|BTN|${stack}`, 120 + stack, { raiseShare: 1 }));
    // Distinct widths per opener, so the opener chip carries information.
    Object.assign(preflop, syntheticTuple(`VS_OPEN|BTN|UTG|${stack}`, 190));
    Object.assign(preflop, syntheticTuple(`VS_OPEN|BTN|HJ|${stack}`, 170));
    Object.assign(preflop, syntheticTuple(`VS_OPEN|BTN|CO|${stack}`, 150));
  }
  const richPack = { preflop };

  const openers = openerOptionsFor(richPack, { format: '6max', position: 'BTN', situation: 'vs_open' });
  assert.deepEqual(openers, ['UTG', 'HJ', 'CO']);
  for (const opener of openers) {
    const evaluation = evaluateCombination(richPack, {
      format: '6max', position: 'BTN', situation: 'vs_open', opener, stack: 20
    });
    assert.equal(evaluation.available, true, `${opener} should be offered`);
    assert.equal(evaluation.sourceId, SOURCE_VS_OPEN);
  }
  // SB still acts after BTN, so it never becomes an opener no matter the data.
  assert.equal(openers.includes('SB'), false);
});

test('an opener axis that repeats one range stays hidden even in a rich pack', () => {
  const preflop = {};
  for (const opener of ['UTG', 'HJ', 'CO']) {
    Object.assign(preflop, syntheticTuple(`VS_OPEN|BTN|${opener}|20`, 170));
  }
  const flatPack = { preflop };
  assert.deepEqual(openerOptionsFor(flatPack, { format: '6max', position: 'BTN', situation: 'vs_open' }), []);
  assert.equal(
    evaluateCombination(flatPack, {
      format: '6max', position: 'BTN', situation: 'vs_open', opener: 'CO', stack: 20
    }).reason,
    REASON.NOT_DISCRIMINATED
  );
});

test('a structurally broken tuple is rejected instead of being displayed', () => {
  const preflop = {};
  Object.assign(preflop, syntheticTuple('RFI|BTN|20', 150, { raiseShare: 1 }));
  // Fold the best hand in the deck: the matrix must fail validation.
  for (const hand of ['AA', 'KK']) {
    preflop[`RFI|BTN|20|${hand}`] = { FOLD: 1, CALL: 0, RAISE: 0 };
  }
  const brokenPack = { preflop };
  const evaluation = evaluateCombination(brokenPack, {
    format: '6max', position: 'BTN', situation: 'rfi', stack: 20
  });
  assert.equal(evaluation.available, false);
  assert.equal(evaluation.reason, REASON.INVALID_RANGE);
});

test('an incomplete tuple never renders as a partial range', () => {
  const preflop = syntheticTuple('RFI|BTN|20', 150, { raiseShare: 1 });
  delete preflop['RFI|BTN|20|72o'];
  const holedPack = { preflop };
  const matrix = buildAtlasMatrix(holedPack, {
    format: '6max', position: 'BTN', situation: 'rfi', stack: 20
  });
  assert.equal(matrix.supported, false);
  assert.equal(matrix.found, 168);
  assert.equal(evaluateCombination(holedPack, {
    format: '6max', position: 'BTN', situation: 'rfi', stack: 20
  }).reason, REASON.NO_DATA);
});

// --- Source routing and rendering -------------------------------------------

test('each situation is routed to its own source', () => {
  assert.equal(sourceIdFor('rfi', 'BTN'), SOURCE_RFI);
  assert.equal(sourceIdFor('vs_open', 'BTN'), SOURCE_VS_OPEN);
  assert.equal(sourceIdFor('vs_open', 'BB'), SOURCE_BB_DEFEND);
  assert.equal(sourceIdFor('vs_3bet', 'CO'), SOURCE_VS_3BET);
  assert.equal(sourceIdFor('push_fold', 'SB'), SOURCE_PUSHFOLD);
  assert.equal(atlasTupleKey({ format: '6max', situation: 'rfi', position: 'CO', stack: 30 }), 'RFI|CO|30');
  assert.equal(
    atlasTupleKey({ format: '6max', situation: 'vs_open', position: 'BB', opener: 'BTN', stack: 25 }),
    'BB_DEFEND|BTN|25'
  );
});

test('the result screen states which source the range came from', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });

  ctl.setField('position', 'CO');
  ctl.setField('situation', 'rfi');
  ctl.setField('stack', 30);
  ctl.showRange();
  Renderer.renderResult(root, ctl.viewModel(), {});
  assert.match(root.innerHTML, /Источник: Preflop atlas · RFI/);
  assert.match(root.innerHTML, /Играем 65% комбинаций \(862 из 1326\)/);

  ctl.backToSelector();
  ctl.setField('position', 'BTN');
  ctl.setField('situation', 'push_fold');
  ctl.setField('stack', 15);
  ctl.showRange();
  Renderer.renderResult(root, ctl.viewModel(), {});
  assert.match(root.innerHTML, /Источник: Push\/fold модель/);
  assert.match(root.innerHTML, /не смешивается с deep-stack/);
});

test('mobile 390x844 renders every offered combination without overflow', () => {
  const root = setupDom();
  const ctl = new RangeController({ pack, storage: memStorage() });
  for (const sel of selectable) {
    ctl.setField('format', sel.format);
    ctl.setField('position', sel.position);
    ctl.setField('situation', sel.situation);
    if (sel.opener) ctl.setField('opener', sel.opener);
    ctl.setField('stack', sel.stack);
    ctl.showRange();
    Renderer.renderResult(root, ctl.viewModel(), {});
    assert.equal(root.querySelectorAll('.rangesCell').length, 169, JSON.stringify(sel));
    assert.ok(root.querySelector('.rangesMatrixWrap'));
    assert.equal(root.innerHTML.includes('НЕТ<br>'), false, JSON.stringify(sel));
    assert.ok(root.clientWidth <= 390 || root.clientWidth === 0);
  }
});
