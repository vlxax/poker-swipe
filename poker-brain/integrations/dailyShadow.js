/**
 * Shadow mode: compare library grading path vs Brain analyze (no user-facing change).
 */
export function shadowCompareDaily({ libraryVerdict, brainDecision }) {
  if (!libraryVerdict || !brainDecision) return 'NOT_COMPARABLE';
  const libAction = libraryVerdict.expectedAction || libraryVerdict.action;
  const brainAction = brainDecision.recommendation?.action;
  if (!libAction || !brainAction) return 'NOT_COMPARABLE';
  if (String(libAction).toUpperCase() === String(brainAction).toUpperCase()) return 'MATCH';
  if (brainDecision.flags?.includes('LIBRARY_TRUTH_PATH')) return 'COMPATIBLE';
  if (brainDecision.conflicts?.length) return 'CONFLICT';
  return 'COMPATIBLE';
}
