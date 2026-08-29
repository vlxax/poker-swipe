// Browser-safe trainer lookup — fetch built JSON, no fs.
// Unified lazy-shard runtime (1698 reconstruction): cold index only, no eager UO payload.

import {
  MATCH_STATUS,
  TRAINER_STATUS,
  canGradeWithTrainerAction
} from './status.js';
import { positionMatchKind } from './positionParser.js';
import { formatProvenanceDebug } from './provenance.js';
import { chartUoFamily, resolveUoFamily, findAmbiguousUoPair } from './uoFamily.js';

const BUILT_BASE = 'data/trainer/built';

let _state = null;

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Trainer data fetch failed: ${path} (${res.status})`);
  return res.json();
}

export async function initBrowserTrainerLookup(base = BUILT_BASE) {
  if (_state?.base === base && _state.ready) return _state.api;

  const [charts, meta, shardIndex, aliasTable] = await Promise.all([
    fetchJson(`${base}/charts-index.json`),
    fetchJson(`${base}/meta.json`),
    fetchJson(`${base}/trainer-shard-index.json`),
    fetchJson(`${base}/b2-id-alias.json`).catch(() => ({ b2ToCanonical: {} }))
  ]);
  const b2ToCanonical = aliasTable?.b2ToCanonical || {};
  function canonicalId(id) {
    return b2ToCanonical[id] || id;
  }

  const chartHandsCache = new Map();
  const shardCache = new Map();

  function expandCompactHand(compact) {
    if (!compact) return null;
    if (compact.actionRaw !== undefined) return compact;
    const actionRaw = compact.a ?? null;
    const isUnselectedFold = actionRaw === 'UNSELECTED';
    const out = {
      actionRaw,
      dataStatus: isUnselectedFold
        ? TRAINER_STATUS.EXACT_TRAINER_DATA
        : compact.d || TRAINER_STATUS.NEEDS_CLARIFICATION,
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

  async function loadChartFromShard(chartId) {
    const resolved = canonicalId(chartId);
    if (chartHandsCache.has(resolved)) return chartHandsCache.get(resolved);

    const shardId = shardIndex?.chartToShard?.[resolved];
    if (!shardId) {
      chartHandsCache.set(resolved, null);
      return null;
    }

    if (!shardCache.has(shardId)) {
      try {
        const shard = await fetchJson(`${base}/trainer-shards/${shardId}.json`);
        shardCache.set(shardId, shard.charts || {});
      } catch {
        chartHandsCache.set(resolved, null);
        return null;
      }
    }

    const compact = shardCache.get(shardId)?.[resolved];
    if (!compact?.h) {
      chartHandsCache.set(resolved, null);
      return null;
    }

    const hands = {};
    for (const [hand, cell] of Object.entries(compact.h)) {
      hands[hand] = expandCompactHand(cell);
    }
    const chart = { chartId: resolved, hands, parseStatus: compact.ps, parseStats: compact.st };
    chartHandsCache.set(resolved, chart);
    return chart;
  }

  function normalizeStackDashes(s) {
    return String(s || '').replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');
  }

  function familyPreference(chart, query) {
    const family = resolveUoFamily(query);
    if (!family) return 0;
    const chartFamily = chartUoFamily(chart);
    if (!chartFamily) return 0;
    if (chartFamily === family) return 2;
    return -2;
  }

  function scoreChartMatch(chart, query) {
    const mismatches = [];
    let score = 0;

    const posKind = positionMatchKind(query.heroPosition, chart.heroPosition?.raw);
    if (posKind === 'exact') score += 40;
    else if (posKind === 'group' || posKind === 'exact_group') {
      score += 25;
      mismatches.push(`heroPosition group (${chart.heroPosition?.raw})`);
    } else if (query.heroPosition) {
      mismatches.push(`heroPosition: ${query.heroPosition} ≠ ${chart.heroPosition?.raw}`);
    } else score += 5;

    const qStack = String(query.stack || '').trim();
    const rStackRaw = chart.stack?.raw || '';
    const rStack = normalizeStackDashes(rStackRaw);
    if (qStack && rStackRaw) {
      const qNorm = normalizeStackDashes(qStack);
      if (
        qStack === rStackRaw ||
        qNorm === rStack ||
        qNorm.replace(/bb/i, '') === rStack.replace(/bb/i, '')
      ) {
        score += 25;
      } else if (rStack.includes('-')) {
        const num = parseFloat(qNorm);
        const [lo, hi] = rStack.replace(/bb/i, '').split('-').map(Number);
        if (Number.isFinite(num) && Number.isFinite(lo) && Number.isFinite(hi) && num >= lo && num <= hi) {
          score += 20;
          mismatches.push(`stack band match (${rStackRaw})`);
        } else mismatches.push(`stack: ${qStack} ∉ ${rStackRaw}`);
      } else if (/^\d+(?:\.\d+)?\+$/i.test(rStack.replace(/bb/i, ''))) {
        const minBb = parseFloat(rStack);
        const num = parseFloat(qNorm);
        if (Number.isFinite(num) && Number.isFinite(minBb) && num >= minBb) {
          score += 20;
          mismatches.push(`stack band match (${rStackRaw})`);
        } else mismatches.push(`stack: ${qStack} ∉ ${rStackRaw}`);
      } else mismatches.push(`stack: ${qStack} ≠ ${rStackRaw}`);
    } else score += 5;

    if (query.opponentPosition && chart.opponentPosition?.raw) {
      const q = String(query.opponentPosition).toUpperCase();
      const r = String(chart.opponentPosition.raw).toUpperCase();
      if (q === r) score += 15;
      else if (r.includes(q)) {
        score += 8;
        mismatches.push(`opponent group (${r})`);
      } else mismatches.push(`opponent: ${q} ≠ ${r}`);
    } else if (query.opponentPosition && chart.sourceMode === 'uo' && !chart.opponentPosition?.raw) {
      score += 5;
    } else score += 5;

    if (query.betSize && chart.betSize?.raw) {
      if (String(query.betSize) === String(chart.betSize.raw)) score += 10;
      else mismatches.push(`betSize: ${query.betSize} ≠ ${chart.betSize.raw}`);
    } else score += 3;

    if (query.sourceMode && chart.sourceMode === query.sourceMode) score += 10;
    if (query.sourceGroup && chart.sourceGroup === query.sourceGroup) score += 12;
    if (query.rawSpot && chart.spot?.rawSpot === query.rawSpot) score += 10;
    if (query.trainerCanonicalId && chart.spot?.trainerCanonicalId === query.trainerCanonicalId) score += 15;

    return { score, mismatches, posKind, familyPref: familyPreference(chart, query) };
  }

  function lookupCharts(query = {}) {
    const family = resolveUoFamily(query);
    const pool = family
      ? charts.filter((c) => {
          const cf = chartUoFamily(c);
          return cf == null || cf === family;
        })
      : charts;
    return pool
      .map((chart) => ({ chart, ...scoreChartMatch(chart, query) }))
      .filter((r) => r.score > 0)
      .filter((r) => {
        const cf = chartUoFamily(r.chart);
        return !family || !cf || cf === family;
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.familyPref !== a.familyPref) return b.familyPref - a.familyPref;
        return String(a.chart.id).localeCompare(String(b.chart.id));
      });
  }

  function lookupSpot(query = {}) {
    if (query.chartId || query.id) {
      const chart = charts.find((c) => c.id === canonicalId(query.chartId || query.id) || c.id === (query.chartId || query.id));
      if (!chart) {
        return { status: MATCH_STATUS.NO_TRAINER_DATA, chart: null, mismatches: [], matches: [] };
      }
      return {
        status: MATCH_STATUS.EXACT_TRAINER_MATCH,
        chart,
        mismatches: [],
        score: 100,
        matches: [{ chartId: chart.id, score: 100, mismatches: [] }]
      };
    }
    const ranked = lookupCharts(query);
    if (!ranked.length) {
      return { status: MATCH_STATUS.NO_TRAINER_DATA, chart: null, mismatches: [], matches: [] };
    }
    const ambiguous = findAmbiguousUoPair(ranked, query);
    if (ambiguous) {
      return {
        status: MATCH_STATUS.AMBIGUOUS_UO_FAMILY,
        chart: null,
        mismatches: [
          `UO family unspecified: zip=${ambiguous.zip.chart.id} vs bekhtold=${ambiguous.bekhtold.chart.id}. Pass uoFamily: 'zip' | 'bekhtold'.`
        ],
        score: 0,
        matches: [
          { chartId: ambiguous.zip.chart.id, score: ambiguous.zip.score, family: 'zip' },
          { chartId: ambiguous.bekhtold.chart.id, score: ambiguous.bekhtold.score, family: 'bekhtold' }
        ]
      };
    }
    const best = ranked[0];
    let status = MATCH_STATUS.PARTIAL_TRAINER_MATCH;
    if (best.mismatches.length === 0 && best.posKind === 'exact' && best.score >= 80) {
      status = MATCH_STATUS.EXACT_TRAINER_MATCH;
    } else if (best.posKind === 'group' || best.posKind === 'exact_group') {
      status = MATCH_STATUS.GROUP_POSITION_MATCH;
    }
    return {
      status,
      chart: best.chart,
      mismatches: best.mismatches,
      score: best.score,
      matches: ranked.slice(0, 5).map((r) => ({
        chartId: r.chart.id,
        score: r.score,
        mismatches: r.mismatches
      }))
    };
  }

  async function lookupHand(chartId, hand) {
    const h = String(hand || '').trim();
    const loaded = await loadChartFromShard(chartId);
    const rec = loaded?.hands?.[h];
    if (!rec) return null;
    const gradingAllowed = rec.isMixed ? false : Boolean(rec.gradingAllowed ?? canGradeWithTrainerAction(rec.actionRaw));
    return {
      chartId,
      hand: h,
      actionRaw: rec.actionRaw,
      dataStatus: rec.dataStatus,
      gradingAllowed,
      strategies: rec.strategies || null,
      isMixed: Boolean(rec.isMixed),
      parserStatus: rec.parsingStatus || rec.parserStatus,
      rawColor: rec.rawColor || null
    };
  }

  async function lookupHandAction(query = {}) {
    const spot = lookupSpot(query);
    if (!spot.chart) {
      return { ...spot, hand: query.hand, action: null, gradingAllowed: false };
    }
    const handRec = await lookupHand(spot.chart.id, query.hand);
    if (!handRec) {
      return {
        ...spot,
        hand: query.hand,
        action: null,
        dataStatus: TRAINER_STATUS.MISSING_TRAINER_DATA,
        gradingAllowed: false
      };
    }
    return {
      ...spot,
      hand: query.hand,
      action: handRec.actionRaw,
      actionStatus: handRec.dataStatus,
      dataStatus: handRec.dataStatus,
      gradingAllowed: handRec.gradingAllowed,
      strategies: handRec.strategies || null,
      isMixed: handRec.isMixed || false,
      provenance: handRec.provenance || spot.chart.provenance,
      rawColor: handRec.rawColor || null
    };
  }

  const api = {
    charts,
    meta,
    shardIndex,
    lookupCharts,
    lookupSpot,
    lookupHand,
    lookupHandAction,
    getChartById: (id) => charts.find((c) => c.id === canonicalId(id) || c.id === id) || null,
    formatProvenanceDebug,
    _debug: { chartHandsCache, shardCache }
  };

  _state = { base, ready: true, api };
  return api;
}

export function getBrowserTrainerLookup() {
  return _state?.api || null;
}

export function resetBrowserTrainerLookup() {
  _state = null;
}
