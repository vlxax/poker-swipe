/**
 * Range Intelligence relationship.
 *
 * Production does not contain a module named Range Intelligence.
 * Closest existing pieces:
 *   - ranges-ui graders (Battleship / narrowing / reference scoreStep)
 *   - solver/src/training/spotSelector.js weaknessScore (solver-spot selection,
 *     not per-hand range memory)
 *   - solver/src/training/progress.js concept mastery (EV drills)
 *
 * Chosen architecture (no duplicate weakness engines):
 *
 *   player answer
 *        → existing production grader (source of truth)
 *        → canonical attempt adapter
 *        → Mistake Memory
 *
 *   Strategy Map is a secondary structural signal into finalReviewPriority only.
 *
 * The standalone rangeIntelligenceAdapter from the ZIP is preserved for
 * optional enrichment IF a future RI payload is supplied. It never overrides
 * an explicit classification (existing adapter contract).
 *
 * We do not backfill RI history: there is none with trustworthy per-hand
 * classification + timestamps + frequency targets.
 */

import { adaptRangeIntelligence } from '../mistake-memory/rangeIntelligenceAdapter.js';

export const RANGE_INTELLIGENCE_POLICY = {
  existsInProduction: false,
  chosenFlow: 'grader → canonical attempt → Mistake Memory',
  riAdapter: 'passthrough-only; classification is source of truth',
  doNotFeed: ['solver/src/training/spotSelector.js#weaknessScore']
};

export function maybeEnrichWithRangeIntelligence(baseAttempt, riPayload) {
  if (!riPayload) return baseAttempt;
  return adaptRangeIntelligence(riPayload, baseAttempt);
}
