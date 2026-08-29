/**
 * Personal session builder.
 *
 * buildReviewSession({ dueItems, newItems, learnerState, targetLength, rng })
 *
 * Mixes:
 * - overdue memory reviews
 * - recent mistakes
 * - frequency reviews
 * - new material
 *
 * Soft interleaving using metadata (spotId, hand, family, concept, transition)
 * when available. Penalize very recent repetition.
 *
 * Returns data only, no UI.
 */

import { clamp } from './math.js';

/**
 * Soft interleaving key from item metadata.
 * @param {Object} item - { itemId, metadata?, spotId?, hand?, type? }
 * @returns {string}
 */
function interleaveKey(item) {
  const md = item.metadata || {};
  const parts = [
    md.spotId || item.spotId || '',
    md.hand || item.hand || '',
    md.family || '',
    md.concept || '',
    md.transition || '',
    item.type || ''
  ].filter(Boolean);
  return parts.join('|') || item.itemId;
}

/**
 * Build a mixed review session.
 *
 * @param {Object} params
 * @param {Object[]} params.dueItems - memory states or enriched items already scored
 * @param {Object[]} [params.newItems]
 * @param {Object} [params.learnerState]
 * @param {number} [params.targetLength=12]
 * @param {function} [params.rng] - () => [0,1)
 * @returns {{
 *   items: Object[],
 *   composition: Object,
 *   reasonBreakdown: Object[]
 * }}
 */
export function buildReviewSession({
  dueItems = [],
  newItems = [],
  learnerState = {},
  targetLength = 12,
  rng
}) {
  if (typeof rng !== 'function') {
    throw new Error('buildReviewSession: rng must be an injected function () => [0,1)');
  }
  const length = Math.max(1, Math.min(50, targetLength));

  // Separate categories
  const overdue = [];
  const weak = [];
  const frequencyFocus = [];
  const normal = [];

  for (const it of dueItems) {
    const status = it.status || (it.state && it.state.status);
    const hasFreq = it.hasFrequencyTarget === true || (it.state && it.state.hasFrequencyTarget === true);
    const freqM = hasFreq
      ? (it.frequencyMastery ?? (it.state && it.state.frequencyMastery) ?? null)
      : null;
    const combined = it.combinedMastery ?? (it.state && it.state.combinedMastery) ?? 0.5;

    if (status === 'LAPSED' || status === 'WEAK') {
      weak.push(it);
    } else if (hasFreq && freqM != null && freqM < 0.55) {
      frequencyFocus.push(it);
    } else if (status === 'REVIEW' || status === 'LEARNING') {
      overdue.push(it);
    } else {
      normal.push(it);
    }
  }

  // Target composition ratios (soft)
  const targetWeak = Math.ceil(length * 0.30);
  const targetFreq = Math.ceil(length * 0.20);
  const targetNew = Math.min(newItems.length, Math.ceil(length * 0.25));
  const targetOverdue = length - targetWeak - targetFreq - targetNew;

  const selected = [];
  const reasons = [];
  const usedKeys = new Set();
  const usedIds = new Set();

  function tryAdd(list, reason, maxAdd) {
    let added = 0;
    // Shuffle lightly with rng for variety
    // Fisher-Yates with injected rng (P2)
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    for (const it of shuffled) {
      if (selected.length >= length) break;
      if (added >= maxAdd) break;
      const id = it.itemId || (it.state && it.state.itemId);
      if (!id || usedIds.has(id)) continue;

      const key = interleaveKey(it);
      // Soft penalty: if same interleave key already used, skip with high probability
      if (usedKeys.has(key) && rng() < 0.7) continue;

      selected.push(it);
      usedIds.add(id);
      usedKeys.add(key);
      reasons.push({ itemId: id, reason });
      added++;
    }
  }

  tryAdd(weak, 'weak_or_lapsed', targetWeak);
  tryAdd(frequencyFocus, 'low_frequency_mastery', targetFreq);
  tryAdd(overdue, 'overdue_or_learning', Math.max(0, targetOverdue));
  tryAdd(normal, 'stable_review', length);
  tryAdd(newItems, 'new_material', targetNew);

  // Fill remaining with whatever is left
  const remaining = [...dueItems, ...newItems].filter(
    it => !usedIds.has(it.itemId || (it.state && it.state.itemId))
  );
  tryAdd(remaining, 'fill', length);

  const composition = {
    total: selected.length,
    weak: reasons.filter(r => r.reason === 'weak_or_lapsed').length,
    frequency: reasons.filter(r => r.reason === 'low_frequency_mastery').length,
    overdue: reasons.filter(r => r.reason === 'overdue_or_learning').length,
    new: reasons.filter(r => r.reason === 'new_material').length,
    other: reasons.filter(r => !['weak_or_lapsed', 'low_frequency_mastery', 'overdue_or_learning', 'new_material'].includes(r.reason)).length
  };

  return {
    items: selected.slice(0, length),
    composition,
    reasonBreakdown: reasons.slice(0, length)
  };
}
