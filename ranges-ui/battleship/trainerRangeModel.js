// Trainer-backed OPEN/FOLD range model for Battleship — fail closed, no hardcoded ranges.

import { buildTrainerMatrixAsync } from '../trainerRanges.js';
import { MATCH_STATUS } from '../../trainer-knowledge/status.js';

export function buildRangeModelFromMatrix(matrix) {
  if (!matrix?.supported || matrix.matchStatus !== MATCH_STATUS.EXACT_TRAINER_MATCH) {
    return {
      supported: false,
      reason: matrix?.matchStatus || 'NO_TRAINER_DATA',
      chartId: matrix?.rangeId || null
    };
  }

  const openSet = new Set();
  const blockedHands = new Set();
  let gradable = 0;
  let blocked = 0;

  for (const [hand, cell] of Object.entries(matrix.cells || {})) {
    if (!cell?.supported) continue;
    if (!cell.gradingAllowed) {
      blockedHands.add(hand);
      blocked++;
      continue;
    }
    gradable++;
    if (cell.normalizedAction !== 'FOLD') openSet.add(hand);
  }

  return {
    supported: true,
    openSet,
    blockedHands,
    gradable,
    blocked,
    chartId: matrix.rangeId,
    chartMeta: matrix.chartMeta,
    provenance: matrix.provenance,
    provenanceDebug: matrix.provenanceDebug,
    matchStatus: matrix.matchStatus,
    sourceMode: matrix.chartMeta?.sourceMode || 'uo',
    position: matrix.chartMeta?.heroPosition?.raw || null,
    stack: matrix.chartMeta?.stack || null,
    rawSpot: matrix.chartMeta?.rawSpot || 'UO'
  };
}

export async function loadRangeModel(selection) {
  const matrix = await buildTrainerMatrixAsync(selection);
  return buildRangeModelFromMatrix(matrix);
}

export function isOpen(hand, model) {
  if (!model?.supported) return false;
  if (model.blockedHands?.has(hand)) return null;
  return model.openSet.has(hand);
}

export function isGradable(hand, model) {
  if (!model?.supported) return false;
  return !model.blockedHands?.has(hand);
}

export function courseLabel(model) {
  if (!model?.supported) return '—';
  const pos = model.position || '?';
  const stack = String(model.stack || '').replace(/bb/i, ' ББ');
  return `${pos} · ${stack}`;
}
