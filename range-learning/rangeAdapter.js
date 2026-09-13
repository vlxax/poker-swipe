/**
 * PokerSwipeRangeToStrategyMapAdapter
 *
 * Converts production range objects into Strategy Map's { id, hands, metadata }
 * shape WITHOUT copying range data into a second library.
 *
 * Missing-hand semantics (production, not assumed):
 *   reference  — absent hand = 100% FOLD (lookupReferencePolicy)
 *   trainer    — absent / nAI / UO / LOW_PLAYABILITY = not represented,
 *                not gradable (NOT fold unless actionRaw === UNSELECTED)
 *   atlas      — absent key = unsupported, not fold
 */

import { matrixClasses } from '../ranges-ui/matrix.js';
import { mapProductionDistribution } from './actionMapping.js';
import { rangeStrategyVersion } from './strategyVersion.js';
import { canGradeWithTrainerAction } from '../trainer-knowledge/status.js';

export const MISSING_HAND_SEMANTICS = {
  reference: {
    meaning: 'FOLD_100',
    gradable: true,
    description: 'Hand omitted from the JSON is treated as { FOLD: 1 } by lookupReferencePolicy.'
  },
  trainer: {
    meaning: 'UNSUPPORTED',
    gradable: false,
    description: 'Missing trainer cell is MISSING_TRAINER_DATA. UNSELECTED is FOLD. nAI/UO/LOW_PLAYABILITY are not gradable.'
  },
  atlas: {
    meaning: 'UNSUPPORTED',
    gradable: false,
    description: 'lookupPolicy returns null; cell.supported = false. Not invented as fold.'
  }
};

const FOLD_ONLY = { FOLD: 1 };

export function adaptProductionRange(productionRange, options = {}) {
  if (!productionRange || typeof productionRange !== 'object') {
    return fail('production range must be an object');
  }

  const source = options.source || inferSource(productionRange);
  if (source === 'reference') return adaptReferenceRange(productionRange, options);
  if (source === 'trainer') return adaptTrainerRange(productionRange, options);
  if (source === 'atlas') return adaptAtlasRange(productionRange, options);
  return fail(`unsupported source: ${source}`);
}

export function inferSource(obj) {
  if (obj.sourceType === 'reference' || obj.format === '6max' && obj.range && !obj.cells) {
    if (obj.sourceMode || obj.chartId) return 'trainer';
    return 'reference';
  }
  if (obj.sourceType === 'trainer' || obj.sourceMode || obj.cells && obj.chartMeta) return 'trainer';
  if (obj.sourceType === 'verified' || obj.sourceType === 'atlas') return 'atlas';
  if (obj.range && obj.id && obj.heroPosition) return 'reference';
  if (obj.cells && obj.rangeId) {
    if (obj.sourceType === 'reference') return 'reference';
    if (obj.sourceType === 'trainer') return 'trainer';
    return obj.sourceType === 'verified' ? 'atlas' : 'trainer';
  }
  return obj.sourceType || null;
}

export function adaptReferenceRange(rangeObj, options = {}) {
  if (!rangeObj || typeof rangeObj !== 'object') return fail('reference range must be an object');
  if (!rangeObj.id) return fail('reference range missing id');
  if (!rangeObj.range || typeof rangeObj.range !== 'object') return fail('reference range.range must be an object');

  const fillMissing = options.fillMissing !== false;
  const hands = {};
  const errors = [];
  const skippedHands = [];

  const keys = fillMissing ? matrixClasses() : Object.keys(rangeObj.range);
  for (const hand of keys) {
    const rawPolicy = rangeObj.range[hand];
    const policy = rawPolicy == null ? (fillMissing ? FOLD_ONLY : null) : rawPolicy;
    if (policy == null) {
      skippedHands.push({ hand, reason: 'absent', semantics: 'FOLD_100' });
      continue;
    }
    const mapped = mapProductionDistribution(policy);
    if (!mapped.ok) {
      errors.push({ hand, errors: mapped.errors });
      skippedHands.push({ hand, reason: 'malformed', errors: mapped.errors });
      continue;
    }
    hands[hand] = { actions: mapped.distribution };
  }

  if (errors.length > 0) {
    return fail('malformed production frequencies', { errors, skippedHands });
  }

  if (Object.keys(hands).length === 0) {
    return fail('no valid hands after mapping', { errors, skippedHands });
  }

  const adapted = {
    id: rangeObj.id,
    rangeId: rangeObj.id,
    hands,
    metadata: {
      source: 'reference',
      format: rangeObj.format || '6max',
      heroPosition: rangeObj.heroPosition || null,
      villainPosition: rangeObj.villainPosition || null,
      situation: rangeObj.situation || null,
      stack: rangeObj.stackBB == null ? null : rangeObj.stackBB,
      category: rangeObj.situation || 'reference',
      family: `reference:${rangeObj.format || '6max'}:${rangeObj.situation || 'unknown'}`,
      missingHandSemantics: 'FOLD_100'
    }
  };
  adapted.strategyVersion = rangeStrategyVersion(adapted);
  return { ok: true, range: adapted, errors, skippedHands, source: 'reference' };
}

/**
 * Trainer range: pass either a chart + cells matrix, or { id, cells } from buildTrainerMatrix.
 */
