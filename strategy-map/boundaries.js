/**
 * Strategic boundary detection
 */

import { normalizeActions, entropy, normalizedEntropy } from './math.js';

export function findBoundaryHands(range, options = {}) {
  const {
    entropyThreshold = 0.5,
    minActiveActions = 2
  } = options;

  if (!range || !range.hands) {
    return {
      boundaryHands: [],
      pureHands: [],
      mixedHands: [],
      highEntropyHands: [],
      summary: {
        totalBoundary: 0,
        totalPure: 0,
        totalMixed: 0,
        totalHighEntropy: 0
      }
    };
  }

  const boundaryHands = [];
  const pureHands = [];
  const mixedHands = [];
  const highEntropyHands = [];

  for (const [hand, data] of Object.entries(range.hands)) {
    const actions = data.actions || {};
    const normalized = normalizeActions(actions);
    const activeActions = Object.keys(normalized).length;

    if (activeActions === 0) continue;

    const ent = entropy(normalized);
    const normEnt = normalizedEntropy(normalized);

    if (activeActions === 1) {
      pureHands.push({ hand, actions: normalized });
    } else if (activeActions >= minActiveActions) {
      const entry = { hand, actions: normalized, entropy: ent, normalizedEntropy: normEnt };
      mixedHands.push(entry);

      if (normEnt > entropyThreshold) {
        boundaryHands.push({ ...entry, isBoundary: true });
      }

      if (ent > 0) {
        highEntropyHands.push({ ...entry, isHighEntropy: true });
      }
    }
  }

  boundaryHands.sort((a, b) => b.entropy - a.entropy);
  mixedHands.sort((a, b) => b.entropy - a.entropy);
  highEntropyHands.sort((a, b) => b.entropy - a.entropy);

  return {
    boundaryHands,
    pureHands,
    mixedHands,
    highEntropyHands,
    summary: {
      totalBoundary: boundaryHands.length,
      totalPure: pureHands.length,
      totalMixed: mixedHands.length,
      totalHighEntropy: highEntropyHands.length
    }
  };
}

export function compareBoundaries(rangeA, rangeB, options = {}) {
  const {
    entropyThreshold = 0.5
  } = options;

  const boundariesA = findBoundaryHands(rangeA, { entropyThreshold });
  const boundariesB = findBoundaryHands(rangeB, { entropyThreshold });

  const boundaryHandsA = new Set(boundariesA.boundaryHands.map(h => h.hand));
  const boundaryHandsB = new Set(boundariesB.boundaryHands.map(h => h.hand));

  const allBoundaryHands = new Set([...boundaryHandsA, ...boundaryHandsB]);

  const gained = [];
  const lost = [];
  const stable = [];

  for (const hand of allBoundaryHands) {
    const inA = boundaryHandsA.has(hand);
    const inB = boundaryHandsB.has(hand);

    if (inA && !inB) {
      lost.push(hand);
    } else if (!inA && inB) {
      gained.push(hand);
    } else if (inA && inB) {
      stable.push(hand);
    }
  }

  return {
    gained,
    lost,
    stable,
    summary: {
      numGained: gained.length,
      numLost: lost.length,
      numStable: stable.length,
      similarity: allBoundaryHands.size > 0 ? 
        stable.length / allBoundaryHands.size : 1
    }
  };
}
