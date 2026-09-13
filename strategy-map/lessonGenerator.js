/**
 * Micro-lesson data generator
 */

import { compareStrategySimilarity } from './similarity.js';
import { findBoundaryHands } from './boundaries.js';

export function createTransitionLesson(rangeA, rangeB, options = {}) {
  const {
    maxHands = 10
  } = options;

  if (!rangeA || !rangeB) {
    return {
      titleData: { fromRange: null, toRange: null },
      unchangedCore: [],
      changedHands: [],
      biggestChanges: [],
      boundaryHands: [],
      quizCandidates: [],
      lessonMetrics: {}
    };
  }

  const comparison = compareStrategySimilarity(rangeA, rangeB);
  const boundariesA = findBoundaryHands(rangeA);
  const boundariesB = findBoundaryHands(rangeB);

  const titleData = {
    fromRange: rangeA.id || rangeA.rangeId || 'Unknown',
    toRange: rangeB.id || rangeB.rangeId || 'Unknown',
    fromMetadata: rangeA.metadata || {},
    toMetadata: rangeB.metadata || {}
  };

  const changedHands = comparison.changedHands.map(h => ({
    hand: h.hand,
    changes: h.changes,
    distance: h.distance
  }));

  const unchangedCore = comparison.stableHands.map(hand => ({ hand }));

  const biggestChanges = comparison.biggestChanges.map(h => ({
    hand: h.hand,
    changes: h.changes,
    distance: h.distance
  }));

  const boundaryHandsA = new Set(boundariesA.boundaryHands.map(h => h.hand));
  const boundaryHandsB = new Set(boundariesB.boundaryHands.map(h => h.hand));
  const allBoundaryHands = new Set([...boundaryHandsA, ...boundaryHandsB]);

  const boundaryHands = [];
  for (const hand of allBoundaryHands) {
    const inA = boundaryHandsA.has(hand);
    const inB = boundaryHandsB.has(hand);
    boundaryHands.push({
      hand,
      inA,
      inB,
      changed: inA !== inB
    });
  }

  const quizCandidates = selectQuizCandidates(comparison, boundariesA, boundariesB);

  const totalCompared = comparison.numChangedHands + comparison.numStableHands;
  const lessonMetrics = {
    similarity: comparison.similarity,
    distance: comparison.distance,
    numChangedHands: comparison.numChangedHands,
    numStableHands: comparison.numStableHands,
    totalHands: totalCompared,
    changePercentage: totalCompared > 0 ? (comparison.numChangedHands / totalCompared) * 100 : 0,
    boundaryChangeCount: Object.keys(comparison.boundaryChanges).length
  };

  return {
    titleData,
    unchangedCore: unchangedCore.slice(0, maxHands),
    changedHands: changedHands.slice(0, maxHands),
    biggestChanges: biggestChanges.slice(0, 10),
    boundaryHands: boundaryHands.slice(0, maxHands),
    quizCandidates: quizCandidates.slice(0, 5),
    lessonMetrics
  };
}

function selectQuizCandidates(comparison, boundariesA, boundariesB) {
  const candidates = [];

  const allBoundaryA = new Set(boundariesA.boundaryHands.map(h => h.hand));
  const allBoundaryB = new Set(boundariesB.boundaryHands.map(h => h.hand));

  for (const change of comparison.biggestChanges) {
    const hand = change.hand;
    const isBoundaryA = allBoundaryA.has(hand);
    const isBoundaryB = allBoundaryB.has(hand);

    candidates.push({
      hand,
      changeMagnitude: change.distance || 0,
      isBoundary: isBoundaryA || isBoundaryB,
      boundaryChanged: isBoundaryA !== isBoundaryB,
      score: change.distance * (isBoundaryA || isBoundaryB ? 1.5 : 1)
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const unique = [];
  const seen = new Set();
  for (const c of candidates) {
    if (!seen.has(c.hand)) {
      seen.add(c.hand);
      unique.push(c);
    }
  }

  return unique;
}
