import { RANKS, SUITS } from '../cards/cardParser.js';
import { rankPairOf } from '../cards/combinations.js';
import { SolverError, assert } from '../api/errors.js';

// Parses basic notation: AA, 77, AKs, AKo, QJs, T9s.
// Extensible: accepts tokens of the form RANKS[RANKS](s|o) for pairs (RR).
const SIMPLE_RE = /^([2-9TJQKA])([2-9TJQKA])([so]?)$/;

// Range object is a map { classKey: weight }
export function parseClassToken(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  // pair notation like AA (implicitly suited/offsuit not applicable)
  const m = t.match(SIMPLE_RE);
  if (m) {
    const hi = m[1];
    const lo = m[2];
    const kind = m[3] || '';
    if (hi === lo) {
      if (kind) return null; // AA is a pair, no suit suffix
      return { hi, lo, kind: 'pair' };
    }
    if (kind === '') return null; // non-pair requires s or o
    if (kind !== 's' && kind !== 'o') return null;
    return { hi, lo, kind };
  }
  return null;
}

export function isValidClassToken(token) {
  return parseClassToken(token) != null;
}

export function assertValidRange(range, where) {
  if (range == null || typeof range !== 'object' || Array.isArray(range)) {
    throw new SolverError('INVALID_RANGE', `${where || 'range'} must be an object map of class:weight`);
  }
  const keys = Object.keys(range);
  if (!keys.length) {
    throw new SolverError('INVALID_RANGE', `${where || 'range'} is empty`);
  }
  for (const k of keys) {
    if (!parseClassToken(k)) {
      throw new SolverError('INVALID_RANGE', `invalid range hand notation: "${k}"`);
    }
    const w = Number(range[k]);
    if (!Number.isFinite(w) || w < 0) {
      throw new SolverError('INVALID_RANGE', `invalid weight for ${k}: ${range[k]}`);
    }
  }
  return range;
}

export { RANKS, SUITS, rankPairOf };