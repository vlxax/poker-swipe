import { RANKS, SUITS, parseCard } from './cardParser.js';

export function createDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;
}

export function removeCards(deck, cards) {
  const blocked = new Set((cards || []).map(parseCard).filter(Boolean));
  return deck.filter((c) => !blocked.has(c));
}

export function deckAfter(knownCards) {
  return removeCards(createDeck(), knownCards);
}

// Fisher-Yates using a supplied RNG (mulberry32-style function taking no args)
export function shuffleDeck(deck, rng) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}