/**
 * Core memory state — checkpoint + bounded event-log tail.
 *
 * SCHEMA_VERSION = 3
 *
 * Model:
 *   currentState = apply(checkpoint, eventLogSorted)
 *
 * Checkpoint holds folded aggregate history.
 * Event log holds only events AFTER checkpointBoundaryTs (bounded tail).
 *
 * Migration (P0-1):
 *   Legacy aggregate without log becomes the checkpoint.
 *   First new event applies ON TOP of that checkpoint — never resets to initial.
 *
 * Compaction (P0-2):
 *   When log exceeds EVENT_LOG_LIMIT, oldest events are folded into checkpoint.
 *   Lifetime attempts/mastery/stability are preserved.
 *
 * Out-of-order older than checkpoint boundary (documented policy):
 *   REJECT — return previous state unchanged.
 *   Exact chronological insertion into compacted history is impossible;
 *   silent incorrect recount is not allowed.
 *
 * RARE_MIX: partial success (weight 0.5), does not decrease recovery.
 * Severe: lifetime analytics + recentSevereInWindow for scheduler/lapse.
 */

import { updateStability } from './stability.js';
import { updateActionMastery, computeCombinedMastery } from './mastery.js';
import { updateFrequencyMastery } from './frequencyMastery.js';
import { detectLapse, applyLapse, updateRecovery } from './lapses.js';
import { estimateForgettingRisk } from './forgetting.js';
import { validateAttempt } from './validation.js';
import { gradeAttempt } from './grading.js';
import { validateTargetDistribution, validateTargetProbability, assertFrequencyTargetContract } from './frequencyValidation.js';

export const SCHEMA_VERSION = 3;

export const MASTERED_THRESHOLD = 0.88;
export const STABLE_THRESHOLD = 0.75;
export const WEAK_THRESHOLD = 0.45;
export const MIN_CONFIDENCE = 0.55;
export const MIN_ATTEMPTS_FOR_MASTERY = 12;
export const FREQ_MASTERY_THRESHOLD = 0.70;

export const EVENT_LOG_LIMIT = 500;
export const SEEN_ATTEMPT_ID_LIMIT = 200;
export const RECENT_SEVERE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function toEventRecord(attempt) {
  const rec = {
    t: attempt.timestamp,
    c: attempt.classification ?? null,
    a: attempt.chosenAction ?? null
  };
  if (attempt.attemptId) rec.id = attempt.attemptId;
  if (typeof attempt.weaknessScore === 'number') rec.w = attempt.weaknessScore;
  if (typeof attempt.targetProbability === 'number') rec.tp = attempt.targetProbability;
  const td =
    attempt.targetDistribution ||
    (attempt.context && attempt.context.targetDistribution) ||
    null;
  if (td && typeof td === 'object') rec.td = { ...td };
  return rec;
}

function fromEventRecord(itemId, rec) {
  const attempt = {
    itemId,
    timestamp: rec.t,
    classification: rec.c ?? undefined,
    chosenAction: rec.a ?? undefined
  };
  if (rec.id) attempt.attemptId = rec.id;
  if (rec.w != null) attempt.weaknessScore = rec.w;
  if (rec.tp != null) attempt.targetProbability = rec.tp;
  if (rec.td) {
    attempt.context = { targetDistribution: rec.td };
    attempt.targetDistribution = rec.td;
  }
  return attempt;
}

export function successWeight(classification) {
  if (classification === 'PURE_MATCH' || classification === 'IN_MIX') return 1;
  if (classification === 'RARE_MIX') return 0.5;
  if (classification === 'OUT_OF_STRATEGY') return 0;
  if (classification == null) return 1;
  return 0;
}

export function isActionError(classification) {
  return classification === 'OUT_OF_STRATEGY';
}

/** Fields that form the learning aggregate (checkpointable). */
const CHECKPOINT_FIELDS = [
  'attempts', 'successes', 'severeErrors',
  'actionMastery', 'frequencyMastery', 'combinedMastery',
  'actionConfidence', 'frequencyConfidence', 'hasFrequencyTarget', 'confidence',
  'stability', 'forgettingRisk',
  'lastSeenAt', 'lastErrorAt', 'lastSuccessAt',
  'status', 'lapseCount', 'lastLapseAt', 'recoveryProgress',
  '_actionWeightedSuccesses', '_actionTotalWeight',
  '_frequencyCounters', '_targetDistribution', '_frequencyTargetHash',
  '_recentSevereTimestamps'
];

