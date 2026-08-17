import { SolverError } from '../api/errors.js';

export const STREETS = ['preflop', 'flop', 'turn', 'river'];

export function normalizeStreet(value) {
  const s = String(value || 'preflop').toLowerCase();
  if (STREETS.includes(s)) return s;
  const map = { preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river', PREFLOP: 'preflop' };
  if (map[s]) return map[s];
  throw new SolverError('INVALID_STREET', `unknown street: ${value}`);
}

export function nextStreet(street) {
  const i = STREETS.indexOf(normalizeStreet(street));
  return i >= 0 && i < STREETS.length - 1 ? STREETS[i + 1] : null;
}

export function boardLengthForStreet(street) {
  return { preflop: 0, flop: 3, turn: 4, river: 5 }[normalizeStreet(street)];
}