export function adaptTrainerRange(input, options = {}) {
  const chartId = input.id || input.rangeId || input.chartId || input.chartMeta?.chartId;
  if (!chartId) return fail('trainer range missing id');

  const cells = input.cells || input.hands || null;
  const records = input.handRecords || null;
  if (!cells && !records) return fail('trainer range needs cells or handRecords');

  const hands = {};
  const errors = [];
  const skippedHands = [];

  const entries = cells
    ? Object.entries(cells)
    : records.map((r) => [r.hand, r]);

  for (const [hand, cell] of entries) {
    const converted = trainerCellToDistribution(cell);
    if (converted.skip) {
      skippedHands.push({ hand, reason: converted.reason, semantics: converted.semantics });
      continue;
    }
    if (!converted.ok) {
      errors.push({ hand, errors: converted.errors });
      skippedHands.push({ hand, reason: 'malformed', errors: converted.errors });
      continue;
    }
    hands[hand] = { actions: converted.distribution };
  }

  if (Object.keys(hands).length === 0) {
    return fail('no gradable trainer hands', { errors, skippedHands });
  }

  const meta = input.chartMeta || input;
  const adapted = {
    id: chartId,
    rangeId: chartId,
    hands,
    metadata: {
      source: 'trainer',
      format: 'trainer',
      heroPosition: meta.heroPosition?.raw || meta.heroPosition || meta.position || null,
      villainPosition: meta.opponentPosition?.raw || meta.opponentPosition || null,
      situation: meta.rawSpot || meta.sourceMode || 'trainer',
      stack: meta.stack?.raw || meta.stack || meta.stackBand || null,
      category: meta.sourceMode || 'trainer',
      family: `trainer:${meta.sourceMode || 'unknown'}`,
      missingHandSemantics: 'UNSUPPORTED'
    }
  };
  adapted.strategyVersion = rangeStrategyVersion(adapted);
  return { ok: true, range: adapted, errors, skippedHands, source: 'trainer' };
}

export function adaptAtlasRange(input) {
  const rangeId = input.id || input.rangeId;
  if (!rangeId) return fail('atlas range missing id');
  const cells = input.cells;
  if (!cells || typeof cells !== 'object') return fail('atlas range needs cells');

  const hands = {};
  const errors = [];
  const skippedHands = [];

  for (const [hand, cell] of Object.entries(cells)) {
    if (!cell || cell.supported === false || !cell.policy) {
      skippedHands.push({ hand, reason: 'unsupported', semantics: 'UNSUPPORTED' });
      continue;
    }
    const mapped = mapProductionDistribution(cell.policy);
    if (!mapped.ok) {
      errors.push({ hand, errors: mapped.errors });
      skippedHands.push({ hand, reason: 'malformed', errors: mapped.errors });
      continue;
    }
    hands[hand] = { actions: mapped.distribution };
  }

  if (Object.keys(hands).length === 0) {
    return fail('no supported atlas hands', { errors, skippedHands });
  }

  const adapted = {
    id: rangeId,
    rangeId,
    hands,
    metadata: {
      source: 'atlas',
      format: input.format || '6max',
      heroPosition: input.heroPosition || input.position || null,
      villainPosition: input.villainPosition || input.opener || null,
      situation: input.situation || null,
      stack: input.stack ?? input.stackBB ?? null,
      category: input.situation || 'atlas',
      family: `atlas:${input.situation || 'unknown'}`,
      missingHandSemantics: 'UNSUPPORTED'
    }
  };
  adapted.strategyVersion = rangeStrategyVersion(adapted);
  return { ok: true, range: adapted, errors, skippedHands, source: 'atlas' };
}

export function trainerCellToDistribution(cell) {
  if (!cell) {
    return { skip: true, reason: 'missing', semantics: 'UNSUPPORTED' };
  }
  if (cell.isMixed || cell.m === 1) {
    return { skip: true, reason: 'mixed_cell', semantics: 'UNSUPPORTED' };
  }
  const raw = cell.trainerActionRaw || cell.actionRaw || cell.normalizedAction || cell.action || cell.a;
  if (cell.gradingAllowed === false && !canGradeWithTrainerAction(raw)) {
    return { skip: true, reason: cell.dataStatus || 'not_gradable', semantics: 'UNSUPPORTED' };
  }

  if (!raw) {
    return { skip: true, reason: 'no_action', semantics: 'UNSUPPORTED' };
  }

  const mapped = mapProductionDistribution({ [raw]: 1 });
  if (!mapped.ok) {
    return { ok: false, errors: mapped.errors, skip: false };
  }
  return { ok: true, skip: false, distribution: mapped.distribution };
}

function fail(error, extra = {}) {
  return { ok: false, error, range: null, errors: extra.errors || [], skippedHands: extra.skippedHands || [] };
}

export function adaptReferenceLibrary(ranges, options = {}) {
  const adapted = [];
  const failed = [];
  for (const r of ranges || []) {
    const result = adaptReferenceRange(r, options);
    if (result.ok) adapted.push(result.range);
    else failed.push({ id: r?.id, error: result.error, errors: result.errors });
  }
  return { adapted, failed };
}
