import { createDeck } from '../cards/deck.js';
import { mulberry32, hashCode } from './rng.js';
import { compareBoards, accumulateResult, finalizeEquity } from './equityEngine.js';

const DECK = createDeck();
const MAX_DECK = DECK.length;

// Deterministic Monte Carlo equity with seedable RNG.
export function monteCarlo({
  heroHand,
  villainCombos,
  board = [],
  iterations = 50000,
  seed = 1337,
  distributions = null
}) {
  const rng = mulberry32(seed);
  const hero = heroHand.slice();
  const boardSet = new Set(board);
  const heroSet = new Set(hero);
  const acc = { hero: 0, villain: 0, tie: 0, total: 0 };
  const needed = 5 - board.length;

  // Precompute base deck (all cards minus hero and board) once.
  const base = [];
  for (let i = 0; i < MAX_DECK; i++) {
    const c = DECK[i];
    if (!heroSet.has(c) && !boardSet.has(c)) base.push(c);
  }
  const baseLen = base.length;

  // Precompute a normalized distribution for weighted sampling.
  const weighted = distributions && distributions.length ? distributions : villainCombos;
  const wTotal = weighted.reduce((s, c) => s + (c.weight || 1), 0);

  // Temporary buffer for runout selection (reused across iterations).
  const runout = new Array(needed);

  for (let i = 0; i < iterations; i++) {
    // sample villain combo (weighted)
    let r = rng() * wTotal;
    let combo = weighted[weighted.length - 1];
    for (let ci = 0; ci < weighted.length; ci++) {
      r -= weighted[ci].weight || 1;
      if (r <= 0) { combo = weighted[ci]; break; }
    }
    const vc = combo.cards;
    const v0 = vc[0];
    const v1 = vc[1];

    // deal `needed` board cards from base, skipping villain cards, via in-place swap selection
    let end = baseLen;
    for (let j = 0; j < needed; j++) {
      let pickIdx;
      for (;;) {
        const idx = Math.floor(rng() * end);
        const card = base[idx];
        if (card === v0 || card === v1) {
          end--;
          const tmp = base[end];
          base[end] = base[idx];
          base[idx] = tmp;
          continue;
        }
        pickIdx = idx;
        break;
      }
      runout[j] = base[pickIdx];
      end--;
      const tmp = base[end];
      base[end] = base[pickIdx];
      base[pickIdx] = tmp;
    }

    const fullBoard = needed === 0 ? board : [...board, ...runout];
    const res = compareBoards(hero, vc, fullBoard);
    accumulateResult(acc, res, combo.weight || 1);
  }
  return { ...finalizeEquity(acc), simulations: iterations };
}

export function deriveSeed(input) {
  const seed = input.seed != null ? input.seed : hashCode(JSON.stringify(input.key || input.heroHand || []));
  return seed >>> 0;
}