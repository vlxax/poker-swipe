/**
 * Hand trajectory tracing across ordered ranges
 */

import { normalizeActions, entropy, normalizedEntropy, variance } from './math.js';
import { extractStackValue } from './transitions.js';

export function traceHandAcrossRanges(hand, orderedRanges) {
  if (!hand || !orderedRanges || orderedRanges.length === 0) {
    return {
      hand,
      trajectory: [],
      totalChange: 0,
      meanTransitionMagnitude: 0,
      volatility: 0,
      transitionPoints: [],
      summary: {
        numRanges: 0,
        avgEntropy: 0,
        avgNormalizedEntropy: 0
      }
    };
  }

  const sorted = sortRangesByStack(orderedRanges);
  const trajectory = [];
  let totalChange = 0;
  const changes = [];

  for (let i = 0; i < sorted.length; i++) {
    const range = sorted[i];
    const handData = range.hands?.[hand];
    const actions = handData?.actions || {};

    const normalized = normalizeActions(actions);
    const positive = Object.keys(normalized);
    const activeActions = positive.length;

    const ent = activeActions > 0 ? entropy(normalized) : 0;
    const normEnt = activeActions > 0 ? normalizedEntropy(normalized) : 0;
    const isPure = activeActions === 1;

    trajectory.push({
      range: range.id || range.rangeId || `range-${i}`,
      stack: range.metadata?.stack || 'unknown',
      actions: normalized,
      entropy: ent,
      normalizedEntropy: normEnt,
      isPure,
      activeActions,
      rangeData: range
    });

    if (i > 0) {
      const prev = trajectory[i - 1];
      let change = 0;
      const allActions = new Set([...Object.keys(prev.actions), ...Object.keys(normalized)]);
      for (const action of allActions) {
        const prevFreq = prev.actions[action] || 0;
        const currFreq = normalized[action] || 0;
        change += Math.abs(currFreq - prevFreq);
      }
      const avgChange = allActions.size > 0 ? change / allActions.size : 0;
      totalChange += avgChange;
      changes.push(avgChange);
    }
  }

  const meanTransitionMagnitude = changes.length > 0 ? 
    changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  const volatility = changes.length > 0 ? variance(changes) : 0;

  const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  const stdChange = changes.length > 1 ? 
    Math.sqrt(changes.reduce((a, b) => a + (b - avgChange) * (b - avgChange), 0) / changes.length) : 0;
  const threshold = avgChange + stdChange * 0.5;

  const transitionPoints = [];
  for (let i = 0; i < changes.length; i++) {
    if (changes[i] > threshold) {
      transitionPoints.push({
        from: trajectory[i].range,
        to: trajectory[i + 1].range,
        magnitude: changes[i],
        fromActions: trajectory[i].actions,
        toActions: trajectory[i + 1].actions
      });
    }
  }

  const avgEntropy = trajectory.reduce((s, t) => s + t.entropy, 0) / (trajectory.length || 1);
  const avgNormEntropy = trajectory.reduce((s, t) => s + t.normalizedEntropy, 0) / (trajectory.length || 1);

  return {
    hand,
    trajectory,
    totalChange,
    meanTransitionMagnitude,
    volatility,
    transitionPoints,
    summary: {
      numRanges: trajectory.length,
      avgEntropy,
      avgNormalizedEntropy: avgNormEntropy,
      mostActiveRange: trajectory.reduce((a, b) => a.activeActions > b.activeActions ? a : b),
      leastActiveRange: trajectory.reduce((a, b) => a.activeActions < b.activeActions ? a : b)
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
