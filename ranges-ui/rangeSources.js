// Verified range sources.
//
// This module is the single place that decides whether a selection is backed by
// real data. It performs exact key lookups only: no position remapping, no
// nearest-stack snapping, no generic fallback range. A selection either resolves
// to a tuple that exists in POKER_BRAIN_PACK.preflop, or it resolves to nothing.
//
// On top of existence it also checks *discrimination*: an axis may only be
// offered to the user when the underlying data actually changes along that axis.
// A situation whose matrix is byte-identical for every hero, villain and stack
// carries no information, so exposing those chips would fabricate precision.

import { matrixClasses } from './matrix.js';
import { normalizePosition } from './positions.js';

export const SOURCE_RFI = 'ATLAS_RFI';
export const SOURCE_VS_OPEN = 'ATLAS_VS_OPEN';
export const SOURCE_BB_DEFEND = 'ATLAS_BB_DEFEND';
export const SOURCE_VS_3BET = 'ATLAS_VS_3BET';
export const SOURCE_PUSHFOLD = 'PUSHFOLD_MODEL';

export const SOURCE_LABELS = Object.freeze({
  [SOURCE_RFI]: 'Модель префлоп-атласа · открытие',
  [SOURCE_VS_OPEN]: 'Модель префлоп-атласа · против открытия',
  [SOURCE_BB_DEFEND]: 'Модель префлоп-атласа · защита BB',
  [SOURCE_VS_3BET]: 'Модель префлоп-атласа · против 3-бета',
  [SOURCE_PUSHFOLD]: 'Пуш/фолд модель'
});

// How the numbers behind a source were produced. No tier in this repository is
// solver output: the pack declares `truth.solverOutput === false`, its
// frequencies form smooth curves over hand strength, and the push/fold matrix
// comes from a hand-tuned scoring formula. SOLVER exists so verified data can
// declare itself once it is actually imported.
export const PRECISION_SOLVER = 'SOLVER';
export const PRECISION_MODEL = 'MODEL';
export const PRECISION_HEURISTIC = 'HEURISTIC';

export const SOURCE_PRECISION = Object.freeze({
  [SOURCE_RFI]: PRECISION_MODEL,
  [SOURCE_VS_OPEN]: PRECISION_MODEL,
  [SOURCE_BB_DEFEND]: PRECISION_MODEL,
  [SOURCE_VS_3BET]: PRECISION_MODEL,
  [SOURCE_PUSHFOLD]: PRECISION_HEURISTIC
});

export const PRECISION_NOTES = Object.freeze({
  [PRECISION_SOLVER]: 'Верифицированные равновесные данные.',
  [PRECISION_MODEL]: 'Расчётная модель префлоп-атласа — не вывод солвера и не Nash-таблица.',
  [PRECISION_HEURISTIC]: 'Эвристическая пуш/фолд модель — не Nash-таблица и не вывод солвера.'
});

export function precisionFor(sourceId) {
  return SOURCE_PRECISION[sourceId] || null;
}

// Atlas key layout per source. `hero`/`opener`/`stack` list the key segments in
// order, which is also the set of axes the data is allowed to vary over.
const ATLAS_SOURCES = Object.freeze({
  [SOURCE_RFI]: { prefix: 'RFI', segments: ['hero', 'stack'] },
  [SOURCE_VS_OPEN]: { prefix: 'VS_OPEN', segments: ['hero', 'opener', 'stack'] },
  [SOURCE_BB_DEFEND]: { prefix: 'BB_DEFEND', segments: ['opener', 'stack'] },
  [SOURCE_VS_3BET]: { prefix: 'VS_3BET', segments: ['hero', 'stack'] }
});

const PREFIX_TO_SOURCE = Object.freeze(
  Object.fromEntries(Object.entries(ATLAS_SOURCES).map(([id, cfg]) => [cfg.prefix, id]))
);

// Atlas keys carry no table-size segment, so every tuple in the pack describes a
// 6-max table. Reading them for a 9-max seat would be a silent substitution of a
// different game, so the atlas is declared 6-max only.
export const ATLAS_FORMAT = '6max';

