// Availability engine for the ranges section.
//
// A combination is offered to the user only when all four gates pass:
//   1. LEGAL        - the seat ordering makes the spot possible at all
//   2. EXACT DATA   - the tuple exists in the pack (or the push/fold model is
//                     inside its calibrated band); no remap, no snapping
//   3. DISCRIMINATED- the data actually changes along the axes the user picks
//   4. VALID        - the resulting matrix passes structural validation
//
// Everything the UI renders is derived from here, so a chip can never lead to a
// missing, fabricated or duplicated range.

import {
  FORMAT_IDS, FORMAT_LABELS, positionsForFormat, getValidOpeners,
  canBeFirstIn, canFaceThreeBet, canFaceOpen, normalizePosition, sortBySeatOrder
} from './positions.js';
import {
  SOURCE_PUSHFOLD, sourceIdFor, isAtlasSource, hasExactTuple, atlasSupportsFormat,
  getSourceIndex, stackBandFor, buildExactIndex, SOURCE_LABELS, precisionFor,
  PRECISION_SOLVER, PRECISION_MODEL, PRECISION_HEURISTIC
} from './rangeSources.js';
import { buildAtlasMatrix } from './preflopAtlas.js';
import {
  buildPushFoldMatrix, pushFoldStacksFor, pushFoldPositions, PUSHFOLD_FORMAT
} from './pushFold.js';
import { validateRangeMatrix, validationProfileFor } from './rangeValidation.js';

export const SITUATION_IDS = Object.freeze(['rfi', 'vs_open', 'vs_3bet', 'push_fold']);

export const SITUATION_LABELS = Object.freeze({
  rfi: 'Первый вход в банк',
  vs_open: 'Против открытия',
  vs_3bet: 'Против 3-бета',
  push_fold: 'Пуш / фолд'
});

export const REASON = Object.freeze({
  OK: 'OK',
  ILLEGAL: 'ILLEGAL',
  NO_DATA: 'NO_DATA',
  NOT_DISCRIMINATED: 'NOT_DISCRIMINATED',
  INVALID_RANGE: 'INVALID_RANGE',
  OUT_OF_MODEL: 'OUT_OF_MODEL'
});

export const REASON_TEXT = Object.freeze({
  [REASON.ILLEGAL]: 'невозможная последовательность действий',
  [REASON.NO_DATA]: 'в атласе нет данных для этой комбинации',
  [REASON.NOT_DISCRIMINATED]: 'атлас отдаёт один и тот же рендж для всех вариантов',
  [REASON.INVALID_RANGE]: 'рендж не проходит структурную проверку',
  [REASON.OUT_OF_MODEL]: 'вне рабочего диапазона пуш/фолд модели'
});

export function situationNeedsOpener(situation) {
  return situation === 'vs_open';
}

// Gate 1: is the spot possible given the seat ordering?
export function checkLegal(format, position, situation, opener) {
  const pos = normalizePosition(position);
  if (!positionsForFormat(format).includes(pos)) return false;
  if (situation === 'rfi') return !opener && canBeFirstIn(format, pos);
  if (situation === 'vs_3bet') return !opener && canFaceThreeBet(format, pos);
  if (situation === 'push_fold') return !opener;
  if (situation === 'vs_open') {
    if (!canFaceOpen(format, pos)) return false;
    if (!opener) return false;
    return getValidOpeners(format, pos).includes(normalizePosition(opener));
  }
  return false;
}

// Gate 3: may this source be offered per hero / per opener at all? An axis with
// several values but identical data behind them cannot be a user choice.
function checkDiscrimination(pack, situation, position) {
  const sourceId = sourceIdFor(situation, position);
  if (sourceId === SOURCE_PUSHFOLD) return REASON.OK;
  const source = getSourceIndex(pack, sourceId);
  if (!source) return REASON.NO_DATA;
  const disc = source.discrimination || {};
  if (disc.hero === false) return REASON.NOT_DISCRIMINATED;
  if (disc.opener === false) return REASON.NOT_DISCRIMINATED;
  return REASON.OK;
}

function pushFoldStatus(format, position, stack) {
  if (format !== PUSHFOLD_FORMAT) return REASON.OUT_OF_MODEL;
  const stacks = pushFoldStacksFor(position);
  if (!stacks.length) return REASON.OUT_OF_MODEL;
  if (stack !== null && stack !== undefined && !stacks.includes(Number(stack))) {
    return REASON.OUT_OF_MODEL;
  }
  return REASON.OK;
}

