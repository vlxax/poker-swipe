// Trainer ranges integration tests — Stage 3A (serial — shared lookup cache).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  resetTrainerCache,
  lookupTrainerSpot,
  lookupTrainerHandAction,
  listCharts,
  getChartById
} from '../../trainer-knowledge/index.js';
import {
  buildTrainerMatrix,
  handDetailFromTrainer,
  selectionToTrainerQuery
} from '../../trainer-knowledge/adapters/rangesAdapter.js';
import { MATCH_STATUS } from '../../trainer-knowledge/status.js';
import { inventoryTrainerSync } from '../../ranges-ui/trainerRanges.js';
import { isSelectionComplete } from '../../ranges-ui/catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

function nodeLookup() {
  return {
    lookupSpot: lookupTrainerSpot,
    lookupHand: async (chartId, hand) => {
      const { lookupTrainerHand } = await import('../../trainer-knowledge/lookup.js');
      return lookupTrainerHand({ chartId, hand });
    },
    lookupHandAction: lookupTrainerHandAction,
    charts: listCharts(),
    getChartById
  };
}

describe('trainer ranges integration', { concurrency: 1 }, () => {
  test('trainer catalog inventory from built charts', () => {
    resetTrainerCache();
    const charts = listCharts();
    const inv = inventoryTrainerSync(charts);
    assert.ok(inv.uoPositions.includes('EP'));
    assert.ok(inv.uoStacks.includes('2-4'));
    assert.ok(inv.modeInventory.callpush);
    assert.equal(inv.chartCount, 1638);
  });

  test('UO exact match: EP 2-4 AA → AI gradable', async () => {
    resetTrainerCache();
    const lookup = nodeLookup();
    const sel = { dataSource: 'trainer', position: 'EP', stackBand: '2-4', trainerSourceMode: 'uo', situation: 'uo_open' };
    const spot = lookup.lookupSpot(selectionToTrainerQuery(sel));
    assert.equal(spot.status, MATCH_STATUS.EXACT_TRAINER_MATCH);
    const hand = lookup.lookupHandAction({ ...selectionToTrainerQuery(sel), hand: 'AA' });
    assert.equal(hand.action, 'AI');
    assert.equal(hand.gradingAllowed, true);
    const detail = await handDetailFromTrainer(lookup, sel, 'AA');
    assert.equal(detail.trainerActionRaw, 'AI');
    assert.match(detail.provenanceDebug, /TRAINER/);
  });

  test('UNSELECTED hand not gradable', async () => {
    resetTrainerCache();
    const lookup = nodeLookup();
    const sel = { dataSource: 'trainer', position: 'EP', stackBand: '2-4', trainerSourceMode: 'uo' };
    const hand = lookup.lookupHandAction({ ...selectionToTrainerQuery(sel), hand: 'K2s' });
    assert.equal(hand.action, 'UNSELECTED');
    assert.equal(hand.gradingAllowed, false);
    const detail = await handDetailFromTrainer(lookup, sel, 'K2s');
    assert.equal(detail.unavailable, true);
    assert.equal(detail.gradingAllowed, false);
  });

  test('partial match: wrong stack not exact', () => {
    resetTrainerCache();
    const spot = lookupTrainerSpot({ sourceMode: 'uo', heroPosition: 'EP', stack: '999BB' });
    assert.notEqual(spot.status, MATCH_STATUS.EXACT_TRAINER_MATCH);
  });

  test('position group chart is not exact individual EP match', () => {
    resetTrainerCache();
    const spot = lookupTrainerSpot({
      sourceMode: 'vssqueeze',
      rawSpot: 'Caller_IP_R_Mid',
      heroPosition: 'EP',
      stack: '25BB',
      betSize: '5x'
    });
    if (spot.chart) {
      assert.ok(
        spot.status === MATCH_STATUS.GROUP_POSITION_MATCH ||
          spot.status === MATCH_STATUS.PARTIAL_TRAINER_MATCH
      );
      assert.notEqual(spot.status, MATCH_STATUS.EXACT_TRAINER_MATCH);
    }
  });

  test('buildTrainerMatrix returns provenance without inventing fold for UNSELECTED', async () => {
    resetTrainerCache();
    const lookup = nodeLookup();
    const sel = { dataSource: 'trainer', position: 'EP', stackBand: '2-4', trainerSourceMode: 'uo' };
    const matrix = await buildTrainerMatrix(lookup, sel);
    assert.ok(matrix.supported);
    assert.equal(matrix.sourceType, 'trainer');
    assert.ok(matrix.provenance?.source === 'TRAINER');
    const k2 = matrix.cells['K2s'];
    assert.equal(k2.trainerActionRaw, 'UNSELECTED');
    assert.notEqual(k2.action, 'FOLD');
    assert.equal(k2.gradingAllowed, false);
  });

  test('selection complete for trainer UO', () => {
    const sel = {
      dataSource: 'trainer',
      situation: 'uo_open',
      position: 'EP',
      stackBand: '2-4',
      trainerSourceMode: 'uo'
    };
    assert.equal(isSelectionComplete(sel, { dataSource: 'trainer' }), true);
  });

  test('five scenario groups have chart matches', () => {
    resetTrainerCache();
    const groups = [
      { sourceMode: 'uo', heroPosition: 'CO', stack: '3BB' },
      { sourceMode: 'callpush', rawSpot: 'Resteal', stack: '25BB' },
      { sourceMode: 'vssqueeze', rawSpot: 'Caller_IP_R_Mid', stack: '25BB', betSize: '5x' },
      { sourceMode: 'sbvsbb', rawSpot: 'BB_Def', heroPosition: 'BB', stack: '20BB' },
      { sourceMode: 'vs3bet', rawSpot: 'Hero_OOP_EP-LJ', stack: '25BB' }
    ];
    for (const g of groups) {
      const spot = lookupTrainerSpot(g);
      assert.notEqual(spot.status, MATCH_STATUS.NO_TRAINER_DATA, JSON.stringify(g));
      assert.ok(spot.chart);
    }
  });

  test('trainer ranges report files exist', () => {
    assert.ok(readFileSync(join(ROOT, 'trainer-knowledge/TRAINER_TERMS_TO_CLARIFY.md'), 'utf8').includes('UO'));
  });
});
