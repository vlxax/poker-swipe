/**
 * Canonical attempt adapter.
 *
 * Production grader result → Mistake Memory attempt.
 * One player answer = one logical attempt. Classification comes from
 * production frequencies / trainer legality — not from mission score.
 *
 * Mixed strategy:
 *   unique primary (argmax) → PURE_MATCH
 *   other legal freq >= 0.15 (PLAY_THRESHOLD) → IN_MIX
 *   other legal freq > 0     → RARE_MIX
 *   freq 0 / unsupported     → OUT_OF_STRATEGY
 *
 * Frequency target is passed only when production has a real mixed
 * distribution. Discrete trainer labels do not invent 50/50.
 */

import { mapProductionAction, mapProductionDistribution } from './actionMapping.js';
import { canonicalItemId, attemptIdFor } from './itemId.js';
import { handStrategyVersion } from './strategyVersion.js';

export const PLAY_THRESHOLD = 0.15;

export function classifyChosenAction(chosenAction, distribution) {
  const mapped = mapProductionAction(chosenAction);
  const canonical = mapped.canonical;
  if (!canonical) {
    return {
      classification: null,
      reason: 'unsupported_action',
      strategyOk: false,
      chosenCanonical: null
    };
  }
  const dist = distribution || {};
  const p = dist[canonical] || 0;
  if (p <= 0) {
    return {
      classification: 'OUT_OF_STRATEGY',
      reason: 'zero_frequency',
      strategyOk: false,
      chosenCanonical: canonical,
      targetProbability: 0
    };
  }

  const values = Object.values(dist);
  const max = Math.max(...values);
  const primaries = Object.keys(dist).filter((a) => dist[a] === max);
  const uniquePrimary = primaries.length === 1 ? primaries[0] : null;

  let classification;
  if (uniquePrimary && canonical === uniquePrimary) classification = 'PURE_MATCH';
  else if (p >= PLAY_THRESHOLD) classification = 'IN_MIX';
  else classification = 'RARE_MIX';

  return {
    classification,
    reason: classification,
    strategyOk: true,
    chosenCanonical: canonical,
    targetProbability: p
  };
}

export function targetDistributionForMemory(distribution) {
  if (!distribution) return null;
  const keys = Object.keys(distribution).filter((k) => (distribution[k] || 0) > 0);
  if (keys.length < 2) return null;
  return { ...distribution };
}

export function attemptFromReferencePolicy({
  rangeId,
  hand,
  policy,
  chosenAction,
  timestamp,
  producer,
  sequence,
  attemptId,
  context = {}
}) {
  const mapped = mapProductionDistribution(policy);
  if (!mapped.ok) {
    return { ok: false, attempt: null, error: mapped.errors.join('; ') };
  }
  const grade = classifyChosenAction(chosenAction, mapped.distribution);
  if (!grade.classification) {
    return { ok: false, attempt: null, error: grade.reason };
  }
  const targetDistribution = targetDistributionForMemory(mapped.distribution);
  const itemId = canonicalItemId({
    source: 'reference',
    rangeId,
    hand,
    distribution: mapped.distribution
  });
  const ts = timestamp;
  const id = attemptId || attemptIdFor({ producer: producer || 'reference', itemId, sequence, timestamp: ts });
  return {
    ok: true,
    attempt: {
      itemId,
      timestamp: ts,
      attemptId: id,
      classification: grade.classification,
      chosenAction: grade.chosenCanonical,
      targetDistribution: targetDistribution || undefined,
      context: {
        ...context,
        source: 'reference',
        rangeId,
        hand,
        strategyOk: grade.strategyOk,
        strategyVersion: handStrategyVersion(mapped.distribution),
        hasFrequencyTarget: !!targetDistribution
      }
    }
  };
}