const EVALUATION_CACHE = new WeakMap();

// Full evaluation of one concrete combination. Results are memoised per pack:
// the selector re-derives the whole chip tree on every render, and each miss
// costs a 169-cell matrix build plus structural validation.
export function evaluateCombination(pack, sel) {
  const packKey = pack || FALLBACK_PACK_KEY;
  let cache = EVALUATION_CACHE.get(packKey);
  if (!cache) {
    cache = new Map();
    EVALUATION_CACHE.set(packKey, cache);
  }
  const cacheKey = [
    sel.format, sel.position, sel.situation, sel.opener, sel.stack, sel.pushMode || 'PUSH'
  ].join('|');
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const result = computeCombination(pack, sel);
  cache.set(cacheKey, result);
  return result;
}

const FALLBACK_PACK_KEY = Object.freeze({});

function computeCombination(pack, sel) {
  const { format, situation } = sel;
  const position = normalizePosition(sel.position);
  const opener = sel.opener ? normalizePosition(sel.opener) : null;
  const stack = sel.stack === null || sel.stack === undefined ? null : Number(sel.stack);

  const base = {
    format, position, situation, opener, stack,
    available: false,
    reason: REASON.ILLEGAL,
    sourceId: null,
    sourceLabel: null,
    sourceKey: null,
    fallback: false,
    stats: null
  };

  if (!SITUATION_IDS.includes(situation)) return base;
  if (!checkLegal(format, position, situation, opener)) return base;

  const sourceId = sourceIdFor(situation, position);
  base.sourceId = sourceId;
  base.sourceLabel = SOURCE_LABELS[sourceId] || null;

  if (sourceId === SOURCE_PUSHFOLD) {
    const status = pushFoldStatus(format, position, stack);
    if (status !== REASON.OK) return { ...base, reason: status };
    if (stack === null) return { ...base, reason: REASON.OUT_OF_MODEL };
    const matrix = buildPushFoldMatrix({ ...sel, position, stack });
    if (!matrix.supported) return { ...base, reason: REASON.OUT_OF_MODEL };
    const validation = validateRangeMatrix(matrix.cells, {
      profile: validationProfileFor(situation, position)
    });
    if (!validation.ok) return { ...base, reason: REASON.INVALID_RANGE };
    return { ...base, available: true, reason: REASON.OK, stats: validation.stats };
  }

  if (!isAtlasSource(sourceId)) return base;
  if (!atlasSupportsFormat(format)) return { ...base, reason: REASON.NO_DATA };

  const discrimination = checkDiscrimination(pack, situation, position);
  if (discrimination !== REASON.OK) return { ...base, reason: discrimination };

  if (stack === null) return { ...base, reason: REASON.NO_DATA };

  const probe = { format, situation, position, opener, stack };
  if (!hasExactTuple(pack, probe)) return { ...base, reason: REASON.NO_DATA };

  const matrix = buildAtlasMatrix(pack, probe);
  if (!matrix.supported) return { ...base, reason: REASON.NO_DATA };

  const validation = validateRangeMatrix(matrix.cells, {
    profile: validationProfileFor(situation, position)
  });
  if (!validation.ok) {
    return { ...base, reason: REASON.INVALID_RANGE, errors: validation.errors };
  }

  return {
    ...base,
    available: true,
    reason: REASON.OK,
    sourceKey: matrix.source ? matrix.source.key : null,
    stats: validation.stats
  };
}

// Stack options for a settled (format, position, situation, opener) prefix.
// When the underlying data does not vary with depth the options collapse into a
// single chip covering the whole band instead of five identical choices.
export function stackOptionsFor(pack, { format, position, situation, opener }) {
  const sourceId = sourceIdFor(situation, position);
  if (sourceId === SOURCE_PUSHFOLD) {
    if (format !== PUSHFOLD_FORMAT) return [];
    return pushFoldStacksFor(position).map((stack) => ({ id: stack, label: `${stack} ББ`, band: null }));
  }
  if (!isAtlasSource(sourceId)) return [];
  const band = stackBandFor(pack, sourceId);
  if (!band) return [];

  const usable = band.stacks.filter((stack) => (
    evaluateCombination(pack, { format, position, situation, opener, stack }).available
  ));
  if (!usable.length) return [];

  if (band.collapsed) {
    const min = usable[0];
    const max = usable[usable.length - 1];
    return [{
      id: min,
      label: min === max ? `${min} ББ` : `${min}–${max} ББ`,
      band: [min, max]
    }];
  }
  return usable.map((stack) => ({ id: stack, label: `${stack} ББ`, band: null }));
}

