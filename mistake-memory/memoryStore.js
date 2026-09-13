/**
 * In-memory store + batch processing.
 *
 * processAttempts:
 * - sorts timestamps within batch
 * - each updateMemoryState rebuilds from event log (delivery-order independent)
 * - scheduler uses resolveSchedulerNow so out-of-order event timestamps
 *   never become "now" when lastSeenAt is newer (P0-2)
 */

import {
  updateMemoryState,
  createInitialMemoryState,
  SCHEMA_VERSION,
  rebuildFromEventLog
} from './memoryState.js';
import { scheduleNextReview, resolveSchedulerNow } from './scheduler.js';
import { validateAttempt } from './validation.js';

export class MemoryStore {
  constructor() {
    this.states = new Map();
  }

  get(itemId) {
    return this.states.get(itemId) || null;
  }

  set(itemId, state) {
    this.states.set(itemId, state);
  }

  has(itemId) {
    return this.states.has(itemId);
  }

  allStates() {
    return Array.from(this.states.values());
  }

  size() {
    return this.states.size;
  }

  toJSON() {
    const obj = {
      schemaVersion: SCHEMA_VERSION,
      items: {}
    };
    for (const [id, state] of this.states) {
      obj.items[id] = state;
    }
    return obj;
  }

  fromJSON(data) {
    this.states.clear();
    if (!data || !data.items) return;
    for (const [id, state] of Object.entries(data.items)) {
      this.states.set(id, migrateMemoryState(state));
    }
  }
}

/**
 * Migrate old state shapes to current schema (v2).
 */
