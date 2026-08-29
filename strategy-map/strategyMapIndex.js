/**
 * Strategy map index for efficient lookups
 */

import { buildRangeFingerprint } from './fingerprint.js';
import { compareStrategySimilarity } from './similarity.js';
import { findNearestRanges } from './neighbors.js';

export class StrategyMapIndex {
  constructor(options = {}) {
    this.options = {
      cacheFingerprints: true,
      candidatePoolSize: 50,
      ...options
    };

    this.ranges = new Map();
    this.fingerprints = new Map();
    this.metadataIndex = new Map();
    this.familyIndex = new Map();
    this.stackIndex = new Map();
    this.positionIndex = new Map();
  }

  add(range) {
    const id = range.id || range.rangeId;
    if (!id) {
      console.warn('Range has no id, skipping');
      return;
    }

    if (this.ranges.has(id)) {
      this.remove(id);
    }

    this.ranges.set(id, range);

    if (this.options.cacheFingerprints) {
      const fp = buildRangeFingerprint(range);
      this.fingerprints.set(id, fp);
    }

    const metadata = range.metadata || {};
    this.indexMetadata(id, metadata);
  }

  replace(range) {
    this.add(range);
  }

  remove(id) {
    if (!this.ranges.has(id)) return false;
    const existing = this.ranges.get(id);
    this.unindexMetadata(id, existing?.metadata || {});
    this.ranges.delete(id);
    this.fingerprints.delete(id);
    return true;
  }

  indexMetadata(id, metadata) {
    const family = metadata.category || metadata.family || 'unknown';
    this._pushUnique(this.familyIndex, family, id);

    const stack = metadata.stack != null && metadata.stack !== '' ? String(metadata.stack) : 'unknown';
    this._pushUnique(this.stackIndex, stack, id);

    const position = metadata.heroPosition || metadata.position || 'unknown';
    this._pushUnique(this.positionIndex, position, id);

    for (const [key, value] of Object.entries(metadata)) {
      const indexKey = `meta_${key}_${String(value)}`;
      this._pushUnique(this.metadataIndex, indexKey, id);
    }
  }

  unindexMetadata(id, metadata) {
    const family = metadata.category || metadata.family || 'unknown';
    this._removeId(this.familyIndex, family, id);

    const stack = metadata.stack != null && metadata.stack !== '' ? String(metadata.stack) : 'unknown';
    this._removeId(this.stackIndex, stack, id);

    const position = metadata.heroPosition || metadata.position || 'unknown';
    this._removeId(this.positionIndex, position, id);

    for (const [key, value] of Object.entries(metadata)) {
      const indexKey = `meta_${key}_${String(value)}`;
      this._removeId(this.metadataIndex, indexKey, id);
    }
  }

  _pushUnique(map, key, id) {
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.includes(id)) list.push(id);
  }

  _removeId(map, key, id) {
    const list = map.get(key);
    if (!list) return;
    const next = list.filter((x) => x !== id);
    if (next.length) map.set(key, next);
    else map.delete(key);
  }

  get(id) {
    return this.ranges.get(id);
  }

  getFingerprint(id) {
    if (this.options.cacheFingerprints) {
      return this.fingerprints.get(id);
    }
    const range = this.ranges.get(id);
    return range ? buildRangeFingerprint(range) : null;
  }

  findNeighbors(id, options = {}) {
    const range = this.ranges.get(id);
    if (!range) return [];

    const library = Array.from(this.ranges.values());
    const mergedOptions = {
      candidatePoolSize: this.options.candidatePoolSize,
      fullCompareFn: options.fullCompareFn || this.options.fullCompareFn,
      ...options
    };

    return findNearestRanges(range, library, mergedOptions);
  }

  findFamily(id) {
    const range = this.ranges.get(id);
    if (!range) return [];

    const family = range.metadata?.category || range.metadata?.family;
    if (!family) return [];

    return this.familyIndex.get(family) || [];
  }

  compare(idA, idB) {
    const rangeA = this.ranges.get(idA);
    const rangeB = this.ranges.get(idB);
    if (!rangeA || !rangeB) return null;

    return compareStrategySimilarity(rangeA, rangeB);
  }

  getByStack(stack) {
    const stackKey = String(stack);
    return this.stackIndex.get(stackKey) || [];
  }

  getByPosition(position) {
    return this.positionIndex.get(position) || [];
  }

  getByMetadata(key, value) {
    const indexKey = `meta_${key}_${String(value)}`;
    return this.metadataIndex.get(indexKey) || [];
  }

  getStats() {
    return {
      totalRanges: this.ranges.size,
      totalFamilies: this.familyIndex.size,
      totalStacks: this.stackIndex.size,
      totalPositions: this.positionIndex.size,
      cachedFingerprints: this.fingerprints.size
    };
  }

  clear() {
    this.ranges.clear();
    this.fingerprints.clear();
    this.metadataIndex.clear();
    this.familyIndex.clear();
    this.stackIndex.clear();
    this.positionIndex.clear();
  }
}