export function attemptFromTrainerCell({
  rangeId,
  hand,
  cell,
  chosenAction,
  timestamp,
  producer,
  sequence,
  attemptId,
  context = {},
  mission = null
}) {
  if (!cell || cell.gradingAllowed === false) {
    return { ok: false, attempt: null, error: 'not_gradable', skip: true };
  }

  const raw = cell.trainerActionRaw || cell.actionRaw || cell.normalizedAction || cell.action;
  const mappedAction = mapProductionAction(raw);
  if (!mappedAction.canonical) {
    return { ok: false, attempt: null, error: 'trainer_action_unsupported', skip: true };
  }

  const distribution = { [mappedAction.canonical]: 1 };
  const chosen = mapProductionAction(chosenAction);
  const strategyOk = chosen.canonical === mappedAction.canonical;

  let classification = strategyOk ? 'PURE_MATCH' : 'OUT_OF_STRATEGY';
  let missionResult = null;

  if (mission) {
    const isTarget = !!mission.isTarget;
    const inRange = cell.normalizedAction !== 'FOLD' && mappedAction.canonical !== 'FOLD';
    if (!isTarget && inRange) {
      missionResult = 'MISSION_OFF_TARGET';
      classification = 'PURE_MATCH';
    } else if (!isTarget && !inRange) {
      missionResult = 'MISSION_MISS';
      classification = 'OUT_OF_STRATEGY';
    } else if (isTarget) {
      missionResult = 'MISSION_HIT';
      classification = 'PURE_MATCH';
    }
  }

  const itemId = canonicalItemId({
    source: 'trainer',
    rangeId,
    hand,
    distribution
  });
  const id = attemptId || attemptIdFor({
    producer: producer || 'trainer',
    itemId,
    sequence,
    timestamp
  });

  return {
    ok: true,
    attempt: {
      itemId,
      timestamp,
      attemptId: id,
      classification,
      chosenAction: chosen.canonical || chosenAction,
      context: {
        ...context,
        source: 'trainer',
        rangeId,
        hand,
        strategyOk: classification !== 'OUT_OF_STRATEGY',
        missionResult,
        strategyVersion: handStrategyVersion(distribution),
        hasFrequencyTarget: false
      }
    }
  };
}

export function attemptFromBattleshipTap({
  model,
  mission,
  hand,
  timestamp,
  sequence,
  isTarget,
  inRange,
  missionType = null
}) {
  const rangeId = model.chartId;
  if (!rangeId) return { ok: false, attempt: null, error: 'no_chart_id' };
  if (!model.supported) return { ok: false, attempt: null, error: 'model_unsupported', skip: true };

  const open = inRange === true;
  const target = isTarget === true;

  let classification;
  let missionResult;
  let strategyOk;
  let chosenAction;

  if (target) {
    classification = 'PURE_MATCH';
    missionResult = 'MISSION_HIT';
    strategyOk = true;
    chosenAction = 'RAISE';
  } else if (missionType === 'MISSION_OFF_TARGET') {
    // Hand is valid in strategy but not this mission's target
    // MUST NOT create a strategy mistake
    classification = 'PURE_MATCH';
    missionResult = 'MISSION_OFF_TARGET';
    strategyOk = true;
    chosenAction = 'RAISE';
  } else if (open) {
    // Fallback for backwards compatibility
    classification = 'PURE_MATCH';
    missionResult = 'MISSION_OFF_TARGET';
    strategyOk = true;
    chosenAction = 'RAISE';
  } else {
    classification = 'OUT_OF_STRATEGY';
    missionResult = 'MISSION_MISS';
    strategyOk = false;
    chosenAction = 'RAISE';
  }

  const distribution = open || target ? { RAISE: 1 } : { FOLD: 1 };
  const itemId = canonicalItemId({
    source: 'trainer',
    rangeId,
    hand,
    distribution: open ? { RAISE: 1 } : { FOLD: 1 }
  });

  return {
    ok: true,
    attempt: {
      itemId,
      timestamp,
      attemptId: attemptIdFor({
        producer: 'battleship',
        itemId,
        sequence,
        timestamp
      }),
      classification,
      chosenAction,
      context: {
        source: 'trainer',
        producer: 'battleship',
        rangeId,
        hand,
        strategyOk,
        missionResult,
        missionId: mission?.id || null,
        strategyVersion: handStrategyVersion(open ? { RAISE: 1 } : { FOLD: 1 }),
        hasFrequencyTarget: false
      }
    }
  };
}

