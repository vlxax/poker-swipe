// Per-player personalization seed and seeded RNG for reproducible but
// user-specific task/assessment selection.

import { stableHash } from '../integration/pokerSwipeHandAdapter.js';

export function createPersonalizationSeed() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(2);
    globalThis.crypto.getRandomValues(buf);
    return `${buf[0].toString(16)}${buf[1].toString(16)}`;
  }
  return stableHash(`${Date.now()}|${Math.random()}|${Math.random()}`);
}

export function seedToNumber(seed) {
  const h = stableHash(String(seed || '0'));
  let n = 0;
  for (let i = 0; i < 8; i++) n = (n * 31 + h.charCodeAt(i)) >>> 0;
  return n || 1;
}

export function seededRng(seed) {
  let state = seedToNumber(seed);
  return function rng() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pickWeighted(candidates, rng, scoreFn = (x) => x.score || 1) {
  if (!candidates.length) return null;
  const scored = candidates.map((c) => ({ c, s: Math.max(0.01, scoreFn(c)) }));
  const total = scored.reduce((sum, x) => sum + x.s, 0);
  let r = rng() * total;
  for (const { c, s } of scored) {
    r -= s;
    if (r <= 0) return c;
  }
  return scored[scored.length - 1].c;
}
