import { UNKNOWN, isUnknown } from '../context/DecisionContext.js';
import { CONTEXT_MATCH } from './compareEvidenceContext.js';
import { trustMetaForLayer } from './trustMetadata.js';

const CONFIRMED = new Set(['AI', 'RAISE', 'CALL', 'CHECK', '4BET', '5BET', 'ISOLATE', 'OVERLIMP']);

function handClass(context, deps) {
  return deps.classOf?.(context.hero?.cards)
    || (typeof context.hero?.cards === 'string' ? context.hero.cards : null);
}

/**
 * Trainer evidence — conservative; UNSELECTED is UNKNOWN (not FOLD).
 */
export function collectUoTrainerEvidence(context, domain, deps = {}) {
  const lookup = deps.trainerLookupHandAction;
  if (typeof lookup !== 'function') return null;

  const hc = handClass(context, deps);
  const pos = context.hero?.position;
  const stack = context.effectiveStackBB;
  if (!hc || isUnknown(pos)) return null;

  let query;
  try {
    query = {
      heroPosition: pos,
      stack: !isUnknown(stack) ? `${stack}BB` : null,
      hand: hc,
      sourceMode: 'uo',
      sourceGroup: 'UO'
    };
    const result = lookup(query);
    if (!result || result.status === 'NO_TRAINER_DATA') return null;

    const actionRaw = result.action || result.actionRaw || result.trainer?.actionRaw;
    if (!actionRaw || actionRaw === 'UNSELECTED') {
      return {
        source: 'UO_TRAINER',
        layerId: 'UO_TRAINER',
        domain,
        policy: null,
        provenance: 'IMPORTED_UNKNOWN',
        solverValidated: false,
        contextMatch: CONTEXT_MATCH.INCOMPATIBLE,
        notComparable: true,
        meta: {
          ...trustMetaForLayer('UO_TRAINER'),
          reason: 'UNSELECTED_NOT_ACTION',
          gradingAllowed: false
        }
      };
    }

    if (!CONFIRMED.has(String(actionRaw).toUpperCase()) && !result.gradingAllowed) {
      return {
        source: 'UO_TRAINER',
        layerId: 'UO_TRAINER',
        domain,
        policy: null,
        notComparable: true,
        contextMatch: CONTEXT_MATCH.INCOMPATIBLE,
        meta: { reason: 'NEEDS_CLARIFICATION', actionRaw }
      };
    }

    const freq = result.frequency ?? result.trainer?.frequency ?? 1;
    const policy = { [normalizeTrainerAction(actionRaw)]: freq };

    return {
      source: 'UO_TRAINER',
      layerId: 'UO_TRAINER',
      domain,
      policy,
      provenance: 'IMPORTED_UNKNOWN',
      solverValidated: false,
      contextMatch: isUnknown(stack) ? CONTEXT_MATCH.PARTIAL : CONTEXT_MATCH.COMPATIBLE,
      meta: {
        ...trustMetaForLayer('UO_TRAINER'),
        actionRaw,
        gradingAllowed: result.gradingAllowed !== false
      }
    };
  } catch {
    return null;
  }
}

function normalizeTrainerAction(raw) {
  const u = String(raw || '').toUpperCase();
  if (u === 'AI') return 'JAM';
  return u;
}
