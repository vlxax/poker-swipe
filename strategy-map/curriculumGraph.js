/**
 * Curriculum graph construction
 */

import { compareStrategySimilarity } from './similarity.js';
import { findBoundaryHands } from './boundaries.js';
import { buildRangeFingerprint } from './fingerprint.js';

export function buildCurriculumGraph(library, options = {}) {
  const {
    maxEdges = 5,
    minSimilarity = 0.3,
    maxSimilarity = 0.99,
    duplicateThreshold = 0.999,
    includeMetadataRelationships = true,
    candidatePoolSize = 50
  } = options;

  if (!library || library.length === 0) {
    return {
      nodes: [],
      edges: [],
      summary: {
        totalNodes: 0,
        totalEdges: 0,
        averageDegree: 0
      }
    };
  }

  const nodes = [];
  const edges = [];
  const fingerprints = new Map();

  for (const range of library) {
    const id = range.id || range.rangeId || `range-${nodes.length}`;
    const fingerprint = buildRangeFingerprint(range);
    fingerprints.set(id, fingerprint);

    const boundaryHands = findBoundaryHands(range);

    nodes.push({
      id,
      range,
      fingerprint,
      metadata: range.metadata || {},
      boundaryHands: boundaryHands.boundaryHands.map(h => h.hand),
      pureHands: boundaryHands.pureHands.map(h => h.hand),
      mixedHands: boundaryHands.mixedHands.map(h => h.hand),
      structuralDifficulty: computeStructuralDifficulty(fingerprint)
    });
  }

  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    const candidates = [];

    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j];
      const fpA = nodeA.fingerprint;
      const fpB = nodeB.fingerprint;

      let fpSimilarity = 0;
      const metrics = ['purePercentage', 'mixedPercentage', 'normalizedAverageEntropy'];
      for (const metric of metrics) {
        const diff = Math.abs((fpA[metric] || 0) - (fpB[metric] || 0));
        fpSimilarity += 1 - diff;
      }
      fpSimilarity /= metrics.length;

      if (fpSimilarity < minSimilarity * 0.5) continue;

      candidates.push({
        node: nodeB,
        fpSimilarity,
        index: j
      });
    }

    candidates.sort((a, b) => b.fpSimilarity - a.fpSimilarity);
    const topCandidates = candidates.slice(0, candidatePoolSize);

    for (const candidate of topCandidates) {
      const nodeB = candidate.node;

      const comparison = compareStrategySimilarity(nodeA.range, nodeB.range);
      const strategyDistance = 1 - comparison.similarity;

      let metadataRelationship = 0;
      if (includeMetadataRelationships) {
        metadataRelationship = computeMetadataRelationship(
          nodeA.metadata,
          nodeB.metadata
        );
      }

      // Curriculum adjacency: allow high-similarity ranges
      if (comparison.similarity >= minSimilarity && 
          comparison.similarity <= maxSimilarity) {

        const edge = {
          from: nodeA.id,
          to: nodeB.id,
          fromRange: nodeA.range,
          toRange: nodeB.range,

          strategyDistance,
          metadataRelationship,

          changedHandCount: comparison.numChangedHands || 0,
          boundaryChangeCount: Object.keys(comparison.boundaryChanges || {}).length,

          difficultyDelta: computeDifficultyDelta(nodeA, nodeB),

          recommendedTransitionScore: computeTransitionScore({
            strategyDistance,
            metadataRelationship,
            changedHandCount: comparison.numChangedHands || 0,
            boundaryChangeCount: Object.keys(comparison.boundaryChanges || {}).length
          })
        };

        edges.push(edge);
      }
    }
  }

  const edgeMap = new Map();
  for (const edge of edges) {
    const key = [edge.from, edge.to].sort().join('|');
    if (!edgeMap.has(key) || edge.recommendedTransitionScore > edgeMap.get(key).recommendedTransitionScore) {
      edgeMap.set(key, edge);
    }
  }

  const uniqueEdges = Array.from(edgeMap.values());

  const nodeEdges = new Map();
  for (const edge of uniqueEdges) {
    if (!nodeEdges.has(edge.from)) nodeEdges.set(edge.from, []);
    if (!nodeEdges.has(edge.to)) nodeEdges.set(edge.to, []);
    nodeEdges.get(edge.from).push(edge);
    nodeEdges.get(edge.to).push(edge);
  }

  const filteredEdges = [];
  for (const [nodeId, edgeList] of nodeEdges) {
    const sorted = edgeList.sort((a, b) => b.recommendedTransitionScore - a.recommendedTransitionScore);
    const top = sorted.slice(0, maxEdges);
    for (const edge of top) {
      if (!filteredEdges.some(e => 
        (e.from === edge.from && e.to === edge.to) || 
        (e.from === edge.to && e.to === edge.from)
      )) {
        filteredEdges.push(edge);
      }
    }
  }

  const degreeMap = {};
  for (const edge of filteredEdges) {
    degreeMap[edge.from] = (degreeMap[edge.from] || 0) + 1;
    degreeMap[edge.to] = (degreeMap[edge.to] || 0) + 1;
  }

  const degrees = Object.values(degreeMap);
  const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;

  return {
    nodes,
    edges: filteredEdges,
    summary: {
      totalNodes: nodes.length,
      totalEdges: filteredEdges.length,
      averageDegree: avgDegree,
      maxDegree: degrees.length > 0 ? Math.max(...degrees) : 0,
      minDegree: degrees.length > 0 ? Math.min(...degrees) : 0
    }
  };
}

function computeStructuralDifficulty(fingerprint) {
  if (!fingerprint) return 0.5;

  const entropyScore = fingerprint.normalizedAverageEntropy || 0;
  const mixedScore = fingerprint.mixedPercentage || 0;
  const actionScore = Math.min((fingerprint.averageActiveActions || 0) / 3, 1);
  const boundaryScore = fingerprint.boundaryDensity || 0;

  return (entropyScore * 0.3 + mixedScore * 0.3 + actionScore * 0.2 + boundaryScore * 0.2);
}

function computeMetadataRelationship(metaA, metaB) {
  if (!metaA || !metaB) return 0;

  const commonKeys = new Set([...Object.keys(metaA), ...Object.keys(metaB)]);
  let matches = 0;
  let total = 0;

  for (const key of commonKeys) {
    const valA = metaA[key];
    const valB = metaB[key];
    total++;
    if (valA !== undefined && valB !== undefined && valA === valB) {
      matches++;
    }
  }

  return total > 0 ? matches / total : 0;
}

function computeDifficultyDelta(nodeA, nodeB) {
  return Math.abs(nodeA.structuralDifficulty - nodeB.structuralDifficulty);
}

function computeTransitionScore({ strategyDistance, metadataRelationship, changedHandCount, boundaryChangeCount }) {
  const strategyScore = 1 - strategyDistance;
  const metadataScore = metadataRelationship;
  const changeScore = Math.min(changedHandCount / 20, 1);
  const boundaryScore = Math.min(boundaryChangeCount / 5, 1);

  return (
    strategyScore * 0.35 +
    metadataScore * 0.25 +
    (1 - changeScore) * 0.2 +
    (1 - boundaryScore) * 0.2
  );
}