export function attemptsFromNarrowingGrade({
  rangeId,
  source = 'trainer',
  hand,
  inRangeTruth,
  playerSaidInRange,
  timestamp,
  producer = 'narrowing',
  sequence
}) {
  const distribution = inRangeTruth ? { RAISE: 1 } : { FOLD: 1 };
  const chosenAction = playerSaidInRange ? 'RAISE' : 'FOLD';
  const grade = classifyChosenAction(chosenAction, distribution);
  const itemId = canonicalItemId({ source, rangeId, hand, distribution });
  return {
    ok: true,
    attempt: {
      itemId,
      timestamp,
      attemptId: attemptIdFor({ producer, itemId, sequence, timestamp }),
      classification: grade.classification,
      chosenAction: grade.chosenCanonical,
      context: {
        source,
        producer,
        rangeId,
        hand,
        strategyOk: grade.strategyOk,
        strategyVersion: handStrategyVersion(distribution),
        hasFrequencyTarget: false
      }
    }
  };
}

/**
 * Decision-UI action labels → production mapping keys.
 * Russian PokerBrain labels and common English aliases only.
 * Does not collapse 3BET/4BET/AI into RAISE.
 */
export const DECISION_ACTION_ALIASES = {
  FOLD: 'FOLD',
  ФОЛД: 'FOLD',
  CALL: 'CALL',
  КОЛЛ: 'CALL',
  RAISE: 'RAISE',
  РЕЙЗ: 'RAISE',
  CHECK: 'CHECK',
  ЧЕК: 'CHECK',
  BET: 'BET',
  СТАВКА: 'BET',
  PUSH: 'PUSH',
  ПУШ: 'PUSH',
  AI: 'AI',
  ALLIN: 'ALLIN',
  'ALL-IN': 'ALLIN',
  'ALL_IN': 'ALLIN',
  '3BET': '3BET',
  '3-БЕТ': '3BET',
  '4BET': '4BET',
  '4-БЕТ': '4BET'
};

export function mapDecisionAction(raw) {
  if (raw == null || raw === '') return mapProductionAction(raw);
  const key = String(raw).trim();
  const aliased = DECISION_ACTION_ALIASES[key] || DECISION_ACTION_ALIASES[key.toUpperCase()] || key;
  return mapProductionAction(aliased);
}

/**
 * Canonical grading result → Mistake Memory classification.
 *
 * Explicit mapping — PokerBrain g/y/r is NOT equivalent to MM categories.
 *
 *   Frequency distribution present
 *     → classifyChosenAction (PURE_MATCH / IN_MIX / RARE_MIX / OUT_OF_STRATEGY)
 *   Solver / assessment with honest correctness
 *     → correct | EXCELLENT | GOOD | nearOptimal → PURE_MATCH
 *     → nearOptimal-only / mixed INACCURACY → IN_MIX
 *     → MISTAKE | BIG_MISTAKE | BIG MISTAKE | correct===false → OUT_OF_STRATEGY
 *   Brain g/y/r without a distribution
 *     → skip (null). Do not invent PURE_MATCH from green.
 *   INACCURACY without mix or correctness
 *     → skip
 */
