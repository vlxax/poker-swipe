/**
 * Range fingerprint generation with strict validation
 */

import { 
  normalizeActions, 
  positiveDistribution, 
  entropy, 
  normalizedEntropy,
  activeNormalizedEntropy,
  globalNormalizedEntropy,
  variance,
  clamp,
  validateActionDistribution 
} from './math.js';

// Keep production action names first-class. Do not collapse 3BET/4BET/ALLIN into RAISE.
export const ALL_ACTIONS = ['AI', 'ALLIN', 'CALL', 'FOLD', 'RAISE', 'CHECK', 'BET', 'PUSH', '3BET', '4BET'];

export function buildRangeFingerprint(range) {
  if (!range || !range.hands) {
    return createEmptyFingerprint();
  }

  const hands = Object.keys(range.hands);
  const numHands = hands.length;

  // Strict validation - invalid distributions are rejected immediately
  for (const hand of hands) {
    const actions = range.hands[hand].actions || {};
    const validation = validateActionDistribution(actions);
    if (!validation.valid) {
      throw new Error(
        `Invalid action distribution for ${hand}: ${validation.reason} ` +
        `(actions: ${JSON.stringify(actions)})`
      );
    }
  }

  const actionFrequencies = {};
  const actionCounts = {};

  let totalPureHands = 0;
  let totalMixedHands = 0;
  let totalEntropy = 0;
  let totalActiveActions = 0;
  let boundaryDensity = 0;

  const handData = {};

  for (const hand of hands) {
    const actions = range.hands[hand].actions || {};
    const normalized = normalizeActions(actions);
    const positive = positiveDistribution(actions);
    const activeActions = Object.keys(positive).length;

    if (activeActions === 0) {
      handData[hand] = { entropy: 0, isPure: false, activeActions: 0, distribution: {} };
      continue;
    }

    const ent = entropy(normalized);
    const isPure = activeActions === 1;

    handData[hand] = {
      entropy: ent,
      isPure,
      activeActions,
      distribution: normalized,
      activeNormalizedEntropy: activeNormalizedEntropy(normalized),
      globalNormalizedEntropy: globalNormalizedEntropy(normalized)
    };

    if (isPure) totalPureHands++;
    else totalMixedHands++;

    totalEntropy += ent;
    totalActiveActions += activeActions;

    for (const [action, freq] of Object.entries(normalized)) {
      actionFrequencies[action] = (actionFrequencies[action] || 0) + freq;
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    }

    const actionValues = Object.values(normalized);
    const maxFreq = Math.max(...actionValues);
    if (maxFreq < 0.7 && activeActions > 1) {
      boundaryDensity += 1;
    }
  }

  const normalizedActionFreq = {};
  for (const [action, freq] of Object.entries(actionFrequencies)) {
    normalizedActionFreq[action] = freq / numHands;
  }

  const actionMass = {};
  for (const action of ALL_ACTIONS) {
    const count = actionCounts[action] || 0;
    actionMass[action] = count / numHands;
  }

  const entropies = Object.values(handData).map(h => h.entropy);
  const avgEntropy = totalEntropy / (numHands || 1);
  const entropyVariance = variance(entropies);

  const maxPossibleEntropy = Math.log2(Object.keys(ALL_ACTIONS).length);
  const normalizedAvgEntropy = maxPossibleEntropy > 0 ? avgEntropy / maxPossibleEntropy : 0;

  return {
    numHands,
    numPureHands: totalPureHands,
    numMixedHands: totalMixedHands,
    purePercentage: numHands > 0 ? totalPureHands / numHands : 0,
    mixedPercentage: numHands > 0 ? totalMixedHands / numHands : 0,

    averageEntropy: avgEntropy,
    normalizedAverageEntropy: normalizedAvgEntropy,
    entropyVariance,
    maxEntropy: entropies.length > 0 ? Math.max(...entropies) : 0,
    minEntropy: entropies.length > 0 ? Math.min(...entropies) : 0,

    averageActiveActions: numHands > 0 ? totalActiveActions / numHands : 0,
    actionFrequencies: normalizedActionFreq,
    actionMass: actionMass,

    boundaryDensity: numHands > 0 ? boundaryDensity / numHands : 0,

    handData,
    metadata: range.metadata || {}
  };
}

function createEmptyFingerprint() {
  return {
    numHands: 0,
    numPureHands: 0,
    numMixedHands: 0,
    purePercentage: 0,
    mixedPercentage: 0,
    averageEntropy: 0,
    normalizedAverageEntropy: 0,
    entropyVariance: 0,
    maxEntropy: 0,
    minEntropy: 0,
    averageActiveActions: 0,
    actionFrequencies: {},
    actionMass: {},
    boundaryDensity: 0,
    handData: {},
    metadata: {}
  };
}

export function compareFingerprints(fpA, fpB) {
  const metrics = [
    'purePercentage',
    'mixedPercentage',
    'normalizedAverageEntropy',
    'entropyVariance',
    'averageActiveActions',
    'boundaryDensity'
  ];

  const differences = {};
  for (const metric of metrics) {
    differences[metric] = Math.abs((fpA[metric] || 0) - (fpB[metric] || 0));
  }

  const allActions = new Set([
    ...Object.keys(fpA.actionFrequencies || {}),
    ...Object.keys(fpB.actionFrequencies || {})
  ]);

  let actionDiff = 0;
  for (const action of allActions) {
    const a = fpA.actionFrequencies[action] || 0;
    const b = fpB.actionFrequencies[action] || 0;
    actionDiff += Math.abs(a - b);
  }
  const avgActionDiff = allActions.size > 0 ? actionDiff / allActions.size : 0;

  const metricSimilarity = 1 - (Object.values(differences).reduce((a, b) => a + b, 0) / metrics.length);
  const actionSimilarity = 1 - avgActionDiff;

  return {
    differences,
    metricSimilarity: clamp(metricSimilarity, 0, 1),
    actionSimilarity: clamp(actionSimilarity, 0, 1),
    overallSimilarity: clamp((metricSimilarity + actionSimilarity) / 2, 0, 1)
  };
}
