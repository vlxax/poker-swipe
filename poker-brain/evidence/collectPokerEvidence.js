import { layersForDomain } from '../registry/knowledgeRegistry.js';
import { POKER_DOMAINS } from '../routing/resolvePokerDomain.js';
import { collectPreflopAtlasEvidence } from './preflopAtlasAdapter.js';
import { compareEvidenceContextDetail } from './compareEvidenceContext.js';
import { collectReference6maxEvidenceSync } from './reference6maxProvider.js';
import { collectUoTrainerEvidence } from './uoTrainerProvider.js';

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
    const ref = collectReference6maxEvidenceSync(context, domain, deps);
    if (ref?.policy) {
      ref.role = 'SUPPORTING_REFERENCE';
      evidence.push(ref);
    } else if (ref?.notComparable) {
      layersRejected.push({ source: 'REFERENCE_6MAX', reason: ref.meta?.reason || 'NOT_COMPARABLE' });
    }

    const trainer = collectUoTrainerEvidence(context, domain, deps);
    if (trainer?.policy) {
      trainer.role = 'SUPPORTING_TRAINER';
      evidence.push(trainer);
    } else if (trainer?.notComparable) {
      layersRejected.push({ source: 'UO_TRAINER', reason: trainer.meta?.reason || 'NOT_COMPARABLE' });
    }

    const atlas = collectPreflopAtlasEvidence(context, domain, deps);
    if (atlas) {
      const compat = compareEvidenceContextDetail(atlas, {
        ...context,
        domainNeedsVillainPosition: domain === POKER_DOMAINS.PREFLOP_VS_3BET
      });
      atlas.contextMatch = compat.match;
      atlas.contextCompatibility = compat;
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
      const isExact = node.source === 'EXACT_REFERENCE_NODE' || node.exact === true;
      evidence.push({
        source: node.source || 'POSTFLOP_ATLAS',
        layerId: isExact ? 'EXACT_NODES' : 'POSTFLOP_ATLAS',
        domain,
        policy: node.actions,
        sizes: node.sizes || null,
        provenance: isExact ? 'EXACT_REFERENCE' : 'CURATED_UNKNOWN',
        solverValidated: false,
        contextMatch: isExact ? 'COMPATIBLE' : 'PARTIAL',
        meta: {
          contextComplete: !!isExact,
          requiresBoard: true,
          requiresStreet: true
        }
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
