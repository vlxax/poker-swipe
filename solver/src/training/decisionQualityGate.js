// P1 Decision Quality Gate — active curriculum filters (no Trainer semantics changes).

import { buildCanonicalSpot } from '../../../task-context/canonicalSpot.js';
import { auditModeSpot } from './taskContextIntegrity.js';
import { resolveGradingSource, GRADING_SOURCE } from './gradingProvenance.js';
import { isMeaningfulTrainerDecision } from '../../../trainer-knowledge/legalPreflopUserOptions.js';

/** Strip stack-variant suffixes for near-duplicate session dedup. */
export { variantFamilyId } from './sessionDiversity.js';
export function trainerSessionFingerprint(task) {
  if (task?.trainerMeta?.chartId && task?.trainerMeta?.hand) {
    return `trainer:${task.trainerMeta.chartId}:${task.trainerMeta.hand}`;
  }
  return `task:${variantFamilyId(task?.id || '')}`;
}

export function sessionFamilyFingerprint(task) {
  const canonical = task?._canonical || buildCanonicalSpot(task);
  const hist = (canonical.history || []).map((h) => h.text).join('|').slice(0, 80);
  return [
    canonical.street,
    canonical.position,
    canonical.villain,
    canonical.correct || task?.correct,
    hist
  ].join('::');
}

export function gradingSourceForTask(task, lookup = null) {
  if (task?._trainerNative || task?.trainerMeta?.gradingSource === 'TRAINER_EXACT') {
    return GRADING_SOURCE.TRAINER_EXACT;
  }
  if (task?._legacy) return GRADING_SOURCE.HEURISTIC;
  if (task?._exploit) return GRADING_SOURCE.PROCEDURAL;
  if (task?._library) return GRADING_SOURCE.STATIC_CURATED;
  return resolveGradingSource({ libraryTask: task, lookup });
}

export function isHeuristicTask(task) {
  return gradingSourceForTask(task) === GRADING_SOURCE.HEURISTIC;
}

export function passesIntegrity(task, mode, lookup = null) {
  const audit = auditModeSpot(task, mode, { lookup });
  if (audit.quarantined) return false;
  return !(audit.errors || []).length;
}

/**
 * Active for normal user-facing training rotation.
 * Excludes: heuristic legacy, integrity failures, non-meaningful trainer single-option cells.
 */
export function isActiveForTraining(task, mode = 'swipe', lookup = null) {
  if (!task?.id) return false;
  if (task._legacy || isHeuristicTask(task)) return false;
  if (task._trainerNative && !isMeaningfulTrainerDecision(task)) return false;
  if (!passesIntegrity(task, mode, lookup)) return false;
  const src = gradingSourceForTask(task, lookup);
  if (src === GRADING_SOURCE.UNKNOWN || src === GRADING_SOURCE.HEURISTIC) return false;
  return true;
}

export function filterActiveCandidates(candidates, mode = 'swipe', lookup = null) {
  return (candidates || []).filter((t) => isActiveForTraining(t, mode, lookup));
}

export function countOneOptionTasks(candidates) {
  let one = 0;
  for (const t of candidates || []) {
    const opts = t?.options || [];
    if (opts.length <= 1) one++;
  }
  return one;
}

export function countMeaningfulDecisions(candidates) {
  let n = 0;
  for (const t of candidates || []) {
    if (t?._trainerNative) {
      if (isMeaningfulTrainerDecision(t)) n++;
    } else if ((t?.options || []).length >= 2) {
      n++;
    }
  }
  return n;
}
