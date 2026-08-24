// Browser-safe trainer lookup — fetch built JSON, no fs.

import {
  MATCH_STATUS,
  TRAINER_STATUS,
  canGradeWithTrainerAction
} from './status.js';
import { positionMatchKind } from './positionParser.js';
import { formatProvenanceDebug } from './provenance.js';

const BUILT_BASE = 'data/trainer/built';

let _state = null;

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Trainer data fetch failed: ${path} (${res.status})`);
  return res.json();
}

export async function initBrowserTrainerLookup(base = BUILT_BASE) {
  if (_state?.base === base && _state.ready) return _state.api;

  const [charts, uoHands, meta] = await Promise.all([
    fetchJson(`${base}/charts-index.json`),
    fetchJson(`${base}/uo-hand-records.json`),
    fetchJson(`${base}/meta.json`)
  ]);

  const uoByChart = new Map();
  for (const rec of uoHands) {
    if (!uoByChart.has(rec.chartId)) uoByChart.set(rec.chartId, new Map());
    uoByChart.get(rec.chartId).set(rec.hand, rec);
  }

  const batch2HandsCache = new Map();

  async function loadBatch2Chart(chartId) {
    if (batch2HandsCache.has(chartId)) return batch2HandsCache.get(chartId);
    try {
      const data = await fetchJson(`${base}/batch2-parsed-hands.json`);
      const chart = data.charts?.[chartId] || null;
      batch2HandsCache.set(chartId, chart);
      return chart;
    } catch {
      batch2HandsCache.set(chartId, null);
      return null;
    }
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
    const rStack = chart.stack?.raw || '';
    if (qStack && rStack) {
      if (qStack === rStack || qStack.replace(/bb/i, '') === rStack) score += 25;
      else if (rStack.includes('-')) {
        const num = parseFloat(qStack);
        const [lo, hi] = rStack.split('-').map(Number);
        if (num >= lo && num <= hi) score += 20;
        else mismatches.push(`stack: ${qStack} ∉ ${rStack}`);
      } else mismatches.push(`stack: ${qStack} ≠ ${rStack}`);
    } else score += 5;

    if (query.opponentPosition && chart.opponentPosition?.raw) {
      const q = String(query.opponentPosition).toUpperCase();
      const r = String(chart.opponentPosition.raw).toUpperCase();
      if (q === r) score += 15;
      else if (r.includes(q)) {
        score += 8;
        mismatches.push(`opponent group (${r})`);
      } else mismatches.push(`opponent: ${q} ≠ ${r}`);
    } else score += 5;

    if (query.betSize && chart.betSize?.raw) {
      if (String(query.betSize) === String(chart.betSize.raw)) score += 10;
      else mismatches.push(`betSize: ${query.betSize} ≠ ${chart.betSize.raw}`);
    } else score += 3;

    if (query.sourceMode && chart.sourceMode === query.sourceMode) score += 10;
    if (query.rawSpot && chart.spot?.rawSpot === query.rawSpot) score += 10;
    if (query.trainerCanonicalId && chart.spot?.trainerCanonicalId === query.trainerCanonicalId) score += 15;

    return { score, mismatches, posKind };
  }

  function lookupCharts(query = {}) {
    return charts
      .map((chart) => ({ chart, ...scoreChartMatch(chart, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  function lookupSpot(query = {}) {
    const ranked = lookupCharts(query);
    if (!ranked.length) {
      return { status: MATCH_STATUS.NO_TRAINER_DATA, chart: null, mismatches: [], matches: [] };
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
    const uo = uoByChart.get(chartId)?.get(h);
    if (uo) return uo;
    const b2 = await loadBatch2Chart(chartId);
    const rec = b2?.hands?.[h];
    if (!rec) return null;
    return {
      chartId,
      hand: h,
      actionRaw: rec.actionRaw,
      dataStatus: rec.dataStatus,
      gradingAllowed: canGradeWithTrainerAction(rec.actionRaw),
      parserStatus: rec.parserStatus,
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
      provenance: handRec.provenance || spot.chart.provenance,
      rawColor: handRec.rawColor || null
    };
  }

  const api = {
    charts,
    meta,
    lookupCharts,
    lookupSpot,
    lookupHand,
    lookupHandAction,
    getChartById: (id) => charts.find((c) => c.id === id) || null,
    formatProvenanceDebug
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
