// Queries POKER_BRAIN_PACK.preflop for weighted range matrices. No solver changes.

import { matrixClasses } from './matrix.js';

const ATLAS_BUCKETS = [20, 25, 30, 40, 50];
const UI_STACKS = [10, 15, 20, 25, 30, 40, 60, 100];

const ACTION_RU = {
  FOLD: 'Фолд',
  CALL: 'Колл',
  RAISE: 'Рейз',
  PUSH: 'Пуш',
  MIX: 'Микс'
};

const NINE_MAX_REMAP = {
  'UTG+1': 'UTG',
  MP: 'HJ',
  LJ: 'HJ'
};

export function nearestStack(bb, buckets = ATLAS_BUCKETS) {
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

function primaryAction(policy = {}, situation) {
  const fold = policy.FOLD || 0;
  const call = policy.CALL || 0;
  const raise = policy.RAISE || 0;
  if (situation === 'rfi') {
    return { action: 'RAISE', freq: raise, play: raise, label: 'Открываем' };
  }
  if (situation === 'vs_3bet') {
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

export function atlasPositionForLookup(sel) {
  const pos = String(sel.position || '').toUpperCase();
  if (sel.format !== '9max') return pos;
  return NINE_MAX_REMAP[pos] || pos;
}

export function atlasOpenerForLookup(sel) {
  const opener = String(sel.opener || '').toUpperCase();
  if (sel.format !== '9max') return opener;
  return NINE_MAX_REMAP[opener] || opener;
}

function atlasKey({ situation, position, opener, stack, hand, format }) {
  const pos = atlasPositionForLookup({ position, format });
  const op = atlasOpenerForLookup({ opener, format });
  const st = nearestStack(stack);
  const h = String(hand || '').trim();
  if (situation === 'rfi') return `RFI|${pos}|${st}|${h}`;
  if (situation === 'bb_defend') return `BB_DEFEND|${op}|${st}|${h}`;
  if (situation === 'vs_3bet') return `VS_3BET|${pos}|${st}|${h}`;
  if (situation === 'vs_open') return `VS_OPEN|${pos}|${op}|${st}|${h}`;
  return null;
}

export function lookupPolicy(pack, sel, hand) {
  if (!pack || !pack.preflop) return null;
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

function probeAtlas(pack, sel) {
  return buildAtlasMatrix(pack, sel).supported;
}

function sortByOrder(items, order) {
  const idx = new Map(order.map((v, i) => [v, i]));
  return [...items].sort((a, b) => (idx.get(a) ?? 99) - (idx.get(b) ?? 99));
}

export function inventoryAtlas(pack, format = '6max') {
  const allPositions = format === '9max'
    ? ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB']
    : ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const probeStack = 20;

  const rfiPositions = [];
  const vs3betPositions = [];
  const vsOpenPairs = {};
  const bbDefendOpeners = [];

  for (const pos of allPositions) {
    if (pos !== 'BB' && probeAtlas(pack, { format, situation: 'rfi', position: pos, stack: probeStack })) {
      rfiPositions.push(pos);
    }
    if (pos !== 'BB' && probeAtlas(pack, { format, situation: 'vs_3bet', position: pos, stack: probeStack })) {
      vs3betPositions.push(pos);
    }

    const atlasHero = atlasPositionForLookup({ position: pos, format });
    if (['HJ', 'CO', 'BTN'].includes(atlasHero)) {
      const openers = [];
      for (const opener of allPositions) {
        if (opener === pos || opener === 'BB') continue;
        if (probeAtlas(pack, {
          format, situation: 'vs_open', position: pos, opener, stack: probeStack
        })) {
          openers.push(opener);
        }
      }
      if (openers.length) vsOpenPairs[pos] = sortByOrder(openers, allPositions);
    }
  }

  for (const opener of allPositions) {
    if (opener === 'BB') continue;
    if (probeAtlas(pack, { format, situation: 'bb_defend', position: 'BB', opener, stack: probeStack })) {
      bbDefendOpeners.push(opener);
    }
  }

  const availablePositions = sortByOrder(
    [...new Set([
      ...rfiPositions,
      ...vs3betPositions,
      ...Object.keys(vsOpenPairs),
      ...(bbDefendOpeners.length ? ['BB'] : []),
      ...allPositions
    ])],
    allPositions
  );

  return {
    stacks: UI_STACKS,
    atlasBuckets: ATLAS_BUCKETS,
    rfiPositions: sortByOrder(rfiPositions, allPositions),
    vs3betPositions: sortByOrder(vs3betPositions, allPositions),
    bbDefendOpeners: sortByOrder(bbDefendOpeners, allPositions),
    vsOpenPairs,
    pushFoldPositions: [...allPositions],
    availablePositions,
    format
  };
}

export function atlasStacksForSelection(pack, sel) {
  if (!sel.situation || sel.situation === 'push_fold') return [];
  const stacks = [];
  for (const stack of UI_STACKS) {
    const probe = { ...sel, stack };
    if (sel.situation === 'bb_defend') {
      if (!sel.opener) continue;
      probe.position = 'BB';
    }
    if (sel.situation === 'vs_open' && !sel.opener) continue;
    if (probeAtlas(pack, probe)) stacks.push(stack);
  }
  return stacks;
}

export function coverageAudit(pack, format = '6max') {
  const inv = inventoryAtlas(pack, format);
  const allPositions = inv.availablePositions;
  const situations = ['rfi', 'vs_open', 'vs_3bet', 'bb_defend', 'push_fold'];
  const rows = [];

  for (const position of allPositions) {
    for (const situation of situations) {
      if (situation === 'rfi' && !inv.rfiPositions.includes(position)) {
        rows.push({ format, position, situation, stack: null, opener: null, status: 'INVALID' });
        continue;
      }
      if (situation === 'vs_3bet' && !inv.vs3betPositions.includes(position)) {
        rows.push({ format, position, situation, stack: null, opener: null, status: 'INVALID' });
        continue;
      }
      if (situation === 'vs_open' && !inv.vsOpenPairs[position]) {
        rows.push({ format, position, situation, stack: null, opener: null, status: 'INVALID' });
        continue;
      }
      if (situation === 'bb_defend' && position !== 'BB') {
        rows.push({ format, position, situation, stack: null, opener: null, status: 'INVALID' });
        continue;
      }
      if (situation === 'push_fold') {
        for (const stack of [10, 15, 20, 25, 30]) {
          rows.push({
            format, position, situation, stack, opener: null, status: 'SUPPORTED'
          });
        }
        continue;
      }

      const openers = situation === 'bb_defend'
        ? inv.bbDefendOpeners
        : situation === 'vs_open'
          ? (inv.vsOpenPairs[position] || [])
          : [null];

      for (const opener of openers) {
        for (const stack of UI_STACKS) {
          const sel = {
            format,
            situation,
            position: situation === 'bb_defend' ? 'BB' : position,
            opener,
            stack
          };
          const supported = probeAtlas(pack, sel);
          rows.push({
            format,
            position: sel.position,
            situation,
            stack,
            opener,
            status: supported ? 'SUPPORTED' : 'MISSING'
          });
        }
      }
    }
  }

  const summary = {
    supported: rows.filter((r) => r.status === 'SUPPORTED').length,
    missing: rows.filter((r) => r.status === 'MISSING').length,
    invalid: rows.filter((r) => r.status === 'INVALID').length,
    partial: rows.filter((r) => r.status === 'PARTIAL').length
  };
  return { rows, summary };
}

export { ATLAS_BUCKETS as ATLAS_STACKS, UI_STACKS, ACTION_RU };
