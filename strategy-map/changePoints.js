/**
 * Change-point detection across ordered ranges
 */

import { compareStrategySimilarity } from './similarity.js';
import { mean, median, standardDeviation, clamp } from './math.js';
import { extractStackValue } from './transitions.js';

export function detectChangePoints(ranges, options = {}) {
  const {
    thresholdMultiplier = 1.5,
    minChangeMagnitude = 0.1,
    minTransitions = 3
  } = options;

  if (!ranges || ranges.length < 2) {
    return {
      changePoints: [],
      summary: {
        totalChangePoints: 0,
        averageMagnitude: 0,
        largestChange: null,
        threshold: 0,
        meanMagnitude: 0,
        stdMagnitude: 0,
        hasEnoughData: false
      }
    };
  }

  const sorted = sortRangesByStack(ranges);
  const magnitudes = [];
  const comparisons = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const comparison = compareStrategySimilarity(from, to);
    const magnitude = 1 - comparison.similarity;
    magnitudes.push(magnitude);
    comparisons.push({
      from: from,
      to: to,
      comparison,
      magnitude,
      index: i
    });
  }

  const changePoints = [];
  let threshold = minChangeMagnitude;
  let meanMag = 0;
  let stdMag = 0;
  let hasEnoughData = magnitudes.length >= minTransitions;
  let confidence = 'low_sample';

  if (hasEnoughData) {
    meanMag = mean(magnitudes);
    stdMag = standardDeviation(magnitudes);
    threshold = Math.max(meanMag + thresholdMultiplier * stdMag, minChangeMagnitude);
    confidence = 'statistical';
  } else {
    threshold = minChangeMagnitude;
  }

  for (let i = 0; i < comparisons.length; i++) {
    const cmp = comparisons[i];

    if (cmp.magnitude >= threshold) {
      const affectedHands = cmp.comparison.changedHands.map(h => ({
        hand: h.hand,
        changeMagnitude: h.distance || 0
      }));

      changePoints.push({
        from: cmp.from.id || cmp.from.rangeId || `range-${cmp.index}`,
        to: cmp.to.id || cmp.to.rangeId || `range-${cmp.index + 1}`,
        magnitude: cmp.magnitude,
        affectedHands: affectedHands,
        affectedHandCount: cmp.comparison.numChangedHands || 0,
        zScore: hasEnoughData && stdMag > 0 ? (cmp.magnitude - meanMag) / stdMag : 0,
        confidence: confidence,
        statisticallySignificant: confidence === 'statistical',
        threshold
      });
    }
  }

  changePoints.sort((a, b) => b.magnitude - a.magnitude);

  return {
    changePoints,
    summary: {
      totalChangePoints: changePoints.length,
      averageMagnitude: changePoints.length > 0 ? 
        changePoints.reduce((s, c) => s + c.magnitude, 0) / changePoints.length : 0,
      largestChange: changePoints.length > 0 ? changePoints[0] : null,
      threshold,
      meanMagnitude: meanMag,
      stdMagnitude: stdMag,
      hasEnoughData
    }
  };
}

function sortRangesByStack(ranges) {
  return [...ranges].sort((a, b) => {
    const stackA = extractStackValue(a.metadata?.stack);
    const stackB = extractStackValue(b.metadata?.stack);
    return stackA - stackB;
  });
}
