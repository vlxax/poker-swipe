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

export function isSelectionComplete(sel) {
  if (!sel.format || !sel.situation || !sel.stack) return false;
  const sit = SITUATIONS.find((s) => s.id === sel.situation);
  if (!sit) return false;
  const pos = sit.heroFixed || sel.position;
  if (!pos) return false;
  if (sit.needsOpener && !sel.opener) return false;
  if (situationNeedsOpenerValid(sel) === false) return false;
  return true;
}

function situationNeedsOpenerValid(sel) {
  if (sel.situation === 'vs_open' && sel.position && sel.opener) {
    return true;
  }
  if (sel.situation === 'bb_defend' && sel.opener) return true;
  if (sel.situation !== 'vs_open' && sel.situation !== 'bb_defend') return true;
  return false;
}

export function situationLabel(id) {
  return (SITUATIONS.find((s) => s.id === id) || {}).label || id;
}

export function suggestNearby(sel, catalog) {
  const stacks = stacksForSituation(sel.situation);
  const positions = positionsForSituation(catalog, sel.situation);
  const out = [];
  if (!sel.stack && stacks.length) out.push({ field: 'stack', value: stacks[0] });
  if (!sel.position && positions.length) out.push({ field: 'position', value: positions[0] });
  if (sel.situation === 'vs_open' && sel.position && !sel.opener) {
    const ops = openersForSituation(catalog, sel.situation, sel.position);
    if (ops[0]) out.push({ field: 'opener', value: ops[0] });
  }
  if (sel.situation === 'bb_defend' && !sel.opener && catalog.bbDefendOpeners[0]) {
    out.push({ field: 'opener', value: catalog.bbDefendOpeners[0] });
  }
  return out;
}
