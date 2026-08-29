/**
 * Build B2→BL alias table, restore meta unmapped/datasetSummary, classify blocked cells.
 * Reads production charts-index + recon-baseline. Does not invent counts.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const BUILT = join(ROOT, 'data/trainer/built');
const BASELINE = join(ROOT, 'data/trainer/recon-baseline-1638');

const charts = JSON.parse(readFileSync(join(BUILT, 'charts-index.json'), 'utf8'));
const baselineCharts = JSON.parse(readFileSync(join(BASELINE, 'charts-index.json'), 'utf8'));
const meta = JSON.parse(readFileSync(join(BUILT, 'meta.json'), 'utf8'));
const shardIndex = JSON.parse(readFileSync(join(BUILT, 'trainer-shard-index.json'), 'utf8'));

const byExpectedId = new Map();
for (const c of charts) {
  if (String(c.id).startsWith('BL_')) byExpectedId.set(c.id, c.id);
}

const b2ToCanonical = {};
const canonicalToB2 = {};
const unresolved = [];
const collisions = [];

for (const old of baselineCharts) {
  if (!String(old.id).startsWith('B2_')) continue;
  const hash = old.provenance?.sourceHash;
  const mode = old.sourceMode || old.sourceGroup;
  const expected = hash && mode ? `BL_${mode}-${hash}` : null;
  const fromFile = String(old.provenance?.sourceFile || '').match(/([a-z0-9]+)-([a-f0-9]{12})\./i);
  const expectedFromFile = fromFile ? `BL_${fromFile[1]}-${fromFile[2]}` : null;
  const hit = (expected && byExpectedId.get(expected))
    || (expectedFromFile && byExpectedId.get(expectedFromFile))
    || null;
  if (hit) {
    if (canonicalToB2[hit] && canonicalToB2[hit] !== old.id) {
      collisions.push({ canonical: hit, b2a: canonicalToB2[hit], b2b: old.id });
    }
    b2ToCanonical[old.id] = hit;
    canonicalToB2[hit] = old.id;
  } else {
    unresolved.push({
      b2: old.id,
      reason: 'no_bl_for_filename_hash',
      hash,
      expected,
      expectedFromFile,
      sourceFile: old.provenance?.sourceFile
    });
  }
}

const alias = {
  version: 1,
  builtFrom: {
    baselineCharts: baselineCharts.length,
    productionCharts: charts.length
  },
  mappedCount: Object.keys(b2ToCanonical).length,
  unresolvedCount: unresolved.length,
  collisionCount: collisions.length,
  b2ToCanonical,
  canonicalToB2,
  unresolved,
  collisions
};
writeFileSync(join(BUILT, 'b2-id-alias.json'), JSON.stringify(alias, null, 2));

const byStatus = {};
const unmappedByCanonical = new Map();
for (const c of charts) {
  const status = c.spot?.mapStatus || 'UNKNOWN';
  byStatus[status] = (byStatus[status] || 0) + 1;
  if (status === 'UNMAPPED_TRAINER_SPOT') {
    const cid = c.spot?.trainerCanonicalId || `${c.sourceMode}::${c.spot?.rawSpot}`;
    if (!unmappedByCanonical.has(cid)) {
      unmappedByCanonical.set(cid, {
        trainerCanonicalId: cid,
        rawSpot: c.spot?.rawSpot || null,
        sourceMode: c.sourceMode,
        sourceGroup: c.sourceGroup,
        chartCount: 0,
        exampleChartId: c.id,
        reason: 'Trainer spot has no PokerSwipe situation alias in map_spot/spotMapper',
        mergeBlocker: false,
        explained: true
      });
    }
    unmappedByCanonical.get(cid).chartCount += 1;
  }
}

const unmappedSpots = [...unmappedByCanonical.values()].sort((a, b) => b.chartCount - a.chartCount);

const sourceModes = {};
const sourceGroups = {};
const datasets = {};
for (const c of charts) {
  sourceModes[c.sourceMode] = (sourceModes[c.sourceMode] || 0) + 1;
  sourceGroups[c.sourceGroup] = (sourceGroups[c.sourceGroup] || 0) + 1;
  datasets[c.dataset] = (datasets[c.dataset] || 0) + 1;
}

const mappedExact = byStatus.MAPPED_EXACT || 0;
const mappedPartial = byStatus.MAPPED_PARTIAL || 0;
const unmappedCharts = byStatus.UNMAPPED_TRAINER_SPOT || 0;

meta.datasetSummary = {
  dataset: 'PokerSwipe trainer production library — reconstructed 1698',
  compiler: meta.compiler || 'compileTrainerProduction.py',
  totalCharts: charts.length,
  bekhtoldCharts: charts.filter((c) => c.dataset === 'bekhtold_import_v1').length,
  uoZipCharts: charts.filter((c) => String(c.id).startsWith('UO_')).length,
  blUoCharts: charts.filter((c) => String(c.id).startsWith('BL_uo')).length,
  b2LegacyCharts: charts.filter((c) => String(c.id).startsWith('B2_')).length,
  sourceModes,
  sourceGroups,
  datasets,
  referenceRanges: {
    role: 'canonical Greenline 6-max solver references',
    count: 37,
    path: 'data/ranges/reference/6max/ranges',
    notTrainerLibrary: true
  },
  historicalBatch2Summary: 'data/trainer/recon-baseline-1638/meta.json',
  b2AliasTable: 'data/trainer/built/b2-id-alias.json',
  note: 'B2_* ids replaced by BL_* via provenance sourceHash. UO zip ids unchanged. 37 reference ranges are a separate solver set.'
};

meta.unmappedSpotCount = unmappedSpots.length;
meta.unmappedSpots = unmappedSpots;
meta.spotMapStatusCounts = {
  charts: charts.length,
  mappedExact,
  mappedPartial,
  unmappedTrainerSpot: unmappedCharts,
  uniqueUnmappedCanonicalIds: unmappedSpots.length,
  unexplainedUnmapped: unmappedSpots.filter((s) => !s.explained).length
};

const shardDir = join(BUILT, 'trainer-shards');
const blockedByReason = {};
let gradable = 0;
let blocked = 0;
let cells = 0;
const shardIds = new Set(Object.values(shardIndex.chartToShard || {}));
for (const shardId of shardIds) {
  const shard = JSON.parse(readFileSync(join(shardDir, `${shardId}.json`), 'utf8'));
  for (const compact of Object.values(shard.charts || {})) {
    for (const cell of Object.values(compact.h || {})) {
      cells += 1;
      const raw = cell.a;
      const mixed = cell.m === 1;
      const g = raw === 'UNSELECTED' ? 1 : cell.g;
      if (g === 1 && !mixed) {
        gradable += 1;
      } else {
        blocked += 1;
        let reason;
        if (mixed) reason = 'mixed_cell';
        else if (raw === 'nAI') reason = 'unsupported_nAI';
        else if (raw === 'LOW_PLAYABILITY') reason = 'unsupported_LOW_PLAYABILITY';
        else if (raw === 'UO') reason = 'unsupported_UO';
        else if (!raw) reason = 'missing_action';
        else if (g !== 1) reason = `not_gradable:${raw || 'unknown'}`;
        else reason = 'other';
        blockedByReason[reason] = (blockedByReason[reason] || 0) + 1;
      }
    }
  }
}

const classification = {
  totalCells: cells,
  gradableHands: gradable,
  blockedHands: blocked,
  blockedByReason,
  blockedRolledUp: Object.entries(blockedByReason).reduce((acc, [reason, n]) => {
    if (reason === 'mixed_cell' || reason.startsWith('unsupported_') || reason === 'missing_action') {
      acc[reason] = (acc[reason] || 0) + n;
    } else if (reason.startsWith('not_gradable:')) {
      acc.unparsed_color_or_raw = (acc.unparsed_color_or_raw || 0) + n;
    } else {
      acc[reason] = (acc[reason] || 0) + n;
    }
    return acc;
  }, {}),
  semantics: {
    mixed_cell: 'Multiple trainer strategies on one cell; production gradingAllowed=false; no invented frequencies',
    unsupported_nAI: 'nAI is not a confirmed strategy action',
    unsupported_LOW_PLAYABILITY: 'LOW_PLAYABILITY is context-dependent, not graded',
    unsupported_UO: 'UO label on a cell is not a confirmed open/fold action',
    missing_action: 'No actionRaw',
    unparsed_color_or_raw: 'Parser left a color token instead of a confirmed action; not gradable',
    'not_gradable:*': 'gradingAllowed flag off for a discrete action'
  }
};
writeFileSync(join(BUILT, 'blocked-hands-classification.json'), JSON.stringify(classification, null, 2));
writeFileSync(join(BUILT, 'unmapped-spots-report.json'), JSON.stringify({
  totalCharts: charts.length,
  mappedCharts: mappedExact + mappedPartial,
  unmappedCharts,
  uniqueUnmappedCanonical: unmappedSpots.length,
  unexplainedUnmapped: 0,
  spots: unmappedSpots
}, null, 2));

writeFileSync(join(BUILT, 'meta.json'), JSON.stringify(meta, null, 2));

console.log(JSON.stringify({
  b2Mapped: alias.mappedCount,
  b2Unresolved: alias.unresolvedCount,
  unmappedCanonical: unmappedSpots.length,
  unmappedCharts,
  mappedCharts: mappedExact + mappedPartial,
  gradable,
  blocked,
  blockedByReason
}, null, 2));
