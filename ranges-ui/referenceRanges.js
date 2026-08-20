// Reference 6-max preflop ranges from AHTOOOXA/poker-charts (greenline).
// Loaded from generated pack; canonical JSON lives in data/ranges/reference/6max/.

import { matrixClasses, dominantBucket, isMixedPolicy, actionFrequencyRows } from './matrix.js';
import { playBucket, primaryAction, ACTION_RU } from './preflopAtlas.js';
import { REFERENCE_6MAX_METADATA, REFERENCE_6MAX_RANGES } from './referenceRangesPack.js';

export const REFERENCE_USER_LABEL = REFERENCE_6MAX_METADATA.userLabel || 'Базовая стратегия';
export const REFERENCE_DISCLAIMER = REFERENCE_6MAX_METADATA.disclaimer;

export const REFERENCE_POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export const REFERENCE_SITUATIONS = [
  { id: 'rfi', label: 'Первый вход в банк', needsOpener: false, heroFixed: null },
  { id: 'vs_open', label: 'Против открытия', needsOpener: true, heroFixed: null },
  { id: 'vs_3bet', label: 'Против 3-бета', needsOpener: true, heroFixed: null },
  { id: 'vs_4bet', label: 'Против 4-бета', needsOpener: true, heroFixed: null }
];

const rangeIndex = new Map();

function rangeKey({ heroPosition, villainPosition, situation }) {
  const hero = String(heroPosition || '').toUpperCase();
  const villain = villainPosition ? String(villainPosition).toUpperCase() : '';
  return `${hero}|${situation}|${villain}`;
}

function buildIndex(ranges = REFERENCE_6MAX_RANGES) {
  rangeIndex.clear();
  for (const r of ranges) {
    rangeIndex.set(rangeKey(r), r);
  }
}

buildIndex();

export function getReferenceMetadata() {
  return { ...REFERENCE_6MAX_METADATA };
}

export function getReferenceRanges() {
  return REFERENCE_6MAX_RANGES;
}

export function lookupReferenceRange(sel) {
  const hero = sel.situation === 'bb_defend' ? 'BB' : String(sel.position || '').toUpperCase();
  const villain = sel.opener ? String(sel.opener).toUpperCase() : null;
  const situation = sel.situation === 'bb_defend' ? 'vs_open' : sel.situation;
  const key = rangeKey({ heroPosition: hero, villainPosition: villain, situation });
  return rangeIndex.get(key) || null;
}

export function lookupReferencePolicy(sel, hand) {
  const rangeObj = lookupReferenceRange(sel);
  if (!rangeObj) return null;
  const h = String(hand || '').trim();
  const policy = rangeObj.range[h];
  if (policy) return policy;
  return { FOLD: 1, CALL: 0, RAISE: 0 };
}

export function inventoryReference() {
  const vsOpen = {};
  const vs3bet = {};
  const vs4bet = {};
  const rfiPositions = [];
  const vs3betPositions = [];
  const vs4betPositions = [];
  const bbDefendOpeners = [];

  for (const r of REFERENCE_6MAX_RANGES) {
    if (r.situation === 'rfi' && !rfiPositions.includes(r.heroPosition)) {
      rfiPositions.push(r.heroPosition);
    }
    if (r.situation === 'vs_open') {
      if (!vsOpen[r.heroPosition]) vsOpen[r.heroPosition] = new Set();
      vsOpen[r.heroPosition].add(r.villainPosition);
      if (r.heroPosition === 'BB' && !bbDefendOpeners.includes(r.villainPosition)) {
        bbDefendOpeners.push(r.villainPosition);
      }
    }
    if (r.situation === 'vs_3bet') {
      if (!vs3bet[r.heroPosition]) vs3bet[r.heroPosition] = new Set();
      vs3bet[r.heroPosition].add(r.villainPosition);
      if (!vs3betPositions.includes(r.heroPosition)) vs3betPositions.push(r.heroPosition);
    }
    if (r.situation === 'vs_4bet') {
      if (!vs4bet[r.heroPosition]) vs4bet[r.heroPosition] = new Set();
      vs4bet[r.heroPosition].add(r.villainPosition);
      if (!vs4betPositions.includes(r.heroPosition)) vs4betPositions.push(r.heroPosition);
    }
  }

  const sortPos = (arr) => REFERENCE_POSITIONS.filter((p) => arr.includes(p));

  return {
    positions: REFERENCE_POSITIONS,
    rfiPositions: sortPos(rfiPositions),
    vs3betPositions: sortPos(vs3betPositions),
    vs4betPositions: sortPos(vs4betPositions),
    bbDefendOpeners: sortPos(bbDefendOpeners),
    vsOpenPairs: Object.fromEntries(
      Object.entries(vsOpen).map(([h, set]) => [h, sortPos([...set])])
    ),
    vs3betPairs: Object.fromEntries(
      Object.entries(vs3bet).map(([h, set]) => [h, sortPos([...set])])
    ),
    vs4betPairs: Object.fromEntries(
      Object.entries(vs4bet).map(([h, set]) => [h, sortPos([...set])])
    ),
    rangeCount: REFERENCE_6MAX_RANGES.length
  };
}

