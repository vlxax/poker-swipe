import { SolverError, assert } from '../api/errors.js';

export const RANKS = '23456789TJQKA';
export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const RANK_VALUE = {};
for (let i = 0; i < RANKS.length; i++) RANK_VALUE[RANKS[i]] = i + 2;
// low-ace value for straight purposes
export const RANK_VALUE_LOW = { ...RANK_VALUE, A: 1 };

export function parseCard(raw) {
  if (raw == null) return null;
  const str = String(raw).trim().replace(/^10/i, 'T');
  if (str.length < 2 || str.length > 2) return null;
  const rank = str[0].toUpperCase();
  const suit = str[1].toLowerCase();
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) return null;
  return rank + suit;
}

export function parseCards(list) {
  return (list || []).map(parseCard);
}

export function isValidCard(raw) {
  return parseCard(raw) != null;
}

export function assertValidCard(raw, where) {
  const c = parseCard(raw);
  if (!c) {
    throw new SolverError('INVALID_CARD', `${where || 'card'} is not a valid card: ${JSON.stringify(raw)}`);
  }
  return c;
}

export function rankOf(card) {
  return parseCard(card) ? RANK_VALUE[parseCard(card)[0]] : 0;
}

export function suitOf(card) {
  return parseCard(card) ? parseCard(card)[1] : '';
}

export function cardLabel(card) {
  const c = parseCard(card);
  if (!c) return '';
  const r = c[0] === 'T' ? '10' : c[0];
  return r + SUIT_SYMBOLS[c[1]];
}

export function cardsLabel(cards) {
  return (cards || []).map(cardLabel).filter(Boolean);
}

export function assertNoDuplicates(groups) {
  const seen = new Map();
  for (const [groupName, cards] of groups) {
    for (const raw of cards || []) {
      const c = parseCard(raw);
      if (!c) continue;
      if (seen.has(c)) {
        const [otherGroup] = seen.get(c);
        throw new SolverError('DUPLICATE_CARD', `${c} appears in both ${otherGroup} and ${groupName}`);
      }
      seen.set(c, [groupName]);
    }
  }
}

export function assertValidBoard(board, street) {
  const cards = parseCards(board);
  const expected = { preflop: 0, flop: 3, turn: 4, river: 5 };
  const want = expected[String(street || 'preflop').toLowerCase()];
  if (want == null) throw new SolverError('INVALID_STREET', `unknown street: ${street}`);
  if (cards.length !== want) {
    throw new SolverError(
      'INVALID_BOARD',
      `street ${street} requires ${want} board cards but got ${cards.length}`
    );
  }
  return cards;
}