export function openerOptionsFor(pack, { format, position, situation }) {
  if (!situationNeedsOpener(situation)) return [];
  const legal = getValidOpeners(format, position);
  return legal.filter((opener) => (
    stackOptionsFor(pack, { format, position, situation, opener }).length > 0
  ));
}

export function situationOptionsFor(pack, { format, position }) {
  return SITUATION_IDS.filter((situation) => {
    if (situationNeedsOpener(situation)) {
      return openerOptionsFor(pack, { format, position, situation }).length > 0;
    }
    return stackOptionsFor(pack, { format, position, situation, opener: null }).length > 0;
  });
}

export function positionOptionsFor(pack, format) {
  return positionsForFormat(format).filter((position) => (
    situationOptionsFor(pack, { format, position }).length > 0
  ));
}

export function formatOptionsFor(pack) {
  return FORMAT_IDS.filter((format) => positionOptionsFor(pack, format).length > 0);
}

const AVAILABILITY_CACHE = new WeakMap();

export function getAvailability(pack) {
  const key = pack || FALLBACK_PACK_KEY;
  if (AVAILABILITY_CACHE.has(key)) return AVAILABILITY_CACHE.get(key);

  const byFormat = {};
  for (const format of FORMAT_IDS) {
    const positions = {};
    for (const position of positionsForFormat(format)) {
      const situations = {};
      for (const situation of situationOptionsFor(pack, { format, position })) {
        situations[situation] = {
          openers: openerOptionsFor(pack, { format, position, situation }),
          stacksByOpener: {}
        };
        const openers = situationNeedsOpener(situation)
          ? situations[situation].openers
          : [null];
        for (const opener of openers) {
          situations[situation].stacksByOpener[opener || '_'] = stackOptionsFor(pack, {
            format, position, situation, opener
          });
        }
      }
      if (Object.keys(situations).length) positions[position] = { situations };
    }
    byFormat[format] = {
      id: format,
      label: FORMAT_LABELS[format],
      positions,
      available: Object.keys(positions).length > 0
    };
  }

  const availability = {
    formats: FORMAT_IDS.filter((f) => byFormat[f].available),
    byFormat
  };
  AVAILABILITY_CACHE.set(key, availability);
  return availability;
}

// Per-pack memo for the report builders: they walk every legal combination and
// are read on each selector render for the "unavailable" note.
const REPORT_CACHE = new WeakMap();

function memoPerPack(pack, name, compute) {
  const key = pack || FALLBACK_PACK_KEY;
  let cache = REPORT_CACHE.get(key);
  if (!cache) {
    cache = new Map();
    REPORT_CACHE.set(key, cache);
  }
  if (!cache.has(name)) cache.set(name, compute());
  return cache.get(name);
}

// Full audit across every legal combination, used by tests and reporting.
export function buildCoverageReport(pack) {
  return memoPerPack(pack, 'coverageReport', () => computeCoverageReport(pack));
}

