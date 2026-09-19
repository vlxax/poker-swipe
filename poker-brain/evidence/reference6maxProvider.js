import { UNKNOWN, isUnknown } from '../context/DecisionContext.js';
import { CONTEXT_MATCH } from './compareEvidenceContext.js';
import { POKER_DOMAINS } from '../routing/resolvePokerDomain.js';
import { trustMetaForLayer } from './trustMetadata.js';

import { lookupReferencePolicy as defaultLookupReferencePolicy } from '../../ranges-ui/referenceRanges.js';

function syncLookupFromDeps(deps) {
  if (typeof deps.referenceLookupPolicy === 'function') return deps.referenceLookupPolicy;
  return defaultLookupReferencePolicy;
}

function handClass(context, deps) {
  const hc = deps.classOf?.(context.hero?.cards);
  if (hc) return hc;
  if (typeof context.hero?.cards === 'string') return context.hero.cards;
  return null;
}

function selectionFromContext(context, domain) {
  const hero = context.hero?.position;
  if (isUnknown(hero)) return null;
  const villain = context.villains?.[0]?.position || context.preflopTree?.threeBettorPosition;
  let situation = 'rfi';
  if (domain === POKER_DOMAINS.PREFLOP_BB_DEFEND || domain === POKER_DOMAINS.PREFLOP_VS_OPEN) {
    situation = 'vs_open';
  } else if (domain === POKER_DOMAINS.PREFLOP_VS_3BET) {
    situation = 'vs_3bet';
  } else if (domain === POKER_DOMAINS.PREFLOP_RFI) {
    situation = 'rfi';
  } else {
    return null;
  }
  return {
    position: hero,
    opener: villain !== UNKNOWN ? villain : undefined,
    situation
  };
}

function situationNeedsVillain(situation) {
  return situation === 'vs_open' || situation === 'vs_3bet' || situation === 'vs_4bet';
}

export function collectReference6maxEvidenceSync(context, domain, deps = {}) {
  const lookup = syncLookupFromDeps(deps);
  if (!lookup) return null;
  const sel = selectionFromContext(context, domain);
  const hc = handClass(context, deps);
  if (!sel || !hc) return null;
  const policy = lookup(sel, hc);
  if (!policy || typeof policy !== 'object') return null;
  let contextMatch = CONTEXT_MATCH.COMPATIBLE;
  const ignoredMaterialFields = [];
  const missingMaterialFields = [];
  if (!isUnknown(context.effectiveStackBB)) {
    ignoredMaterialFields.push('effectiveStackBB');
    contextMatch = CONTEXT_MATCH.PARTIAL;
  }
  if (situationNeedsVillain(sel.situation) && !sel.opener) {
    missingMaterialFields.push('villainPosition');
    contextMatch = CONTEXT_MATCH.PARTIAL;
  }
  if (domain === POKER_DOMAINS.PREFLOP_VS_3BET && !isUnknown(context.preflopTree?.threeBettorPosition)) {
    ignoredMaterialFields.push('threeBettorPosition');
    contextMatch = CONTEXT_MATCH.PARTIAL;
  }
  return {
    source: 'REFERENCE_6MAX',
    layerId: 'REFERENCE_6MAX',
    domain,
    policy,
    provenance: 'REFERENCE_CHART',
    solverValidated: false,
    contextMatch,
    meta: {
      ...trustMetaForLayer('REFERENCE_6MAX'),
      stackSpecific: false,
      referenceOnly: true,
      ignoredMaterialFields,
      missingMaterialFields
    }
  };
}

export const collectReference6maxEvidence = collectReference6maxEvidenceSync;
