// Trainer range coverage inventory for Battleship — data-driven, no guessing.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetTrainerCache, lookupTrainerSpot, listCharts } from '../trainer-knowledge/index.js';
import { buildTrainerMatrix } from '../trainer-knowledge/adapters/rangesAdapter.js';
import { MATCH_STATUS } from '../trainer-knowledge/status.js';
import { buildRangeModelFromMatrix } from '../ranges-ui/battleship/trainerRangeModel.js';
import {
  scanBattleshipCoursesNode,
  buildCoverageTable,
  displayPosition
} from '../ranges-ui/battleship/courses.js';

const MIN_GRADABLE_GATE = 140;
const MAX_BLOCKED_GATE = 10;

describe('battleship trainer coverage audit', () => {
  test('inventory + coverage table from built trainer data', async () => {
    resetTrainerCache();
    const lookup = {
      lookupSpot: lookupTrainerSpot,
      lookupHand: async (chartId, hand) => {
        const { lookupTrainerHand } = await import('../trainer-knowledge/lookup.js');
        return lookupTrainerHand({ chartId, hand });
      }
    };
    const allCharts = listCharts();
    const uoCharts = allCharts.filter((c) => c.sourceMode === 'uo');
    const catalog = await scanBattleshipCoursesNode(uoCharts, (sel) => buildTrainerMatrix(lookup, sel));

    const blocked = { gradable: 0, blockedCells: 0, notExact: 0, unsupported: 0 };
    for (const chart of uoCharts) {
      const sel = {
        dataSource: 'trainer',
        position: chart.heroPosition?.raw,
        stackBand: chart.stack?.raw,
        trainerSourceMode: 'uo',
        situation: 'uo_open'
      };
      const matrix = await buildTrainerMatrix(lookup, sel);
      if (matrix.matchStatus !== MATCH_STATUS.EXACT_TRAINER_MATCH) {
        blocked.notExact++;
        continue;
      }
      const model = buildRangeModelFromMatrix(matrix);
      if (!model.supported) {
        blocked.unsupported++;
        continue;
      }
      if (model.gradable < MIN_GRADABLE_GATE) blocked.gradable++;
      if (model.blocked > MAX_BLOCKED_GATE) blocked.blockedCells++;
    }

    const table = buildCoverageTable(catalog);
    console.log('\n=== COVERAGE TABLE ===');
    for (const [pos, stacks] of Object.entries(table)) {
      console.log(`${pos} | ${stacks.join(', ')} | ${stacks.length}`);
    }
    console.log('\nTOTAL UO CHARTS:', uoCharts.length);
    console.log('TOTAL BATTLESHIP-SAFE:', catalog.length);
    console.log('BLOCKED:', blocked);

    assert.ok(uoCharts.length >= 60);
    assert.ok(catalog.length >= 38);
    assert.ok(table.UTG?.length >= 5, 'UTG (EP) should have stacks');
    assert.ok(table.HJ?.length >= 5);
    assert.ok(table.CO?.length >= 5);
    assert.ok(table.BTN?.length >= 5);

    for (const entry of catalog) {
      assert.ok(entry.chartId);
      assert.equal(entry.sourceMode, 'uo');
      assert.ok(entry.gradable >= MIN_GRADABLE_GATE);
      assert.ok(entry.blocked <= MAX_BLOCKED_GATE);
      assert.equal(displayPosition(entry.position), entry.position === 'EP' ? 'UTG' : entry.position);
    }
  });
});
