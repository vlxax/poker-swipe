import { parseClassToken } from './rangeParser.js';
import { expandClass } from '../cards/combinations.js';

// Expand a range map into weighted combos.
// Returns { combos: [{cards, weight, class}], totalWeight, comboCount }
export function expandRange(range, blockedCards = []) {
  const expanded = [];
  let totalWeight = 0;
  for (const [cls, weightRaw] of Object.entries(range || {})) {
    const parsed = parseClassToken(cls);
    if (!parsed) continue;
    const weight = Number(weightRaw) || 0;
    const combos = expandClass(cls, blockedCards);
    for (const cards of combos) {
      expanded.push({ cards, weight, class: cls });
      totalWeight += weight;
    }
  }
  return {
    combos: expanded,
    totalWeight,
    comboCount: expanded.length
  };
}

// Remove combos that contain any of the given (blocked) cards.
export function removeBlockedCombos(expanded, cards) {
  const blocked = new Set((cards || []).map((c) => String(c)));
  const filtered = expanded.combos.filter(
    (combo) => !combo.cards.some((c) => blocked.has(String(c)))
  );
  return {
    combos: filtered,
    totalWeight: filtered.reduce((s, c) => s + c.weight, 0),
    comboCount: filtered.length
  };
}

// Count total combos for a range (weighted) after removing blocked cards.
export function comboCountForRange(range, blockedCards = []) {
  const ex = expandRange(range, blockedCards);
  return ex.comboCount;
}