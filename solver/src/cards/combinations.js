// Generates actual card combos from a class (rank pair + suitedness), excluding blocked cards.
import { RANKS, SUITS, parseCard } from './cardParser.js';

export function rankPairOf(handClass) {
  const k = String(handClass || '');
  if (k.length < 2) return null;
  const a = k[0].toUpperCase();
  const b = k[1].toUpperCase();
  if (!RANKS.includes(a) || !RANKS.includes(b)) return null;
  const kind = k.slice(2).toLowerCase();
  return { hi: a, lo: b, kind };
}

export function expandClass(handClass, blockedCards = []) {
  const rp = rankPairOf(handClass);
  if (!rp) return [];
  const blocked = new Set((blockedCards || []).map(parseCard).filter(Boolean));
  const combos = [];
  if (rp.hi === rp.lo) {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        const c1 = rp.hi + SUITS[i];
        const c2 = rp.hi + SUITS[j];
        if (!blocked.has(c1) && !blocked.has(c2)) combos.push([c1, c2]);
      }
    }
    return combos;
  }
  for (const s1 of SUITS) {
    for (const s2 of SUITS) {
      if (rp.kind === 's' && s1 !== s2) continue;
      if (rp.kind === 'o' && s1 === s2) continue;
      if (rp.kind !== 's' && rp.kind !== 'o') continue;
      const c1 = rp.hi + s1;
      const c2 = rp.lo + s2;
      if (!blocked.has(c1) && !blocked.has(c2)) combos.push([c1, c2]);
    }
  }
  return combos;
}

export function comboCount(handClass, blockedCards = []) {
  return expandClass(handClass, blockedCards).length;
}

export function classKey(combo) {
  const [a, b] = combo;
  const c1 = parseCard(a);
  const c2 = parseCard(b);
  if (!c1 || !c2) return null;
  const r1 = c1[0];
  const r2 = c2[0];
  if (r1 === r2) return r1 + r2;
  const hi = RANKS.indexOf(r1) > RANKS.indexOf(r2) ? r1 : r2;
  const lo = hi === r1 ? r2 : r1;
  return hi + lo + (c1[1] === c2[1] ? 's' : 'o');
}