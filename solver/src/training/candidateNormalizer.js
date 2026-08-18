// Normalizes a PokerSwipe review model's trainingCandidate (plus the source hand
// and the specific solved decision it points at) into the standardized candidate
// the personalized-training pipeline consumes. It never fabricates data the
// source did not provide: anything unknown stays null.

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';
import { classifyConcept } from './concepts.js';

const ANALYZER_VERSION = 'solver-core';

export function normalizeCandidate({
  reviewModel = {},
  sourceHandId = null,
  sourceCandidateId = null,
  decisionIndex = null,
  forceConcept = null
} = {}) {
  const tc = reviewModel.trainingCandidate || null;
  const hand = reviewModel.hand || {};
  const decisions = reviewModel.decisions || [];

  // The decision this candidate points at (by index when provided, else the one
  // matching the candidate's street).
  let decision = null;
  if (decisionIndex != null) {
    decision = decisions.find((d) => d.index === decisionIndex) || null;
  }
  if (!decision && tc) {
    decision = decisions.find((d) => d.street === tc.street) || null;
  }

  const street = tc ? tc.street : decision ? decision.street : null;
  const board = tc && tc.board && tc.board.length ? tc.board : decision ? decision.board || [] : [];
  const actionTaken = tc && tc.actionTaken ? tc.actionTaken : decision ? decision.actionTaken || null : null;
  const recommendedAction = tc && tc.recommendedAction ? tc.recommendedAction : decision ? decision.recommendedAction || null : null;
  const evLossBB = tc && tc.evLossBB != null ? tc.evLossBB : decision ? decision.evLossBB != null ? decision.evLossBB : null : null;
  const severity = decision ? decision.severity || null : null;
  const confidence = decision && decision.confidence ? {
    score: decision.confidence.score,
    level: decision.confidence.level
  } : null;

  const reason = tc && Array.isArray(tc.reason) ? tc.reason : [];
  const interestingReason = tc && tc.difficultyScore != null
    ? reason.join(', ') : reason.join(', ');

  const difficulty = tc && tc.difficultyScore != null ? tc.difficultyScore : null;
  const keyConcept = decision && decision.explanation && decision.explanation.keyConcept
    ? decision.explanation.keyConcept : null;
  const concept = forceConcept || classifyConcept({
    street,
    actionTaken,
    recommendedAction,
    reason,
    keyConcept,
    sizingSensitive: reason.includes('sizing_sensitive') || null
  });

  const subConcept = keyConcept && keyConcept !== concept ? keyConcept : null;

  const positions = {
    hero: hand.positions && hand.positions.hero ? hand.positions.hero : null,
    villain: hand.positions && hand.positions.villain ? hand.positions.villain : null
  };
  const effectiveStackBb = hand.effStack != null ? Number(hand.effStack) : null;
  const potBb = decision ? decision.potBB : null;
  const heroCards = Array.isArray(hand.hero) ? hand.hero : [];
  const sourceDecisionId = decision != null ? `d${decision.index != null ? decision.index : 0}` : null;

  const id = stableHash(
    `${sourceHandId || ''}|${sourceCandidateId || ''}|${sourceDecisionId || ''}|${street || ''}|${concept}|${ANALYZER_VERSION}`
  );

  return {
    id,
    sourceHandId: sourceHandId || null,
    sourceDecisionId,

    street,
    concept,
    subConcept,

    positions,
    effectiveStackBb,
    potBb,

    board,
    heroCards,

    sourceAction: actionTaken,
    recommendedAction,

    sourceEvLossBb: evLossBB != null ? round(evLossBB, 4) : null,
    sourceSeverity: severity,
    confidence,

    reason,
    interestingReason: interestingReason || null,
    difficulty,

    generationConstraints: {
      preservePositionPattern: true,
      preserveStackBucket: effectiveStackBb != null,
      preserveStreet: true,
      preserveConcept: true,
      varyBoard: true,
      varyHeroCombo: true,
      varySizing: true
    },

    solverMetadata: {
      analyzerVersion: (reviewModel.meta && reviewModel.meta.version) || ANALYZER_VERSION
    }
  };
}

// The dedup identity for a leak event / candidate from a source hand. Same
// sourceHandId + decision + analyzer version ⇒ same event (requirement 18).
export function candidateIdentity(normalized) {
  return stableHash(
    `${normalized.sourceHandId || ''}|${normalized.sourceDecisionId || ''}|${normalized.solverMetadata.analyzerVersion || ANALYZER_VERSION}`
  );
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export { ANALYZER_VERSION };