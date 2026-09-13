// 13×13 matrix helpers for Range Battleship.

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const RANK_INDEX = Object.fromEntries(RANKS.map((r, i) => [r, i]));

export function handCode(row, col) {
  const a = RANKS[row];
  const b = RANKS[col];
  if (row === col) return a + b;
  return row < col ? a + b + 's' : b + a + 'o';
}

export function canonicalHand(rank1, rank2, suited) {
  const idx1 = RANK_INDEX[rank1];
  const idx2 = RANK_INDEX[rank2];
  const first = idx1 <= idx2 ? rank1 : rank2;
  const second = idx1 <= idx2 ? rank2 : rank1;
  if (first === second) return first + second;
  return first + second + (suited ? 's' : 'o');
}

export function allHands() {
  const out = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) out.push(handCode(r, c));
  }
  return out;
}

export function getHandCategory(hand) {
  if (hand.length === 2) return 'pocketPairs';
  const rank = hand[0];
  const type = hand.includes('s') ? 'suited' : 'offsuit';
  const rank2 = hand[1];
  if (rank === 'A' && type === 'suited') return 'suitedAx';
  if (rank === 'A' && type === 'offsuit') return 'offsuitAx';
  if (rank === 'K' && type === 'suited') return 'suitedKx';
  if (rank === 'K' && type === 'offsuit') return 'offsuitKx';
  if (['A', 'K', 'Q', 'J', 'T'].includes(rank) && ['A', 'K', 'Q', 'J', 'T'].includes(rank2)) return 'broadway';
  const diff = Math.abs(RANK_INDEX[rank] - RANK_INDEX[rank2]);
  if (type === 'suited' && diff === 1) return 'suitedConnectors';
  if (type === 'suited' && diff === 2) return 'suitedGappers';
  return 'other';
}

export function getPocketSequence() {
  const seq = [];
  for (let r = 0; r < 13; r++) seq.push(handCode(r, r));
  return seq;
}

export function getSuitedAxSequence() {
  const seq = [];
  for (let c = 1; c < 13; c++) seq.push('A' + RANKS[c] + 's');
  return seq;
}

export function getOffsuitAxSequence() {
  const seq = [];
  for (let c = 1; c < 13; c++) seq.push('A' + RANKS[c] + 'o');
  return seq;
}

export function getSuitedKxSequence() {
  const seq = [];
  for (let c = 2; c < 13; c++) seq.push('K' + RANKS[c] + 's');
  return seq;
}

export function getCanonicalBroadwayHands() {
  const broadwayRanks = ['A', 'K', 'Q', 'J', 'T'];
  const result = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === c) result.push(broadwayRanks[r] + broadwayRanks[c]);
      else if (r < c) result.push(canonicalHand(broadwayRanks[r], broadwayRanks[c], true));
      else result.push(canonicalHand(broadwayRanks[r], broadwayRanks[c], false));
    }
  }
  return result;
}

export function getNearBroadwayHands() {
  const result = [];
  const near = ['K9', 'Q9', 'J9', 'T9'];
  for (const pair of near) {
    result.push(canonicalHand(pair[0], pair[1], true));
    result.push(canonicalHand(pair[0], pair[1], false));
  }
  return result;
}

export function getSuitedConnectorSequence() {
  return ['T9s', '98s', '87s', '76s', '65s', '54s'];
}

export function getSuitedGapperSequence() {
  return ['T8s', '97s', '86s', '75s', '64s', '53s'];
}

export function findContinuousBoundary(sequence, rangeSet) {
  let lastOpen = null;
  let firstFold = null;
  for (const hand of sequence) {
    if (rangeSet.has(hand)) lastOpen = hand;
    else if (lastOpen !== null && firstFold === null) firstFold = hand;
  }
  return { lastOpen, firstFold, continuous: lastOpen !== null && firstFold !== null };
}

export function isSequenceContinuousOpen(sequence, rangeSet) {
  const { continuous } = findContinuousBoundary(sequence, rangeSet);
  if (!continuous) return false;
  const { lastOpen, firstFold } = findContinuousBoundary(sequence, rangeSet);
  const start = sequence.indexOf(lastOpen);
  const end = sequence.indexOf(firstFold);
  for (let i = start; i < end; i++) {
    if (!rangeSet.has(sequence[i])) return false;
  }
  for (let i = end; i < sequence.length; i++) {
    if (rangeSet.has(sequence[i])) return false;
  }
  return true;
}

export function getLowestContinuousOpen(sequence, rangeSet) {
  if (!isSequenceContinuousOpen(sequence, rangeSet)) return null;
  let lowest = null;
  for (const hand of sequence) {
    if (rangeSet.has(hand)) lowest = hand;
  }
  return lowest;
}

export function formatThreshold(hand) {
  if (!hand) return null;
  if (hand.length === 2) return hand + '+';
  if (hand.includes('s')) return hand.replace('s', 's+');
  if (hand.includes('o')) return hand.replace('o', 'o+');
  return hand + '+';
}
