/**
 * Inventory of production range sources on the combined tree.
 * Does not duplicate range JSON. Reads existing charts-index + reference pack.
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getReferenceRanges } from '../ranges-ui/referenceRanges.js';
import { listCharts, getTrainerMeta, resetTrainerCache } from '../trainer-knowledge/lookup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BUILT = join(ROOT, 'data/trainer/built');

export function getCombinedRangeInventory() {
  const referenceRanges = getReferenceRanges();
  resetTrainerCache();
  const charts = listCharts();
  const meta = getTrainerMeta();
  const byMode = {};
  for (const c of charts) {
    byMode[c.sourceMode] = (byMode[c.sourceMode] || 0) + 1;
  }
  const uoZip = charts.filter((c) => c.id.startsWith('UO_')).length;
  const blUo = charts.filter((c) => String(c.id).startsWith('BL_uo')).length;
  const bekhtold = charts.filter((c) => c.dataset === 'bekhtold_import_v1').length;

  return {
    referenceRanges: referenceRanges.length,
    trainerCharts: charts.length,
    uoZipCharts: uoZip,
    blUoCharts: blUo,
    bekhtoldCharts: bekhtold,
    bySourceMode: byMode,
    metaStats: meta?.stats || {},
    shardIndexPresent: existsSync(join(BUILT, 'trainer-shard-index.json')),
    strategyMapDefaultLibrary: 'reference-6max',
    strategyMapTrainerEligible: charts.length,
    unmappedSpotCount: meta?.unmappedSpotCount ?? meta?.stats?.unmappedSpotCount ?? null
  };
}

export function countTrainerGradableHands() {
  const idxPath = join(BUILT, 'trainer-shard-index.json');
  if (!existsSync(idxPath)) return { charts: 0, gradableHands: 0, blockedHands: 0 };
  const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
  const shardDir = join(BUILT, 'trainer-shards');
  let gradable = 0;
  let blocked = 0;
  let charts = 0;
  const shardIds = new Set(Object.values(idx.chartToShard || {}));
  for (const shardId of shardIds) {
    const p = join(shardDir, `${shardId}.json`);
    if (!existsSync(p)) continue;
    const shard = JSON.parse(readFileSync(p, 'utf8'));
    for (const compact of Object.values(shard.charts || {})) {
      charts += 1;
      const hands = compact.h || {};
      for (const cell of Object.values(hands)) {
        const raw = cell.a;
        const g = raw === 'UNSELECTED' ? 1 : cell.g;
        if (g === 1) gradable += 1;
        else blocked += 1;
      }
    }
  }
  return { charts, gradableHands: gradable, blockedHands: blocked, shardCount: shardIds.size };
}