function computeCoverageReport(pack) {
  const rows = [];
  for (const format of FORMAT_IDS) {
    for (const position of positionsForFormat(format)) {
      for (const situation of SITUATION_IDS) {
        const openers = situationNeedsOpener(situation)
          ? getValidOpeners(format, position)
          : [null];
        const candidateStacks = situation === 'push_fold'
          ? [10, 15, 20, 25, 30]
          : buildExactIndex(pack).stacks;
        const stacks = candidateStacks.length ? candidateStacks : [null];
        for (const opener of openers.length ? openers : [null]) {
          for (const stack of stacks) {
            const result = evaluateCombination(pack, { format, position, situation, opener, stack });
            rows.push({
              format,
              position,
              situation,
              opener,
              stack,
              // "available" means: legal, present under its own key, sensitive to
              // the chosen parameters and structurally valid. It does not claim
              // the numbers are solver output - see `precision`.
              available: result.available,
              precision: result.available ? precisionFor(result.sourceId) : null,
              reason: result.reason,
              source: result.available ? result.sourceId : null,
              sourceKey: result.sourceKey,
              fallback: false,
              playPct: result.stats ? result.stats.playPct : null
            });
          }
        }
      }
    }
  }

  const summary = {
    total: rows.length,
    available: rows.filter((r) => r.available).length,
    solver: rows.filter((r) => r.precision === PRECISION_SOLVER).length,
    model: rows.filter((r) => r.precision === PRECISION_MODEL).length,
    heuristic: rows.filter((r) => r.precision === PRECISION_HEURISTIC).length,
    illegal: rows.filter((r) => r.reason === REASON.ILLEGAL).length,
    noData: rows.filter((r) => r.reason === REASON.NO_DATA).length,
    notDiscriminated: rows.filter((r) => r.reason === REASON.NOT_DISCRIMINATED).length,
    invalid: rows.filter((r) => r.reason === REASON.INVALID_RANGE).length,
    outOfModel: rows.filter((r) => r.reason === REASON.OUT_OF_MODEL).length,
    fallback: 0
  };

  return { rows, summary, duplicateGroups: buildExactIndex(pack).duplicateGroups };
}

// Distinct offerable UI paths, i.e. what the selector can actually reach.
export function enumerateSelectableCombinations(pack) {
  const out = [];
  const availability = getAvailability(pack);
  for (const format of availability.formats) {
    const fmt = availability.byFormat[format];
    for (const [position, posInfo] of Object.entries(fmt.positions)) {
      for (const [situation, sitInfo] of Object.entries(posInfo.situations)) {
        const openers = situationNeedsOpener(situation) ? sitInfo.openers : [null];
        for (const opener of openers) {
          for (const stack of sitInfo.stacksByOpener[opener || '_'] || []) {
            out.push({ format, position, situation, opener, stack: stack.id });
          }
        }
      }
    }
  }
  return out;
}

// Short, user-facing summary of what the selector deliberately does not offer.
// Only whole formats and whole situations are listed; partial gaps (a depth the
// push/fold model cannot cover, say) are already invisible in the chip lists.
export function unavailableSummary(pack) {
  return memoPerPack(pack, 'unavailableSummary', () => computeUnavailableSummary(pack));
}

function computeUnavailableSummary(pack) {
  const availability = getAvailability(pack);
  const hidden = hiddenScenarioSummary(pack);
  const out = [];
  for (const format of FORMAT_IDS) {
    const fmt = availability.byFormat[format];
    if (!fmt.available) {
      out.push({
        scope: format,
        situation: null,
        reason: REASON.NO_DATA,
        text: `${FORMAT_LABELS[format]} — нет проверенных данных`
      });
      continue;
    }
    const offered = new Set();
    for (const position of Object.values(fmt.positions)) {
      for (const situation of Object.keys(position.situations)) offered.add(situation);
    }
    const seen = new Set();
    for (const entry of hidden.filter((h) => h.format === format)) {
      if (offered.has(entry.situation) || seen.has(entry.situation)) continue;
      seen.add(entry.situation);
      out.push({
        scope: format,
        situation: entry.situation,
        reason: entry.reason,
        text: `${SITUATION_LABELS[entry.situation]} — ${entry.reasonText}`
      });
    }
  }
  return out;
}

export function hiddenScenarioSummary(pack) {
  return memoPerPack(pack, 'hiddenScenarios', () => computeHiddenScenarios(pack));
}

function computeHiddenScenarios(pack) {
  const { rows } = buildCoverageReport(pack);
  const groups = new Map();
  for (const row of rows) {
    if (row.available || row.reason === REASON.ILLEGAL) continue;
    const key = `${row.format}|${row.situation}|${row.reason}`;
    if (!groups.has(key)) {
      groups.set(key, {
        format: row.format,
        situation: row.situation,
        reason: row.reason,
        reasonText: REASON_TEXT[row.reason],
        positions: new Set(),
        count: 0
      });
    }
    const g = groups.get(key);
    g.positions.add(row.position);
    g.count++;
  }
  return [...groups.values()].map((g) => ({
    ...g,
    positions: sortBySeatOrder(g.format, [...g.positions])
  }));
}
