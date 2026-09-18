import { UNKNOWN, isUnknown } from './DecisionContext.js';

const POS_ALIASES = {
  'UTG+1': 'UTG+1',
  MP: 'MP',
  LJ: 'LJ',
  EP: 'UTG',
  MP1: 'HJ'
};

export function normalizePosition(pos) {
  if (isUnknown(pos)) return UNKNOWN;
  const p = String(pos).split(/\s|vs/i)[0].trim().toUpperCase();
  return POS_ALIASES[p] || p;
}

export function normalizeStreet(street) {
  if (isUnknown(street)) return UNKNOWN;
  const s = String(street).toUpperCase()
    .replace('ФЛОП', 'FLOP')
    .replace('ТЁРН', 'TURN')
    .replace('ТЕРН', 'TURN')
    .replace('РИВЕР', 'RIVER')
    .replace('ПРЕФЛОП', 'PREFLOP');
  if (['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(s)) return s;
  return UNKNOWN;
}
