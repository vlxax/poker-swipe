/**
 * Cached Strategy Map over production PokerSwipe ranges.
 *
 * Default structural library = reference 6-max (37 Greenline charts).
 * Trainer charts (1698 on the reconstructed library) are a separate
 * production source; use getCombinedRangeInventory / adaptTrainerRange.
 * Do not replace the trainer library with the 37 reference ranges.
 */

import { StrategyMapEngine } from '../strategy-map/index.js';
import { getReferenceRanges } from '../ranges-ui/referenceRanges.js';
import { adaptReferenceLibrary } from './rangeAdapter.js';
import { datasetStrategyVersion } from './strategyVersion.js';
import { findBoundaryHands } from '../strategy-map/boundaries.js';
import { analyzeVolatility } from '../strategy-map/volatility.js';

let _cache = null;

export function getProductionStrategyMap({ force = false, ranges = null } = {}) {
  if (!force && !ranges && _cache) {
    return _cache;
  }

  const sourceRanges = ranges || getReferenceRanges();
  const { adapted, failed } = adaptReferenceLibrary(sourceRanges);
  const version = datasetStrategyVersion(adapted);

  if (!force && _cache && _cache.version === version) {
    return _cache;
  }

  const engine = new StrategyMapEngine();
  engine.loadLibrary(adapted);

  const byId = new Map(adapted.map((r) => [r.id, r]));
  const boundaryByRange = new Map();
  for (const r of adapted) {
    const b = findBoundaryHands(r);
    boundaryByRange.set(r.id, new Set(b.boundaryHands.map((h) => h.hand)));
  }

  _cache = {
    engine,
    adapted,
    failed,
    byId,
    boundaryByRange,
    version,
    builtAt: Date.now(),
    sourceCount: sourceRanges.length
  };
  return _cache;
}

export function resetProductionStrategyMap() {
  _cache = null;
}

export function loadProductionLibraryInto(engine, ranges = null) {
  const sourceRanges = ranges || getReferenceRanges();
  const { adapted, failed } = adaptReferenceLibrary(sourceRanges);
  engine.loadLibrary(adapted);
  return { adapted, failed, version: datasetStrategyVersion(adapted) };
}

export function signalsForItem(rangeId, hand) {
  const cache = getProductionStrategyMap();
  const range = cache.byId.get(rangeId);
  if (!range) return null;
  const fp = cache.engine.fingerprint(range);
  const boundary = cache.boundaryByRange.get(rangeId)?.has(hand) === true;
  return {
    boundaryHand: boundary,
    structuralDifficulty: fp.boundaryDensity || 0,
    volatileEdge: fp.mixedPercentage || 0,
    transitionMagnitude: 0
  };
}

export function stackTransitionsForFamily(familyKey) {
  const cache = getProductionStrategyMap();
  const family = cache.adapted.filter(
    (r) => (r.metadata.family === familyKey || r.metadata.heroPosition === familyKey)
      && r.metadata.stack != null
  );
  if (family.length < 2) return cache.engine.transitions(family);
  return cache.engine.transitions(family);
}

export { analyzeVolatility };
