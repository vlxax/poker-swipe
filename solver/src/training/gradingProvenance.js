// Machine-readable grading provenance for training decisions.

export const GRADING_SOURCE = {
  TRAINER_EXACT: 'TRAINER_EXACT',
  TRAINER_CONFIRMED: 'TRAINER_CONFIRMED',
  STATIC_CURATED: 'STATIC_CURATED',
  POKER_BRAIN_REFERENCE: 'POKER_BRAIN_REFERENCE',
  PROCEDURAL: 'PROCEDURAL',
  HEURISTIC: 'HEURISTIC',
  UNKNOWN: 'UNKNOWN'
};

/** @typedef {'synthetic_letter_grade'|'synthetic_drill_score'|'trainer_backed'|'unknown'} EvScoreKind */

export const SYNTHETIC_EV_SITES = [
  { path: 'training-ui/miniAppBridge.js', field: 'EV_MAP', kind: 'synthetic_letter_grade', note: 'g/y/r → fixed BB loss abstraction' },
  { path: 'solver/src/training/libraryDrill.js', field: 'BEST_EV/NEAR_EV/WRONG_EV', kind: 'synthetic_drill_score', note: 'internal drill scoring only' },
  { path: 'training-ui/gameShell.js', field: 'evLossBb display', kind: 'synthetic_letter_grade', note: 'UI label says EV but maps from letter grade' },
  { path: 'training-ui/renderer.js', field: 'ПОТЕРЯ EV', kind: 'synthetic_letter_grade', note: 'display abstraction' }
];

export function resolveGradingSource({ trainerResult, libraryTask, brainResult } = {}) {
  if (trainerResult?.status === 'EXACT_TRAINER_MATCH' && trainerResult?.trainer?.gradingAllowed) {
    const prov = trainerResult.trainer?.provenance?.source;
    return prov === 'TRAINER_CONFIRMED' ? GRADING_SOURCE.TRAINER_CONFIRMED : GRADING_SOURCE.TRAINER_EXACT;
  }
  if (libraryTask?._trainerNative) return GRADING_SOURCE.TRAINER_EXACT;
  if (libraryTask?._library || libraryTask?.source === 'library') return GRADING_SOURCE.STATIC_CURATED;
  if (brainResult?.source) return GRADING_SOURCE.POKER_BRAIN_REFERENCE;
  return GRADING_SOURCE.UNKNOWN;
}

export function buildGradingProvenanceRecord({
  task,
  trainerResult,
  brainResult,
  userAction,
  gradeLetter
} = {}) {
  const source = resolveGradingSource({ trainerResult, libraryTask: task, brainResult });
  const trainer = trainerResult?.trainer || task?.trainerMeta || null;
  return {
    gradingSource: source,
    gradeLetter,
    userAction,
    chartId: trainerResult?.chartId || trainer?.chartId || null,
    sourceMode: trainer?.sourceMode || trainerResult?.query?.sourceMode || null,
    actionRaw: trainer?.actionRaw || null,
    normalizedAction: trainer?.normalizedAction || null,
    contextualAction: trainer?.contextualAction || null,
    gradingAllowed: trainer?.gradingAllowed ?? null,
    provenance: trainer?.provenance || null,
    evScoreKind: source.startsWith('TRAINER') ? 'trainer_backed' : 'synthetic_letter_grade'
  };
}
