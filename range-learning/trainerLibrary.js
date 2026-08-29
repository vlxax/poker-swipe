/**
 * Adapt production trainer charts (shards) into Strategy Map ranges.
 * Does not copy JSON into a second library — reads the canonical shard store.
 */

import { listCharts, getTrainerChartHands, getChartById } from '../trainer-knowledge/lookup.js';
import { canonicalRangeId } from '../trainer-knowledge/rangeIdAlias.js';
import { adaptTrainerRange } from './rangeAdapter.js';

export function adaptTrainerChartById(chartId) {
  const resolved = canonicalRangeId(chartId);
  const chart = getChartById(resolved);
  if (!chart) return { ok: false, error: `unknown chart ${chartId}`, range: null };
  const loaded = getTrainerChartHands(resolved);
  if (!loaded?.hands) return { ok: false, error: `no shard hands for ${resolved}`, range: null };
  const handRecords = Object.entries(loaded.hands).map(([hand, rec]) => ({ hand, ...rec }));
  return adaptTrainerRange({
    id: resolved,
    chartId: resolved,
    chartMeta: chart,
    handRecords
  });
}

export function adaptTrainerLibrary(charts = null) {
  const list = charts || listCharts();
  const adapted = [];
  const failed = [];
  for (const chart of list) {
    const result = adaptTrainerChartById(chart.id);
    if (result.ok) adapted.push(result.range);
    else {
      failed.push({ id: chart.id, error: result.error, skippedHands: result.skippedHands });
      adapted.push({
        id: chart.id,
        rangeId: chart.id,
        hands: {},
        metadata: {
          source: 'trainer',
          format: 'trainer',
          heroPosition: chart.heroPosition?.raw || null,
          villainPosition: chart.opponentPosition?.raw || null,
          situation: chart.spot?.rawSpot || chart.sourceMode || 'trainer',
          stack: chart.stack?.raw || null,
          category: chart.sourceMode || 'trainer',
          family: `trainer:${chart.sourceMode || 'unknown'}`,
          missingHandSemantics: 'UNSUPPORTED',
          adapterEmpty: true
        }
      });
    }
  }
  return { adapted, failed };
}
