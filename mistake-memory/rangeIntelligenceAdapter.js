/**
 * Thin adapter from Range Intelligence Engine outputs to memory evidence.
 *
 * ============================================================================
 * EXACT INPUT CONTRACT (standalone; no production imports)
 * ============================================================================
 *
 * baseAttempt (required, source of truth for identity & time):
 * {
 *   itemId: string,          // required
 *   timestamp: number,       // required, finite >= 0
 *   classification?: "PURE_MATCH" | "IN_MIX" | "RARE_MIX" | "OUT_OF_STRATEGY",
 *   chosenAction?: string,
 *   attemptId?: string,
 *   context?: object,
 *   ...
 * }
 *
 * riPayload (optional enrichment):
 * {
 *   weaknessScore?: number,           // 0..1
 *   components?: {
 *     actionError?: number,           // 0..1  (higher = worse action)
 *     frequencyDeviation?: number,    // 0..1
 *     actionRecency?: number,
 *     frequencyRecency?: number,
 *     evidenceStrength?: number       // 0..1
 *   }
 * }
 *
 * ============================================================================
 * SOURCE OF TRUTH (QA P1-5)
 * ============================================================================
 *
 * - If baseAttempt.classification is already present → it is KEPT.
 *   Range Intelligence does NOT override an explicit classification.
 * - If classification is absent and components.actionError is present →
 *   classification is derived from actionError thresholds.
 * - weaknessScore / frequencyDeviation are always filled when provided
 *   (they are numeric evidence, not classification).
 *
 * This adapter invents no production schema beyond the documented shape above.
 */

import { clamp } from './math.js';

/**
 * Convert Range Intelligence weakness payload into attempt-compatible fields.
 *
 * @param {Object|null} riPayload
 * @param {Object} baseAttempt - must already contain itemId + timestamp
 * @returns {Object} enriched attempt
 */
export function adaptRangeIntelligence(riPayload, baseAttempt) {
  if (!baseAttempt || typeof baseAttempt.itemId !== 'string') {
    throw new Error('baseAttempt.itemId is required');
  }
  if (typeof baseAttempt.timestamp !== 'number') {
    throw new Error('baseAttempt.timestamp is required');
  }

  const out = { ...baseAttempt };

  if (riPayload == null) {
    return out;
  }

  if (typeof riPayload.weaknessScore === 'number' && Number.isFinite(riPayload.weaknessScore)) {
    out.weaknessScore = clamp(riPayload.weaknessScore, 0, 1);
  }

  const c = riPayload.components || {};

  if (typeof c.frequencyDeviation === 'number' && Number.isFinite(c.frequencyDeviation)) {
    out.frequencyDeviation = clamp(c.frequencyDeviation, 0, 1);
  }

  // Classification: attempt is source of truth. Only fill when missing.
  if (out.classification == null && typeof c.actionError === 'number') {
    if (c.actionError >= 0.85) {
      out.classification = 'OUT_OF_STRATEGY';
    } else if (c.actionError >= 0.45) {
      out.classification = 'RARE_MIX';
    } else if (c.actionError >= 0.15) {
      out.classification = 'IN_MIX';
    } else {
      out.classification = 'PURE_MATCH';
    }
  }

  // Each PASSTHROUGH field is independent (P1)
  const ctxExtra = {};
  if (typeof c.evidenceStrength === 'number' && Number.isFinite(c.evidenceStrength)) {
    ctxExtra.evidenceStrength = clamp(c.evidenceStrength, 0, 1);
  }
  if (typeof c.actionRecency === 'number' && Number.isFinite(c.actionRecency)) {
    ctxExtra.actionRecency = c.actionRecency;
  }
  if (typeof c.frequencyRecency === 'number' && Number.isFinite(c.frequencyRecency)) {
    ctxExtra.frequencyRecency = c.frequencyRecency;
  }
  if (Object.keys(ctxExtra).length > 0) {
    out.context = { ...(out.context || {}), ...ctxExtra };
  }

  return out;
}
