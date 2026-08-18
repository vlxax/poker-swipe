// Product-facing review model for a saved PokerSwipe hand. It wraps the solver's
// `analyzeHand` (range-level, street-by-street CFR re-solve) and turns the raw
// result into the shape the "My Hands" UI renders: an overall verdict + EV loss,
// per-decision street reviews (what Hero did, recommended strategy, EV, EV loss,
// severity, confidence, explanation), the biggest mistake, a training candidate,
// and explicit warnings. It never fabricates a decision that was not solved and
// never invents an opponent mistake the solver did not actually evaluate.
//
// Non-blocking usage (browser): `reviewPokerSwipeHandAsync` yields to the event
// loop once before solving so a loading state can paint, honors an AbortSignal,
// and routes solver cancellation / timeouts / failures into a graceful status.

import { analyzeHand } from '../hand/handAnalyzer.js';
import { detectInterestingSpots } from '../hand/interestingSpots.js';
import { classifyMistake } from '../analysis/mistakeClassifier.js';
import { SolverError } from '../api/errors.js';
import { adaptPokerSwipeHand, handContentKey } from './pokerSwipeHandAdapter.js';

const VERSION = 'solver-core';

// Bounded, fixed-iteration solver defaults. Adaptive mode requires
// minIterations (200+) which is far too slow for interactive review, and the
// maxSolveMs/maxNodes guards do not reliably bound runtime (the per-iteration
// cost scales with range class count). So the product solves a fixed, modest
// number of iterations with the adapter's coarse ranges — a few seconds per
// decision spot — and reports the (deliberately low) confidence prominently.
const DEFAULT_SOLVER_OPTS = {
  adaptive: false,
  maxChanceBranches: 1,
  seed: 12345,
  iterations: 20
};

// Build the full review model synchronously (used by tests and internally).
export function buildReviewModel(hand = {}, options = {}) {
  // ---- 1. Normalize (may reject malformed hands). ----
  let adapted;
  try {
    adapted = adaptPokerSwipeHand(hand, options);
  } catch (err) {
    return errorStatus(err, { status: 'ERROR' });
  }
  const { input, warnings, meta } = adapted;

  const solverOpts = {
    adaptive: options.adaptive != null ? options.adaptive : DEFAULT_SOLVER_OPTS.adaptive,
    maxChanceBranches: options.maxChanceBranches != null ? options.maxChanceBranches : DEFAULT_SOLVER_OPTS.maxChanceBranches,
    seed: options.seed != null ? options.seed : DEFAULT_SOLVER_OPTS.seed,
    iterations: options.iterations != null ? options.iterations : DEFAULT_SOLVER_OPTS.iterations
  };
  if (options.maxSolveMs != null) solverOpts.maxSolveMs = options.maxSolveMs;
  if (options.signal != null) solverOpts.signal = options.signal;

  // ---- 2. Cache. ----
  const cache = options.cache || null;
  const contentKey = handContentKey(hand, options);
  let cached = false;
  if (cache) {
    const hit = cache.get(contentKey, solverOpts);
    if (hit && hit.status && hit.status !== 'ERROR') {
      return { ...hit, meta: { ...hit.meta, cached: true } };
    }
  }

  // ---- 3. Solve. ----
  let raw;
  try {
    raw = analyzeHand(input, solverOpts);
  } catch (err) {
    const errStatus = errorStatus(err, {});
    if (cache && errStatus.status !== 'CANCELLED') cache.set(contentKey, solverOpts, errStatus);
    return errStatus;
  }

  // ---- 4. Build the product model. ----
  const model = toReviewModel(raw, { meta, warnings, solverOpts });

  if (cache) cache.set(contentKey, solverOpts, model);
  return model;
}

