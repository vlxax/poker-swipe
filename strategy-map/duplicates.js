/**
 * Duplicate and near-duplicate detection
 * OFFLINE operation - expensive full comparison
 */

import { compareStrategySimilarity } from './similarity.js';
import { buildRangeFingerprint } from './fingerprint.js';

const EPSILON = 0.001;

export function findDuplicateStrategies(library, options = {}) {
  const {
    exactThreshold = 0.999,
    nearThreshold = 0.95,
    minClusterSize = 2
  } = options;

  if (!library || library.length === 0) {
    return {
      exactDuplicates: [],
      nearDuplicates: [],
      distinct: [],
      summary: {
        totalRanges: 0,
        duplicateCount: 0,
        nearDuplicateCount: 0,
        distinctCount: 0
      }
    };
  }

  const ranges = library.map((r, i) => ({
    id: r.id || r.rangeId || `range-${i}`,
    range: r,
    fingerprint: buildRangeFingerprint(r)
  }));

  const processed = new Set();
  const exactDuplicates = [];
  const nearDuplicates = [];
  const distinct = [];

  for (let i = 0; i < ranges.length; i++) {
    if (processed.has(i)) continue;

    const current = ranges[i];
    const exactGroup = {
      primary: { id: current.id, range: current.range },
      duplicates: []
    };
    const nearGroup = {
      primary: { id: current.id, range: current.range },
      duplicates: []
    };

    let hasExact = false;
    let hasNear = false;

    for (let j = i + 1; j < ranges.length; j++) {
      if (processed.has(j)) continue;

      const comparison = compareStrategySimilarity(current.range, ranges[j].range);
      const similarity = comparison.similarity;

      if (similarity >= exactThreshold - EPSILON) {
        exactGroup.duplicates.push({
          id: ranges[j].id,
          range: ranges[j].range,
          similarity,
          type: 'EXACT'
        });
        processed.add(j);
        hasExact = true;
      } else if (similarity >= nearThreshold) {
        nearGroup.duplicates.push({
          id: ranges[j].id,
          range: ranges[j].range,
          similarity,
          type: 'NEAR'
        });
        processed.add(j);
        hasNear = true;
      }
    }

    if (exactGroup.duplicates.length > 0) {
      exactDuplicates.push({
        primary: exactGroup.primary,
        duplicates: exactGroup.duplicates,
        clusterSize: 1 + exactGroup.duplicates.length
      });
    }

    if (nearGroup.duplicates.length > 0 && !hasExact) {
      nearDuplicates.push({
        primary: nearGroup.primary,
        duplicates: nearGroup.duplicates,
        clusterSize: 1 + nearGroup.duplicates.length
      });
    }

    if (exactGroup.duplicates.length === 0 && nearGroup.duplicates.length === 0) {
      distinct.push(current.id);
    }

    processed.add(i);
  }

  return {
    exactDuplicates,
    nearDuplicates,
    distinct,
    summary: {
      totalRanges: ranges.length,
      duplicateCount: exactDuplicates.reduce((a, b) => a + b.duplicates.length, 0),
      nearDuplicateCount: nearDuplicates.reduce((a, b) => a + b.duplicates.length, 0),
      distinctCount: distinct.length
    }
  };
}
