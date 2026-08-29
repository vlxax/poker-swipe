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
  inRange
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
  } else if (open) {
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
