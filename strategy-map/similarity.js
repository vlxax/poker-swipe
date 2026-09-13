/**
 * Range similarity comparison
 */

import { 
  jensenShannonDistance, 
  normalizeActions,
  clamp 
} from './math.js';
import { buildRangeFingerprint, compareFingerprints } from './fingerprint.js';

export function compareStrategySimilarity(rangeA, rangeB, options = {}) {
  const {
    significanceThreshold = 0.05,
    includeUnchanged = true
  } = options;

  if (!rangeA || !rangeB) {
    return {
      similarity: 0,
      distance: 1,
      changedHands: [],
      stableHands: [],
      biggestChanges: [],
      actionChanges: {},
      boundaryChanges: {},
      numChangedHands: 0,
      numStableHands: 0,
      fingerprintSimilarity: 0
    };
  }

  const handsA = rangeA.hands || {};
  const handsB = rangeB.hands || {};
  const allHands = new Set([...Object.keys(handsA), ...Object.keys(handsB)]);

  const handDistances = {};
  const changedHands = [];
  const stableHands = [];
  const biggestChanges = [];
  const actionChanges = {};
  const boundaryChanges = {};

  for (const hand of allHands) {
    const actionsA = handsA[hand]?.actions || {};
    const actionsB = handsB[hand]?.actions || {};

    const normA = normalizeActions(actionsA);
    const normB = normalizeActions(actionsB);

    const allActions = new Set([...Object.keys(normA), ...Object.keys(normB)]);

    const distA = {};
    const distB = {};
    for (const action of allActions) {
      distA[action] = normA[action] || 0;
      distB[action] = normB[action] || 0;
    }

    const distance = jensenShannonDistance(distA, distB);

    handDistances[hand] = distance;

    const changes = [];
    for (const action of allActions) {
      const freqA = distA[action] || 0;
      const freqB = distB[action] || 0;
      const diff = Math.abs(freqB - freqA);

      if (diff > significanceThreshold) {
        changes.push({
          action,
          from: freqA,
          to: freqB,
          delta: freqB - freqA
        });

        if (!actionChanges[action]) {
          actionChanges[action] = { totalChange: 0, count: 0 };
        }
        actionChanges[action].totalChange += diff;
        actionChanges[action].count++;
      }
    }

    if (changes.length > 0) {
      changedHands.push({ hand, changes, distance });
      biggestChanges.push({ hand, changes, distance });
    } else if (includeUnchanged) {
      stableHands.push(hand);
    }

    const hasBoundaryA = Object.values(distA).some(v => v > 0.3 && v < 0.7);
    const hasBoundaryB = Object.values(distB).some(v => v > 0.3 && v < 0.7);
    if (hasBoundaryA !== hasBoundaryB) {
      boundaryChanges[hand] = {
        from: hasBoundaryA,
        to: hasBoundaryB
      };
    }
  }

  biggestChanges.sort((a, b) => b.distance - a.distance);

  const distances = Object.values(handDistances);
  const avgDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 1;
  const overallSimilarity = 1 - avgDistance;

  const fpA = buildRangeFingerprint(rangeA);
  const fpB = buildRangeFingerprint(rangeB);
  const fpComparison = compareFingerprints(fpA, fpB);

  return {
    similarity: clamp(overallSimilarity, 0, 1),
    distance: clamp(avgDistance, 0, 1),
    changedHands,
    stableHands,
    biggestChanges: biggestChanges.slice(0, 10),
    actionChanges,
    boundaryChanges,
    numChangedHands: changedHands.length,
    numStableHands: stableHands.length,
    fingerprintSimilarity: fpComparison.overallSimilarity
  };
}
