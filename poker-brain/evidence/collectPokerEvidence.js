import { layersForDomain } from '../registry/knowledgeRegistry.js';
import { POKER_DOMAINS } from '../routing/resolvePokerDomain.js';
import { collectPreflopAtlasEvidence } from './preflopAtlasAdapter.js';
import { compareEvidenceContext } from './compareEvidenceContext.js';

const PREFLOP_DOMAINS = new Set([
  POKER_DOMAINS.PREFLOP_RFI,
  POKER_DOMAINS.PREFLOP_BB_DEFEND,
  POKER_DOMAINS.PREFLOP_VS_OPEN,
  POKER_DOMAINS.PREFLOP_VS_3BET
]);

export function collectPokerEvidence(context, domain, deps = {}) {
  const evidence = [];
  const layersConsidered = [];
  const layersRejected = [];

  const layerMeta = layersForDomain(domain.startsWith('PREFLOP') ? 'PREFLOP' : domain);
  for (const layer of layerMeta) {
    layersConsidered.push(layer.id);
  }

  if (PREFLOP_DOMAINS.has(domain)) {
    const atlas = collectPreflopAtlasEvidence(context, domain, deps);
    if (atlas) {
      atlas.contextMatch = compareEvidenceContext(atlas, {
        ...context,
        domainNeedsVillainPosition: domain === POKER_DOMAINS.PREFLOP_VS_3BET
      });
      evidence.push(atlas);
    } else {
      layersRejected.push({ source: 'POKER_BRAIN_PACK', reason: 'NO_POLICY_KEY' });
    }
  }

  if (domain === POKER_DOMAINS.PREFLOP_PUSH_FOLD && deps.pushFoldEval) {
    const hc = deps.classOf?.(context.hero?.cards);
    if (hc) {
      const ev = deps.pushFoldEval(hc, context.hero?.position, context.effectiveStackBB);
      evidence.push({
        source: 'PUSH_FOLD_HEURISTIC',
        layerId: 'PUSH_FOLD',
        domain,
        policy: { label: ev.label, confidence: ev.p },
        provenance: 'HEURISTIC',
        solverValidated: false,
        contextMatch: 'PARTIAL',
        meta: { stackSpecific: true, openSizingDimension: false }
      });
    }
  }

  if ((domain === POKER_DOMAINS.POSTFLOP || domain === POKER_DOMAINS.SIZING) && deps.legacyNodeFor) {
    const spot = deps.spotFromContext?.(context) || {};
    const node = deps.legacyNodeFor(spot);
    if (node?.actions) {
      evidence.push({
        source: node.source || 'POSTFLOP_ATLAS',
        layerId: node.source === 'EXACT_REFERENCE_NODE' ? 'EXACT_NODES' : 'POSTFLOP_ATLAS',
        domain,
        policy: node.actions,
        sizes: node.sizes || null,
        provenance: 'CURATED_UNKNOWN',
        solverValidated: false,
        contextMatch: 'PARTIAL',
        meta: { contextComplete: false }
      });
    } else {
      layersRejected.push({ source: 'POSTFLOP_ATLAS', reason: 'NO_MODEL' });
    }
  }

  if (context._raw?._library && context._raw?._drill) {
    evidence.push({
      source: 'TASK_LIBRARY',
      layerId: 'TASK_LIBRARY',
      domain: 'LIBRARY',
      policy: null,
      provenance: 'LIBRARY_CURATED',
      solverValidated: false,
      contextMatch: 'COMPATIBLE',
      meta: { libraryOwned: true },
      libraryDrill: context._raw._drill
    });
  }

  return { evidence, layersConsidered, layersRejected };
}
