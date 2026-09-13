/**
 * Unmapped PokerSwipe situation aliases still resolve as trainer charts by ID.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { getChartById, lookupTrainerSpot } from '../trainer-knowledge/lookup.js';
import { adaptTrainerChartById } from '../range-learning/trainerLibrary.js';
import { canonicalItemId } from '../range-learning/itemId.js';
import { chartUoFamily } from '../trainer-knowledge/uoFamily.js';

const report = JSON.parse(readFileSync(new URL('../data/trainer/built/unmapped-spots-report.json', import.meta.url)));

describe('21 aliasless trainer spots', () => {
  it('unexplained unmapped is 0 and every spot has a live chart', () => {
    assert.equal(report.unexplainedUnmapped, 0);
    assert.equal(report.uniqueUnmappedCanonical, 21);
    for (const spot of report.spots) {
      assert.equal(spot.mergeBlocker, false);
      assert.ok(spot.explained);
      assert.ok(spot.exampleChartId.startsWith('BL_'));
      const chart = getChartById(spot.exampleChartId);
      assert.ok(chart, spot.exampleChartId);
      assert.notEqual(chartUoFamily(chart), 'zip');
      const byId = lookupTrainerSpot({ chartId: spot.exampleChartId });
      assert.ok(byId.chart);
      assert.equal(byId.chart.id, spot.exampleChartId);
      const adapted = adaptTrainerChartById(spot.exampleChartId);
      if (adapted.ok) {
        const hand = Object.keys(adapted.range.hands)[0];
        const item = canonicalItemId({
          source: 'trainer',
          rangeId: adapted.range.id,
          hand,
          distribution: adapted.range.hands[hand].actions
        });
        assert.ok(item.includes(spot.exampleChartId));
      }
    }
  });
});
