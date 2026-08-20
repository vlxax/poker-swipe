// Supported range situations derived from atlas inventory + reference dataset + push/fold engine.

import { inventoryAtlas, ATLAS_STACKS } from './preflopAtlas.js';
import { PUSH_STACKS } from './pushFold.js';
import { inventoryReference, REFERENCE_SITUATIONS } from './referenceRanges.js';
import { DATA_SOURCES } from './rangeSources.js';

export const FORMATS = [
  { id: '6max', label: '6-max' },
  { id: '9max', label: '9-max' }
];

const POSITIONS_6MAX = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSITIONS_9MAX = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export const SITUATIONS = [
  { id: 'rfi', label: 'Первый вход в банк', needsOpener: false, heroFixed: null },
  { id: 'vs_open', label: 'Против открытия', needsOpener: true, heroFixed: null },
  { id: 'vs_3bet', label: 'Против 3-бета', needsOpener: false, heroFixed: null },
  { id: 'bb_defend', label: 'Защита BB', needsOpener: true, heroFixed: 'BB' },
  { id: 'push_fold', label: 'Пуш / фолд', needsOpener: false, heroFixed: null, push: true }
];

function positionsForFormat(format, dataSource = 'verified') {
  if (dataSource === 'reference') return inventoryReference().positions;
  return format === '9max' ? POSITIONS_9MAX : POSITIONS_6MAX;
}

function activeSituations(dataSource = 'verified') {
  if (dataSource === 'reference') return REFERENCE_SITUATIONS;
  return SITUATIONS;
}

function isReferenceSource(dataSource) {
  return dataSource === 'reference';
}

export function getCatalog(pack, format = '6max', dataSource = 'verified') {
  const ref = isReferenceSource(dataSource);
  const inv = ref ? inventoryReference() : inventoryAtlas(pack, format);
  const formats = ref ? [{ id: '6max', label: '6-max' }] : FORMATS;
  return {
    formats,
    dataSources: DATA_SOURCES,
    situations: activeSituations(dataSource),
    allSituations: activeSituations(dataSource),
    atlasStacks: ATLAS_STACKS,
    pushStacks: PUSH_STACKS,
    format: ref ? '6max' : format,
    dataSource,
    positions: positionsForFormat(format, dataSource),
    vsOpenPairs: inv.vsOpenPairs,
    vs3betPairs: inv.vs3betPairs || {},
    vs4betPairs: inv.vs4betPairs || {},
    rfiPositions: inv.rfiPositions,
    vs3betPositions: inv.vs3betPositions,
    vs4betPositions: inv.vs4betPositions || [],
    bbDefendOpeners: inv.bbDefendOpeners,
    atlasOnlyPositions: inv.atlasOnlyPositions || [],
    referenceRangeCount: ref ? inv.rangeCount : 0
  };
}

export function situationsForPosition(catalog, position) {
  if (!position) return [];
  const pos = String(position).toUpperCase();
  const sitList = catalog.allSituations || SITUATIONS;
  const ids = [];
  if ((catalog.rfiPositions || []).includes(pos)) ids.push('rfi');
  if ((catalog.vs3betPositions || []).includes(pos)) ids.push('vs_3bet');
  if ((catalog.vs4betPositions || []).includes(pos)) ids.push('vs_4bet');
  if (catalog.vsOpenPairs && catalog.vsOpenPairs[pos]) ids.push('vs_open');
  if (pos === 'BB' && !isReferenceSource(catalog.dataSource) && (catalog.bbDefendOpeners || []).length) {
    ids.push('bb_defend');
  }
  if (!isReferenceSource(catalog.dataSource)) ids.push('push_fold');
  return sitList.filter((s) => ids.includes(s.id));
}

export function positionsForSituation(catalog, situation) {
  const sitList = catalog.allSituations || SITUATIONS;
  const sit = sitList.find((s) => s.id === situation);
  if (!sit) return [];
  if (sit.heroFixed) return [sit.heroFixed];
  if (situation === 'rfi') return catalog.rfiPositions || [];
  if (situation === 'vs_3bet') return catalog.vs3betPositions || [];
  if (situation === 'vs_4bet') return catalog.vs4betPositions || [];
  if (situation === 'vs_open') return Object.keys(catalog.vsOpenPairs || {}).sort();
  if (situation === 'push_fold') return catalog.positions || POSITIONS_6MAX;
  return (catalog.positions || POSITIONS_6MAX).filter((pos) =>
    situationsForPosition(catalog, pos).some((s) => s.id === situation)
  );
}

export function stacksForSituation(situation, dataSource = 'verified') {
  if (isReferenceSource(dataSource)) return [];
  if (situation === 'push_fold') return PUSH_STACKS;
  return ATLAS_STACKS;
}

export function openersForSituation(catalog, situation, position) {
  if (situation === 'bb_defend') return catalog.bbDefendOpeners || [];
  if (situation === 'vs_open') return (catalog.vsOpenPairs && catalog.vsOpenPairs[position]) || [];
  if (situation === 'vs_3bet') return (catalog.vs3betPairs && catalog.vs3betPairs[position]) || [];
  if (situation === 'vs_4bet') return (catalog.vs4betPairs && catalog.vs4betPairs[position]) || [];
  return [];
}

