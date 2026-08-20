// Supported range situations derived from atlas inventory + push/fold engine.

import { inventoryAtlas, ATLAS_STACKS } from './preflopAtlas.js';
import { PUSH_STACKS } from './pushFold.js';

export const FORMATS = [
  { id: '6max', label: '6-max' }
];

export const SITUATIONS = [
  { id: 'rfi', label: 'Первый вход в банк', needsOpener: false, heroFixed: null },
  { id: 'vs_open', label: 'Против открытия', needsOpener: true, heroFixed: null },
  { id: 'vs_3bet', label: 'Против 3-бета', needsOpener: false, heroFixed: null },
  { id: 'bb_defend', label: 'Защита BB', needsOpener: true, heroFixed: 'BB' },
  { id: 'push_fold', label: 'Пуш / фолд', needsOpener: false, heroFixed: null, push: true }
];

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export function getCatalog(pack) {
  const inv = inventoryAtlas(pack);
  return {
    formats: FORMATS,
    situations: SITUATIONS,
    atlasStacks: ATLAS_STACKS,
    pushStacks: PUSH_STACKS,
    positions: POSITIONS,
    vsOpenPairs: inv.vsOpenPairs,
    rfiPositions: inv.rfiPositions,
    vs3betPositions: inv.vs3betPositions,
    bbDefendOpeners: inv.bbDefendOpeners
  };
}

export function situationsForPosition(catalog, position) {
  if (!position) return [];
  const pos = String(position).toUpperCase();
  const ids = [];
  if ((catalog.rfiPositions || []).includes(pos)) ids.push('rfi');
  if ((catalog.vs3betPositions || []).includes(pos)) ids.push('vs_3bet');
  if (catalog.vsOpenPairs && catalog.vsOpenPairs[pos]) ids.push('vs_open');
  if (pos === 'BB') ids.push('bb_defend');
  ids.push('push_fold');
  return SITUATIONS.filter((s) => ids.includes(s.id));
}

export function positionsForSituation(catalog, situation) {
  const sit = SITUATIONS.find((s) => s.id === situation);
  if (!sit) return [];
  if (sit.heroFixed) return [sit.heroFixed];
  if (situation === 'rfi') return catalog.rfiPositions;
  if (situation === 'vs_3bet') return catalog.vs3betPositions;
  if (situation === 'vs_open') return Object.keys(catalog.vsOpenPairs || {}).sort();
  if (situation === 'push_fold') return POSITIONS;
  return POSITIONS;
}

export function stacksForSituation(situation) {
  if (situation === 'push_fold') return PUSH_STACKS;
  return ATLAS_STACKS;
}

export function openersForSituation(catalog, situation, position) {
  if (situation === 'bb_defend') return catalog.bbDefendOpeners;
  if (situation === 'vs_open') return (catalog.vsOpenPairs && catalog.vsOpenPairs[position]) || [];
  return [];
}

export function situationMeta(id) {
  return SITUATIONS.find((s) => s.id === id) || null;
}

export function isSelectionComplete(sel) {
  if (!sel.format || !sel.position || !sel.situation || !sel.stack) return false;
  const sit = situationMeta(sel.situation);
  if (!sit) return false;
  const pos = sit.heroFixed || sel.position;
  if (!pos) return false;
  if (sit.needsOpener && !sel.opener) return false;
  if (sel.situation === 'vs_open' && sel.position && sel.opener) return true;
  if (sel.situation === 'bb_defend' && sel.opener) return true;
  if (sel.situation !== 'vs_open' && sel.situation !== 'bb_defend') return true;
  return false;
}

export function nextCtaLabel(sel) {
  if (!sel.position) return 'ВЫБЕРИ ПОЗИЦИЮ';
  if (!sel.situation) return 'ВЫБЕРИ СИТУАЦИЮ';
  const sit = situationMeta(sel.situation);
  if (sit && sit.needsOpener && !sel.opener) return 'ВЫБЕРИ ОТКРЫТИЕ';
  if (!sel.stack) return 'ВЫБЕРИ СТЕК';
  return 'ПОКАЗАТЬ РЕНДЖ';
}

export function situationLabel(id) {
  return (situationMeta(id) || {}).label || id;
}

export function suggestNearby(sel, catalog) {
  const stacks = stacksForSituation(sel.situation);
  const out = [];
  if (!sel.position && catalog.positions.length) out.push({ field: 'position', value: catalog.positions[0] });
  if (sel.position && !sel.situation) {
    const sit = situationsForPosition(catalog, sel.position)[0];
    if (sit) out.push({ field: 'situation', value: sit.id });
  }
  if (!sel.stack && stacks.length) out.push({ field: 'stack', value: stacks[0] });
  if (sel.situation === 'vs_open' && sel.position && !sel.opener) {
    const ops = openersForSituation(catalog, sel.situation, sel.position);
    if (ops[0]) out.push({ field: 'opener', value: ops[0] });
  }
  if (sel.situation === 'bb_defend' && !sel.opener && catalog.bbDefendOpeners[0]) {
    out.push({ field: 'opener', value: catalog.bbDefendOpeners[0] });
  }
  return out;
}

export function sanitizeSelection(sel, catalog) {
  const next = { ...sel };
  if (!next.position) {
    next.situation = null;
    next.opener = null;
    next.stack = null;
    return next;
  }
  const allowedSit = situationsForPosition(catalog, next.position);
  if (next.situation && !allowedSit.some((s) => s.id === next.situation)) {
    next.situation = null;
    next.opener = null;
    next.stack = null;
  }
  const sit = situationMeta(next.situation);
  if (sit && sit.heroFixed) next.position = sit.heroFixed;
  if (next.situation) {
    const allowedPos = positionsForSituation(catalog, next.situation);
    if (!allowedPos.includes(next.position)) {
      next.situation = null;
      next.opener = null;
      next.stack = null;
    }
  }
  if (next.situation && sit && sit.needsOpener) {
    const ops = openersForSituation(catalog, next.situation, next.position);
    if (next.opener && !ops.includes(next.opener)) next.opener = null;
  } else {
    next.opener = null;
  }
  if (!next.situation) {
    next.opener = null;
    next.stack = null;
  }
  return next;
}