export function createInitialMemoryState(itemId) {
  return {
    schemaVersion: SCHEMA_VERSION,
    itemId,
    attempts: 0,
    successes: 0,
    severeErrors: 0,
    recentSevereInWindow: 0,
    actionMastery: 0.5,
    frequencyMastery: null,
    combinedMastery: 0.5,
    actionConfidence: 0,
    frequencyConfidence: 1,
    hasFrequencyTarget: false,
    confidence: 0,
    stability: 10 * 60 * 1000,
    forgettingRisk: 0,
    lastSeenAt: null,
    lastErrorAt: null,
    lastSuccessAt: null,
    dueAt: null,
    intervalMs: null,
    status: 'NEW',
    lapseCount: 0,
    lastLapseAt: null,
    recoveryProgress: 1,
    _actionWeightedSuccesses: 0,
    _actionTotalWeight: 0,
    _frequencyCounters: {},
    _targetDistribution: null,
    _frequencyTargetHash: null,
    _seenAttemptIds: [],
    _eventLog: [],
    _checkpoint: null,
    _checkpointBoundaryTs: null,
    _checkpointCursor: null,
    _recentSevereTimestamps: []
  };
}

/**
 * Snapshot current aggregate into a checkpoint object.
 */
export function snapshotCheckpoint(state) {
  const cp = {};
  for (const f of CHECKPOINT_FIELDS) {
    const v = state[f];
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      cp[f] = { ...v };
    } else if (Array.isArray(v)) {
      cp[f] = [...v];
    } else {
      cp[f] = v;
    }
  }
  return cp;
}

/**
 * Restore a state base from checkpoint (or initial).
 */
function stateFromCheckpoint(itemId, checkpoint) {
  const base = createInitialMemoryState(itemId);
  if (!checkpoint) return base;
  for (const f of CHECKPOINT_FIELDS) {
    if (checkpoint[f] !== undefined) {
      const v = checkpoint[f];
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        base[f] = { ...v };
      } else if (Array.isArray(v)) {
        base[f] = [...v];
      } else {
        base[f] = v;
      }
    }
  }
  return base;
}

export function hasFrequencyTarget(state) {
  if (state.hasFrequencyTarget === true) return true;
  if (state._targetDistribution && Object.keys(state._targetDistribution).length > 0) return true;
  return false;
}

export function deriveStatus(state) {
  if ((state.lapseCount ?? 0) > 0 && (state.recoveryProgress ?? 1) < 0.9) {
    return 'LAPSED';
  }
  if (state.attempts === 0) return 'NEW';

  const m = state.combinedMastery ?? 0;
  const conf = state.confidence ?? 0;
  const att = state.attempts ?? 0;
  const freqOk =
    !hasFrequencyTarget(state) ||
    ((state.frequencyMastery ?? 0) >= FREQ_MASTERY_THRESHOLD);

  if (
    m >= MASTERED_THRESHOLD &&
    conf >= MIN_CONFIDENCE &&
    att >= MIN_ATTEMPTS_FOR_MASTERY &&
    freqOk
  ) {
    return 'MASTERED';
  }
  if (m >= STABLE_THRESHOLD && conf >= 0.4 && att >= 6 && freqOk) {
    return 'STABLE';
  }
  if (m < WEAK_THRESHOLD || (state.recentSevereInWindow ?? 0) >= 2) {
    return 'WEAK';
  }
  if (att < 5) return 'LEARNING';
  return 'REVIEW';
}

export function isMastered(memoryState) {
  if (!memoryState || memoryState.attempts < MIN_ATTEMPTS_FOR_MASTERY) return false;
  if ((memoryState.combinedMastery ?? 0) < MASTERED_THRESHOLD) return false;
  if ((memoryState.confidence ?? 0) < MIN_CONFIDENCE) return false;
  if (hasFrequencyTarget(memoryState)) {
    if ((memoryState.frequencyMastery ?? 0) < FREQ_MASTERY_THRESHOLD) return false;
  }
  return true;
}

