/**
 * Explain a single range cell without 169× analyze — one-shot VM for selected hand.
 */
import { analyze } from '../analyze.js';
import { adapters } from '../context/normalize.js';

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
  return {
    selection,
    decision: result,
    limitations: {
      stackSpecific: result.strategySourceKnows?.lookupStackBB != null,
      stackBucketDistanceBB: result.contextCompatibility?.stackBucket?.stackBucketDistanceBB,
      ignoredMaterialFields: result.contextCompatibility?.ignoredMaterialFields || [],
      primarySource: result.provenance?.primarySource
    }
  };
}
