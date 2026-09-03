// Hand of the Day → Canonical Grading Adapter
// Maps 5-level Hand of the Day grades to 4-level canonical grades.
// Preserves original Hand of the Day context in metadata.
// Does NOT invent numeric penalties; uses conservative mapping.

const HOD_GRADES = {
  BEST: 'BEST',
  GOOD: 'GOOD',
  MIXED: 'MIXED',
  INACCURATE: 'INACCURATE',
  MISTAKE: 'MISTAKE'
};

const CANONICAL_GRADES = {
  GOOD: 'GOOD',
  INACCURACY: 'INACCURACY',
  MISTAKE: 'MISTAKE',
  BLUNDER: 'BLUNDER'
};

/**
 * Map Hand of the Day grade to canonical grade for storage in Mistake Memory.
 *
 * Strategy:
 * - BEST → GOOD (optimal decision, no EV loss)
 * - GOOD → GOOD (acceptable alternative, minimal loss)
 * - MIXED → INACCURACY (contextually valid but riskier)
 * - INACCURATE → INACCURACY or MISTAKE (depends on severity)
 * - MISTAKE → MISTAKE or BLUNDER (depends on severity)
 *
 * For simplicity without EV data, we map conservatively:
 * - INACCURATE → INACCURACY (err on side of learning, not punishment)
 * - MISTAKE → MISTAKE (clear error)
 *
 * Implied EV losses (for history entry, not canonical grading):
 * - BEST: 0 BB
 * - GOOD: 0.02 BB (small loss)
 * - MIXED: 0.10 BB (context-dependent)
 * - INACCURATE: 0.40 BB (substantial but not terrible)
 * - MISTAKE: 0.80 BB (clear error)
 */

const GRADE_MAPPING = {
  [HOD_GRADES.BEST]: {
    canonical: CANONICAL_GRADES.GOOD,
    impliedEvLossBB: 0,
    explanation: 'Hand of the Day: Optimal decision'
  },
  [HOD_GRADES.GOOD]: {
    canonical: CANONICAL_GRADES.GOOD,
    impliedEvLossBB: 0.02,
    explanation: 'Hand of the Day: Acceptable alternative'
  },
  [HOD_GRADES.MIXED]: {
    canonical: CANONICAL_GRADES.INACCURACY,
    impliedEvLossBB: 0.10,
    explanation: 'Hand of the Day: Context-dependent strategy'
  },
  [HOD_GRADES.INACCURATE]: {
    canonical: CANONICAL_GRADES.INACCURACY,
    impliedEvLossBB: 0.40,
    explanation: 'Hand of the Day: Suboptimal but learnable'
  },
  [HOD_GRADES.MISTAKE]: {
    canonical: CANONICAL_GRADES.MISTAKE,
    impliedEvLossBB: 0.80,
    explanation: 'Hand of the Day: Clear strategic error'
  }
};

/**
 * Adapt a Hand of the Day grading result to canonical form.
 *
 * Input:
 *   {
 *     grade: 'BEST' | 'GOOD' | 'MIXED' | 'INACCURATE' | 'MISTAKE',
 *     classification?: string,  (optional HOD-specific context)
 *     explanation?: string      (optional HOD explanation)
 *   }
 *
 * Output:
 *   {
 *     canonicalGrade: 'GOOD' | 'INACCURACY' | 'MISTAKE' | 'BLUNDER',
 *     impliedEvLossBB: number,  (conservative estimate)
 *     hodGrade: string,         (original grade, preserved in metadata)
 *     hodClassification?: string,
 *     hodExplanation?: string,
 *     adaptationReason: string
 *   }
 */
export function adaptHodGradeToCanonical(hodResult) {
  if (!hodResult || !hodResult.grade) {
    return {
      canonicalGrade: CANONICAL_GRADES.GOOD,
      impliedEvLossBB: 0,
      hodGrade: 'UNKNOWN',
      adaptationReason: 'No grade provided; defaulting to GOOD'
    };
  }

  const hodGrade = hodResult.grade;
  const mapping = GRADE_MAPPING[hodGrade];

  if (!mapping) {
    return {
      canonicalGrade: CANONICAL_GRADES.GOOD,
      impliedEvLossBB: 0,
      hodGrade,
      hodClassification: hodResult.classification,
      hodExplanation: hodResult.explanation,
      adaptationReason: `Unknown HOD grade "${hodGrade}"; conservatively mapped to GOOD`
    };
  }

  return {
    canonicalGrade: mapping.canonical,
    impliedEvLossBB: mapping.impliedEvLossBB,
    hodGrade,
    hodClassification: hodResult.classification,
    hodExplanation: hodResult.explanation,
    adaptationReason: mapping.explanation
  };
}

