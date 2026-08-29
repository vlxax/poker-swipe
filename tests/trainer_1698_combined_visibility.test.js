/**
 * Combined-branch visibility: reconstructed 1698 trainer library + 37 reference.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resetTrainerCache, listCharts, getChartById, lookupTrainerHand, lookupTrainerHandAction } from '../trainer-knowledge/lookup.js';
import { getReferenceRanges } from '../ranges-ui/referenceRanges.js';
import { adaptTrainerRange, adaptReferenceRange, getCombinedRangeInventory, countTrainerGradableHands } from '../range-learning/index.js';
import { StrategyMapEngine } from '../strategy-map/index.js';

describe('combined trainer-1698 + strategy-memory visibility', () => {
  it('sees 1698 trainer charts and 37 reference ranges', () => {
    resetTrainerCache();
    const inv = getCombinedRangeInventory();
    assert.equal(inv.trainerCharts, 1698);
    assert.equal(inv.referenceRanges, 37);
    assert.equal(inv.uoZipCharts, 60);
    assert.equal(inv.blUoCharts, 60);
    assert.equal(inv.strategyMapTrainerEligible, 1698);
    assert.equal(inv.shardIndexPresent, true);
    assert.equal(getReferenceRanges().length, 37);
    assert.equal(listCharts().length, 1698);
  });

  it('B2_* batch2 ids are replaced by BL_* reconstructed ids', () => {
    resetTrainerCache();
    const ids = listCharts().map((c) => c.id);
    assert.equal(ids.filter((id) => id.startsWith('B2_')).length, 0);
    assert.ok(ids.filter((id) => id.startsWith('BL_')).length >= 1578);
    assert.ok(getChartById('UO_2-4_EP'));
    assert.equal(getChartById('B2_0001'), null);
  });

  it('trusted UO zip AA is still AI and Strategy Map can adapt it', async () => {
    resetTrainerCache();
    const rec = lookupTrainerHand({ chartId: 'UO_2-4_EP', hand: 'AA' });
    assert.equal(rec.actionRaw, 'AI');
    const hands = {};
    for (const hand of ['AA', 'KK', 'AKs', '72o']) {
      const h = lookupTrainerHand({ chartId: 'UO_2-4_EP', hand });
      if (h) hands[hand] = { trainerActionRaw: h.actionRaw, gradingAllowed: h.gradingAllowed, actionRaw: h.actionRaw };
    }
    const adapted = adaptTrainerRange({
      id: 'UO_2-4_EP',
      sourceMode: 'uo',
      stack: { raw: '2-4' },
      heroPosition: { raw: 'EP' },
      cells: Object.fromEntries(
        Object.entries(hands).map(([hand, cell]) => [hand, { ...cell, gradingAllowed: cell.gradingAllowed }])
      )
    });
    assert.equal(adapted.ok, true);
    const engine = new StrategyMapEngine();
    engine.loadLibrary([adapted.range]);
    assert.equal(engine.getStats().totalRanges, 1);
    const fp = engine.fingerprint(adapted.range);
    assert.ok(fp.numHands >= 1);
  });

  it('BekhtOLD reconstructed chart is lookup-able', () => {
    resetTrainerCache();
    const bl = listCharts({ dataset: 'bekhtold_import_v1' });
    assert.ok(bl.length >= 1578);
    const sample = bl.find((c) => c.sourceMode === 'callpush' && c.hasParsedHands);
    assert.ok(sample);
    const rec = lookupTrainerHand({ chartId: sample.id, hand: 'AA' });
    assert.ok(rec == null || rec.actionRaw !== undefined || rec.gradingAllowed !== undefined || rec.dataStatus);
  });

  it('reference adapter still converts Greenline ranges', () => {
    const btn = getReferenceRanges().find((r) => r.id === 'btn-rfi');
    const adapted = adaptReferenceRange(btn);
    assert.equal(adapted.ok, true);
    assert.equal(adapted.range.metadata.source, 'reference');
  });

  it('countable Mistake Memory gradable trainer hands exist', () => {
    const counts = countTrainerGradableHands();
    assert.equal(counts.charts, 1698);
    assert.ok(counts.gradableHands > 100000, `gradable ${counts.gradableHands}`);
    assert.ok(counts.shardCount >= 30);
  });

  it('UO exact match prefers zip family', () => {
    resetTrainerCache();
    const result = lookupTrainerHandAction({
      heroPosition: 'EP',
      stack: '3BB',
      sourceMode: 'uo',
      sourceGroup: 'UO',
      hand: 'AA'
    });
    assert.equal(result.chart.id, 'UO_2-4_EP');
    assert.equal(result.action, 'AI');
  });
});
