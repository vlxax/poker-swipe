/**
 * Canonical learner item identity.
 *
 * Components (minimum to avoid collisions):
 *   source        — reference | trainer | atlas
 *   rangeId       — production range / chart id (btn-rfi, UO_18-25_BTN, …)
 *   hand          — starting-hand class (A5s)
 *   strategyVersion — hash of this hand's target distribution
 *
 * Spot/context is already encoded in rangeId for production data:
 *   btn-rfi vs bb-vs-open-btn vs UO_20bb BTN are distinct ids.
 *
 * Do not omit stack when the production id includes it (trainer charts).
 * Do not collide BTN open A5s 20bb with BTN open A5s 40bb.
 */

import { handStrategyVersion } from './strategyVersion.js';

const SEP = '|';

export function canonicalItemId({
  source,
  rangeId,
  hand,
  strategyVersion = null,
  distribution = null
} = {}) {
  const src = String(source || 'unknown');
  const rid = String(rangeId || '');
  const h = String(hand || '').trim();
  if (!rid) throw new Error('canonicalItemId: rangeId is required');
  if (!h) throw new Error('canonicalItemId: hand is required');
  const ver = strategyVersion || handStrategyVersion(distribution);
  return ['spot-hand', src, rid, h, ver].join(SEP);
}

export function parseCanonicalItemId(itemId) {
  if (typeof itemId !== 'string') return null;
  const parts = itemId.split(SEP);
  if (parts[0] !== 'spot-hand' || parts.length < 5) return null;
  return {
    type: 'SPOT_HAND',
    source: parts[1],
    rangeId: parts[2],
    hand: parts[3],
    strategyVersion: parts.slice(4).join(SEP)
  };
}

export function attemptIdFor({ producer, itemId, sequence, timestamp }) {
  const seq = sequence != null ? String(sequence) : String(timestamp);
  return [producer, itemId, seq].join(SEP);
}