/**
 * Merge checkpoint severe timestamps + log severe events, prune outside window.
 * Avoids double-counting by using a Set of timestamps.
 */
function countRecentSevere(eventLog, checkpoint, referenceTime, windowMs, stateTimestamps) {
  const cutoff = referenceTime - windowMs;
  const map = new Map();
  function add(t, id) {
    if (typeof t === 'number' && t >= cutoff && t <= referenceTime) map.set(id, t);
  }
  for (const e of (checkpoint && checkpoint._recentSevereTimestamps) || []) {
    if (typeof e === 'number') add(e, `t:${e}`);
    else add(e.t, e.id || `t:${e.t}`);
  }
  for (const e of stateTimestamps || []) {
    if (typeof e === 'number') add(e, `t:${e}`);
    else add(e.t, e.id || `t:${e.t}`);
  }
  if (eventLog) {
    eventLog.forEach((rec, idx) => {
      if (rec.c === 'OUT_OF_STRATEGY') add(rec.t, severeEventKey(rec, idx));
    });
  }
  return map.size;
}

/**
 * Severe event identity: prefer attemptId, else synthetic key from timestamp+index.
 * Stored as { t, id } so same-timestamp distinct events do not collapse (P1-3).
 */
function severeEventKey(rec, fallbackIdx) {
  if (rec && rec.id) return String(rec.id);
  const ts = rec && (rec.t ?? rec.timestamp);
  if (typeof ts === 'number') return `t:${ts}#0`;
  return `anon:${fallbackIdx}`;
}

/**
 * Prune and return updated severe event list {t,id}[].
 * Events with attemptId: unique by id.
 * Events without attemptId: unique by log occurrence at timestamp
 *   (t:<ts>#0, t:<ts>#1, ...) so two real attempts at same ts count as 2,
 *   while a single attempt is never double-registered under two keys.
 */
function updateSevereTimestamps(prevList, eventLog, referenceTime, windowMs) {
  const cutoff = referenceTime - windowMs;
  const map = new Map();
  for (const e of prevList || []) {
    const t = typeof e === 'number' ? e : e.t;
    const id = typeof e === 'number' ? `t:${e}#0` : (e.id || `t:${e.t}#0`);
    if (typeof t === 'number' && t >= cutoff) map.set(String(id), { t, id: String(id) });
  }
  if (eventLog) {
    const perTs = new Map(); // ts -> occurrence count for id-less severes
    eventLog.forEach((rec, idx) => {
      if (rec.c !== 'OUT_OF_STRATEGY' || rec.t < cutoff) return;
      let id;
      if (rec.id) {
        id = String(rec.id);
      } else {
        const n = perTs.get(rec.t) || 0;
        perTs.set(rec.t, n + 1);
        id = `t:${rec.t}#${n}`;
      }
      map.set(id, { t: rec.t, id });
    });
  }
  return Array.from(map.values()).sort((a, b) => a.t - b.t || String(a.id).localeCompare(String(b.id)));
}

/**
 * Apply one attempt chronologically onto state (no log management).
 */
