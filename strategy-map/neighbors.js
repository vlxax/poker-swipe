/**
 * Nearest strategy neighbors finder
 * Two-stage: cheap fingerprint comparison then full comparison on candidates
 */

import { compareStrategySimilarity } from './similarity.js';
import { buildRangeFingerprint, compareFingerprints } from './fingerprint.js';

export function findNearestRanges(targetRange, library, options = {}) {
  const {
    maxResults = 10,
    minSimilarity = 0.5,
    strategyWeight = 0.7,
    metadataWeight = 0.3,
    excludeSelf = true,
    candidatePoolSize = 50,
    useFullComparison = true,
    fullCompareFn = null
  } = options;

  if (!targetRange || !library || library.length === 0) {
    return [];
  }

  const compareFn = fullCompareFn || compareStrategySimilarity;
  const targetId = targetRange.id || targetRange.rangeId;
  const targetFp = buildRangeFingerprint(targetRange);

  const candidates = [];

  for (const range of library) {
    const rangeId = range.id || range.rangeId;
    if (excludeSelf && rangeId === targetId) continue;

    const fp = buildRangeFingerprint(range);
    const fpComparison = compareFingerprints(targetFp, fp);

    candidates.push({
      rangeId,
      range,
      fp,
      fpComparison,
      fingerprintSimilarity: fpComparison.overallSimilarity,
      metadataSimilarity: computeMetadataSimilarity(
        targetRange.metadata || {},
        range.metadata || {}
      )
    });
  }

  candidates.sort((a, b) => b.fingerprintSimilarity - a.fingerprintSimilarity);

  const topCandidates = candidates.slice(0, candidatePoolSize);

  const results = [];

  for (const candidate of topCandidates) {
    let strategySimilarity;
    let comparison;

    if (useFullComparison) {
      comparison = compareFn(targetRange, candidate.range);
      strategySimilarity = comparison.similarity;
    } else {
      strategySimilarity = candidate.fingerprintSimilarity;
      comparison = null;
    }

    const combinedSimilarity = 
      strategySimilarity * strategyWeight +
      candidate.metadataSimilarity * metadataWeight;

    if (combinedSimilarity >= minSimilarity) {
      results.push({
        rangeId: candidate.rangeId,
        range: candidate.range,
        similarity: combinedSimilarity,
        strategySimilarity,
        metadataSimilarity: candidate.metadataSimilarity,
        fingerprintSimilarity: candidate.fingerprintSimilarity,
        comparison,
        reason: determineReason(comparison, candidate.metadataSimilarity)
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, maxResults);
}

function computeMetadataSimilarity(metaA, metaB) {
  if (!metaA || !metaB || Object.keys(metaA).length === 0 || Object.keys(metaB).length === 0) {
    return 0;
  }

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

function determineReason(comparison, metadataSimilarity) {
  const reasons = [];

  if (comparison) {
    if (comparison.similarity > 0.8) {
      reasons.push('very similar strategy');
    } else if (comparison.similarity > 0.6) {
      reasons.push('moderately similar strategy');
    }
  }

  if (metadataSimilarity > 0.7) {
    reasons.push('similar metadata');
  } else if (metadataSimilarity > 0.3) {
    reasons.push('some metadata overlap');
  }

  if (comparison && comparison.numChangedHands < 20) {
    reasons.push('few hand changes');
  }

  return reasons.join(', ') || 'minimal similarity';
}