export function migrateMemoryState(oldState) {
  if (!oldState || typeof oldState !== 'object') {
    throw new Error('migrateMemoryState: invalid state');
  }
  let state = { ...oldState };
  const version = state.schemaVersion ?? 0;

  if (version < 1) {
    if (state.actionMastery == null) state.actionMastery = 0.5;
    if (state.combinedMastery == null) state.combinedMastery = 0.5;
    if (state.stability == null) state.stability = 10 * 60 * 1000;
    if (state.status == null) state.status = 'NEW';
    if (state.lapseCount == null) state.lapseCount = 0;
    if (state.recoveryProgress == null) state.recoveryProgress = 1;
    if (state._frequencyCounters == null) state._frequencyCounters = {};
    if (state._actionWeightedSuccesses == null) state._actionWeightedSuccesses = 0;
    if (state._actionTotalWeight == null) state._actionTotalWeight = 0;
  }

  if (version < 2) {
    if (!Array.isArray(state._eventLog)) state._eventLog = [];
    if (state._frequencyTargetHash === undefined) state._frequencyTargetHash = null;
    if (state.recentSevereInWindow == null) state.recentSevereInWindow = 0;
    if (state.hasFrequencyTarget == null) {
      const hasTarget =
        state._targetDistribution != null &&
        typeof state._targetDistribution === 'object' &&
        Object.keys(state._targetDistribution).length > 0;
      state.hasFrequencyTarget = hasTarget;
      if (!hasTarget) {
        if (state.frequencyMastery === 0.5 || state.frequencyMastery == null) {
          state.frequencyMastery = null;
        }
        state.frequencyConfidence = 1;
      }
    }
    if (state._targetDistribution === undefined) state._targetDistribution = null;
    if (state._seenAttemptIds == null) state._seenAttemptIds = [];
  }

  if (version < 3) {
    // Promote aggregate without log to checkpoint so next event does not wipe history
    if (!state._checkpoint && (state.attempts ?? 0) > 0 && (!state._eventLog || state._eventLog.length === 0)) {
      const fields = [
        'attempts','successes','severeErrors','actionMastery','frequencyMastery','combinedMastery',
        'actionConfidence','frequencyConfidence','hasFrequencyTarget','confidence','stability',
        'forgettingRisk','lastSeenAt','lastErrorAt','lastSuccessAt','status','lapseCount',
        'lastLapseAt','recoveryProgress','_actionWeightedSuccesses','_actionTotalWeight',
        '_frequencyCounters','_targetDistribution','_frequencyTargetHash'
      ];
      const cp = {};
      for (const f of fields) {
        const v = state[f];
        if (v != null && typeof v === 'object' && !Array.isArray(v)) cp[f] = { ...v };
        else if (Array.isArray(v)) cp[f] = [...v];
        else cp[f] = v;
      }
      state._checkpoint = cp;
      state._checkpointBoundaryTs = state.lastSeenAt ?? null;
      // Seed running totals so incremental mastery continues from aggregate
      if (state._actionTotalWeight == null || state._actionTotalWeight === 0) {
        const att = state.attempts || 0;
        const am = state.actionMastery ?? 0.5;
        state._actionTotalWeight = att;
        state._actionWeightedSuccesses = am * att;
        if (state._checkpoint) {
          state._checkpoint._actionTotalWeight = att;
          state._checkpoint._actionWeightedSuccesses = am * att;
        }
      }
      // P1-2: preserve recent severe operational evidence when exact timestamps unknown
      // Policy: if recentSevereInWindow=N and lastErrorAt present, synthesize N event
      // markers at lastErrorAt with distinct synthetic ids. This is conservative:
      // keeps scheduler/lapse operational signal; not exact historical timestamps.
      const rsw = state.recentSevereInWindow ?? 0;
      if (rsw > 0) {
        const baseT = state.lastErrorAt ?? state.lastSeenAt ?? 0;
        const synth = [];
        for (let i = 0; i < rsw; i++) {
          synth.push({ t: baseT, id: `migrated_severe_${i}` });
        }
        state._recentSevereTimestamps = synth;
        if (state._checkpoint) state._checkpoint._recentSevereTimestamps = [...synth];
      }

      if (!Array.isArray(state._eventLog)) state._eventLog = [];
    }
    if (state._checkpoint === undefined) state._checkpoint = null;
    if (state._checkpointBoundaryTs === undefined) state._checkpointBoundaryTs = null;
  }

  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

/**
 * Process a batch of attempts.
 * @param {MemoryStore} store
 * @param {Object[]} attempts
 * @param {Object} [options] - options.now = processing clock for scheduler
 */
export function processAttempts(store, attempts, options = {}) {
  if (!Array.isArray(attempts)) {
    throw new Error('attempts must be an array');
  }

  const errors = [];
  const updated = new Set();

  const valid = [];
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const v = validateAttempt(a);
    if (!v.ok) {
      errors.push(`attempt[${i}]: ${v.errors.join('; ')}`);
      continue;
    }
    valid.push(a);
  }

  valid.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return (a.attemptId || '').localeCompare(b.attemptId || '');
  });

  let applied = 0;
  let duplicates = 0;
  let rejected = 0;

  for (const attempt of valid) {
    try {
      const prev = store.get(attempt.itemId);
      const prevAttempts = prev ? prev.attempts : 0;
      const next = updateMemoryState(prev, attempt, options);

      if (next._lastRejectReason) {
        rejected++;
        // store rejected state markers if any
        store.set(attempt.itemId, next);
        continue;
      }

      if (prev && next.attempts === prevAttempts && attempt.attemptId) {
        duplicates++;
        continue;
      }

      const processingNow =
        typeof options.now === 'number' && Number.isFinite(options.now)
          ? options.now
          : attempt.timestamp;
      const schedNow = resolveSchedulerNow(next, processingNow);
      const sched = scheduleNextReview(next, schedNow, options);
      next.dueAt = sched.dueAt;
      next.intervalMs = sched.intervalMs;

      store.set(attempt.itemId, next);
      updated.add(attempt.itemId);
      applied++;
    } catch (e) {
      errors.push(`item ${attempt.itemId}: ${e.message}`);
    }
  }

  return {
    // processed === applied (state-mutating) for backward compatibility
    processed: applied,
    received: attempts.length,
    validated: valid.length,
    applied,
    duplicates,
    rejected,
    errors,
    updatedItemIds: Array.from(updated)
  };
}

export { rebuildFromEventLog };
