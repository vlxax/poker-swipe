// Queries POKER_BRAIN_PACK.preflop for weighted range matrices. No solver changes.

import { matrixClasses } from './matrix.js';

const ATLAS_STACKS = [20, 25, 30, 40, 50];
const ACTION_RU = {
  FOLD: 'Фолд',
  CALL: 'Колл',
  RAISE: 'Рейз',
  PUSH: 'Пуш',
  MIX: 'Микс'
};

export function nearestStack(bb, buckets = ATLAS_STACKS) {
  const n = Number(bb);
  if (!Number.isFinite(n)) return buckets[2];
  let best = buckets[0];
  let diff = Math.abs(n - best);
  for (const b of buckets) {
    const d = Math.abs(n - b);
    if (d < diff) { best = b; diff = d; }
  }
  return best;
}

export function primaryAction(policy = {}, situation) {
  const fold = policy.FOLD || 0;
  const call = policy.CALL || 0;
  const raise = policy.RAISE || 0;
  if (situation === 'rfi' || situation === 'vs_3bet') {
    return { action: 'RAISE', freq: raise, play: raise, label: 'Открываем' };
  }
  if (situation === 'bb_defend') {
    const play = call + raise;
    if (raise >= 0.35) return { action: 'RAISE', freq: raise, play, label: '3-бетим' };
    if (play >= 0.5) return { action: 'CALL', freq: call, play, label: 'Коллим' };
    return { action: 'FOLD', freq: fold, play: 1 - fold, label: 'Фолдим' };
  }
  if (situation === 'vs_open') {
    const play = call + raise;
    if (raise >= 0.4) return { action: 'RAISE', freq: raise, play, label: '3-бетим' };
    if (play >= 0.45) return { action: 'CALL', freq: call, play, label: 'Коллим' };
    return { action: 'FOLD', freq: fold, play: 1 - fold, label: 'Фолдим' };
  }
  const play = Math.max(raise, call, 1 - fold);
  const action = raise >= call && raise >= 1 - fold ? 'RAISE' : call >= 1 - fold ? 'CALL' : 'FOLD';
  return { action, freq: policy[action] || play, play, label: ACTION_RU[action] || action };
}

export function playBucket(play) {
  const p = Number(play) || 0;
  if (p >= 0.85) return { key: 'always', label: 'Играем всегда' };
  if (p >= 0.15) return { key: 'sometimes', label: 'Играем иногда' };
  return { key: 'never', label: 'Не играем' };
}

function atlasPositionForLookup(sel) {
  const pos = String(sel.position || '').toUpperCase();
  if (sel.format !== '9max') return pos;
  const map = {
    'UTG+1': 'UTG',
    MP: 'HJ',
    LJ: 'HJ'
  };
  return map[pos] || pos;
}

function atlasKey({ situation, position, opener, stack, hand, format }) {
  const pos = atlasPositionForLookup({ position, format });
  const st = nearestStack(stack);
  const h = String(hand || '').trim();
  if (situation === 'rfi') return `RFI|${pos}|${st}|${h}`;
  if (situation === 'bb_defend') return `BB_DEFEND|${opener}|${st}|${h}`;
  if (situation === 'vs_3bet') return `VS_3BET|${pos}|${st}|${h}`;
  if (situation === 'vs_open') return `VS_OPEN|${pos}|${opener}|${st}|${h}`;
  return null;
}

export function lookupPolicy(pack, sel, hand) {
  if (!pack || !pack.preflop) return null;
  if (sel.format === '9max') {
    const pos = String(sel.position || '').toUpperCase();
    const atlasOnly = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    if (!atlasOnly.includes(pos) && pos !== 'BB') return null;
    if (sel.situation === 'vs_open' && sel.opener) {
      const opener = String(sel.opener).toUpperCase();
      if (!atlasOnly.includes(opener)) return null;
    }
    if (sel.situation === 'bb_defend' && sel.opener) {
      const opener = String(sel.opener).toUpperCase();
      if (!atlasOnly.includes(opener)) return null;
    }
  }
  const key = atlasKey({ ...sel, hand });
  if (!key) return null;
  return pack.preflop[key] || null;
}

export function buildAtlasMatrix(pack, sel) {
  const cells = {};
  let found = 0;
  for (const hand of matrixClasses()) {
    const policy = lookupPolicy(pack, sel, hand);
    if (!policy) {
      cells[hand] = { hand, supported: false, play: 0, bucket: 'never' };
      continue;
    }
    found++;
    const meta = primaryAction(policy, sel.situation);
    const bucket = playBucket(meta.play);
    cells[hand] = {
      hand,
      supported: true,
      play: meta.play,
      bucket: bucket.key,
      bucketLabel: bucket.label,
      action: meta.action,
      actionLabel: meta.label,
      freq: meta.freq,
      policy
    };
  }
  return { cells, found, supported: found > 100 };
}

export function handDetailFromAtlas(pack, sel, hand) {
  const policy = lookupPolicy(pack, sel, hand);
  if (!policy) return null;
  const meta = primaryAction(policy, sel.situation);
  const bucket = playBucket(meta.play);
  const openSize = sel.situation === 'rfi'
    ? (sel.stack <= 25 ? 2.2 : sel.stack <= 40 ? 2.3 : 2.5)
    : null;
  return {
    hand,
    actionLabel: meta.label,
    actionCode: meta.action,
    freqPct: Math.round((meta.freq || meta.play) * 100),
    bucketLabel: bucket.label,
    sizeLabel: openSize ? `${String(openSize).replace('.', ',')} ББ` : null,
    policy
  };
}

export function inventoryAtlas(pack, format = '6max') {
  const pre = (pack && pack.preflop) || {};
  const vsOpen = {};
  for (const k of Object.keys(pre)) {
    if (!k.startsWith('VS_OPEN|')) continue;
    const [, hero, opener] = k.split('|');
    if (!vsOpen[hero]) vsOpen[hero] = new Set();
    vsOpen[hero].add(opener);
  }
  const atlasOnlyPositions = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
  const rfiPositions = format === '9max'
    ? ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB']
    : atlasOnlyPositions;
  const vs3betPositions = format === '9max'
    ? ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB']
    : atlasOnlyPositions;
  const bbDefendOpeners = format === '9max'
    ? ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB']
    : atlasOnlyPositions;
  const vsOpenPairs = format === '9max'
    ? Object.fromEntries(
      ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB'].map((h) => [
        h,
        vsOpen[h] ? [...vsOpen[h]].sort() : (vsOpen.UTG ? [...vsOpen.UTG].sort() : [])
      ])
    )
    : Object.fromEntries(
      Object.entries(vsOpen).map(([h, set]) => [h, [...set].sort()])
    );
  return {
    stacks: ATLAS_STACKS,
    rfiPositions,
    vs3betPositions,
    bbDefendOpeners,
    vsOpenPairs,
    atlasOnlyPositions
  };
}

export { ATLAS_STACKS, ACTION_RU };
