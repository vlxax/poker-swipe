/**
 * Personalized curriculum builder
 */

import { buildCurriculumGraph } from './curriculumGraph.js';
import { findBoundaryHands } from './boundaries.js';

export function buildPersonalLearningPath({
  library,
  learnerModel = null,
  startRange = null,
  maxSteps = 10,
  options = {}
}) {
  const {
    weaknessWeight = 0.35,
    proximityWeight = 0.20,
    transitionWeight = 0.20,
    boundaryWeight = 0.15,
    noveltyWeight = 0.10,
    antiRepeatWeight = 0.05,
    rng = Math.random,
    maxCandidatesPerStep = 5
  } = options;

  if (!library || library.length === 0) {
    return {
      path: [],
      summary: {
        totalSteps: 0,
        startRange: null
      }
    };
  }

  const graph = buildCurriculumGraph(library);

  let currentRange = startRange;
  if (!currentRange) {
    const sorted = [...graph.nodes].sort((a, b) => 
      a.structuralDifficulty - b.structuralDifficulty
    );
    currentRange = sorted[0]?.range || library[0];
  }

  const path = [];
  const visited = new Set();
  const recentTasks = learnerModel?.recentTasks || [];

  let currentId = currentRange.id || currentRange.rangeId || 'start';
  visited.add(currentId);

  let currentNode = graph.nodes.find(n => 
    (n.range.id === currentRange.id || n.range.rangeId === currentRange.rangeId)
  );

  if (!currentNode) {
    return {
      path: [{ rangeId: currentId, reason: 'Starting point' }],
      summary: { totalSteps: 1, startRange: currentId }
    };
  }

  for (let step = 1; step < maxSteps; step++) {
    const neighbors = graph.edges
      .filter(e => e.from === currentNode.id || e.to === currentNode.id)
      .map(e => {
        const neighborId = e.from === currentNode.id ? e.to : e.from;
        const neighborNode = graph.nodes.find(n => n.id === neighborId);
        return { edge: e, node: neighborNode };
      })
      .filter(({ node }) => node && !visited.has(node.id));

    if (neighbors.length === 0) break;

    const scored = neighbors.map(({ edge, node }) => {
      let weaknessScore = 0;
      if (learnerModel && learnerModel.weaknessBySpot) {
        const weakness = learnerModel.weaknessBySpot[node.range.id] || 0;
        weaknessScore = weakness;
      }

      const proximity = 1 - edge.strategyDistance;
      const transitionQuality = edge.recommendedTransitionScore;

      let boundaryScore = 0;
      if (learnerModel && learnerModel.weaknessByHand) {
        const validHands = Object.keys(node.range.hands || {});
        const boundaryHands = node.boundaryHands || [];
        for (const hand of boundaryHands) {
          if (validHands.includes(hand) && learnerModel.weaknessByHand[hand]) {
            boundaryScore += learnerModel.weaknessByHand[hand];
          }
        }
        boundaryScore = Math.min(boundaryScore / 5, 1);
      }

      let noveltyScore = 1;
      const recentCount = recentTasks.filter(t => t.rangeId === node.id).length;
      if (recentCount > 0) {
        noveltyScore = 1 - (recentCount / 3);
      }
      noveltyScore = Math.max(noveltyScore, 0.1);

      let antiRepeatScore = 1;
      if (visited.has(node.id)) {
        antiRepeatScore = 0.1;
      }

      const repeatPenalty = (1 - antiRepeatScore) * antiRepeatWeight;

      const totalScore = (
        weaknessScore * weaknessWeight +
        proximity * proximityWeight +
        transitionQuality * transitionWeight +
        boundaryScore * boundaryWeight +
        noveltyScore * noveltyWeight
      ) * (1 - repeatPenalty);

      return {
        node,
        edge,
        scores: {
          weakness: weaknessScore,
          proximity,
          transitionQuality,
          boundary: boundaryScore,
          novelty: noveltyScore,
          repeatPenalty
        },
        totalScore
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    const topCandidates = scored.slice(0, Math.min(maxCandidatesPerStep, scored.length));
    const weights = topCandidates.map(c => Math.max(c.totalScore, 0.01));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let random = rng() * totalWeight;
    let selected = topCandidates[0];
    for (let i = 0; i < topCandidates.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selected = topCandidates[i];
        break;
      }
    }

    const validHands = Object.keys(selected.node.range.hands || {});
    const targetHands = findRelevantHands(selected.node, learnerModel, validHands);

    path.push({
      rangeId: selected.node.id,
      range: selected.node.range,
      reason: selected.node.id,
      targetHands,
      transitionFromPrevious: {
        from: currentId,
        to: selected.node.id,
        similarity: 1 - selected.edge.strategyDistance,
        changedHands: selected.edge.changedHandCount
      },
      scoreBreakdown: {
        total: selected.totalScore,
        ...selected.scores
      }
    });

    currentId = selected.node.id;
    currentNode = selected.node;
    visited.add(currentId);
  }

  return {
    path,
    summary: {
      totalSteps: path.length,
      startRange: startRange?.id || 'auto',
      endRange: path.length > 0 ? path[path.length - 1].rangeId : null
    }
  };
}

function findRelevantHands(node, learnerModel, validHands) {
  if (!validHands || validHands.length === 0) return [];

  const hands = [];
  const boundaryHands = node.boundaryHands || [];

  const weakHands = [];
  if (learnerModel && learnerModel.weaknessByHand) {
    for (const [hand, score] of Object.entries(learnerModel.weaknessByHand)) {
      if (score > 0.3 && validHands.includes(hand)) {
        weakHands.push(hand);
      }
    }
  }

  const combined = [];
  for (const hand of boundaryHands) {
    if (validHands.includes(hand)) {
      const weakness = learnerModel?.weaknessByHand?.[hand] || 0;
      combined.push({ hand, weakness, isBoundary: true });
    }
  }

  for (const hand of weakHands) {
    if (!combined.some(c => c.hand === hand) && validHands.includes(hand)) {
      combined.push({ hand, weakness: learnerModel.weaknessByHand[hand] || 0, isBoundary: false });
    }
  }

  combined.sort((a, b) => b.weakness - a.weakness);
  return combined.slice(0, 10).map(c => c.hand);
}
