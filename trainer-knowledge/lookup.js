// Dimension-based trainer lookup — indexes loaded lazily, no image decoding at runtime.

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { MATCH_STATUS, TRAINER_STATUS, canGradeWithTrainerAction } from './status.js';
import { parseTrainerPosition, positionMatchKind } from './positionParser.js';
import { mapTrainerSpot } from './spotMapper.js';
import { trainerProvenance } from './provenance.js';
import { matchQueryToRecord, parseTrainerStack } from './stackParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BUILT_DIR = join(ROOT, 'data/trainer/built');

let _cache = null;
let _shardIndex = null;
let _shardCache = new Map();
let _chartHandsCache = new Map();

function expandCompactHand(compact) {
  if (!compact) return null;
  if (compact.actionRaw !== undefined) return compact; // already expanded
  const actionRaw = compact.a ?? null;
  const isUnselectedFold = actionRaw === 'UNSELECTED';
  const out = {
    actionRaw,
    dataStatus: isUnselectedFold
      ? TRAINER_STATUS.EXACT_TRAINER_DATA
      : compact.d || 'NEEDS_CLARIFICATION',
    gradingAllowed: isUnselectedFold ? true : compact.g === 1,
    parsingStatus: compact.p || 'PARSED',
    isMixed: compact.m === 1
  };
  if (Array.isArray(compact.s)) {
    out.strategies = compact.s.map((st) => ({
      rawAction: st.a,
      frequency: st.f,
      frequencyType: st.t === 'E' ? 'EXACT' : 'VISUAL_APPROX',
      gradingAllowed: st.g === 1,
      dataStatus: st.g === 1 ? TRAINER_STATUS.EXACT_TRAINER_DATA : TRAINER_STATUS.NEEDS_CLARIFICATION
    }));
  }
  return out;
}

function loadShardIndex() {
  if (_shardIndex) return _shardIndex;
  const path = join(BUILT_DIR, 'trainer-shard-index.json');
  if (!existsSync(path)) return null;
  _shardIndex = JSON.parse(readFileSync(path, 'utf8'));
  return _shardIndex;
}

function loadChartFromShard(chartId) {
  if (_chartHandsCache.has(chartId)) return _chartHandsCache.get(chartId);
  const index = loadShardIndex();
  if (!index?.chartToShard) return null;
  const shardId = index.chartToShard[chartId];
  if (!shardId) return null;
  if (!_shardCache.has(shardId)) {
    const shardPath = join(BUILT_DIR, 'trainer-shards', `${shardId}.json`);
    if (!existsSync(shardPath)) return null;
    const shard = JSON.parse(readFileSync(shardPath, 'utf8'));
    _shardCache.set(shardId, shard.charts || {});
  }
  const compact = _shardCache.get(shardId)[chartId];
  if (!compact?.h) return null;
  const hands = {};
  for (const [hand, cell] of Object.entries(compact.h)) {
    hands[hand] = expandCompactHand(cell);
  }
  const chart = { chartId, hands, parseStatus: compact.ps, parseStats: compact.st };
  _chartHandsCache.set(chartId, chart);
  return chart;
}

function loadBuilt() {
  if (_cache) return _cache;
  const chartsPath = join(BUILT_DIR, 'charts-index.json');
  const metaPath = join(BUILT_DIR, 'meta.json');
  if (!existsSync(chartsPath)) {
    throw new Error(
      'Trainer knowledge not built. Run: python3 trainer-knowledge/scripts/compileTrainerProduction.py'
    );
  }
  const byIdPath = join(BUILT_DIR, 'indexes/by-id.json');
  _cache = {
    charts: JSON.parse(readFileSync(chartsPath, 'utf8')),
    meta: existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {},
    indexes: existsSync(byIdPath) ? JSON.parse(readFileSync(byIdPath, 'utf8')) : {}
  };
  return _cache;
}

export function resetTrainerCache() {
  _cache = null;
  _shardIndex = null;
  _shardCache = new Map();
  _chartHandsCache = new Map();
}

export function getTrainerMeta() {
  return loadBuilt().meta;
}

export function getChartById(chartId) {
  const { charts } = loadBuilt();
  return charts.find((c) => c.id === chartId) || null;
}

export function listCharts(filter = {}) {
  const { charts } = loadBuilt();
  return charts.filter((c) => matchesChartFilter(c, filter));
}