export function situationMeta(id, dataSource = 'verified') {
  return activeSituations(dataSource).find((s) => s.id === id)
    || SITUATIONS.find((s) => s.id === id)
    || null;
}

export function needsOpenerForSelection(sel, catalog) {
  const sit = situationMeta(sel.situation, sel.dataSource || catalog.dataSource);
  if (!sit) return false;
  if (sit.needsOpener) return true;
  if (isReferenceSource(sel.dataSource || catalog.dataSource) && sel.situation === 'vs_3bet') return true;
  return false;
}

export function isSelectionComplete(sel) {
  const dataSource = sel.dataSource || 'verified';
  const ref = isReferenceSource(dataSource);
  if (!sel.format || !sel.position || !sel.situation) return false;
  if (!ref && !sel.stack) return false;
  const sit = situationMeta(sel.situation, dataSource);
  if (!sit) return false;
  const pos = sit.heroFixed || sel.position;
  if (!pos) return false;
  if (needsOpenerForSelection(sel, { dataSource })) {
    if (!sel.opener) return false;
  } else if (sit.needsOpener && !sel.opener) {
    return false;
  }
  return true;
}

export function nextCtaLabel(sel) {
  if (!sel.position) return 'ВЫБЕРИ ПОЗИЦИЮ';
  if (!sel.situation) return 'ВЫБЕРИ СИТУАЦИЮ';
  const sit = situationMeta(sel.situation, sel.dataSource);
  const needsOp = needsOpenerForSelection(sel, { dataSource: sel.dataSource });
  if (needsOp && !sel.opener) {
    if (sel.situation === 'vs_3bet') return 'ВЫБЕРИ 3-БЕТ';
    if (sel.situation === 'vs_4bet') return 'ВЫБЕРИ 4-БЕТ';
    return 'ВЫБЕРИ ОТКРЫТИЕ';
  }
  if (!isReferenceSource(sel.dataSource) && !sel.stack) return 'ВЫБЕРИ СТЕК';
  return 'ПОКАЗАТЬ РЕНДЖ';
}

export function situationLabel(id, dataSource = 'verified') {
  return (situationMeta(id, dataSource) || {}).label || id;
}

export function suggestNearby(sel, catalog) {
  const stacks = stacksForSituation(sel.situation, sel.dataSource || catalog.dataSource);
  const out = [];
  if (!sel.position && catalog.positions.length) out.push({ field: 'position', value: catalog.positions[0] });
  if (sel.position && !sel.situation) {
    const sit = situationsForPosition(catalog, sel.position)[0];
    if (sit) out.push({ field: 'situation', value: sit.id });
  }
  if (!isReferenceSource(sel.dataSource || catalog.dataSource) && !sel.stack && stacks.length) {
    out.push({ field: 'stack', value: stacks[0] });
  }
  const needsOp = needsOpenerForSelection(sel, catalog);
  if (needsOp && sel.position && !sel.opener) {
    const ops = openersForSituation(catalog, sel.situation, sel.position);
    if (ops[0]) out.push({ field: 'opener', value: ops[0] });
  }
  if (sel.situation === 'bb_defend' && !sel.opener && catalog.bbDefendOpeners[0]) {
    out.push({ field: 'opener', value: catalog.bbDefendOpeners[0] });
  }
  return out;
}

export function sanitizeSelection(sel, catalog) {
  const next = { ...sel, dataSource: sel.dataSource || catalog.dataSource || 'reference' };
  if (isReferenceSource(next.dataSource)) {
    next.format = '6max';
    next.stack = null;
  }

  if (next.dataSource && next.dataSource !== catalog.dataSource) {
    next.position = null;
    next.situation = null;
    next.opener = null;
    next.stack = null;
  }

  if (next.position && !catalog.positions.includes(next.position)) {
    next.position = null;
    next.situation = null;
    next.opener = null;
    next.stack = null;
    return next;
  }

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
  const sit = situationMeta(next.situation, next.dataSource);
  if (sit && sit.heroFixed) next.position = sit.heroFixed;
  if (next.situation) {
    const allowedPos = positionsForSituation(catalog, next.situation);
    if (!allowedPos.includes(next.position)) {
      next.situation = null;
      next.opener = null;
      next.stack = null;
    }
  }
  const needsOp = needsOpenerForSelection(next, catalog);
  if (next.situation && needsOp) {
    const ops = openersForSituation(catalog, next.situation, next.position);
    if (next.opener && !ops.includes(next.opener)) next.opener = null;
  } else if (next.situation && sit && !sit.needsOpener) {
    next.opener = null;
  }
  if (!next.situation) {
    next.opener = null;
    if (!isReferenceSource(next.dataSource)) next.stack = null;
  }
  return next;
}

export { DATA_SOURCES };
