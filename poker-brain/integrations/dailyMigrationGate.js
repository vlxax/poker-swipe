import { listMissingContextFields } from '../context/DecisionContext.js';

/**
 * Diagnostic only — does NOT enable Brain as Daily user truth.
 */
export function canUnifiedBrainOwnDaily(context, brainResult) {
  const blockers = [];
  if (!context) blockers.push('NO_CONTEXT');
  if (!brainResult) blockers.push('NO_BRAIN_RESULT');

  const missing = listMissingContextFields(context || {});
  if (missing.length > 2) blockers.push('CONTEXT_INCOMPLETE');

  if (brainResult?.flags?.includes('NO_STRATEGY_AVAILABLE')) blockers.push('NO_STRATEGY');
  if (brainResult?.flags?.includes('EVIDENCE_CONFLICT')) blockers.push('UNRESOLVED_CONFLICT');
  if (brainResult?.contextCompatibility?.ignoredMaterialFields?.length) {
    blockers.push('MATERIAL_CONTEXT_COLLAPSED');
  }
  if (!brainResult?.provenance?.primarySource) blockers.push('NO_PRIMARY_SOURCE');
  if (brainResult?.contextQuality?.level === 'VERY_LOW') blockers.push('LOW_CONTEXT_QUALITY');

  const primary = brainResult?.provenance?.primarySource;
  if (primary === 'REFERENCE_6MAX' && !brainResult?.supporting?.length) {
    blockers.push('REFERENCE_ONLY_PRIMARY');
  }

  return {
    canOwn: blockers.length === 0,
    blockers,
    safeCandidate: blockers.length === 0
  };
}

export function summarizeDailyMigrationGate(tasksWithGate) {
  const total = tasksWithGate.length;
  const safe = tasksWithGate.filter((t) => t.gate?.safeCandidate).length;
  return {
    SAFE_CANDIDATE_COUNT: safe,
    SAFE_CANDIDATE_PERCENT: total ? Math.round((100 * safe) / total) : 0,
    BLOCKED_COUNT: total - safe
  };
}