export function atlasSupportsFormat(format) {
  return String(format || '') === ATLAS_FORMAT;
}

// Which atlas source serves a UI situation. `vs_open` splits by hero: the atlas
// stores BB's defending range under its own prefix.
export function sourceIdFor(situation, heroPosition) {
  const hero = normalizePosition(heroPosition);
  if (situation === 'rfi') return SOURCE_RFI;
  if (situation === 'vs_3bet') return SOURCE_VS_3BET;
  if (situation === 'push_fold') return SOURCE_PUSHFOLD;
  if (situation === 'vs_open') return hero === 'BB' ? SOURCE_BB_DEFEND : SOURCE_VS_OPEN;
  return null;
}

export function isAtlasSource(sourceId) {
  return Object.prototype.hasOwnProperty.call(ATLAS_SOURCES, sourceId);
}

// Builds the atlas tuple prefix (everything before the hand class) for a
// selection. Returns null when the selection cannot be expressed as a key.
export function atlasTupleKey(sel) {
  const sourceId = sourceIdFor(sel.situation, sel.position);
  if (!isAtlasSource(sourceId)) return null;
  if (sel.format !== undefined && !atlasSupportsFormat(sel.format)) return null;
  const cfg = ATLAS_SOURCES[sourceId];
  const values = {
    hero: normalizePosition(sel.position),
    opener: normalizePosition(sel.opener),
    stack: sel.stack
  };
  const parts = [cfg.prefix];
  for (const seg of cfg.segments) {
    const v = values[seg];
    if (v === null || v === undefined || v === '') return null;
    parts.push(String(v));
  }
  return parts.join('|');
}

export function atlasHandKey(sel, hand) {
  const tuple = atlasTupleKey(sel);
  return tuple ? `${tuple}|${hand}` : null;
}

function policyFingerprint(pack, tupleKey) {
  const pre = pack.preflop;
  const parts = [];
  for (const hand of matrixClasses()) {
    const p = pre[`${tupleKey}|${hand}`];
    if (!p) return null;
    parts.push(`${p.FOLD || 0}/${p.CALL || 0}/${p.RAISE || 0}`);
  }
  return parts.join(';');
}

function parseTupleKey(key) {
  const parts = key.split('|');
  const sourceId = PREFIX_TO_SOURCE[parts[0]];
  if (!sourceId) return null;
  const cfg = ATLAS_SOURCES[sourceId];
  if (parts.length !== cfg.segments.length + 1) return null;
  const out = { sourceId, hero: null, opener: null, stack: null };
  cfg.segments.forEach((seg, i) => {
    const raw = parts[i + 1];
    out[seg] = seg === 'stack' ? Number(raw) : raw;
  });
  return out;
}

// Does the data vary along `axis` when every other axis is held fixed?
function axisDiscriminates(tuples, axis, otherAxes) {
  const groups = new Map();
  for (const t of tuples) {
    const groupKey = otherAxes.map((a) => String(t[a])).join('|');
    if (!groups.has(groupKey)) groups.set(groupKey, new Set());
    groups.get(groupKey).add(t.fingerprint);
  }
  for (const set of groups.values()) {
    if (set.size > 1) return true;
  }
  return false;
}

// Indexes every atlas tuple present in the pack and works out which axes carry
// information. Result is cached per pack object.
const INDEX_CACHE = new WeakMap();

