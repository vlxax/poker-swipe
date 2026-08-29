/**
 * Validation helpers for Mistake Memory Engine.
 * Never invent missing values. Fail or mark explicitly.
 *
 * P0-2: attempt must have at least one gradable evidence source:
 *   valid classification OR finite weaknessScore.
 * Unscored attempts are rejected — never silent success.
 */

/**
 * Validate a timestamp.
 */
export function validateTimestamp(ts, fieldName = 'timestamp') {
  if (ts === undefined || ts === null) {
    return {
      ok: false,
      errors: [`${fieldName} is required; missing timestamps are not replaced with Date.now()`]
    };
  }
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts < 0) {
    return {
      ok: false,
      errors: [`${fieldName} must be a finite non-negative number`]
    };
  }
  return { ok: true, errors: [], data: ts };
}

const ALLOWED_CLASSIFICATIONS = ['PURE_MATCH', 'IN_MIX', 'RARE_MIX', 'OUT_OF_STRATEGY'];

/**
 * Validate attempt object.
 * Requires itemId, timestamp, and gradable evidence (classification or weaknessScore).
 */
export function validateAttempt(attempt) {
  const errors = [];
  if (!attempt || typeof attempt !== 'object') {
    return { ok: false, errors: ['attempt must be an object'] };
  }
  if (typeof attempt.itemId !== 'string' || attempt.itemId.length === 0) {
    errors.push('itemId must be a non-empty string');
  }
  const tsCheck = validateTimestamp(attempt.timestamp, 'timestamp');
  if (!tsCheck.ok) {
    errors.push(...tsCheck.errors);
  }

  const hasClassification =
    attempt.classification !== undefined && attempt.classification !== null;
  const hasWeakness =
    typeof attempt.weaknessScore === 'number' && Number.isFinite(attempt.weaknessScore);

  if (hasClassification) {
    if (!ALLOWED_CLASSIFICATIONS.includes(attempt.classification)) {
      errors.push(`classification must be one of ${ALLOWED_CLASSIFICATIONS.join(', ')}`);
    }
  }
  if (attempt.weaknessScore !== undefined && attempt.weaknessScore !== null) {
    if (typeof attempt.weaknessScore !== 'number' || !Number.isFinite(attempt.weaknessScore)) {
      errors.push('weaknessScore must be a finite number');
    } else if (attempt.weaknessScore < 0 || attempt.weaknessScore > 1) {
      errors.push('weaknessScore must be in [0,1]');
    }
  }

  // P0-2: require at least one gradable source
  if (!hasClassification && !hasWeakness) {
    errors.push(
      'attempt must include classification or finite weaknessScore; unscored events are rejected'
    );
  }

  if (attempt.frequencyDeviation !== undefined) {
    if (typeof attempt.frequencyDeviation !== 'number' || !Number.isFinite(attempt.frequencyDeviation)) {
      errors.push('frequencyDeviation must be a finite number');
    } else if (attempt.frequencyDeviation < 0 || attempt.frequencyDeviation > 1) {
      errors.push('frequencyDeviation must be in [0,1]');
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, errors: [], data: attempt };
}

export function validateMemoryState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') {
    return { ok: false, errors: ['memoryState must be an object'] };
  }
  if (typeof state.itemId !== 'string') {
    errors.push('itemId required');
  }
  if (typeof state.attempts !== 'number' || state.attempts < 0) {
    errors.push('attempts must be non-negative number');
  }
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], data: state };
}

export function safeNumber(v, fallback = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return fallback;
}