function applyAttemptChronological(state, attempt, options = {}) {
  const ts = attempt.timestamp;
  // Validate frequency targets fail-fast (P1-6)
  if (attempt.targetDistribution) {
    const v = validateTargetDistribution(attempt.targetDistribution);
    if (!v.ok) throw new Error('Invalid targetDistribution: ' + v.errors.join('; '));
  }
  if (attempt.context && attempt.context.targetDistribution) {
    const v = validateTargetDistribution(attempt.context.targetDistribution);
    if (!v.ok) throw new Error('Invalid targetDistribution: ' + v.errors.join('; '));
  }
  if (typeof attempt.targetProbability === 'number') {
    const v = validateTargetProbability(attempt.targetProbability);
    if (!v.ok) throw new Error('Invalid targetProbability: ' + v.errors.join('; '));
  }
  assertFrequencyTargetContract(attempt, options);

  const actionUpdate = updateActionMastery(state, attempt, options);
  const freqUpdate = updateFrequencyMastery(state, attempt, options);
  const stabUpdate = updateStability(state, attempt, options);

  const grade = gradeAttempt(attempt);
  const severe = grade.isError;
  const sw = grade.successWeight;
  const isSuccessFull = grade.isSuccessFull;
  const isSuccessPartial = grade.isSuccessPartial;
  const classification = grade.classification;

  const newAttempts = (state.attempts ?? 0) + 1;
  const newSuccesses = (state.successes ?? 0) + (isSuccessFull ? 1 : 0);
  const newSevereLifetime = (state.severeErrors ?? 0) + (severe ? 1 : 0);

  const hasFreqTarget = freqUpdate.hasFrequencyTarget === true;
  const combined = computeCombinedMastery(
    actionUpdate.actionMastery,
    hasFreqTarget ? freqUpdate.frequencyMastery : null
  );

  const confidence = hasFreqTarget
    ? Math.min(actionUpdate.actionConfidence, freqUpdate.frequencyConfidence)
    : actionUpdate.actionConfidence;

  const lapseInfo = detectLapse(state, attempt, {
    ...actionUpdate,
    isActionError: severe,
    eventLog: state._eventLog,
    recentSevereInWindow: state.recentSevereInWindow
  });
  let lapseFields = {};
  if (lapseInfo.isLapse) {
    lapseFields = applyLapse(state, ts);
  } else {
    if (sw > 0) {
      lapseFields = updateRecovery(state, true);
    } else if (severe) {
      lapseFields = updateRecovery(state, false);
    } else {
      lapseFields = { recoveryProgress: state.recoveryProgress ?? 1 };
    }
  }

  let next = {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    itemId: state.itemId,
    attempts: newAttempts,
    successes: newSuccesses,
    severeErrors: newSevereLifetime,
    actionMastery: actionUpdate.actionMastery,
    frequencyMastery: hasFreqTarget ? freqUpdate.frequencyMastery : null,
    combinedMastery: combined,
    actionConfidence: actionUpdate.actionConfidence,
    frequencyConfidence: hasFreqTarget ? freqUpdate.frequencyConfidence : 1,
    hasFrequencyTarget: hasFreqTarget,
    confidence,
    stability: stabUpdate.stabilityAfter,
    lastSeenAt: ts,
    lastErrorAt: severe ? ts : state.lastErrorAt,
    lastSuccessAt: isSuccessPartial ? ts : state.lastSuccessAt,
    _actionWeightedSuccesses: actionUpdate.weightedSuccesses,
    _actionTotalWeight: actionUpdate.totalWeight,
    _frequencyCounters: freqUpdate._frequencyCounters,
    _targetDistribution: freqUpdate._targetDistribution,
    _frequencyTargetHash: freqUpdate._frequencyTargetHash,
    ...lapseFields
  };

  // Maintain bounded severe timestamp deque for compaction-safe window
  let sevTs = updateSevereTimestamps(
    state._recentSevereTimestamps || (state._checkpoint && state._checkpoint._recentSevereTimestamps) || [],
    next._eventLog || [],
    ts,
    RECENT_SEVERE_WINDOW_MS
  );
  // Do NOT re-add: updateSevereTimestamps already incorporated eventLog.
  // Only seed from attempt when log does not yet contain this event (should not happen
  // in normal apply path where log is pushed first). Same key function avoids doubles.
  if (severe) {
    const sid = attempt.attemptId ? String(attempt.attemptId) : `t:${ts}#0`;
    if (!sevTs.some(e => String(e.id || e) === sid)) {
      sevTs = [...sevTs, { t: ts, id: sid }].filter(e => (e.t ?? e) >= ts - RECENT_SEVERE_WINDOW_MS);
    }
  }
  next._recentSevereTimestamps = sevTs;
  next.recentSevereInWindow = countRecentSevere(
    next._eventLog || [],
    next._checkpoint,
    ts,
    RECENT_SEVERE_WINDOW_MS,
    sevTs
  );

  next.forgettingRisk = estimateForgettingRisk(next, ts);
  next.status = deriveStatus(next);
  return next;
}

/**
 * Rebuild state = checkpoint + chronological event log.
 * Compacts if log exceeds limit.
 */
