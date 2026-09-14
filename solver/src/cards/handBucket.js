/**
 * Map canonical hand strength → legacy PokerBrain abstraction bucket.
 * Made-hand classification comes only from evaluateCards (single source of truth).
 */
import { evaluateCards } from './handEvaluator.js';
import { parseCard, rankOf } from './cardParser.js';

function normCard(c) {
  return String(c || '')
    .replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c')
    .trim();
}

export function handBucketFromEvaluator(hero = [], board = []) {
  const h = (hero || []).map(normCard).filter(parseCard);
  const b = (board || []).map(normCard).filter(parseCard);
  if (h.length < 2) return 'AIR';
  const ev = evaluateCards([...h, ...b]);
  if (!ev.valid && h.length + b.length < 5) return 'AIR';

  const cat = ev.category;
  if (['straight_flush', 'four_of_a_kind', 'full_house', 'flush', 'straight'].includes(cat)) {
    return 'NUTTED';
  }
  if (cat === 'three_of_a_kind' || cat === 'two_pair') return 'TWO_PAIR_PLUS';

  const br = b.map(rankOf).filter((x) => x > 0);
  const hr = h.map(rankOf).filter((x) => x > 0);
  if (!br.length) return 'AIR';

  const heroPair = h.length === 2 && h[0][0] === h[1][0];
  const pairBoard = hr.some((x) => br.includes(x));

  if (cat === 'one_pair') {
    if (heroPair) {
      const topBoard = Math.max(...br);
      if (Math.max(...hr) > topBoard) return 'OVERPAIR';
      return 'MIDDLE_PAIR';
    }
    if (pairBoard) {
      const hit = Math.max(...hr.filter((x) => br.includes(x)));
      const top = Math.max(...br);
      return hit === top ? 'TOP_PAIR' : 'MIDDLE_PAIR';
    }
  }

  // Draw detection only when no made hand ≥ pair
  const suits = [...h, ...b].map((c) => c.slice(-1));
  const suitCount = {};
  suits.forEach((s) => { suitCount[s] = (suitCount[s] || 0) + 1; });
  const fd = b.length < 5 && Object.values(suitCount).some((n) => n >= 4);

  const allRanks = [...new Set([...hr, ...br])].sort((a, b) => a - b);
  let sd = false;
  for (let i = 0; i < allRanks.length; i++) {
    for (let j = i + 1; j < allRanks.length; j++) {
      for (let k = j + 1; k < allRanks.length; k++) {
        if (allRanks[k] - allRanks[i] <= 4) sd = true;
      }
    }
  }
  if (fd && sd) return 'COMBO_DRAW';
  if (fd || sd) return 'DRAW';
  if (hr.every((x) => x < Math.min(...br))) return 'OVERCARDS';
  return 'AIR';
}
