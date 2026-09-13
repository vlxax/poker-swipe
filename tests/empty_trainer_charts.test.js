/**
 * The 17 Strategy Map adapter failures are reconstructed charts whose cells
 * are all non-gradable (unparsed colors / nAI / LOW_PLAYABILITY). Not missing shards.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getChartById, getTrainerChartHands } from '../trainer-knowledge/lookup.js';
import { adaptTrainerChartById } from '../range-learning/trainerLibrary.js';
import { canGradeWithTrainerAction } from '../trainer-knowledge/status.js';
import { chartUoFamily } from '../trainer-knowledge/uoFamily.js';

const EMPTY_ADAPTER_SOURCE = [
  'BL_callpush-0a6348d41390',
  'BL_callpush-35f457e844dc',
  'BL_callpush-637f28b6edf5',
  'BL_callpush-7181014b813b',
  'BL_callpush-83432cabbc4d',
  'BL_huante-1b5af6ea1315',
  'BL_huante-751feddfad10',
  'BL_huante-89b325fa4057',
  'BL_huante-e6259b74de85',
  'BL_sbvsbb-1e02e7a910d2',
  'BL_sbvsbb-70589cdc8c57',
  'BL_sbvsbb-a1005fb9d5fc',
  'BL_sbvsbb-eec979aba835',
  'BL_uo-52885ee4dcaa',
  'BL_vslimp-3db30f4f4a76',
  'BL_vslimp-65b56e85a731',
  'BL_vslimp-c0f6c22ff0c8'
];

describe('empty trainer charts (17)', () => {
  it('every listed chart exists with 169 reconstructed cells and a source image', () => {
    for (const id of EMPTY_ADAPTER_SOURCE) {
      const chart = getChartById(id);
      assert.ok(chart, id);
      const loaded = getTrainerChartHands(id);
      assert.equal(Object.keys(loaded?.hands || {}).length, 169, id);
      assert.ok(chart.provenance?.sourceFile || chart.provenance?.path, id);
    }
  });

  it('unexplained empty (missing shard / zero cells) is 0', () => {
    const unexplained = [];
    for (const id of EMPTY_ADAPTER_SOURCE) {
      const loaded = getTrainerChartHands(id);
      const n = Object.keys(loaded?.hands || {}).length;
      if (n === 0) unexplained.push(id);
    }
    assert.deepEqual(unexplained, []);
  });

  it('Battleship zip catalog cannot include these charts', () => {
    for (const id of EMPTY_ADAPTER_SOURCE) {
      const chart = getChartById(id);
      assert.notEqual(chartUoFamily(chart), 'zip', id);
    }
  });

  it('adapter is empty because every cell is mixed or non-gradable, not a missing shard', () => {
    for (const id of EMPTY_ADAPTER_SOURCE) {
      const loaded = getTrainerChartHands(id);
      const pure = Object.values(loaded.hands).filter(
        (h) => !h.isMixed && h.gradingAllowed && canGradeWithTrainerAction(h.actionRaw)
      );
      assert.equal(pure.length, 0, id);
      assert.equal(adaptTrainerChartById(id).ok, false, id);
    }
  });
});
