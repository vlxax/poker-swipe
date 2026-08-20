// Short-stack push/fold heuristic (same formula as index.html push18). Used only for push_fold situation.

import { matrixClasses } from './matrix.js';
import { playBucket } from './preflopAtlas.js';

const R18 = '23456789TJQKA';

function cls18(a, b) {
  const r1 = String(a || '').replace('10', 'T')[0];
  const r2 = String(b || a || '').replace('10', 'T')[0];
  const s1 = String(a).includes('♠') || String(a).endsWith('s') ? 's' : 'o';
  if (!b || r1 === r2) return r1 + r2;
  const hi = R18.indexOf(r1) >= R18.indexOf(r2) ? r1 : r2;
  const lo = r1 === hi ? r2 : r1;
  return hi + lo + (s1 === 's' || String(a).includes(String(b)) ? 's' : 'o');
}

export function pushFoldEval(handClass, pos, bb, mode = 'PUSH') {
  const c = handClass.length === 2 ? handClass : handClass;
  const pair = c.length === 2;
  const a = R18.indexOf(c[0]);
  const b = R18.indexOf(c[1] || c[0]);
  let x = pair
    ? 54 + a * 3.3
    : 18 + a * 2.4 + b * 0.75 + (c.endsWith('s') ? 6 : 0)
      + (Math.abs(a - b) <= 2 ? 4 : 0) + (c[0] === 'A' ? 5 : 0);
  x += ({
    UTG: -11,
    'UTG+1': -9,
    MP: -8,
    LJ: -8,
    HJ: -6,
    CO: 0,
    BTN: 8,
    SB: 12,
    BB: 3
  }[pos] || 0);
  x += (12 - bb) * 3.4;
  x += mode === 'CALL' ? -9 : 0;
  x = Math.max(3, Math.min(97, Math.round(x)));
  const label = x >= 66 ? (mode === 'CALL' ? 'CALL' : 'PUSH')
    : x >= 38 ? 'MIX' : 'FOLD';
  return { p: x, label };
}

export function buildPushFoldMatrix(sel) {
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
  return { cells, found: 169, supported: true };
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

export const PUSH_STACKS = [10, 15, 20, 25, 30];