export function buildExactIndex(pack) {
  if (!pack || !pack.preflop) {
    return { sources: {}, stacks: [], tupleCount: 0, duplicateGroups: [] };
  }
  if (INDEX_CACHE.has(pack)) return INDEX_CACHE.get(pack);

  const seen = new Set();
  for (const key of Object.keys(pack.preflop)) {
    const idx = key.lastIndexOf('|');
    if (idx > 0) seen.add(key.slice(0, idx));
  }

  const sources = {};
  const allStacks = new Set();
  const fingerprintIndex = new Map();

  for (const tupleKey of seen) {
    const parsed = parseTupleKey(tupleKey);
    if (!parsed) continue;
    const fingerprint = policyFingerprint(pack, tupleKey);
    if (!fingerprint) continue;
    const entry = { ...parsed, key: tupleKey, fingerprint };
    if (!sources[parsed.sourceId]) {
      sources[parsed.sourceId] = { id: parsed.sourceId, tuples: [], byKey: new Map() };
    }
    sources[parsed.sourceId].tuples.push(entry);
    sources[parsed.sourceId].byKey.set(tupleKey, entry);
    if (Number.isFinite(parsed.stack)) allStacks.add(parsed.stack);
    if (!fingerprintIndex.has(fingerprint)) fingerprintIndex.set(fingerprint, []);
    fingerprintIndex.get(fingerprint).push(tupleKey);
  }

  for (const [sourceId, source] of Object.entries(sources)) {
    const cfg = ATLAS_SOURCES[sourceId];
    const axes = cfg.segments;
    source.discrimination = {};
    for (const axis of axes) {
      const others = axes.filter((a) => a !== axis);
      const values = new Set(source.tuples.map((t) => String(t[axis])));
      source.discrimination[axis] = values.size <= 1
        ? null // only one value present, nothing to discriminate
        : axisDiscriminates(source.tuples, axis, others);
    }
    source.heroes = [...new Set(source.tuples.map((t) => t.hero).filter(Boolean))];
    source.openers = [...new Set(source.tuples.map((t) => t.opener).filter(Boolean))];
    source.stacks = [...new Set(source.tuples.map((t) => t.stack).filter(Number.isFinite))]
      .sort((a, b) => a - b);
    source.distinctRanges = new Set(source.tuples.map((t) => t.fingerprint)).size;
  }

  const duplicateGroups = [...fingerprintIndex.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort());

  const index = {
    sources,
    stacks: [...allStacks].sort((a, b) => a - b),
    tupleCount: seen.size,
    duplicateGroups
  };
  INDEX_CACHE.set(pack, index);
  return index;
}

export function getSourceIndex(pack, sourceId) {
  return buildExactIndex(pack).sources[sourceId] || null;
}

export function hasExactTuple(pack, sel) {
  const tupleKey = atlasTupleKey(sel);
  if (!tupleKey) return false;
  const sourceId = sourceIdFor(sel.situation, sel.position);
  const source = getSourceIndex(pack, sourceId);
  return !!(source && source.byKey.has(tupleKey));
}

// A stack axis that carries no information is collapsed into a band instead of
// pretending each depth is a separate range.
export function stackBandFor(pack, sourceId) {
  const source = getSourceIndex(pack, sourceId);
  if (!source || !source.stacks.length) return null;
  const collapsed = source.discrimination.stack === false;
  return {
    stacks: [...source.stacks],
    collapsed,
    min: source.stacks[0],
    max: source.stacks[source.stacks.length - 1],
    representative: source.stacks[0]
  };
}

export function describeSource(pack, sel) {
  const sourceId = sourceIdFor(sel.situation, sel.position);
  if (!sourceId) return null;
  if (sourceId === SOURCE_PUSHFOLD) {
    return {
      id: sourceId,
      label: SOURCE_LABELS[sourceId],
      kind: 'FORMULA',
      key: null,
      precision: precisionFor(sourceId)
    };
  }
  const tupleKey = atlasTupleKey(sel);
  if (!tupleKey || !hasExactTuple(pack, sel)) return null;
  return {
    id: sourceId,
    label: SOURCE_LABELS[sourceId],
    kind: 'ATLAS',
    key: tupleKey,
    precision: precisionFor(sourceId)
  };
}

export function lookupPolicyExact(pack, sel, hand) {
  if (!pack || !pack.preflop) return null;
  const key = atlasHandKey(sel, hand);
  if (!key) return null;
  return pack.preflop[key] || null;
}

export { ATLAS_SOURCES };
