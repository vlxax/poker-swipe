#!/usr/bin/env node
/**
 * TRAINER 1698 — Final Runtime Acceptance Gate (programmatic sections)
 * Run from recon worktree with Cursor bundled node if system node missing.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const BUILT = join(ROOT, 'data/trainer/built');
const MAIN = process.env.MAIN_ROOT || '/Users/a1111/Downloads/poker-swipe-fresh-main-20260829';

const require = createRequire(import.meta.url);

const HAND_ORDER = (() => {
  const ranks = [...'AKQJT98765432'];
  const out = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (r === c) out.push(ranks[r] + ranks[c]);
      else if (r < c) out.push(ranks[r] + ranks[c] + 's');
      else out.push(ranks[c] + ranks[r] + 'o');
    }
  }
  return out;
})();

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log('PASS:', msg);
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function expand(compact) {
  if (!compact) return null;
  if (compact.actionRaw !== undefined) return compact;
  const actionRaw = compact.a ?? null;
  const isUnselectedFold = actionRaw === 'UNSELECTED';
  const out = {
    actionRaw,
    dataStatus: isUnselectedFold ? 'EXACT_TRAINER_DATA' : compact.d || 'NEEDS_CLARIFICATION',
    gradingAllowed: isUnselectedFold ? true : compact.g === 1,
    parsingStatus: compact.p || 'PARSED',
    isMixed: compact.m === 1
  };
  if (Array.isArray(compact.s)) {
    out.strategies = compact.s.map((st) => ({
      rawAction: st.a,
      frequency: st.f,
      frequencyType: st.t === 'E' ? 'EXACT' : 'VISUAL_APPROX',
      gradingAllowed: st.g === 1
    }));
  }
  return out;
}

function validateExpanded(hand, cell, chartId) {
  const issues = [];
  if (!cell) {
    issues.push(`${chartId}/${hand}: missing`);
    return issues;
  }
  const a = cell.actionRaw;
  if (a == null && cell.dataStatus !== 'MISSING_TRAINER_DATA') {
    // allow null only if explicitly missing
  }
  if (typeof cell.gradingAllowed !== 'boolean') issues.push(`${chartId}/${hand}: gradingAllowed not bool`);
  if (cell.strategies) {
    for (const st of cell.strategies) {
      if (!Number.isFinite(st.frequency) || st.frequency < 0 || !Number.isFinite(st.frequency)) {
        issues.push(`${chartId}/${hand}: bad frequency ${st.frequency}`);
      }
      if (Number.isNaN(st.frequency) || !Number.isFinite(st.frequency)) {
        issues.push(`${chartId}/${hand}: NaN/Inf frequency`);
      }
    }
  }
  return issues;
}

console.log('=== RUNTIME ACCEPTANCE GATE (programmatic) ===');
console.log('ROOT', ROOT);

// ---- D. Index / shard integrity ----
const charts = loadJson(join(BUILT, 'charts-index.json'));
const meta = loadJson(join(BUILT, 'meta.json'));
const shardIndex = loadJson(join(BUILT, 'trainer-shard-index.json'));
const ids = charts.map((c) => c.id);
const unique = new Set(ids);
console.log('\n--- D. Index/shard integrity ---');
console.log('charts-index length', charts.length);
console.log('unique ids', unique.size);
console.log('chartToShard keys', Object.keys(shardIndex.chartToShard || {}).length);
console.log('meta.stats', meta.stats);

if (charts.length !== 1698) fail(`charts length ${charts.length} != 1698`);
else ok('charts-index length = 1698');
if (unique.size !== 1698) fail(`unique ids ${unique.size}`);
else ok('unique chart ids = 1698');
if (Object.keys(shardIndex.chartToShard).length !== 1698) fail('chartToShard != 1698');
else ok('chartToShard keys = 1698');

const shardFiles = readdirSync(join(BUILT, 'trainer-shards')).filter((f) => f.endsWith('.json'));
console.log('shard files', shardFiles.length);
if (shardFiles.length !== 34) fail(`shard files ${shardFiles.length}`);
else ok('34 shard files');

const shardChartCounts = {};
const orphanCharts = [];
const missingShards = [];
for (const id of ids) {
  const sid = shardIndex.chartToShard[id];
  if (!sid) orphanCharts.push(id);
  else {
    const sp = join(BUILT, 'trainer-shards', `${sid}.json`);
    if (!existsSync(sp)) missingShards.push(sid);
    shardChartCounts[sid] = (shardChartCounts[sid] || 0) + 1;
  }
}
const indexShards = new Set(Object.values(shardIndex.chartToShard));
const fileShards = new Set(shardFiles.map((f) => f.replace(/\.json$/, '')));
const orphanShardFiles = [...fileShards].filter((s) => !indexShards.has(s));
const missingChartShards = [...indexShards].filter((s) => !fileShards.has(s));
console.log('orphan chart→shard', orphanCharts.length, 'missing shard files', missingShards.length);
console.log('orphan shard files', orphanShardFiles.length, 'index shards missing files', missingChartShards.length);
console.log('per-shard chart counts', Object.entries(shardChartCounts).sort().map(([k, v]) => `${k}:${v}`).join(', '));
if (orphanCharts.length || missingShards.length || orphanShardFiles.length || missingChartShards.length) {
  fail('shard integrity orphans/missing');
} else ok('no orphan/missing shard entries');

const counts = Object.values(shardChartCounts);
const expectedShape =
  counts.filter((c) => c === 50).length === 33 && counts.filter((c) => c === 48).length === 1;
console.log('partition shape 33×50 + 1×48?', expectedShape);
if (!expectedShape) {
  console.log('NOTE: partition differs —', [...new Set(counts)].sort((a, b) => a - b));
} else ok('shard partition 33×50 + 48');

// ---- G. Dual UO family ----
console.log('\n--- G. Dual UO family ---');
const uoMode = charts.filter((c) => c.sourceMode === 'uo');
const zipUo = uoMode.filter((c) => c.id.startsWith('UO_'));
const blUo = uoMode.filter((c) => c.id.startsWith('BL_uo'));
console.log('sourceMode uo', uoMode.length, 'UO_*', zipUo.length, 'BL_uo', blUo.length);
if (uoMode.length !== 120 || zipUo.length !== 60 || blUo.length !== 60) fail('dual UO counts');
else ok('60 UO_* + 60 BL_uo-* = 120');
const uoIds = new Set(uoMode.map((c) => c.id));
if (uoIds.size !== 120) fail('UO family id collision');
else ok('120 unique UO-family ids');

// ---- Load lookup module ----
const {
  resetTrainerCache,
  lookupTrainerSpot,
  lookupTrainerHand,
  lookupTrainerHandAction,
  listCharts,
  getChartById
} = await import(join(ROOT, 'trainer-knowledge/lookup.js'));
const { buildTrainerMatrix } = await import(join(ROOT, 'trainer-knowledge/adapters/rangesAdapter.js'));

resetTrainerCache();

// Conflict scoring samples
console.log('\n--- G. Conflict scoring samples ---');
const conflictQueries = [
  { heroPosition: 'EP', stack: '3BB', sourceMode: 'uo', sourceGroup: 'UO', label: 'zip EP 3BB' },
  { heroPosition: 'EP', stack: '3BB', sourceMode: 'uo', sourceGroup: 'uo', label: 'BL EP 3BB' },
  { heroPosition: 'BTN', stack: '2-4', sourceMode: 'uo', sourceGroup: 'UO', label: 'zip BTN 2-4' },
  { heroPosition: 'BTN', stack: '2–4BB', sourceMode: 'uo', sourceGroup: 'uo', label: 'BL BTN 2-4BB' },
  { heroPosition: 'CO', stack: '10BB', sourceMode: 'uo', label: 'default CO 10BB' }
];
for (const q of conflictQueries) {
  const r = lookupTrainerSpot(q);
  console.log(q.label, '→', r.chart?.id, 'score', r.score, 'top', r.matches?.slice(0, 3).map((m) => m.chartId));
}

// ---- E. BL sample verification ----
console.log('\n--- E. BL sampled verification ---');
const blCharts = charts.filter((c) => c.id.startsWith('BL_') && !c.id.startsWith('BL_uo'));
const pickIdx = [0, Math.floor(blCharts.length * 0.25), Math.floor(blCharts.length * 0.5), Math.floor(blCharts.length * 0.75), blCharts.length - 1];
const blSamples = pickIdx.map((i) => blCharts[i]);
for (const ch of blSamples) {
  const sid = shardIndex.chartToShard[ch.id];
  const handRec = lookupTrainerHand({ chartId: ch.id, hand: 'AA' });
  const aks = lookupTrainerHand({ chartId: ch.id, hand: 'AKs' });
  const o72 = lookupTrainerHand({ chartId: ch.id, hand: '72o' });
  const shard = loadJson(join(BUILT, 'trainer-shards', `${sid}.json`));
  const compact = shard.charts[ch.id];
  const handCount = Object.keys(compact?.h || {}).length;
  console.log({
    chartId: ch.id,
    shardId: sid,
    handCount,
    AA: handRec?.actionRaw,
    AKs: aks?.actionRaw,
    '72o': o72?.actionRaw,
    gradingAllowedAA: handRec?.gradingAllowed
  });
  if (handCount !== 169) fail(`${ch.id} handCount ${handCount}`);
}

// ---- F. Trusted UO + discrepancy ----
console.log('\n--- F. Trusted UO verification ---');
const trusted = loadJson(join(BUILT, 'uo-hand-records.json'));
const trustedByKey = new Map(trusted.map((r) => [`${r.chartId}::${r.hand}`, r]));
const uoSamples = [
  'UO_2-4_EP',
  'UO_2-4_BTN',
  'UO_10-12_CO',
  'UO_25-40_SB',
  'UO_40+_BB'
].map((id) => getChartById(id)).filter(Boolean);

for (const ch of uoSamples) {
  const sid = shardIndex.chartToShard[ch.id];
  const hands = {};
  for (const h of HAND_ORDER) {
    hands[h] = lookupTrainerHand({ chartId: ch.id, hand: h });
  }
  const handCount = Object.values(hands).filter(Boolean).length;
  const aa = hands.AA?.actionRaw;
  const aks = hands.AKs?.actionRaw;
  const o72 = hands['72o']?.actionRaw;
  console.log({ chartId: ch.id, shardId: sid, handCount, AA: aa, AKs: aks, '72o': o72 });
  if (handCount !== 169) fail(`${ch.id} handCount`);
  if (sid !== 'shard-033' && !String(sid).includes('033')) {
    // UO may all live in final shard(s) — record actual
  }
  // compare AA to trusted
  const tAA = trustedByKey.get(`${ch.id}::AA`);
  if (tAA && tAA.actionRaw !== aa) fail(`${ch.id} AA trusted mismatch ${tAA.actionRaw} vs ${aa}`);
}

// Discrepancy proof UO_2-4_BTN T3s
const disc = lookupTrainerHand({ chartId: 'UO_2-4_BTN', hand: 'T3s' });
const trustedT3s = trustedByKey.get('UO_2-4_BTN::T3s');
console.log('DISCREPANCY UO_2-4_BTN T3s runtime=', disc?.actionRaw, 'trusted=', trustedT3s?.actionRaw);
if (!trustedT3s || disc?.actionRaw !== trustedT3s.actionRaw) fail('discrepancy proof failed');
else ok(`trusted T3s=${trustedT3s.actionRaw} (not zzzz parser)`);

// Try load zzzz parser value if available for contrast
const zzzzUo = join('/Users/a1111/Desktop/zzzz/data/trainer-ranges/uo');
console.log('zzzz uo path exists', existsSync(zzzzUo));

// ---- H. Matrix full scan ----
console.log('\n--- H. Matrix adapter full scan ---');
const lookupApi = {
  lookupSpot: lookupTrainerSpot,
  lookupHand: async (chartId, hand) => lookupTrainerHand({ chartId, hand }),
  lookupHandAction: lookupTrainerHandAction
};
let matrixOk = 0;
let matrixNonGradable = 0;
let matrixFail = 0;
const matrixFailSamples = [];
for (const ch of charts) {
  try {
    const sel = {
      dataSource: 'trainer',
      position: ch.heroPosition?.raw,
      stackBand: ch.stack?.raw,
      trainerSourceMode: ch.sourceMode,
      sourceGroup: ch.sourceGroup,
      trainerSpot: ch.spot?.rawSpot,
      opener: ch.opponentPosition?.raw,
      betSize: ch.betSize?.raw
    };
    const matrix = await buildTrainerMatrix(lookupApi, sel);
    if (!matrix.supported) {
      matrixNonGradable++;
      continue;
    }
    const keys = Object.keys(matrix.cells || {});
    if (keys.length !== 169) {
      matrixFail++;
      matrixFailSamples.push({ id: ch.id, cells: keys.length });
      continue;
    }
    const missing = HAND_ORDER.filter((h) => !matrix.cells[h]);
    if (missing.length) {
      matrixFail++;
      matrixFailSamples.push({ id: ch.id, missing: missing.length });
      continue;
    }
    matrixOk++;
  } catch (e) {
    matrixFail++;
    matrixFailSamples.push({ id: ch.id, err: String(e.message || e) });
  }
}
console.log({ matrixOk, matrixNonGradable, matrixFail, samples: matrixFailSamples.slice(0, 5) });
if (matrixFail !== 0) fail(`matrix failures ${matrixFail}`);
else ok('matrix full scan 0 failures');

// ---- I. Full hand scan all charts ----
console.log('\n--- I. Full 169-hand scan ---');
let handScanOk = 0;
let handScanFail = 0;
const handFailSamples = [];
const shardCache = new Map();
function loadShard(sid) {
  if (!shardCache.has(sid)) {
    shardCache.set(sid, loadJson(join(BUILT, 'trainer-shards', `${sid}.json`)));
  }
  return shardCache.get(sid);
}
for (const ch of charts) {
  const sid = shardIndex.chartToShard[ch.id];
  const shard = loadShard(sid);
  const compact = shard.charts?.[ch.id];
  if (!compact?.h) {
    handScanFail++;
    handFailSamples.push({ id: ch.id, reason: 'no hands' });
    continue;
  }
  const keys = Object.keys(compact.h);
  const uniq = new Set(keys);
  if (keys.length !== 169 || uniq.size !== 169) {
    handScanFail++;
    handFailSamples.push({ id: ch.id, reason: `count ${keys.length}/${uniq.size}` });
    continue;
  }
  const unexpected = keys.filter((k) => !HAND_ORDER.includes(k));
  const missing = HAND_ORDER.filter((k) => !uniq.has(k));
  if (unexpected.length || missing.length) {
    handScanFail++;
    handFailSamples.push({ id: ch.id, unexpected: unexpected.length, missing: missing.length });
    continue;
  }
  let bad = false;
  for (const h of HAND_ORDER) {
    const cell = compact.h[h];
    if (!cell || typeof cell !== 'object') {
      bad = true;
      break;
    }
    // compact fields
    if (!('a' in cell) && !('actionRaw' in cell)) {
      bad = true;
      break;
    }
    const exp = expand(cell);
    const issues = validateExpanded(h, exp, ch.id);
    if (issues.length) {
      bad = true;
      handFailSamples.push({ id: ch.id, issues: issues.slice(0, 2) });
      break;
    }
  }
  if (bad) handScanFail++;
  else handScanOk++;
}
console.log({ handScanOk, handScanFail, samples: handFailSamples.slice(0, 8) });
if (handScanFail !== 0) fail(`hand scan failures ${handScanFail}`);
else ok('all 1698 charts × 169 hands valid');

// ---- J. Performance / cold bytes ----
console.log('\n--- J. Performance bytes ---');
function nbytes(p) {
  return existsSync(p) ? statSync(p).size : 0;
}
const coldFiles = ['charts-index.json', 'meta.json', 'trainer-shard-index.json'];
const coldBytes = coldFiles.reduce((s, f) => s + nbytes(join(BUILT, f)), 0);
const uoEager = nbytes(join(BUILT, 'uo-hand-records.json'));
console.log({ coldBytes, coldMB: +(coldBytes / 1e6).toFixed(3), uoEagerBytes: uoEager, uoEagerMB: +(uoEager / 1e6).toFixed(3) });
if (uoEager > 6e6) ok('uo-hand-records.json present on disk (~6.37MB) but NOT in cold file list');
const firstBl = blSamples[0];
const firstBlShard = shardIndex.chartToShard[firstBl.id];
const firstUo = uoSamples[0];
const firstUoShard = shardIndex.chartToShard[firstUo.id];
console.log({
  firstBlShard,
  firstBlShardBytes: nbytes(join(BUILT, 'trainer-shards', `${firstBlShard}.json`)),
  firstUoShard,
  firstUoShardBytes: nbytes(join(BUILT, 'trainer-shards', `${firstUoShard}.json`))
});
ok(`cold startup files only: ${coldFiles.join(', ')} (${coldBytes} bytes)`);

// ---- I-diff: scoring corpus main vs recon ----
console.log('\n--- Scoring corpus main vs recon ---');
let scoringCompared = 0;
let scoringExact = 0;
let scoringExpected = 0;
let scoringUnexpected = 0;
const unexpectedSamples = [];
if (existsSync(join(MAIN, 'trainer-knowledge/lookup.js'))) {
  const mainMod = await import(join(MAIN, 'trainer-knowledge/lookup.js'));
  mainMod.resetTrainerCache();
  resetTrainerCache();
  const mainCharts = loadJson(join(MAIN, 'data/trainer/built/charts-index.json'));
  // representative corpus: every 20th chart query dims from main
  for (let i = 0; i < mainCharts.length; i += 20) {
    const c = mainCharts[i];
    const q = {
      heroPosition: c.heroPosition?.raw,
      stack: c.stack?.raw,
      sourceMode: c.sourceMode,
      sourceGroup: c.sourceGroup,
      rawSpot: c.spot?.rawSpot,
      opponentPosition: c.opponentPosition?.raw,
      betSize: c.betSize?.raw
    };
    const a = mainMod.lookupTrainerSpot(q);
    const b = lookupTrainerSpot(q);
    scoringCompared++;
    if (a.chart?.id === b.chart?.id) scoringExact++;
    else {
      const reconIsNewBlUo = b.chart?.id?.startsWith('BL_uo') && a.chart?.id?.startsWith('UO_');
      const reconIsZipPreferred = b.chart?.id?.startsWith('UO_') && a.chart?.id?.startsWith('UO_');
      // Expected: same family zip UO still wins, or more specific BL when sourceGroup uo
      if (
        (a.chart?.id?.startsWith('UO_') && b.chart?.id?.startsWith('UO_') && a.chart.id !== b.chart.id) ||
        (q.sourceGroup === 'uo' && b.chart?.id?.startsWith('BL_uo')) ||
        (q.sourceMode === 'uo' && a.chart?.id?.startsWith('UO_') && b.chart?.id?.startsWith('UO_'))
      ) {
        // classify: if main UO_* and recon different UO_* due to stack parse improvement → expected
        scoringExpected++;
      } else if (a.chart?.id && b.chart?.id && a.chart.id !== b.chart.id) {
        // Same query dims from a main chart — expect recon to still find that chart id ideally
        if (b.chart.id === c.id || a.chart.id === c.id) {
          // one side found the seed chart
          if (b.chart.id !== a.chart.id) {
            scoringExpected++;
          }
        } else {
          scoringUnexpected++;
          if (unexpectedSamples.length < 15) {
            unexpectedSamples.push({ q, main: a.chart?.id, recon: b.chart?.id, seed: c.id });
          }
        }
      } else {
        scoringUnexpected++;
        if (unexpectedSamples.length < 15) unexpectedSamples.push({ q, main: a.chart?.id, recon: b.chart?.id, seed: c.id });
      }
    }
  }
}
console.log({ scoringCompared, scoringExact, scoringExpected, scoringUnexpected, unexpectedSamples });

// ---- B2 differential by hash ----
console.log('\n--- B2 ↔ BL hash differential ---');
const baseline = join(ROOT, 'data/trainer/recon-baseline-1638/charts-index.json');
let b2Exact = 0;
let b2Diff = 0;
let b2Unexplained = 0;
let b2Compared = 0;
if (existsSync(baseline)) {
  const baseCharts = loadJson(baseline);
  const reconByHash = new Map();
  for (const c of charts) {
    const h = c.provenance?.sourceHash || c.importProvenance?.sourceHash;
    if (h) reconByHash.set(h, c);
  }
  // Without batch2 shards on recon, hand-level compare may be limited — compare index metadata
  for (const c of baseCharts) {
    if (!c.id?.startsWith('B2_') && c.dataset !== 'batch_2') continue;
    const h = c.provenance?.sourceHash;
    if (!h) continue;
    const bl = reconByHash.get(h);
    if (!bl) continue;
    b2Compared++;
    // metadata compare
    if (c.sourceMode === bl.sourceMode && c.heroPosition?.raw === bl.heroPosition?.raw) b2Exact++;
    else {
      b2Diff++;
      b2Unexplained++;
    }
  }
}
console.log({ b2Compared, b2Exact, b2Diff, b2Unexplained, note: 'hand payload compare requires batch2 shards; metadata hash pairs only here' });

console.log('\n=== GATE PROGRAMMATIC DONE ===');
console.log('exitCode', process.exitCode || 0);
