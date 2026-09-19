import { CONTEXT_MATCH } from './compareEvidenceContext.js';

const MATCH_RANK = {
  [CONTEXT_MATCH.EXACT]: 4,
  [CONTEXT_MATCH.COMPATIBLE]: 3,
  [CONTEXT_MATCH.PARTIAL]: 2,
  [CONTEXT_MATCH.INCOMPATIBLE]: 0,
  [CONTEXT_MATCH.UNKNOWN]: 1
};

const LAYER_PRIORITY = {
  TASK_LIBRARY: 100,
  EXACT_NODES: 95,
  PREFLOP_ATLAS: 90,
  POSTFLOP_ATLAS: 70,
  UO_TRAINER: 40,
  REFERENCE_6MAX: 30,
  PUSH_FOLD: 50
};

function dominantAction(policy) {
  if (!policy || typeof policy !== 'object') return null;
  const entries = Object.entries(policy).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { action: entries[0][0], freq: entries[0][1] };
}

function rankScore(evidence) {
  const match = MATCH_RANK[evidence.contextMatch] ?? 1;
  const layer = LAYER_PRIORITY[evidence.layerId] ?? 10;
  const exactBoost = evidence.layerId === 'EXACT_NODES' ? 2 : 0;
  const solver = evidence.solverValidated ? 1 : 0;
  const hasPolicy = evidence.policy && typeof evidence.policy === 'object' ? 5 : 0;
  return match * 100 + layer + exactBoost + solver + hasPolicy;
}

export function resolvePokerEvidence(context, collected) {
  const evidence = (collected?.evidence || []).filter((e) => e.policy || e.meta?.libraryOwned);
  const conflicts = [];
  const supporting = [];

  if (!evidence.length) {
    return {
      primary: null,
      supporting,
      conflicts,
      flags: ['NO_STRATEGY_AVAILABLE']
    };
  }

  const library = evidence.find((e) => e.layerId === 'TASK_LIBRARY');
  if (library?.meta?.libraryOwned) {
    return {
      primary: library,
      supporting: evidence.filter((e) => e !== library),
      conflicts: [],
      flags: ['LIBRARY_TRUTH_PATH']
    };
  }

  const policyEvidence = evidence.filter((e) => e.policy && !e.notComparable);
  const ranked = [...policyEvidence].sort((a, b) => rankScore(b) - rankScore(a));

  const primary = ranked[0] || null;
  if (!primary) {
    return {
      primary: null,
      supporting: evidence,
      conflicts,
      flags: ['NO_STRATEGY_AVAILABLE']
    };
  }

  for (const e of ranked.slice(1)) {
    supporting.push(e);
    const d1 = dominantAction(primary.policy);
    const d2 = dominantAction(e.policy);
    if (d1 && d2 && d1.action !== d2.action && d1.freq > 0.35 && d2.freq > 0.35) {
      conflicts.push({
        type: 'EVIDENCE_CONFLICT',
        sourceA: primary.source,
        sourceB: e.source,
        domain: primary.domain || e.domain,
        difference: { primaryAction: d1.action, otherAction: d2.action },
        contextMatchA: primary.contextMatch,
        contextMatchB: e.contextMatch,
        reason: 'DOMINANT_ACTION_MISMATCH'
      });
    }
  }

  for (const e of evidence) {
    if (e === primary || supporting.includes(e)) continue;
    if (e.notComparable) supporting.push(e);
  }

  const flags = [];
  if (primary.contextMatch === CONTEXT_MATCH.PARTIAL) flags.push('PARTIAL_CONTEXT_MATCH');
  if (!primary.solverValidated) flags.push('UNVALIDATED_POLICY_SOURCE');
  if (primary.meta?.stackSpecific === false) flags.push('STACK_INVARIANT_SOURCE');
  if (primary.meta?.villainPositionDimension === false) flags.push('COLLAPSED_VILLAIN_CONTEXT');
  if (conflicts.length) flags.push('EVIDENCE_CONFLICT');

  return { primary, supporting, conflicts, flags };
}
