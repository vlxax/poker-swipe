// Source provenance for trainer records — debugging and UI attribution.

import { STRATEGY_SOURCE } from './status.js';

export function trainerProvenance({
  dataset,
  sourceFile = null,
  sourceHash = null,
  chartId = null,
  originalSha256 = null,
  parserStatus = null
} = {}) {
  return {
    source: STRATEGY_SOURCE.TRAINER,
    dataset: dataset || null,
    sourceFile,
    sourceHash,
    chartId,
    originalSha256,
    parserStatus
  };
}

export function pokerBrainProvenance({ key = null } = {}) {
  return {
    source: STRATEGY_SOURCE.POKER_BRAIN,
    dataset: 'POKER_BRAIN_PACK',
    atlasKey: key
  };
}

export function formatProvenanceDebug(prov) {
  if (!prov) return 'unknown';
  const parts = [prov.source || '?'];
  if (prov.dataset) parts.push(prov.dataset);
  if (prov.chartId) parts.push(prov.chartId);
  if (prov.sourceFile) parts.push(prov.sourceFile);
  if (prov.sourceHash) parts.push(`hash:${prov.sourceHash}`);
  if (prov.atlasKey) parts.push(prov.atlasKey);
  return parts.join(' · ');
}
