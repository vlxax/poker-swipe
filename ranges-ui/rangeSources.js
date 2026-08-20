// Range source resolution — VERIFIED, REFERENCE, HEURISTIC, DERIVED.
// No hidden heuristic fallback when reference source is selected.

import { lookupPolicy, buildAtlasMatrix, handDetailFromAtlas } from './preflopAtlas.js';
import { buildPushFoldMatrix, handDetailFromPush } from './pushFold.js';
import {
  lookupReferenceRange,
  buildReferenceMatrix,
  handDetailFromReference,
  REFERENCE_USER_LABEL
} from './referenceRanges.js';

export const SOURCE_TYPES = {
  VERIFIED: 'verified',
  REFERENCE: 'reference',
  HEURISTIC: 'heuristic',
  DERIVED: 'derived'
};

export const DATA_SOURCES = [
  {
    id: 'verified',
    label: 'Модель турнира',
    sourceType: SOURCE_TYPES.VERIFIED,
    help: 'Диапазоны из внутренней модели с привязкой к стеку.'
  },
  {
    id: 'reference',
    label: REFERENCE_USER_LABEL,
    sourceType: SOURCE_TYPES.REFERENCE,
    help: 'Справочный префлоп-диапазон. Не является solver-верифицированным решением для конкретной структуры турнира.'
  }
];

export function dataSourceMeta(id) {
  return DATA_SOURCES.find((d) => d.id === id) || DATA_SOURCES[0];
}

export function resolveRangeMatrix(pack, sel) {
  const source = sel.dataSource || 'verified';

  if (sel.situation === 'push_fold') {
    if (source === 'reference') {
      return { cells: {}, found: 0, supported: false, sourceType: SOURCE_TYPES.REFERENCE };
    }
    return { ...buildPushFoldMatrix(sel), sourceType: SOURCE_TYPES.HEURISTIC };
  }

  if (source === 'reference') {
    const ref = buildReferenceMatrix(sel);
    return ref;
  }

  const atlas = buildAtlasMatrix(pack, sel);
  return { ...atlas, sourceType: SOURCE_TYPES.VERIFIED };
}

export function resolveHandDetail(pack, sel, hand) {
  const source = sel.dataSource || 'verified';

  if (sel.situation === 'push_fold') {
    if (source === 'reference') return null;
    return handDetailFromPush(sel, hand);
  }

  if (source === 'reference') {
    return handDetailFromReference(sel, hand);
  }

  return handDetailFromAtlas(pack, sel, hand);
}

export function hasExactRange(pack, sel) {
  const source = sel.dataSource || 'verified';

  if (sel.situation === 'push_fold') {
    return source !== 'reference';
  }

  if (source === 'reference') {
    return !!lookupReferenceRange(sel);
  }

  const probe = lookupPolicy(pack, sel, 'AA');
  return probe != null;
}

export function sourcePriority(sourceType) {
  const order = {
    [SOURCE_TYPES.VERIFIED]: 1,
    [SOURCE_TYPES.REFERENCE]: 2,
    [SOURCE_TYPES.DERIVED]: 3,
    [SOURCE_TYPES.HEURISTIC]: 4
  };
  return order[sourceType] || 99;
}

export function pickBestSource(pack, sel, preferredSource = 'verified') {
  if (preferredSource === 'reference') {
    if (lookupReferenceRange(sel)) return SOURCE_TYPES.REFERENCE;
    return null;
  }

  if (hasExactRange(pack, { ...sel, dataSource: 'verified' })) {
    return SOURCE_TYPES.VERIFIED;
  }
  if (lookupReferenceRange(sel)) return SOURCE_TYPES.REFERENCE;
  if (sel.situation === 'push_fold') return SOURCE_TYPES.HEURISTIC;
  return null;
}
