import { CONTEXT_MATCH } from './compareEvidenceContext.js';

const MATCH_RANK = {
  [CONTEXT_MATCH.EXACT]: 4,
  [CONTEXT_MATCH.COMPATIBLE]: 3,
  [CONTEXT_MATCH.PARTIAL]: 2,
  [CONTEXT_MATCH.INCOMPATIBLE]: 0,
  [CONTEXT_MATCH.UNKNOWN]: 1
};

function dominantAction(policy) {
  if (!policy || typeof policy !== 'object') return null;
  const entries = Object.entries(policy).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { action: entries[0][0], freq: entries[0][1] };
}

export function resolvePokerEvidence(context, collected) {
  const evidence = collected?.evidence || [];
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

  const ranked = [...evidence].sort((a, b) => {
    const exactBoost = (e) => (e.layerId === 'EXACT_NODES' ? 1 : 0);
    const ra = (MATCH_RANK[a.contextMatch] ?? 1) + exactBoost(a);
    const rb = (MATCH_RANK[b.contextMatch] ?? 1) + exactBoost(b);
    if (rb !== ra) return rb - ra;
    if (a.solverValidated && !b.solverValidated) return -1;
    if (!a.solverValidated && b.solverValidated) return 1;
    return 0;
  });

  const primary = ranked[0];
  for (const e of ranked.slice(1)) {
    supporting.push(e);
    const d1 = dominantAction(primary.policy);
    const d2 = dominantAction(e.policy);
    if (d1 && d2 && d1.action !== d2.action && d1.freq > 0.35 && d2.freq > 0.35) {
      conflicts.push({
        type: 'EVIDENCE_CONFLICT',
        primary: primary.source,
        other: e.source,
        primaryAction: d1.action,
        otherAction: d2.action
      });
    }
  }

  const flags = [];
  if (primary.contextMatch === CONTEXT_MATCH.PARTIAL) flags.push('PARTIAL_CONTEXT_MATCH');
  if (!primary.solverValidated) flags.push('UNVALIDATED_POLICY_SOURCE');
  if (primary.meta?.stackSpecific === false) flags.push('STACK_INVARIANT_SOURCE');
  if (primary.meta?.villainPositionDimension === false) flags.push('COLLAPSED_VILLAIN_CONTEXT');
  if (conflicts.length) flags.push('EVIDENCE_CONFLICT');

  return { primary, supporting, conflicts, flags };
}
