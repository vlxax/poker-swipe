// Short-stack push/fold heuristic (same formula as index.html push18).
//
// This is an explicit model, not atlas data, and it is only meaningful inside
// the stack band it was calibrated for: the (12 - bb) term collapses the whole
// range to folds once stacks get deep. Positions and depths are therefore
// filtered down to the band where the model still produces a structurally valid
// range, and the model is never mixed with deep-stack opening ranges.

import { matrixClasses } from './matrix.js';
import { playBucket } from './preflopAtlas.js';
import { validateRangeMatrix, validationProfileFor } from './rangeValidation.js';

const R18 = '23456789TJQKA';

// Seats the model actually calibrates for. The offsets encode how many players
// are still to act, so they are 6-max values and are not reused for 9-max.
const POSITION_OFFSETS = Object.freeze({
  UTG: -11, HJ: -6, CO: 0, BTN: 8, SB: 12, BB: 3
});

export const PUSHFOLD_FORMAT = '6max';
export const PUSHFOLD_POSITIONS = Object.freeze(Object.keys(POSITION_OFFSETS));
export const PUSH_STACK_CANDIDATES = Object.freeze([10, 15, 20, 25, 30]);

export function pushFoldEval(handClass, pos, bb, mode = 'PUSH') {
  const c = String(handClass);
  const pair = c.length === 2;
  const a = R18.indexOf(c[0]);
  const b = R18.indexOf(c[1] || c[0]);
  let x = pair
    ? 54 + a * 3.3
    : 18 + a * 2.4 + b * 0.75 + (c.endsWith('s') ? 6 : 0)
      + (Math.abs(a - b) <= 2 ? 4 : 0) + (c[0] === 'A' ? 5 : 0);
  x += POSITION_OFFSETS[String(pos || '').toUpperCase()] || 0;
  x += (12 - bb) * 3.4;
  x += mode === 'CALL' ? -9 : 0;
  x = Math.max(3, Math.min(97, Math.round(x)));
  const label = x >= 66 ? (mode === 'CALL' ? 'CALL' : 'PUSH')
    : x >= 38 ? 'MIX' : 'FOLD';
  return { p: x, label };
}

function cellsFor(sel) {
  const mode = sel.pushMode || 'PUSH';
  const cells = {};
  for (const hand of matrixClasses()) {
    const ev = pushFoldEval(hand, sel.position, sel.stack, mode);
    const play = ev.label === 'PUSH' || ev.label === 'CALL' ? 1
      : ev.label === 'MIX' ? 0.5 : 0;
    const bucket = playBucket(play);
    const actionLabel = ev.label === 'PUSH' ? 'Пушим'
      : ev.label === 'CALL' ? 'Коллим'
        : ev.label === 'MIX' ? 'Микс'
          : 'Фолдим';
    cells[hand] = {
      hand,
      supported: true,
      play,
      bucket: bucket.key,
      bucketLabel: bucket.label,
      action: ev.label,
      actionLabel,
      freq: play,
      pushPct: ev.p
    };
  }
  return cells;
}

// The model is in-domain when the top of the range is a pure shove and the
// bottom is a pure fold. Outside the band it either shoves 72o or folds aces.
export function isPushFoldModelValid(position, stack, mode = 'PUSH') {
  const pos = String(position || '').toUpperCase();
  if (!PUSHFOLD_POSITIONS.includes(pos)) return false;
  if (!Number.isFinite(Number(stack))) return false;
  const cells = cellsFor({ position: pos, stack: Number(stack), pushMode: mode });
  if (cells.AA.play !== 1 || cells.KK.play !== 1) return false;
  if (cells['72o'].play !== 0) return false;
  return validateRangeMatrix(cells, { profile: validationProfileFor('push_fold', pos) }).ok;
}

export function pushFoldStacksFor(position, mode = 'PUSH') {
  return PUSH_STACK_CANDIDATES.filter((stack) => isPushFoldModelValid(position, stack, mode));
}

export function pushFoldPositions(format, mode = 'PUSH') {
  if (format && format !== PUSHFOLD_FORMAT) return [];
  return PUSHFOLD_POSITIONS.filter((pos) => pushFoldStacksFor(pos, mode).length > 0);
}

export function buildPushFoldMatrix(sel) {
  const cells = cellsFor(sel);
  const supported = isPushFoldModelValid(sel.position, sel.stack, sel.pushMode || 'PUSH');
  return { cells, found: Object.keys(cells).length, supported, sourceId: 'PUSHFOLD_MODEL' };
}

export function handDetailFromPush(sel, hand) {
  const ev = pushFoldEval(hand, sel.position, sel.stack, sel.pushMode || 'PUSH');
  const play = ev.label === 'MIX' ? 0.5 : (ev.label === 'FOLD' ? 0 : 1);
  const bucket = playBucket(play);
  const actionLabel = ev.label === 'PUSH' ? 'Пушим'
    : ev.label === 'CALL' ? 'Коллим'
      : ev.label === 'MIX' ? 'Микс'
        : 'Фолдим';
  return {
    hand,
    actionLabel,
    actionCode: ev.label,
    freqPct: ev.label === 'MIX' ? 50 : (ev.label === 'FOLD' ? 0 : 100),
    bucketLabel: bucket.label,
    sizeLabel: ev.label === 'PUSH' || ev.label === 'CALL' ? 'Пуш' : null
  };
}

// Kept for callers that only need the advertised depths; per-position filtering
// goes through pushFoldStacksFor.
export const PUSH_STACKS = PUSH_STACK_CANDIDATES;
