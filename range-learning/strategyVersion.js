/**
 * Strategy version for learner memory.
 *
 * Policy:
 *   item identity includes a deterministic hash of the *hand's* target
 *   distribution (plus dataset identity). When production changes
 *   RAISE 70 / CALL 30 → RAISE 40 / CALL 60, the new target is a new item.
 *   Historical frequency mastery stays on the old itemId and is never
 *   replayed against the new target.
 *
 * Dataset-level version (rangeStrategyVersion) hashes the whole adapted
 * range so Strategy Map cache invalidation has a cheap fingerprint.
 *
 * We do not invent timestamps or remap old attempts onto new targets.
 */

import { hashTargetDistribution } from '../mistake-memory/math.js';

export const STRATEGY_VERSION_POLICY = {
  id: 'hand-target-hash-v1',
  description:
    'item strategyVersion = hash of canonical positive action distribution for that hand. Range strategyVersion = sorted hash of all hand hashes. Old items are left as legacy when the target changes.'
};

export function handStrategyVersion(distribution) {
  if (!distribution || typeof distribution !== 'object') return 'none';
  const hash = hashTargetDistribution(distribution);
  return hash || 'none';
}

export function rangeStrategyVersion(adaptedRange) {
  if (!adaptedRange?.hands) return 'empty';
  const parts = Object.keys(adaptedRange.hands)
    .sort()
    .map((hand) => {
      const dist = adaptedRange.hands[hand]?.actions || {};
      return `${hand}=${handStrategyVersion(dist)}`;
    });
  return simpleHash(parts.join(';'));
}

export function datasetStrategyVersion(adaptedRanges) {
  const parts = (adaptedRanges || [])
    .map((r) => `${r.id}:${r.strategyVersion || rangeStrategyVersion(r)}`)
    .sort();
  return simpleHash(parts.join('|'));
}

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
