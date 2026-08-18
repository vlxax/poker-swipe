// Lightweight training-spot detection over hand-analysis decisions. A decision is
// "interesting" when it is genuinely instructive for a player to review: the top
// actions are close, the strategy is meaningfully mixed, the player's EV loss is
// significant, a river bluff-catch is tight, or sizing materially changes EV.
// Produces a difficulty score (0..1) and metadata a future drill system could use.

export const MAX_EV_LOSS_MISTAKE = 0.05;
export const CLOSE_EV_BB = 0.03;
export const SIZE_SPREAD_BB = 0.05;

// Inspect one solved decision and return { interesting, reason, difficulty,
// trainingPrompt } or null when nothing worth training on is present.
export function inspectDecision(decision) {
  const reasons = [];
  let difficulty = 0.3;

  const evSep = decision.evSeparationBB;
  const bestFreq = decision.recommendedFrequency;
  const loss = decision.evLossBB;
  const severity = decision.mistakeSeverity || decision.severity;

  if (evSep != null && evSep >= 0 && evSep < CLOSE_EV_BB) {
    reasons.push('close_ev');
    difficulty += 0.25;
  }

  if (bestFreq != null && bestFreq > 0.2 && bestFreq < 0.8) {
    reasons.push('mixed_strategy');
    difficulty += 0.2;
  }

  if (loss != null && loss > MAX_EV_LOSS_MISTAKE) {
    reasons.push('significant_ev_loss');
    difficulty += 0.15;
  }

  if (decision.street === 'river' && decision.actionTaken &&
      ['call', 'fold'].includes(decision.actionTaken.type)) {
    // River call/fold: check how close call and fold are in EV.
    const call = findEV(decision, 'call');
    const fold = findEV(decision, 'fold');
    if (call != null && fold != null && Math.abs(call - fold) < CLOSE_EV_BB) {
      reasons.push('river_bluff_catch');
      difficulty += 0.15;
    }
  }

  const spread = sizingSpread(decision);
  if (spread != null && spread > SIZE_SPREAD_BB) {
    reasons.push('sizing_sensitive');
    difficulty += 0.15;
  }

  // More legal decisions = slightly harder.
  if (decision.legalActions && decision.legalActions.length > 3) {
    difficulty += Math.min(0.1, (decision.legalActions.length - 3) * 0.03);
  }

  if (severity === 'large' || severity === 'severe') difficulty += 0.1;

  if (reasons.length === 0) return null;

  return {
    interesting: true,
    reason: reasons,
    difficultyScore: round(Math.min(0.95, Math.max(0.05, difficulty)), 3),
    trainingPrompt: {
      drill: 'spot_review',
      street: decision.street,
      board: decision.board,
      actionTaken: decision.actionTaken,
      recommendedAction: decision.recommendedAction,
      evLossBB: loss,
      reason: reasons
    }
  };
}

// Analyze every decision in a hand and return the interesting ones in order.
export function detectInterestingSpots(decisions = []) {
  return decisions
    .map((d) => ({ decision: d, inspection: inspectDecision(d) }))
    .filter((x) => x.inspection != null)
    .map((x) => ({ street: x.decision.street, ...x.inspection }));
}

// The EV of the action whose root id is `id` (e.g. 'call', 'fold').
function findEV(decision, id) {
  if (!decision.actionEV) return null;
  return decision.actionEV[id] != null ? decision.actionEV[id] : null;
}

// Spread (max - min) of EV across distinct bet/raise sizes.
function sizingSpread(decision) {
  const entries = (decision.legalActions || [])
    .filter((a) => a && a.action && (a.action.type === 'bet' || a.action.type === 'raise'))
    .map((a) => a.evBB)
    .filter((n) => Number.isFinite(n));
  if (entries.length < 2) return null;
  return Math.max(...entries) - Math.min(...entries);
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}