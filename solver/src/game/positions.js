import { SolverError } from '../api/errors.js';

export const POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];

export function normalizePosition(pos) {
  if (pos == null) return '';
  const s = String(pos).toUpperCase();
  if (s === 'BUTTON') return 'BTN';
  if (s === 'CUTOFF') return 'CO';
  if (s === 'HIJACK') return 'HJ';
  if (POSITIONS.includes(s)) return s;
  return s;
}

export function isLatePosition(pos) {
  return ['BTN', 'CO', 'HJ'].includes(normalizePosition(pos));
}

export function isBlind(pos) {
  return ['BB', 'SB'].includes(normalizePosition(pos));
}

export function assertValidPositions({ heroPosition, villainPosition }) {
  const hero = normalizePosition(heroPosition);
  const villain = normalizePosition(villainPosition);
  if (!hero || !villain) throw new SolverError('INVALID_INPUT', 'both heroPosition and villainPosition are required');
  return { hero, villain };
}