export function mapCanonicalToMemory(canonical = {}) {
  if (!canonical || canonical.ok === false) {
    return { classification: null, strategyOk: null, reason: 'not_gradable', distribution: null };
  }

  const dist = canonical.metadata?.distribution || null;
  const chosenRaw = canonical.action;
  const chosen = chosenRaw != null && chosenRaw !== '' ? mapDecisionAction(chosenRaw) : { canonical: null };

  if (dist && typeof dist === 'object' && chosen.canonical) {
    const grade = classifyChosenAction(chosen.canonical, dist);
    if (!grade.classification) {
      return { classification: null, strategyOk: null, reason: grade.reason, distribution: dist };
    }
    return {
      classification: grade.classification,
      strategyOk: grade.strategyOk,
      reason: 'frequency',
      distribution: dist,
      chosenCanonical: grade.chosenCanonical
    };
  }

  if (canonical.correctness === true || canonical.verdict === 'EXCELLENT' || canonical.verdict === 'GOOD') {
    if (!chosen.canonical && canonical.correctness !== true) {
      return { classification: null, strategyOk: null, reason: 'no_mappable_action', distribution: null };
    }
    return {
      classification: 'PURE_MATCH',
      strategyOk: true,
      reason: 'solver_correct',
      distribution: null,
      chosenCanonical: chosen.canonical || null
    };
  }

  if (canonical.correctness === false && canonical.metadata?.nearOptimal === true) {
    return {
      classification: 'IN_MIX',
      strategyOk: true,
      reason: 'assessment_near_optimal',
      distribution: null,
      chosenCanonical: chosen.canonical || null
    };
  }

  if (canonical.verdict === 'INACCURACY' && canonical.metadata?.mixedStrategy === true) {
    return {
      classification: 'IN_MIX',
      strategyOk: true,
      reason: 'solver_mixed_inaccuracy',
      distribution: null,
      chosenCanonical: chosen.canonical || null
    };
  }

  if (
    canonical.correctness === false
    || canonical.verdict === 'MISTAKE'
    || canonical.verdict === 'BIG_MISTAKE'
    || canonical.verdict === 'BIG MISTAKE'
  ) {
    return {
      classification: 'OUT_OF_STRATEGY',
      strategyOk: false,
      reason: 'solver_incorrect',
      distribution: null,
      chosenCanonical: chosen.canonical || null
    };
  }

  return {
    classification: null,
    strategyOk: null,
    reason: 'ambiguous_brain_grade',
    distribution: dist
  };
}

export function attemptFromGradingResult({
  canonical,
  timestamp,
  producer,
  sequence,
  attemptId,
  context = {}
} = {}) {
  if (!canonical || canonical.ok === false) {
    return { ok: false, attempt: null, skip: true, error: 'not_gradable' };
  }

  const mapped = mapCanonicalToMemory(canonical);
  if (!mapped.classification) {
    return { ok: false, attempt: null, skip: true, error: mapped.reason };
  }

  const rangeId = canonical.metadata?.spotId || canonical.decisionId;
  const hand = canonical.metadata?.handClass;
  if (!rangeId || !hand) {
    return { ok: false, attempt: null, skip: true, error: 'missing_item_identity' };
  }

  const ts = timestamp;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) {
    return { ok: false, attempt: null, skip: true, error: 'missing_timestamp' };
  }

  const itemId = canonicalItemId({
    source: 'decision',
    rangeId: String(rangeId),
    hand: String(hand),
    distribution: mapped.distribution || undefined
  });
  const prod = producer || canonical.mode || 'decision';
  const id = attemptId || attemptIdFor({
    producer: prod,
    itemId,
    sequence: sequence != null ? sequence : canonical.decisionId,
    timestamp: ts
  });

  return {
    ok: true,
    attempt: {
      itemId,
      timestamp: ts,
      attemptId: id,
      classification: mapped.classification,
      chosenAction: mapped.chosenCanonical || undefined,
      targetDistribution: mapped.distribution && Object.keys(mapped.distribution).length >= 2
        ? mapped.distribution
        : undefined,
      context: {
        ...context,
        source: 'decision',
        producer: prod,
        mode: canonical.mode || null,
        spotId: String(rangeId),
        hand: String(hand),
        strategyOk: mapped.strategyOk,
        mappingReason: mapped.reason,
        decisionId: canonical.decisionId || null,
        strategyVersion: handStrategyVersion(mapped.distribution || { [mapped.chosenCanonical || 'CHECK']: 1 }),
        hasFrequencyTarget: !!(mapped.distribution && Object.keys(mapped.distribution).length >= 2)
      }
    }
  };
}
