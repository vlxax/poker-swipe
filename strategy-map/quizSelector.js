/**
 * Quiz candidate selection engine
 */

import { compareStrategySimilarity } from './similarity.js';
import { findBoundaryHands } from './boundaries.js';
import { normalizedEntropy } from './math.js';

export function selectTransitionQuizHands(rangeA, rangeB, options = {}) {
  const {
    maxHands = 10,
    minChangeThreshold = 0.05,
    maxRepeat = 3,
    learnerWeakness = null,
    rng = Math.random
  } = options;

  if (!rangeA || !rangeB) {
    return [];
  }

  const comparison = compareStrategySimilarity(rangeA, rangeB);
  const boundariesA = findBoundaryHands(rangeA);
  const boundariesB = findBoundaryHands(rangeB);

  const allBoundaryA = new Set(boundariesA.boundaryHands.map(h => h.hand));
  const allBoundaryB = new Set(boundariesB.boundaryHands.map(h => h.hand));

  const candidates = [];

  const allChanged = comparison.changedHands;

  for (const change of allChanged) {
    const hand = change.hand;
    const changes = change.changes || [];
    const magnitude = change.distance || 0;

    if (magnitude < minChangeThreshold) continue;

    const frequencyScore = Math.min(magnitude * 2, 1);

    let boundaryScore = 0;
    for (const c of changes) {
      if ((c.from > 0.5 && c.to < 0.5) || (c.from < 0.5 && c.to > 0.5)) {
        boundaryScore = 1;
        break;
      }
    }

    let actionScore = 0;
    for (const c of changes) {
      if ((c.from === 0 && c.to > 0) || (c.from > 0 && c.to === 0)) {
        actionScore = 1;
        break;
      }
    }

    const isBoundaryA = allBoundaryA.has(hand);
    const isBoundaryB = allBoundaryB.has(hand);
    const boundaryChange = isBoundaryA !== isBoundaryB;

    let entropyScore = 0;
    const actionsA = rangeA.hands?.[hand]?.actions || {};
    const actionsB = rangeB.hands?.[hand]?.actions || {};
    const entropyA = normalizedEntropy(actionsA);
    const entropyB = normalizedEntropy(actionsB);
    entropyScore = Math.max(entropyA, entropyB);

    let weaknessScore = 0;
    if (learnerWeakness && learnerWeakness[hand]) {
      weaknessScore = learnerWeakness[hand];
    }

    let repeatPenalty = 0;
    if (options.recentHands && options.recentHands.includes(hand)) {
      const count = options.recentHands.filter(h => h === hand).length;
      repeatPenalty = Math.min(count / maxRepeat, 1) * 0.3;
    }

    const totalScore = (
      frequencyScore * 0.25 +
      boundaryScore * 0.20 +
      actionScore * 0.15 +
      (boundaryChange ? 0.15 : 0) +
      entropyScore * 0.10 +
      weaknessScore * 0.15
    ) * (1 - repeatPenalty);

    candidates.push({
      hand,
      changes,
      magnitude,
      score: totalScore,
      breakdown: {
        frequency: frequencyScore,
        boundary: boundaryScore,
        action: actionScore,
        boundaryChange,
        entropy: entropyScore,
        weakness: weaknessScore,
        repeatPenalty
      }
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const topCandidates = candidates.slice(0, Math.min(20, candidates.length));
  const selected = [];
  const used = new Set();

  if (topCandidates.length > 0) {
    const first = topCandidates[0];
    selected.push(first);
    used.add(first.hand);
  }

  const remaining = topCandidates.filter(c => !used.has(c.hand));
  const maxToSelect = Math.min(maxHands - selected.length, remaining.length);

  for (let i = 0; i < maxToSelect; i++) {
    const weights = remaining.map(c => Math.max(c.score, 0.01));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let random = rng() * totalWeight;
    let selectedIdx = 0;
    for (let j = 0; j < weights.length; j++) {
      random -= weights[j];
      if (random <= 0) {
        selectedIdx = j;
        break;
      }
    }

    const selectedItem = remaining[selectedIdx];
    selected.push(selectedItem);
    used.add(selectedItem.hand);
    remaining.splice(selectedIdx, 1);
  }

  return selected;
}
