/**
 * Production Strategy Map lifecycle.
 *
 * Trainer 1698 is the canonical trainer library (source: shards).
 * Reference 37 is a separate Greenline solver set — not a substitute trainer library.
 *
 * Dataset load:
 *   version → hydrate persisted structural index OR build fingerprints once → cache
 * Interaction:
 *   neighbor lookup uses cached fingerprints + metadata prefilter.
 *   Full pairwise graph is never built on the interaction path.
 */

import { StrategyMapEngine, compactFingerprint, fingerprintIsFinite } from '../strategy-map/index.js';
import { getReferenceRanges } from '../ranges-ui/referenceRanges.js';
import { adaptReferenceLibrary } from './rangeAdapter.js';
import { datasetStrategyVersion } from './strategyVersion.js';
import { findBoundaryHands } from '../strategy-map/boundaries.js';
import { analyzeVolatility } from '../strategy-map/volatility.js';
import { listCharts, getTrainerMeta } from '../trainer-knowledge/lookup.js';
import { adaptTrainerLibrary, adaptTrainerChartById } from './trainerLibrary.js';
import {
  computeDatasetVersion,
  serializeStructuralIndex,
  writeStructuralCache,
  readStructuralCache,
  cacheMatchesVersion,
  ADAPTER_VERSION
} from './strategyMapCache.js';

let _trainer = null;
let _reference = null;

function trainerDatasetVersion() {
  const meta = getTrainerMeta() || {};
  const charts = listCharts();
  return computeDatasetVersion({
    builtAt: meta.builtAt,
    chartCount: charts.length,
    extra: `${ADAPTER_VERSION}`
  });
}

function attachLazyLoader(engine) {
  engine.index.setRangeLoader((id) => {
    const result = adaptTrainerChartById(id);
    return result.ok ? result.range : null;
  });
}

export function getReferenceStrategyMap({ force = false } = {}) {
  if (!force && _reference) return _reference;
  const sourceRanges = getReferenceRanges();
  const { adapted, failed } = adaptReferenceLibrary(sourceRanges);
  const version = datasetStrategyVersion(adapted);
  if (!force && _reference && _reference.version === version) return _reference;
  const engine = new StrategyMapEngine();
  engine.loadLibrary(adapted);
  const byId = new Map(adapted.map((r) => [r.id, r]));
  const boundaryByRange = new Map();
  for (const r of adapted) {
    const b = findBoundaryHands(r);
    boundaryByRange.set(r.id, new Set(b.boundaryHands.map((h) => h.hand)));
  }
  _reference = {
    library: 'reference',
    engine,
    adapted,
    failed,
    byId,
    boundaryByRange,
    version,
    builtAt: Date.now(),
    sourceCount: sourceRanges.length,
    hydrated: false
  };
  return _reference;
}

function hydrateTrainerFromCache(payload, version) {
  const engine = new StrategyMapEngine();
  const fingerprints = new Map();
  const metadata = new Map();
  for (const [id, fp] of Object.entries(payload.fingerprints || {})) {
    fingerprints.set(id, fp);
    engine.index.fingerprints.set(id, fp);
  }
  for (const [id, meta] of Object.entries(payload.metadata || {})) {
    metadata.set(id, meta);
    const stub = { id, hands: {}, metadata: meta };
    engine.index.ranges.set(id, stub);
    engine.index.indexMetadata(id, meta);
  }
  attachLazyLoader(engine);
  const byId = new Map();
  const boundaryByRange = new Map();
  for (const [id, fp] of fingerprints) {
    if (Array.isArray(fp.boundaryHands)) boundaryByRange.set(id, new Set(fp.boundaryHands));
  }
  _trainer = {
    library: 'trainer',
    engine,
    adapted: [],
    failed: [],
    byId,
    boundaryByRange,
    version,
    builtAt: payload.builtAt || Date.now(),
    sourceCount: fingerprints.size,
    hydrated: true,
    fingerprints
  };
  return _trainer;
}

function buildTrainerIndex({ persist = true } = {}) {
  const version = trainerDatasetVersion();
  const { adapted, failed } = adaptTrainerLibrary();
  const engine = new StrategyMapEngine();
  engine.loadLibrary(adapted);
  attachLazyLoader(engine);
  const byId = new Map(adapted.map((r) => [r.id, r]));
  const boundaryByRange = new Map();
  const fingerprints = new Map();
  for (const r of adapted) {
    const fp = engine.index.getFingerprint(r.id);
    fingerprints.set(r.id, compactFingerprint(fp));
    const b = findBoundaryHands(r);
    boundaryByRange.set(r.id, new Set(b.boundaryHands.map((h) => h.hand)));
  }
  const payload = serializeStructuralIndex({
    version,
    fingerprints,
    metadata: new Map(adapted.map((r) => [r.id, r.metadata])),
    stats: { adapted: adapted.length, failed: failed.length }
  });
  if (persist) {
    try { writeStructuralCache(payload); } catch { /* quota / readonly */ }
  }
  _trainer = {
    library: 'trainer',
    engine,
    adapted,
    failed,
    byId,
    boundaryByRange,
    version,
    builtAt: Date.now(),
    sourceCount: adapted.length,
    hydrated: false,
    fingerprints
  };
  return _trainer;
}

