// Poker position model for the ranges section. Pure rules, no data lookups.
//
// Seat order is the preflop acting order for an unopened pot. Everything the UI
// offers as a "villain who already acted" must come from this ordering.

export const SEAT_ORDER = Object.freeze({
  '6max': Object.freeze(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
  '9max': Object.freeze(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
});

export const FORMAT_IDS = Object.freeze(['6max', '9max']);

export const FORMAT_LABELS = Object.freeze({ '6max': '6-max', '9max': '9-max' });

const BLINDS = Object.freeze(['SB', 'BB']);

export function normalizeFormat(format) {
  const f = String(format || '').toLowerCase();
  return FORMAT_IDS.includes(f) ? f : null;
}

export function normalizePosition(position) {
  return String(position || '').trim().toUpperCase();
}

export function positionsForFormat(format) {
  const f = normalizeFormat(format);
  return f ? [...SEAT_ORDER[f]] : [];
}

export function isKnownPosition(format, position) {
  return positionsForFormat(format).includes(normalizePosition(position));
}

export function seatIndex(format, position) {
  return positionsForFormat(format).indexOf(normalizePosition(position));
}

export function actsBefore(format, a, b) {
  const ia = seatIndex(format, a);
  const ib = seatIndex(format, b);
  if (ia < 0 || ib < 0) return false;
  return ia < ib;
}

export function isBlind(position) {
  return BLINDS.includes(normalizePosition(position));
}

// Every seat that acts before hero preflop, i.e. every seat that could have
// opened the pot before the action reaches hero.
export function getValidOpeners(format, heroPosition) {
  const seats = positionsForFormat(format);
  const idx = seatIndex(format, heroPosition);
  if (idx < 0) return [];
  return seats.slice(0, idx);
}

// A hero can be first in whenever at least one seat still acts behind them.
// BB is never first in: if everyone folds, BB wins the pot uncontested.
export function canBeFirstIn(format, heroPosition) {
  const seats = positionsForFormat(format);
  const idx = seatIndex(format, heroPosition);
  if (idx < 0) return false;
  return idx < seats.length - 1;
}

// Hero can face a 3-bet only after opening, so the same seats as first-in.
export function canFaceThreeBet(format, heroPosition) {
  return canBeFirstIn(format, heroPosition);
}

// Hero can face an open only when at least one seat acts before them.
export function canFaceOpen(format, heroPosition) {
  return getValidOpeners(format, heroPosition).length > 0;
}

// Seats that can 3-bet hero after hero opens from heroPosition.
export function getValidThreeBettors(format, heroPosition) {
  const seats = positionsForFormat(format);
  const idx = seatIndex(format, heroPosition);
  if (idx < 0) return [];
  return seats.slice(idx + 1);
}

export function sortBySeatOrder(format, positions) {
  const seats = positionsForFormat(format);
  return [...positions]
    .map(normalizePosition)
    .filter((p) => seats.includes(p))
    .sort((a, b) => seats.indexOf(a) - seats.indexOf(b));
}