export function rebuildFromEventLog(itemId, eventLog, checkpoint, options = {}) {
  let state = stateFromCheckpoint(itemId, checkpoint);
  state._checkpoint = checkpoint ? snapshotCheckpoint({ ...state, ...checkpoint }) : null;
  state._checkpointBoundaryTs = checkpoint
    ? (checkpoint.lastSeenAt ?? checkpoint._checkpointBoundaryTs ?? null)
    : null;

  const sorted = [...(eventLog || [])].sort((a, b) => {
    if (a.t !== b.t) return a.t - b.t;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  state._eventLog = [];

  for (const rec of sorted) {
    state._eventLog.push(rec);
    const attempt = fromEventRecord(itemId, rec);
    state = applyAttemptChronological(state, attempt, options);
    state._eventLog = [...state._eventLog];
  }

  // Compaction: fold excess into checkpoint
  if (state._eventLog.length > EVENT_LOG_LIMIT) {
    const overflow = state._eventLog.length - EVENT_LOG_LIMIT;
    const toFold = state._eventLog.slice(0, overflow);
    const tail = state._eventLog.slice(overflow);

    // Build intermediate state from current checkpoint + folded events
    let mid = stateFromCheckpoint(itemId, checkpoint);
    mid._eventLog = [];
    for (const rec of toFold) {
      mid._eventLog.push(rec);
      mid = applyAttemptChronological(mid, fromEventRecord(itemId, rec), options);
      mid._eventLog = [...mid._eventLog];
    }
    const newCheckpoint = snapshotCheckpoint(mid);
    newCheckpoint.lastSeenAt = mid.lastSeenAt;
    // Cursor: last folded event (timestamp, attemptId)
    const lastFolded = toFold[toFold.length - 1];
    const boundary = lastFolded ? lastFolded.t : mid.lastSeenAt;
    const cursor = lastFolded
      ? { timestamp: lastFolded.t, attemptId: lastFolded.id || '' }
      : { timestamp: mid.lastSeenAt, attemptId: '' };
    newCheckpoint._checkpointCursor = cursor;
    // Preserve severe event identities into checkpoint
    newCheckpoint._recentSevereTimestamps = mid._recentSevereTimestamps || [];

    // Rebuild from new checkpoint + tail
    state = stateFromCheckpoint(itemId, newCheckpoint);
    state._checkpoint = newCheckpoint;
    state._checkpointBoundaryTs = boundary;
    state._checkpointCursor = cursor;
    state._eventLog = [];
    for (const rec of tail) {
      state._eventLog.push(rec);
      state = applyAttemptChronological(state, fromEventRecord(itemId, rec), options);
      state._eventLog = [...state._eventLog];
    }
  }

  // Preserve checkpoint refs
  if (!state._checkpoint && checkpoint) {
    state._checkpoint = checkpoint;
    state._checkpointBoundaryTs = checkpoint.lastSeenAt ?? null;
  }

  // Seen ids from log + keep
  const ids = [];
  for (const rec of state._eventLog) {
    if (rec.id) ids.push(rec.id);
  }
  state._seenAttemptIds = ids.slice(-SEEN_ATTEMPT_ID_LIMIT);

  // Final recent severe recount
  if (state.lastSeenAt != null) {
    state._recentSevereTimestamps = updateSevereTimestamps(
      state._recentSevereTimestamps || [],
      state._eventLog,
      state.lastSeenAt,
      RECENT_SEVERE_WINDOW_MS
    );
    state.recentSevereInWindow = countRecentSevere(
      state._eventLog,
      state._checkpoint,
      state.lastSeenAt,
      RECENT_SEVERE_WINDOW_MS,
      state._recentSevereTimestamps
    );
  }

  return state;
}

/**
 * Main public update.
 */
export function updateMemoryState(previousState, attempt, options = {}) {
  const validation = validateAttempt(attempt);
  if (!validation.ok) {
    throw new Error('Invalid attempt: ' + validation.errors.join('; '));
  }

  // Validate frequency targets early (P1-6)
  if (attempt.targetDistribution) {
    const v = validateTargetDistribution(attempt.targetDistribution);
    if (!v.ok) throw new Error('Invalid targetDistribution: ' + v.errors.join('; '));
  }
  if (attempt.context && attempt.context.targetDistribution) {
    const v = validateTargetDistribution(attempt.context.targetDistribution);
    if (!v.ok) throw new Error('Invalid targetDistribution: ' + v.errors.join('; '));
  }
  if (typeof attempt.targetProbability === 'number') {
    const v = validateTargetProbability(attempt.targetProbability);
    if (!v.ok) throw new Error('Invalid targetProbability: ' + v.errors.join('; '));
  }
  assertFrequencyTargetContract(attempt, options);

  const itemId = attempt.itemId;
  const prev = previousState
    ? { ...previousState }
    : createInitialMemoryState(itemId);

  if (prev.itemId !== itemId) {
    throw new Error(`itemId mismatch: state=${prev.itemId} attempt=${itemId}`);
  }

  // Ensure checkpoint for legacy migrated states (P0-1)
  let checkpoint = prev._checkpoint || null;
  let eventLog = prev._eventLog ? [...prev._eventLog] : [];
  let boundary = prev._checkpointBoundaryTs ?? null;

  if (!checkpoint && (prev.attempts ?? 0) > 0 && eventLog.length === 0) {
    // Migrated aggregate: promote entire state to checkpoint
    if (!prev._actionTotalWeight) {
      const att = prev.attempts || 0;
      const am = prev.actionMastery ?? 0.5;
      prev._actionTotalWeight = att;
      prev._actionWeightedSuccesses = am * att;
    }
    // Preserve recent severe evidence (P1-2)
    const rsw = prev.recentSevereInWindow ?? 0;
    if (rsw > 0 && (!prev._recentSevereTimestamps || prev._recentSevereTimestamps.length === 0)) {
      const baseT = prev.lastErrorAt ?? prev.lastSeenAt ?? 0;
      prev._recentSevereTimestamps = [];
      for (let i = 0; i < rsw; i++) {
        prev._recentSevereTimestamps.push({ t: baseT, id: `migrated_severe_${i}` });
      }
    }
    checkpoint = snapshotCheckpoint(prev);
    boundary = prev.lastSeenAt ?? null;
  }

  // Idempotency
  if (attempt.attemptId) {
    if (eventLog.some(r => r.id === attempt.attemptId)) {
      return previousState || prev;
    }
    if (prev._seenAttemptIds && prev._seenAttemptIds.includes(attempt.attemptId)) {
      return previousState || prev;
    }
  }

  // Policy: event at or before checkpoint cursor → REJECT (P1-4)
  // Cursor is { timestamp, attemptId }. Event is rejected if
  // (t < cursor.t) OR (t === cursor.t && attemptId <= cursor.attemptId).
  const cursor = prev._checkpointCursor || (
    boundary != null ? { timestamp: boundary, attemptId: '' } : null
  );
  if (cursor != null) {
    const aid = attempt.attemptId || '';
    const before =
      attempt.timestamp < cursor.timestamp ||
      (attempt.timestamp === cursor.timestamp && aid <= (cursor.attemptId || ''));
    if (before) {
      const rejected = { ...(previousState || prev) };
      rejected._lastRejectReason = 'event_older_than_checkpoint_boundary';
      rejected._lastRejectedAttemptId = attempt.attemptId || null;
      return rejected;
    }
  }

  eventLog.push(toEventRecord(attempt));

  let next = rebuildFromEventLog(itemId, eventLog, checkpoint, options);

  if (options.includeDiagnostics) {
    next._lastUpdateDiagnostics = {
      eventLogSize: next._eventLog.length,
      hasCheckpoint: !!next._checkpoint,
      rebuilt: true
    };
  }

  return next;
}

export function semanticSnapshot(state) {
  return {
    itemId: state.itemId,
    attempts: state.attempts,
    successes: state.successes,
    severeErrors: state.severeErrors,
    recentSevereInWindow: state.recentSevereInWindow ?? 0,
    actionMastery: round4(state.actionMastery),
    frequencyMastery: state.frequencyMastery == null ? null : round4(state.frequencyMastery),
    combinedMastery: round4(state.combinedMastery),
    confidence: round4(state.confidence),
    stability: Math.round(state.stability),
    status: state.status,
    lapseCount: state.lapseCount ?? 0,
    recoveryProgress: round4(state.recoveryProgress ?? 1),
    lastSeenAt: state.lastSeenAt,
    lastErrorAt: state.lastErrorAt,
    lastSuccessAt: state.lastSuccessAt,
    hasFrequencyTarget: !!state.hasFrequencyTarget
  };
}

function round4(n) {
  if (n == null || !Number.isFinite(n)) return n;
  return Math.round(n * 10000) / 10000;
}
