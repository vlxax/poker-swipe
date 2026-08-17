import { parseCard } from '../cards/cardParser.js';
import { expandClass } from '../cards/combinations.js';

// Count how many combos a class loses given blocked cards (dead cards, board, hero cards).
export function countBlockedCombos(handClass, blockedCards = []) {
  const blocked = new Set((blockedCards || []).map(parseCard).filter(Boolean));
  const all = expandClass(handClass, []);
  return all.filter((combo) => combo.some((c) => blocked.has(c))).length;
}

export function unblockedComboCount(handClass, blockedCards = []) {
  return expandClass(handClass, blockedCards).length;
}

// Convenience: reduce every class in a range by blocked cards (returns new weight map
// representing combos-per-remaining). Used for displaying blocker effects.
export function blockersAdjustRange(range, blockedCards = []) {
  const out = {};
  for (const [cls, weight] of Object.entries(range || {})) {
    out[cls] = Number(weight) * (unblockedComboCount(cls, blockedCards) / Math.max(1, unblockedComboCount(cls, [])));
  }
  return out;
}