/**
 * Build a Mistake Memory-compatible attempt from Hand of the Day grading.
 *
 * This is the key integration function: it transforms HOD grading
 * into a shape that recordTrainingResult() expects.
 *
 * Input:
 *   {
 *     scenarioId: string,
 *     userActions: string[],  (ordered list of chosen actions)
 *     timestamp: number,
 *     hodGrade: { grade, classification?, explanation? },
 *     concept?: string         (optional, from scenarioConceptMapping)
 *   }
 *
 * Output:
 *   {
 *     drill: { concept, drillId, ... },
 *     grade: 'GOOD' | 'INACCURACY' | 'MISTAKE' | 'BLUNDER',
 *     evLossBb: number,
 *     hodMetadata: { ... }    (preserved for debugging/UI)
 *   }
 */
export function buildMistakeMemoryAttempt({
  scenarioId,
  userActions = [],
  timestamp = Date.now(),
  hodGrade = {},
  concept = null
}) {
  if (!scenarioId) {
    throw new Error('buildMistakeMemoryAttempt: scenarioId required');
  }

  const adapted = adaptHodGradeToCanonical(hodGrade);
  const actionSequence = userActions.join('|');
  const attemptId = `${scenarioId}|${actionSequence}`;

  return {
    // For recordTrainingResult()
    drill: {
      concept: concept || 'hand_of_day_unclassified',
      drillId: `hod_${scenarioId}_${timestamp}`,
      spotId: `hod_${scenarioId}`,
      sourceTaskId: `hod_${scenarioId}`,
      scenario: { id: scenarioId, actionSequence }
    },
    grade: adapted.canonicalGrade,
    evLossBb: adapted.impliedEvLossBB,

    // Metadata (preserved for UI, debugging, future analysis)
    hodMetadata: {
      scenarioId,
      userActions,
      timestamp,
      originalGrade: adapted.hodGrade,
      originalClassification: adapted.hodClassification,
      originalExplanation: adapted.hodExplanation,
      adaptationReason: adapted.adaptationReason,
      attemptId
    }
  };
}

/**
 * Check if two HOD attempts are semantically identical (for deduplication).
 *
 * Two attempts are identical if:
 * - Same scenario ID
 * - Same action sequence (same decisions in same order)
 * - Similar timestamp (within 5 seconds, accounting for page render variance)
 */
export function areHodAttemptsIdentical(attempt1, attempt2) {
  if (!attempt1 || !attempt2) return false;
  if (attempt1.hodMetadata?.scenarioId !== attempt2.hodMetadata?.scenarioId) return false;

  const actions1 = attempt1.hodMetadata?.userActions || [];
  const actions2 = attempt2.hodMetadata?.userActions || [];
  if (actions1.length !== actions2.length) return false;
  if (!actions1.every((a, i) => a === actions2[i])) return false;

  const ts1 = attempt1.hodMetadata?.timestamp || 0;
  const ts2 = attempt2.hodMetadata?.timestamp || 0;
  const timeDiff = Math.abs(ts1 - ts2);

  return timeDiff < 5000; // Within 5 seconds is considered duplicate
}

/**
 * Grading Mapping Summary for Reference:
 *
 * Hand of the Day (UI)     Canonical (Storage)    Implied EV Loss
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * BEST     ⭐              GOOD                   0 BB
 * GOOD     ✅              GOOD                   0.02 BB
 * MIXED    ⚖️              INACCURACY             0.10 BB
 * INACCURATE ⚠️            INACCURACY             0.40 BB
 * MISTAKE  ❌              MISTAKE                0.80 BB
 *
 * Notes:
 * - Implied EV losses are CONSERVATIVE estimates, not computed from solver.
 * - Mapping preserves semantic distinction (GOOD stays learnable, MISTAKE stays punished).
 * - Original HOD context is stored in metadata for future analysis.
 * - Two non-BEST decisions with same action sequence are treated as INACCURACY
 *   (learnable), not MISTAKE (punished), respecting mixed-strategy semantics.
 */