function matchesChartFilter(chart, filter) {
  if (filter.sourceMode && chart.sourceMode !== filter.sourceMode) return false;
  if (filter.dataset && chart.dataset !== filter.dataset) return false;
  if (filter.stack && chart.stack?.raw !== filter.stack) return false;
  if (filter.sourceGroup && chart.sourceGroup !== filter.sourceGroup) return false;
  if (filter.trainerCanonicalId && chart.spot?.trainerCanonicalId !== filter.trainerCanonicalId) return false;
  return true;
}

function stackMatch(queryStack, recordStack) {
  if (!queryStack || !recordStack) return 'unknown';
  const q = String(queryStack).trim();
  const rRaw = recordStack.raw || String(recordStack).trim();
  if (q === rRaw) return 'exact';

  const qSem = parseTrainerStack(q);
  // Always re-parse raw: compile-time semantics may be UNKNOWN for unicode-dash stacks.
  const rSem = parseTrainerStack(rRaw);

  if (qSem.type === 'EXACT') {
    const kind = matchQueryToRecord(qSem.bb, rSem);
    return kind === 'none' ? 'none' : kind;
  }

  // Non-exact query against record — raw equality or equivalent band labels
  if (qSem.raw === rSem.raw) return 'exact';
  if (
    (qSem.type === 'RANGE' || qSem.type === 'MINIMUM') &&
    qSem.type === rSem.type &&
    qSem.minBb === rSem.minBb &&
    qSem.maxBb === rSem.maxBb
  ) {
    return 'exact';
  }
  return 'none';
}

/** Dual UO family: prefer UO_* (zip) vs BL_uo-* (BekhtOLD) without cross-stealing. */
function familyPreference(chart, query) {
  const id = chart.id || '';
  const isZipUo = id.startsWith('UO_');
  const isBlUo = id.startsWith('BL_uo');
  if (query.sourceGroup === 'UO') return isZipUo ? 2 : isBlUo ? -2 : 0;
  if (query.sourceGroup === 'uo') return isBlUo ? 2 : isZipUo ? -2 : 0;
  // Default (incl. brain queries with no sourceMode): trusted zip UO_* wins over BL_uo-*.
  if (isZipUo) return 1;
  if (isBlUo) return -1;
  return 0;
}

function opponentMatch(queryOpp, recordOpp) {
  if (!queryOpp && !recordOpp) return 'exact';
  if (!queryOpp || !recordOpp) return 'partial';
  const q = String(queryOpp).toUpperCase();
  const r = String(recordOpp.raw || recordOpp).toUpperCase();
  if (q === r) return 'exact';
  if (r.includes(q) || q.includes(r)) return 'group';
  return 'none';
}

function sizingMatch(queryBet, recordBet) {
  if (!queryBet && !recordBet) return 'exact';
  if (!queryBet || !recordBet) return 'partial';
  const q = String(queryBet).trim();
  const r = String(recordBet.raw || recordBet).trim();
  if (q === r) return 'exact';
  return 'none';
}

function scoreChartMatch(chart, query) {
  const mismatches = [];
  let score = 0;

  const posKind = positionMatchKind(query.heroPosition, chart.heroPosition?.raw);
  if (posKind === 'exact') score += 40;
  else if (posKind === 'group' || posKind === 'exact_group') {
    score += 25;
    mismatches.push(`heroPosition group match (${chart.heroPosition?.raw})`);
  } else if (query.heroPosition) {
    mismatches.push(`heroPosition: wanted ${query.heroPosition}, have ${chart.heroPosition?.raw}`);
  } else score += 5;

  const stackKind = stackMatch(query.stack, chart.stack);
  if (stackKind === 'exact') score += 25;
  else if (stackKind === 'band') score += 20;
  else if (query.stack) mismatches.push(`stack: wanted ${query.stack}, have ${chart.stack?.raw}`);
  else score += 5;

  const oppKind = opponentMatch(query.opponentPosition, chart.opponentPosition);
  if (oppKind === 'exact') score += 15;
  else if (oppKind === 'group') {
    score += 8;
    mismatches.push(`opponent group match (${chart.opponentPosition?.raw})`);
  } else if (query.opponentPosition) {
    // UO open charts have no villain seat — inferred BB from task canonical must not block.
    if (chart.sourceMode === 'uo' && !chart.opponentPosition?.raw) score += 5;
    else mismatches.push(`opponent: wanted ${query.opponentPosition}, have ${chart.opponentPosition?.raw}`);
  } else score += 5;

  const betKind = sizingMatch(query.betSize, chart.betSize);
  if (betKind === 'exact') score += 10;
  else if (query.betSize) mismatches.push(`betSize: wanted ${query.betSize}, have ${chart.betSize?.raw}`);
  else score += 3;

  if (query.sourceMode && chart.sourceMode === query.sourceMode) score += 10;
  if (query.sourceGroup && chart.sourceGroup === query.sourceGroup) score += 12;
  if (query.rawSpot && chart.spot?.rawSpot === query.rawSpot) score += 10;
  if (query.trainerCanonicalId && chart.spot?.trainerCanonicalId === query.trainerCanonicalId) score += 15;

  return { score, mismatches, posKind, familyPref: familyPreference(chart, query) };
}

