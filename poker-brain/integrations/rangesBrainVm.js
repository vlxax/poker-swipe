/**
 * On-demand range cell Brain VM — one hand at a time.
 */
import { analyze } from '../analyze.js';
import { adapters } from '../context/normalize.js';

export function buildRangesSelection(meta, hand) {
  if (!meta || !hand) return null;
  const situation = meta.type === 'uo' ? 'rfi' : mapModeToSituation(meta.mode);
  return {
    position: meta.position,
    stack: meta.stack,
    hand,
    handCards: hand,
    situation,
    opener: meta.opponent || meta.manifest?.opponent,
    ctx: meta.actionContext || ''
  };
}

function mapModeToSituation(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('3-бет') || m.includes('3bet')) return 'vs_3bet';
  if (m.includes('4-бет') || m.includes('4bet')) return 'vs_4bet';
  if (m.includes('открыт') || m.includes('open') || m.includes('vs')) return 'vs_open';
  return 'rfi';
}

export function explainRangeCell(selection, deps = {}) {
  const ctx = adapters.ranges({
    sel: selection,
    scenario: {
      pos: selection.position,
      stack: selection.stack,
      hero: selection.handCards || selection.hand,
      street: 'PREFLOP',
      ctx: selection.situation === 'rfi' ? 'unopened first in' : (selection.ctx || '')
    }
  });
  const result = analyze({ context: ctx }, deps);
  return formatRangeBrainVm(selection, result);
}

export function explainRangeCellForRanges(meta, hand, deps = {}) {
  const selection = buildRangesSelection(meta, hand);
  if (!selection) return { hand, error: 'INVALID_SELECTION' };
  return explainRangeCell(selection, deps);
}

export function formatRangeBrainVm(selection, result) {
  const primary = result.provenance?.primarySource;
  const supporting = result.provenance?.supportingSources || [];
  return {
    hand: selection?.hand || selection?.handCards,
    domain: result.domain,
    policy: result.recommendation?.frequencies || null,
    recommendation: result.recommendation,
    primarySource: primary,
    supportingSources: supporting,
    stackSpecific: result.strategySourceKnows?.lookupStackBB != null,
    solverValidated: result.provenance?.solverValidated,
    contextMatch: result.contextCompatibility?.matchLevel || result.contextQuality?.level,
    actualStackBB: result.brainKnows?.stackBucket?.actualStackBB ?? result.brainKnows?.effectiveStackBB,
    lookupStackBB: result.strategySourceKnows?.lookupStackBB ?? result.contextCompatibility?.stackBucket?.lookupStackBB,
    stackBucketDistanceBB: result.contextCompatibility?.stackBucket?.stackBucketDistanceBB,
    brainKnows: result.brainKnows,
    strategySourceKnows: result.strategySourceKnows,
    ignoredMaterialFields: result.contextCompatibility?.ignoredMaterialFields || [],
    missingMaterialFields: result.contextCompatibility?.missingMaterialFields || [],
    conflicts: result.conflicts || [],
    limitations: {
      flags: result.flags || [],
      primarySource: primary
    },
    engineVersion: result.engineVersion
  };
}