export function referenceCoverageReport() {
  const inv = inventoryReference();
  const bySit = {};
  for (const r of REFERENCE_6MAX_RANGES) {
    bySit[r.situation] = (bySit[r.situation] || 0) + 1;
  }
  return {
    rangeObjects: REFERENCE_6MAX_RANGES.length,
    positions: REFERENCE_POSITIONS,
    scenarios: Object.keys(bySit).sort(),
    rfi: bySit.rfi || 0,
    vsOpen: bySit.vs_open || 0,
    vs3bet: bySit.vs_3bet || 0,
    vs4bet: bySit.vs_4bet || 0,
    frequencies: REFERENCE_6MAX_METADATA.frequencySupport ? 'YES' : 'NO',
    stackSpecific: REFERENCE_6MAX_METADATA.stackSpecific ? 'YES' : 'NO',
    inventory: inv,
    uiScenarios: buildUiCoverageReport()
  };
}

export function buildUiCoverageReport() {
  const inv = inventoryReference();
  const report = {
    rfi: [...inv.rfiPositions],
    vsOpen: {},
    vs3bet: {},
    vs4bet: {}
  };

  for (const [hero, openers] of Object.entries(inv.vsOpenPairs || {})) {
    report.vsOpen[hero] = openers.map((opener) => `${hero} vs ${opener}`);
  }
  for (const [hero, villains] of Object.entries(inv.vs3betPairs || {})) {
    report.vs3bet[hero] = villains.map((v) => `${hero} vs ${v}`);
  }
  for (const [hero, villains] of Object.entries(inv.vs4betPairs || {})) {
    report.vs4bet[hero] = villains.map((v) => `${hero} vs ${v}`);
  }

  return report;
}

export function buildReferenceMatrix(sel) {
  const rangeObj = lookupReferenceRange(sel);
  if (!rangeObj) {
    return { cells: {}, found: 0, supported: false, sourceType: 'reference' };
  }

  const cells = {};
  let found = 0;
  for (const hand of matrixClasses()) {
    const policy = rangeObj.range[hand] || { FOLD: 1, CALL: 0, RAISE: 0 };
    found++;
    const sit = sel.situation === 'bb_defend' ? 'bb_defend' : sel.situation;
    const meta = primaryAction(policy, sit);
    const bucketKey = dominantBucket(policy, sit);
    cells[hand] = {
      hand,
      supported: true,
      play: meta.play,
      bucket: bucketKey === 'mixed' ? 'mixed' : playBucket(meta.play).key,
      bucketLabel: bucketKey === 'mixed' ? 'Смешанная стратегия' : playBucket(meta.play).label,
      action: meta.action,
      actionLabel: meta.label,
      freq: meta.freq,
      policy,
      isMixed: isMixedPolicy(policy)
    };
  }

  return {
    cells,
    found,
    supported: true,
    sourceType: 'reference',
    sourceLabel: REFERENCE_USER_LABEL,
    rangeId: rangeObj.id
  };
}

export function handDetailFromReference(sel, hand) {
  const policy = lookupReferencePolicy(sel, hand);
  if (!policy) return null;
  const sit = sel.situation === 'bb_defend' ? 'bb_defend' : sel.situation;
  const meta = primaryAction(policy, sit);
  const bucket = playBucket(meta.play);
  const actions = actionFrequencyRows(policy, sit);
  return {
    hand,
    actionLabel: meta.label,
    actionCode: meta.action,
    freqPct: Math.round((meta.freq || meta.play) * 100),
    bucketLabel: isMixedPolicy(policy) ? 'Смешанная стратегия' : bucket.label,
    sizeLabel: null,
    sourceLabel: REFERENCE_USER_LABEL,
    actions,
    policy
  };
}

export function validateReferenceRange(rangeObj) {
  const errors = [];
  const hands = Object.keys(rangeObj.range || {});
  for (const hand of hands) {
    if (!/^[2-9TJQKA]{2}([so])?$/.test(hand)) {
      errors.push(`invalid hand key: ${hand}`);
      continue;
    }
    const p = rangeObj.range[hand];
    for (const k of ['FOLD', 'CALL', 'RAISE']) {
      const v = p[k];
      if (v == null || v < 0 || v > 1) errors.push(`${hand}.${k} out of range: ${v}`);
    }
    const sum = (p.FOLD || 0) + (p.CALL || 0) + (p.RAISE || 0);
    if (Math.abs(sum - 1) > 0.001) errors.push(`${hand} frequencies sum to ${sum}`);
  }
  return errors;
}

export { ACTION_RU };