export function getTrainerStrategyMap({ force = false, persist = true } = {}) {
  const version = trainerDatasetVersion();
  if (!force && _trainer && _trainer.version === version) return _trainer;

  if (!force) {
    const cached = readStructuralCache();
    if (cached?.ok && cacheMatchesVersion(cached.payload, version)) {
      return hydrateTrainerFromCache(cached.payload, version);
    }
  }

  return buildTrainerIndex({ persist });
}

/**
 * Default production map = trainer 1698 structural index.
 * Pass library: 'reference' for the 37 Greenline charts.
 */
export function getProductionStrategyMap({ force = false, ranges = null, library = 'trainer', persist = true } = {}) {
  if (ranges) {
    const { adapted, failed } = adaptReferenceLibrary(ranges);
    const engine = new StrategyMapEngine();
    engine.loadLibrary(adapted);
    return {
      library: 'custom',
      engine,
      adapted,
      failed,
      byId: new Map(adapted.map((r) => [r.id, r])),
      boundaryByRange: new Map(),
      version: datasetStrategyVersion(adapted),
      builtAt: Date.now(),
      sourceCount: ranges.length,
      hydrated: false
    };
  }
  if (library === 'reference') return getReferenceStrategyMap({ force });
  return getTrainerStrategyMap({ force, persist });
}

export function resetProductionStrategyMap() {
  _trainer = null;
  _reference = null;
}

export function loadProductionLibraryInto(engine, ranges = null) {
  if (ranges) {
    const { adapted, failed } = adaptReferenceLibrary(ranges);
    engine.loadLibrary(adapted);
    return { adapted, failed, version: datasetStrategyVersion(adapted) };
  }
  const cache = getTrainerStrategyMap();
  const adapted = cache.adapted.length
    ? cache.adapted
    : [...cache.engine.index.ranges.values()].filter((r) => r.hands && Object.keys(r.hands).length);
  if (adapted.length) engine.loadLibrary(adapted);
  return { adapted, failed: cache.failed, version: cache.version };
}

function resolveCacheForId(rangeId) {
  const trainer = getTrainerStrategyMap();
  if (trainer.engine.index.ranges.has(rangeId) || trainer.byId.has(rangeId)) return trainer;
  const reference = getReferenceStrategyMap();
  if (reference.byId.has(rangeId)) return reference;
  return trainer;
}

export function signalsForItem(rangeId, hand) {
  const cache = resolveCacheForId(rangeId);
  let range = cache.byId.get(rangeId);
  if (!range && cache.engine.index.lazyRange) range = cache.engine.index.lazyRange(rangeId);
  if (!range && cache.engine.index.rangeLoader) {
    range = cache.engine.index.rangeLoader(rangeId);
    if (range) cache.byId.set(rangeId, range);
  }
  const fp = cache.engine.index.getFingerprint(rangeId) || (range ? cache.engine.fingerprint(range) : null);
  if (!fp) return null;
  const boundary = cache.boundaryByRange.get(rangeId)?.has(hand) === true;
  return {
    boundaryHand: boundary,
    structuralDifficulty: fp.boundaryDensity || 0,
    volatileEdge: fp.mixedPercentage || 0,
    transitionMagnitude: 0,
    fingerprintFinite: fingerprintIsFinite(fp)
  };
}

export function neighborsForRange(rangeId, options = {}) {
  const cache = resolveCacheForId(rangeId);
  const range = cache.byId.get(rangeId)
    || cache.engine.index.ranges.get(rangeId)
    || cache.engine.index.rangeLoader?.(rangeId);
  if (!range) return [];
  if (range && !cache.byId.has(rangeId) && range.hands && Object.keys(range.hands).length) {
    cache.byId.set(rangeId, range);
    cache.engine.index.ranges.set(rangeId, range);
  }
  return cache.engine.neighbors(range, options);
}

export function stackTransitionsForFamily(familyKey) {
  const cache = getReferenceStrategyMap();
  const family = cache.adapted.filter(
    (r) => (r.metadata.family === familyKey || r.metadata.heroPosition === familyKey)
      && r.metadata.stack != null
  );
  return cache.engine.transitions(family);
}

export { analyzeVolatility, trainerDatasetVersion };
