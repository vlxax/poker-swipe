/**
 * Stack transition engine
 */

import { compareStrategySimilarity } from './similarity.js';
import { buildRangeFingerprint } from './fingerprint.js';
import { normalizeActions, positiveDistribution } from './math.js';

export function analyzeStackTransitions(ranges, options = {}) {
  const {
    includeRawStackValues = true
  } = options;

  if (!ranges || ranges.length < 2) {
    return {
      transitions: [],
      summary: {
        totalTransitions: 0,
        averageMagnitude: 0,
        largestTransition: null,
        orderingConfidence: 1
      }
    };
  }

  const sorted = sortRangesByStack(ranges);
  const stackOrder = sorted.map(r => ({
    id: r.id || r.rangeId,
    stack: r.metadata?.stack || 'unknown',
    rawStack: extractStackValue(r.metadata?.stack)
  }));

  const transitions = [];
  let totalMagnitude = 0;
  let largestMagnitude = 0;
  let largestTransition = null;

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];

    const comparison = compareStrategySimilarity(from, to);
    const magnitude = 1 - comparison.similarity;

    const transition = {
      from: from.id || from.rangeId || `range-${i}`,
      to: to.id || to.rangeId || `range-${i+1}`,
      fromRange: from,
      toRange: to,

      changedHands: comparison.changedHands.map(h => h.hand),
      unchangedHands: comparison.stableHands,

      biggestFrequencyChanges: comparison.biggestChanges.map(h => ({
        hand: h.hand,
        changes: h.changes,
        distance: h.distance
      })),

      newlyActivatedActions: findNewlyActivatedActions(from, to),
      removedActions: findRemovedActions(from, to),

      boundaryHands: Object.keys(comparison.boundaryChanges),

      transitionMagnitude: magnitude,
      strategySimilarity: comparison.similarity,
      numChangedHands: comparison.numChangedHands
    };

    transitions.push(transition);
    totalMagnitude += magnitude;

    if (magnitude > largestMagnitude) {
      largestMagnitude = magnitude;
      largestTransition = transition;
    }
  }

  let orderingConfidence = 1;
  for (let i = 1; i < stackOrder.length; i++) {
    const prev = stackOrder[i - 1].rawStack;
    const curr = stackOrder[i].rawStack;
    if (prev !== Infinity && curr !== Infinity && prev > curr) {
      orderingConfidence *= 0.5;
    }
  }

  return {
    transitions,
    summary: {
      totalTransitions: transitions.length,
      averageMagnitude: transitions.length > 0 ? totalMagnitude / transitions.length : 0,
      largestTransition,
      largestMagnitude,
      orderingConfidence,
      stackOrder
    }
  };
}

export function sortRangesByStack(ranges) {
  return [...ranges].sort((a, b) => {
    const stackA = extractStackValue(a.metadata?.stack);
    const stackB = extractStackValue(b.metadata?.stack);
    return stackA - stackB;
  });
}

export function extractStackValue(stack) {
  if (!stack) return Infinity;
  if (typeof stack === 'number') return stack;
  if (typeof stack === 'string') {
    const rangeMatch = stack.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
    }
    const singleMatch = stack.match(/^(\d+(?:\.\d+)?)/);
    if (singleMatch) return parseFloat(singleMatch[1]);
  }
  return Infinity;
}

function findNewlyActivatedActions(from, to) {
  const actionsFrom = getAllActions(from);
  const actionsTo = getAllActions(to);
  const newlyActivated = [];

  for (const action of actionsTo) {
    if (!actionsFrom.has(action)) {
      newlyActivated.push(action);
    }
  }

  return newlyActivated;
}

function findRemovedActions(from, to) {
  const actionsFrom = getAllActions(from);
  const actionsTo = getAllActions(to);
  const removed = [];

  for (const action of actionsFrom) {
    if (!actionsTo.has(action)) {
      removed.push(action);
    }
  }

  return removed;
}

function getAllActions(range) {
  const actions = new Set();
  if (!range || !range.hands) return actions;

  for (const hand of Object.values(range.hands)) {
    if (hand.actions) {
      const positive = positiveDistribution(hand.actions);
      for (const action of Object.keys(positive)) {
        actions.add(action);
      }
    }
  }

  return actions;
}
