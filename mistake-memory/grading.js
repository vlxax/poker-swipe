/**
 * Canonical grading source for attempts (P0-1).
 *
 * Precedence:
 *   1. explicit classification (source of truth when present)
 *   2. else finite weaknessScore with documented mapping
 *   3. else unscored — rejected by validation upstream
 *
 * weaknessScore mapping (when no classification):
 *   score >= 0.7  → OUT_OF_STRATEGY (severe error)
 *   score >= 0.45 → RARE_MIX
 *   score >= 0.15 → IN_MIX
 *   score <  0.15 → PURE_MATCH
 *
 * All modules (mastery, stability, successes, severeErrors, timestamps,
 * lapse, recovery) MUST use gradeAttempt() — never re-derive thresholds.
 */

export const WEAKNESS_SEVERE = 0.7;
export const WEAKNESS_RARE = 0.45;
export const WEAKNESS_IN_MIX = 0.15;

/**
 * @param {Object} attempt
 * @returns {{
 *   classification: 'PURE_MATCH'|'IN_MIX'|'RARE_MIX'|'OUT_OF_STRATEGY',
 *   isError: boolean,
 *   isSuccessFull: boolean,
 *   isSuccessPartial: boolean,
 *   successWeight: number,
 *   source: 'classification'|'weaknessScore'
 * }}
 */
export function gradeAttempt(attempt) {
  let classification;
  let source;

  if (attempt.classification != null && attempt.classification !== undefined) {
    classification = attempt.classification;
    source = 'classification';
  } else if (typeof attempt.weaknessScore === 'number' && Number.isFinite(attempt.weaknessScore)) {
    const w = attempt.weaknessScore;
    if (w >= WEAKNESS_SEVERE) classification = 'OUT_OF_STRATEGY';
    else if (w >= WEAKNESS_RARE) classification = 'RARE_MIX';
    else if (w >= WEAKNESS_IN_MIX) classification = 'IN_MIX';
    else classification = 'PURE_MATCH';
    source = 'weaknessScore';
  } else {
    throw new Error('gradeAttempt: attempt has no classification or weaknessScore');
  }

  const isError = classification === 'OUT_OF_STRATEGY';
  let successWeight = 0;
  if (classification === 'PURE_MATCH' || classification === 'IN_MIX') successWeight = 1;
  else if (classification === 'RARE_MIX') successWeight = 0.5;

  return {
    classification,
    isError,
    isSuccessFull: successWeight >= 1,
    isSuccessPartial: successWeight > 0,
    successWeight,
    source
  };
}
