/**
 * Stable core vs volatile edge analysis
 */

import { traceHandAcrossRanges } from './handTrajectory.js';

export function analyzeVolatility(orderedRanges, options = {}) {
  const {
    volatilityThreshold = 0.3,
    minRanges = 3
  } = options;

  if (!orderedRanges || orderedRanges.length < minRanges) {
    return {
      status: 'insufficient_data',
      message: `Need at least ${minRanges} ranges, got ${orderedRanges.length}`,
      stableCore: [],
      volatileEdge: [],
      volatilityByHand: {},
      summary: {
        totalHands: 0,
        stableCount: 0,
        volatileCount: 0,
        averageVolatility: 0
      }
    };
  }

  const allHands = new Set();
  for (const range of orderedRanges) {
    if (range.hands) {
      for (const hand of Object.keys(range.hands)) {
        allHands.add(hand);
      }
    }
  }

  const volatilityByHand = {};
  let totalVolatility = 0;

  for (const hand of allHands) {
    const trajectory = traceHandAcrossRanges(hand, orderedRanges);
    const volatility = trajectory.volatility || 0;
    const meanChange = trajectory.meanTransitionMagnitude || 0;
    volatilityByHand[hand] = {
      volatility,
      meanTransitionMagnitude: meanChange,
      totalChange: trajectory.totalChange || 0,
      transitionPoints: trajectory.transitionPoints || [],
      ranges: trajectory.trajectory || []
    };
    totalVolatility += volatility;
  }

  const stableCore = [];
  const volatileEdge = [];

  for (const [hand, data] of Object.entries(volatilityByHand)) {
    if (data.volatility < volatilityThreshold) {
      stableCore.push(hand);
    } else {
      volatileEdge.push(hand);
    }
  }

  const sorted = Object.entries(volatilityByHand)
    .sort((a, b) => a[1].volatility - b[1].volatility);

  return {
    status: 'ready',
    stableCore,
    volatileEdge,
    volatilityByHand,
    summary: {
      totalHands: allHands.size,
      stableCount: stableCore.length,
      volatileCount: volatileEdge.length,
      averageVolatility: allHands.size > 0 ? totalVolatility / allHands.size : 0,
      leastVolatile: sorted.slice(0, 5).map(([hand]) => hand),
      mostVolatile: sorted.slice(-5).map(([hand]) => hand)
    }
  };
}
