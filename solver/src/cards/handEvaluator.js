import { parseCard, rankOf, suitOf } from './cardParser.js';

// Direct evaluator for 5..7 cards: returns best 5-card { category, value } without
// enumerating subsets. value[0] = category rank, followed by descending tiebreakers.
export const HAND_CATEGORIES = [
  'high_card', 'one_pair', 'two_pair', 'three_of_a_kind', 'straight',
  'flush', 'full_house', 'four_of_a_kind', 'straight_flush'
];

export function evaluateCards(cards) {
  const list = (cards || []).map(parseCard).filter(Boolean);
  if (list.length < 5) {
    return { category: 'high_card', value: [0], cards: list, valid: false, reason: 'less_than_5_cards' };
  }
  const ranks = list.map(rankOf);
  const suits = list.map(suitOf);

  const cnt = new Array(13).fill(0);
  const suitRanks = [[], [], [], []];
  const suitIndex = { s: 0, h: 1, d: 2, c: 3 };
  let mask = 0;
  for (let i = 0; i < list.length; i++) {
    const r = ranks[i] - 2; // 0..12
    cnt[r]++;
    const si = suitIndex[suits[i]];
    suitRanks[si].push(ranks[i]); // rank 2..14
    mask |= 1 << r;
  }

  // flush detection
  let flushSuit = -1;
  for (let si = 0; si < 4; si++) {
    if (suitRanks[si].length >= 5) { flushSuit = si; break; }
  }

  // straight detection over full mask (and wheel)
  let straightHigh = 0;
  const straightFromMask = (m, allowWheel) => {
    for (let low = 0; low <= 8; low++) {
      if ((m & (0b11111 << low)) === (0b11111 << low)) return low + 5; // highest card value (2..14)
    }
    if (allowWheel && (m & 0b1000000000111) === 0b1000000000111) return 5; // A 2 3 4 5 -> wheel high = 5
    return 0;
  };
  const allMask = mask;
  straightHigh = straightFromMask(allMask, true);

  // straight flush: straight using only flush-suit ranks
  let straightFlushHigh = 0;
  if (flushSuit >= 0) {
    let fmask = 0;
    for (const r of suitRanks[flushSuit]) fmask |= 1 << (r - 2);
    straightFlushHigh = straightFromMask(fmask, true);
  }

  // sorted rank groups by count desc then rank desc
  const byCount = new Array(5).fill(null).map(() => []);
  for (let r = 0; r < 13; r++) {
    if (cnt[r] > 0) byCount[cnt[r]].push(r + 2); // rank value 2..14
  }
  const desc = (a, b) => b - a;
  for (let c = 1; c <= 4; c++) byCount[c].sort(desc);
  const quads = byCount[4][0] || 0;
  const tripsList = byCount[3];
  const pairsList = byCount[2];
  const singlesList = byCount[1];

  // collect all ranks sorted by (count desc, rank desc)
  const ordered = [];
  for (let c = 4; c >= 1; c--) for (const r of byCount[c]) ordered.push(r);

  let category;
  let value;
  const categoryRank = HAND_CATEGORIES.indexOf;

  if (straightFlushHigh) {
    category = 'straight_flush';
    value = [8, straightFlushHigh];
  } else if (quads) {
    category = 'four_of_a_kind';
    const kicker = ordered.find((r) => r !== quads) || 0;
    value = [7, quads, kicker];
  } else if (tripsList.length && pairsList.length) {
    category = 'full_house';
    value = [6, tripsList[0], pairsList[0]];
  } else if (flushSuit >= 0) {
    category = 'flush';
    const top5 = suitRanks[flushSuit].sort(desc).slice(0, 5);
    value = [5, ...top5];
  } else if (straightHigh) {
    category = 'straight';
    value = [4, straightHigh];
  } else if (tripsList.length) {
    category = 'three_of_a_kind';
    const kickers = ordered.filter((r) => r !== tripsList[0]).slice(0, 2);
    value = [3, tripsList[0], ...kickers];
  } else if (pairsList.length >= 2) {
    category = 'two_pair';
    const hi = pairsList[0];
    const lo = pairsList[1];
    const kicker = ordered.find((r) => r !== hi && r !== lo) || 0;
    value = [2, hi, lo, kicker];
  } else if (pairsList.length === 1) {
    category = 'one_pair';
    const p = pairsList[0];
    const kickers = ordered.filter((r) => r !== p).slice(0, 3);
    value = [1, p, ...kickers];
  } else {
    category = 'high_card';
    const top5 = ordered.slice(0, 5);
    value = [0, ...top5];
  }

  return { category, value, cards: list, valid: true };
}

export function compareValueArrays(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

export function compareEvaluations(a, b) {
  return compareValueArrays(a.value, b.value);
}

// Compatibility aliases (kept for the public + internal API)
export const evaluateHand = evaluateCards;
export function compareHands(handA, handB) {
  const a = handA && handA.category ? handA : evaluateCards(handA);
  const b = handB && handB.category ? handB : evaluateCards(handB);
  return compareEvaluations(a, b);
}
export { rankOf, suitOf, RANK_VALUE, RANK_VALUE_LOW } from './cardParser.js';

export function handName(category) {
  const RU = {
    high_card: 'старшая карта',
    one_pair: 'пара',
    two_pair: 'две пары',
    three_of_a_kind: 'трипс',
    straight: 'стрит',
    flush: 'флеш',
    full_house: 'фулл-хаус',
    four_of_a_kind: 'каре',
    straight_flush: 'стрит-флеш'
  };
  return RU[category] || category;
}