// Asynchronous wrapper for the browser UI: yields once (so a loading frame can
// render), checks the AbortSignal, then runs the synchronous solve.
export async function reviewPokerSwipeHandAsync(hand, options = {}) {
  if (options.signal && options.signal.aborted) {
    return { status: 'CANCELLED', warnings: ['Analysis cancelled before it started.'] };
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (options.signal && options.signal.aborted) {
    return { status: 'CANCELLED', warnings: ['Analysis cancelled.'] };
  }
  return buildReviewModel(hand, options);
}

// Turn a raw analyzeHand result into the product-facing shape.
function toReviewModel(raw, { meta, warnings, solverOpts }) {
  const decisions = (raw.decisions || []).map((d) => ({
    index: d.index,
    solved: !!d.solved,
    street: d.street,
    board: d.board || [],
    potBB: d.potBB,
    spr: d.spr,
    actionTaken: d.actionTaken || null,
    recommendedAction: d.recommendedAction || null,
    recommendedFrequency: d.recommendedFrequency != null ? round(d.recommendedFrequency, 4) : null,
    heroEV: d.heroEV != null ? round(d.heroEV, 4) : null,
    bestEV: d.bestEV != null ? round(d.bestEV, 4) : null,
    evLossBB: d.evLossBB != null ? round(d.evLossBB, 4) : null,
    severity: d.severity || null,
    mistakeSeverity: d.mistakeSeverity || null,
    confidence: d.confidence ? { score: d.confidence.score, level: d.confidence.level } : null,
    explanation: d.explanation || null,
    error: d.error || null
  }));

  const solvedDecisions = decisions.filter((d) => d.solved);
  const failedDecisions = decisions.filter((d) => !d.solved);
  const biggest = raw.biggestMistake || null;

  // Mark which decision is the biggest mistake (by decision index + street).
  if (biggest) {
    const b = decisions.find((d) => d.index === biggest.decisionIndex && d.street === biggest.street);
    if (b) b.biggest = true;
  }

  // Aggregate overall verdict from the total EV loss.
  const preset = meta.preset || 'mtt';
  const overallVerdict = classifyMistake({ evLossBB: raw.totalEvLossBB || 0, preset }).severity;

  // Aggregate confidence = worst solved-decision confidence (conservative).
  const confScores = solvedDecisions.map((d) => (d.confidence ? d.confidence.score : null)).filter((n) => n != null);
  const conf = confScores.length
    ? { score: Math.min(...confScores), level: confScoresMinLevel(confScores) }
    : { score: null, level: 'low' };

  // Training candidate: the most instructive interesting spot.
  const trainingCandidate = pickTrainingCandidate(raw.interestingSpots || []);

  // Determine status.
  let status = 'READY';
  if (decisions.length === 0) status = 'LIMITED';
  else if (failedDecisions.some((d) => d.error && d.error.code === 'CANCELLED')) status = 'CANCELLED';
  else if (failedDecisions.length > 0) status = 'LIMITED';

  const allWarnings = [
    ...(warnings || []),
    ...confLevelWarnings(conf),
    ...(failedDecisions.length ? [`${failedDecisions.length} decision(s) could not be solved by the solver.`] : [])
  ];

  return {
    status,
    hand: {
      hero: meta.heroCards,
      villain: meta.villainCards,
      board: meta.board,
      positions: { hero: meta.heroSeat, villain: meta.villainSeat },
      effStack: meta.effStack,
      preset
    },
    overall: {
      totalEvLossBB: raw.totalEvLossBB != null ? round(raw.totalEvLossBB, 4) : 0,
      decisionsAnalyzed: decisions.length,
      solvedDecisions: solvedDecisions.length,
      verdict: overallVerdict,
      biggestMistake: biggest
        ? { street: biggest.street, decisionIndex: biggest.decisionIndex, evLossBB: round(biggest.evLossBB, 4) }
        : null,
      summary: raw.summary || null,
      confidence: conf
    },
    decisions,
    trainingCandidate,
    warnings: dedupe(allWarnings),
    meta: {
      version: VERSION,
      durationMs: raw.meta ? raw.meta.durationMs : null,
      seed: solverOpts.seed,
      maxChanceBranches: solverOpts.maxChanceBranches,
      adaptive: solverOpts.adaptive,
      cached: false
    }
  };
}

// Pick the single most instructive training spot (highest difficulty, preferring
// one with an EV loss). Returns a compact candidate or null.
function pickTrainingCandidate(spots) {
  if (!spots || spots.length === 0) return null;
  const ranked = spots.slice().sort((a, b) => (b.difficultyScore || 0) - (a.difficultyScore || 0));
  const top = ranked[0];
  return {
    street: top.street,
    board: top.board || [],
    difficultyScore: round(top.difficultyScore || 0, 3),
    reason: top.reason || [],
    actionTaken: top.trainingPrompt ? top.trainingPrompt.actionTaken : null,
    recommendedAction: top.trainingPrompt ? top.trainingPrompt.recommendedAction : null,
    evLossBB: top.trainingPrompt && top.trainingPrompt.evLossBB != null ? round(top.trainingPrompt.evLossBB, 4) : null
  };
}

// Build an ERROR / LIMITED model from a thrown SolverError (or any error).
function errorStatus(err, base) {
  const code = err instanceof SolverError ? err.code : err && err.code ? err.code : 'INTERNAL';
  const message = err && err.message ? err.message : String(err);
  if (code === 'CANCELLED') {
    return { status: 'CANCELLED', warnings: ['Analysis was cancelled.'], ...base };
  }
  if (code === 'INVALID_INPUT' || code === 'INVALID_HAND' || code === 'INVALID_CARD' ||
      code === 'INVALID_BOARD' || code === 'INVALID_STACK' || code === 'DUPLICATE_CARD' ||
      code === 'INVALID_ACTION' || code === 'INVALID_RANGE') {
    return { status: 'LIMITED', error: { code, message }, trainingCandidate: null, warnings: [message], ...base };
  }
  return { status: 'ERROR', error: { code, message }, trainingCandidate: null, warnings: [message], ...base };
}

function confScoresMinLevel(scores) {
  const min = Math.min(...scores);
  return min >= 0.8 ? 'high' : min >= 0.6 ? 'medium' : 'low';
}

function confLevelWarnings(conf) {
  if (!conf || conf.score == null) return ['Confidence is unavailable — treat results as tentative.'];
  if (conf.level === 'low') return ['Low solver confidence in this spot — the recommended line is tentative.'];
  if (conf.level === 'medium') return ['Medium solver confidence — the abstraction may not capture every line.'];
  return [];
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export { VERSION };