export function lookupTrainerCharts(query = {}) {
  const { charts } = loadBuilt();
  const ranked = charts
    .map((chart) => ({ chart, ...scoreChartMatch(chart, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.familyPref !== a.familyPref) return b.familyPref - a.familyPref;
      return String(a.chart.id).localeCompare(String(b.chart.id));
    });
  return ranked;
}

export function lookupTrainerHand({ chartId, hand }) {
  const h = String(hand || '').trim();
  const chart = loadChartFromShard(chartId);
  const rec = chart?.hands?.[h];
  if (!rec) return null;
  return {
    chartId,
    hand: h,
    actionRaw: rec.actionRaw,
    dataStatus: rec.dataStatus,
    gradingAllowed: rec.isMixed ? false : Boolean(rec.gradingAllowed),
    strategies: rec.strategies || null,
    isMixed: Boolean(rec.isMixed),
    parsingStatus: rec.parsingStatus,
    parserStatus: rec.parsingStatus
  };
}

export function lookupTrainerSpot(query = {}) {
  const ranked = lookupTrainerCharts(query);
  if (!ranked.length) {
    return { status: MATCH_STATUS.NO_TRAINER_DATA, matches: [], provenance: null };
  }

  const best = ranked[0];
  const { chart, mismatches, posKind, score } = best;

  let status = MATCH_STATUS.PARTIAL_TRAINER_MATCH;
  if (mismatches.length === 0 && posKind === 'exact' && score >= 80) {
    status = MATCH_STATUS.EXACT_TRAINER_MATCH;
  } else if (posKind === 'group' || posKind === 'exact_group') {
    status = MATCH_STATUS.GROUP_POSITION_MATCH;
  }

  return {
    status,
    chart,
    mismatches,
    score,
    matches: ranked.slice(0, 5).map((r) => ({
      chartId: r.chart.id,
      score: r.score,
      mismatches: r.mismatches
    })),
    provenance: chart.provenance
  };
}

export function lookupTrainerHandAction(query = {}) {
  const spot = lookupTrainerSpot(query);
  if (spot.status === MATCH_STATUS.NO_TRAINER_DATA || !spot.chart) {
    return { ...spot, hand: query.hand, action: null, gradingAllowed: false };
  }

  const handRec = lookupTrainerHand({ chartId: spot.chart.id, hand: query.hand });

  if (!handRec) {
    return {
      ...spot,
      hand: query.hand,
      action: null,
      dataStatus: TRAINER_STATUS.MISSING_TRAINER_DATA,
      gradingAllowed: false
    };
  }

  const gradingAllowed = handRec.isMixed
    ? false
    : Boolean(handRec.gradingAllowed ?? canGradeWithTrainerAction(handRec.actionRaw));
  return {
    ...spot,
    hand: query.hand,
    action: handRec.actionRaw,
    actionStatus: handRec.dataStatus,
    dataStatus: handRec.dataStatus,
    gradingAllowed,
    strategies: handRec.strategies || null,
    isMixed: handRec.isMixed || false,
    provenance: handRec.provenance || spot.provenance,
    sourceColor: handRec.sourceColor || null
  };
}

export function getUnmappedSpotsReport() {
  const meta = getTrainerMeta();
  return meta.unmappedSpots || [];
}

export function getTermsToClarify() {
  const meta = getTrainerMeta();
  return meta.termsToClarify || [];
}

export { parseTrainerPosition, mapTrainerSpot, trainerProvenance };
