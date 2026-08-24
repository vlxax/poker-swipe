// Trainer ranges — browser-facing API via central knowledge layer.

import {
  TRAINER_USER_LABEL,
  TRAINER_DISCLAIMER,
  inventoryTrainer,
  selectionToTrainerQuery,
  buildTrainerMatrix,
  handDetailFromTrainer,
  lookupTrainerRange,
  SOURCE_MODE_LABELS,
  MATCH_STATUS
} from '../trainer-knowledge/adapters/rangesAdapter.js';
import { initBrowserTrainerLookup, getBrowserTrainerLookup } from '../trainer-knowledge/browserLookup.js';

export { TRAINER_USER_LABEL, TRAINER_DISCLAIMER, SOURCE_MODE_LABELS, MATCH_STATUS };

export const TRAINER_SITUATIONS = [
  { id: 'uo_open', label: 'UO open', sourceMode: 'uo', needsOpener: false },
  { id: 'resteal', label: 'Resteal', sourceMode: 'callpush', rawSpot: 'Resteal', needsOpener: false },
  { id: 'call_vs_push', label: 'Call vs Push', sourceMode: 'callpush', needsOpener: false },
  { id: 'open_push', label: 'Open Push', sourceMode: 'callpush', rawSpot: 'Open_Push', needsOpener: false },
  { id: 'bb_defend_trainer', label: 'Защита BB', sourceMode: 'vs1rshort', rawSpot: 'Def_BB', needsOpener: false, heroFixed: 'BB' },
  { id: 'vs_squeeze', label: 'Vs Squeeze', sourceMode: 'vssqueeze', needsOpener: false },
  { id: 'vs_3bet_trainer', label: 'Vs 3-Bet', sourceMode: 'vs3bet', needsOpener: false },
  { id: 'vs_4bet_trainer', label: 'Vs 4-Bet', sourceMode: 'vs4bet', needsOpener: false },
  { id: 'sb_vs_bb', label: 'SB vs BB', sourceMode: 'sbvsbb', needsOpener: false }
];

let _lookupPromise = null;

export function ensureTrainerLookup() {
  if (getBrowserTrainerLookup()) return Promise.resolve(getBrowserTrainerLookup());
  if (!_lookupPromise) _lookupPromise = initBrowserTrainerLookup();
  return _lookupPromise;
}

export async function getTrainerCatalog() {
  const lookup = await ensureTrainerLookup();
  return inventoryTrainer(lookup.charts);
}

export function inventoryTrainerSync(charts) {
  return inventoryTrainer(charts);
}

export async function lookupTrainerRangeAsync(sel) {
  const lookup = await ensureTrainerLookup();
  return lookupTrainerRange(lookup, sel);
}

export async function buildTrainerMatrixAsync(sel) {
  const lookup = await ensureTrainerLookup();
  return buildTrainerMatrix(lookup, sel);
}

export async function handDetailFromTrainerAsync(sel, hand) {
  const lookup = await ensureTrainerLookup();
  return handDetailFromTrainer(lookup, sel, hand);
}

export function selFromTrainerSituation(situation, catalog, base = {}) {
  const sit = TRAINER_SITUATIONS.find((s) => s.id === situation) || null;
  const next = {
    dataSource: 'trainer',
    format: 'trainer',
    situation,
    trainerSourceMode: sit?.sourceMode || base.trainerSourceMode || null,
    trainerSpot: sit?.rawSpot || base.trainerSpot || null,
    ...base
  };
  if (sit?.heroFixed) next.position = sit.heroFixed;
  return next;
}

export { selectionToTrainerQuery };
