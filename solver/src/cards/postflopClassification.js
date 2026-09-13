// Postflop hand structure using the existing evaluator — not a second evaluator.
// Draw detection tests real completing cards; proximity of ranks is not a draw.

import { evaluateCards, HAND_CATEGORIES } from './handEvaluator.js';
import { parseCard, rankOf, suitOf, RANKS } from './cardParser.js';

const SUITS = ['s', 'h', 'd', 'c'];
const RANK_LIST = RANKS.split('');

function parseList(cards) {
  return (cards || []).map((c) => {
    if (!c) return null;
    const s = String(c).trim()
      .replace(/♠/g, 's').replace(/♥/g, 'h').replace(/♦/g, 'd').replace(/♣/g, 'c')
      .replace(/^10/i, 'T');
    if (s.length >= 2) return parseCard(s[0].toUpperCase() + s[1].toLowerCase());
    return parseCard(s);
  }).filter(Boolean);
}

function uniqueCards(list) {
  return [...new Set(list)];
}

function boardPairRanks(board) {
  const cnt = {};
  for (const c of board) {
    const r = rankOf(c);
    cnt[r] = (cnt[r] || 0) + 1;
  }
  return cnt;
}

function madeFromEval(hero, board) {
  const all = uniqueCards([...hero, ...board]);
  if (all.length < 5) {
    return coarseMade(hero, board);
  }
  const ev = evaluateCards(all);
  const cat = ev.category;
  const boardEv = board.length >= 5 ? evaluateCards(board) : null;
  const heroRanks = hero.map(rankOf);
  const br = board.map(rankOf);
  const topBoard = br.length ? Math.max(...br) : 0;
  const boardCnt = boardPairRanks(board);

  let made = 'high_card';
  let pairKind = null;
  if (cat === 'straight_flush') made = 'straight_flush';
  else if (cat === 'four_of_a_kind') made = 'quads';
  else if (cat === 'full_house') made = 'full_house';
  else if (cat === 'flush') made = 'flush';
  else if (cat === 'straight') made = 'straight';
  else if (cat === 'three_of_a_kind') {
    const tripRank = (ev.value && ev.value[1]) || 0;
    made = boardCnt[tripRank] >= 3 ? 'trips' : 'set';
  } else if (cat === 'two_pair') made = 'two_pair';
  else if (cat === 'one_pair') {
    const pairRank = (ev.value && ev.value[1]) || 0;
    const pocket = hero[0] && hero[1] && rankOf(hero[0]) === rankOf(hero[1]);
    if (pocket && pairRank === rankOf(hero[0])) {
      pairKind = pairRank > topBoard ? 'overpair' : pairRank === topBoard ? 'top_pair' : 'underpair';
      made = pairKind === 'overpair' ? 'overpair' : 'pair';
    } else if (heroRanks.includes(pairRank)) {
      pairKind = pairRank === topBoard ? 'top_pair' : pairRank === secondBoard(br) ? 'second_pair' : 'pair';
      made = pairKind === 'top_pair' ? 'top_pair' : pairKind === 'second_pair' ? 'second_pair' : 'pair';
    } else {
      made = 'high_card';
    }
  } else {
    made = 'high_card';
  }

  return {
    made,
    pairKind,
    category: cat,
    playsBoard: boardEv && HAND_CATEGORIES.indexOf(cat) <= HAND_CATEGORIES.indexOf(boardEv.category)
      && cat === boardEv.category
  };
}

function secondBoard(br) {
  const u = [...new Set(br)].sort((a, b) => b - a);
  return u[1] || 0;
}

function coarseMade(hero, board) {
  const hr = hero.map(rankOf);
  const br = board.map(rankOf);
  const counts = {};
  for (const r of [...hr, ...br]) counts[r] = (counts[r] || 0) + 1;
  const topBoard = br.length ? Math.max(...br) : 0;
  const pocket = hr.length === 2 && hr[0] === hr[1];
  if (Object.values(counts).some((n) => n >= 3)) {
    const trip = Number(Object.keys(counts).find((k) => counts[k] >= 3));
    return { made: br.filter((r) => r === trip).length >= 3 ? 'trips' : 'set', pairKind: null, category: 'three_of_a_kind' };
  }
  const pairs = Object.entries(counts).filter(([, n]) => n >= 2);
  if (pairs.length >= 2) return { made: 'two_pair', pairKind: null, category: 'two_pair' };
  if (pocket) {
    const pk = hr[0] > topBoard ? 'overpair' : 'underpair';
    return { made: pk === 'overpair' ? 'overpair' : 'pair', pairKind: pk, category: 'one_pair' };
  }
  const hit = hr.find((r) => br.includes(r));
  if (hit) {
    const kind = hit === topBoard ? 'top_pair' : hit === secondBoard(br) ? 'second_pair' : 'pair';
    return { made: kind, pairKind: kind, category: 'one_pair' };
  }
  return { made: 'high_card', pairKind: null, category: 'high_card' };
}

function flushDrawInfo(hero, board) {
  if (board.length >= 5) {
    return { flushDraw: false, nutFlushDraw: false, backdoorFlushDraw: false, flushOuts: [] };
  }
  const all = [...hero, ...board];
  const bySuit = { s: [], h: [], d: [], c: [] };
  for (const c of all) bySuit[suitOf(c)].push(c);
  let flushDraw = false;
  let nutFlushDraw = false;
  let backdoorFlushDraw = false;
  const flushOuts = [];
  for (const su of SUITS) {
    const cards = bySuit[su];
    const heroSuited = hero.filter((c) => suitOf(c) === su);
    const boardSuited = board.filter((c) => suitOf(c) === su);
    if (heroSuited.length === 0) continue;
    if (cards.length === 4) {
      flushDraw = true;
      const used = new Set(all);
      for (const r of RANK_LIST) {
        const card = r.toLowerCase ? `${r}${su}` : `${r}${su}`;
        const pc = parseCard(r + su);
        if (pc && !used.has(pc)) flushOuts.push(pc);
      }
      const maxFlushRank = Math.max(...cards.map(rankOf));
      const heroHasNut = heroSuited.some((c) => rankOf(c) === 14)
        || (boardSuited.some((c) => rankOf(c) === 14) && heroSuited.some((c) => rankOf(c) === 13));
      nutFlushDraw = Boolean(heroHasNut) && maxFlushRank >= 13;
      if (heroSuited.some((c) => rankOf(c) === 14)) nutFlushDraw = true;
    } else if (cards.length === 3 && board.length <= 3 && heroSuited.length >= 1) {
      backdoorFlushDraw = true;
    }
  }
  return { flushDraw, nutFlushDraw, backdoorFlushDraw, flushOuts };
}

function completesStraight(ranks) {
  const u = [...new Set(ranks)].sort((a, b) => a - b);
  const withWheel = u.includes(14) ? [...u, 1] : u;
  const set = new Set(withWheel);
  for (let high = 5; high <= 14; high++) {
    const need = high === 5 ? [1, 2, 3, 4, 5] : [high - 4, high - 3, high - 2, high - 1, high];
    if (need.every((x) => set.has(x))) return true;
  }
  return false;
}

function heroUsedInStraight(heroRanks, boardRanks, extraRank) {
  const withHero = [...heroRanks, ...boardRanks, extraRank];
  if (!completesStraight(withHero)) return false;
  if (completesStraight([...boardRanks, extraRank])) return false;
  return true;
}

function straightDrawInfo(hero, board) {
  if (board.length >= 5) {
    return {
      straightDraw: false,
      gutshot: false,
      openEnded: false,
      doubleGutter: false,
      straightOutRanks: []
    };
  }
  const heroRanks = hero.map(rankOf);
  const boardRanks = board.map(rankOf);
  const allNow = [...heroRanks, ...boardRanks];
  if (completesStraight(allNow)) {
    return { straightDraw: false, gutshot: false, openEnded: false, doubleGutter: false, straightOutRanks: [], madeStraight: true };
  }
  const usedRanks = new Set(allNow);
  const outs = [];
  for (let r = 2; r <= 14; r++) {
    if (usedRanks.has(r) && boardRanks.includes(r) && heroRanks.includes(r)) {
      // still can complete with remaining copies, but rank-out model uses rank uniqueness
    }
    if (!heroUsedInStraight(heroRanks, boardRanks, r)) continue;
    if (completesStraight([...heroRanks, ...boardRanks, r])) outs.push(r);
  }
  const uniqueOuts = [...new Set(outs)].sort((a, b) => a - b);
  let openEnded = false;
  let gutshot = false;
  let doubleGutter = false;
  if (uniqueOuts.length === 1) gutshot = true;
  else if (uniqueOuts.length === 2) {
    const spread = uniqueOuts[1] - uniqueOuts[0];
    if (spread === 5 || spread === 4) openEnded = true; // 4-linear (T/5) or 3456-style
    else if (spread === 1) openEnded = true;
    else {
      doubleGutter = true;
      gutshot = false;
    }
  } else if (uniqueOuts.length >= 3) {
    openEnded = true;
  }
  return {
    straightDraw: uniqueOuts.length > 0,
    gutshot: gutshot && !openEnded,
    openEnded,
    doubleGutter: doubleGutter && !openEnded,
    straightOutRanks: uniqueOuts,
    madeStraight: false
  };
}

export function classifyPostflopHand(heroCards, boardCards) {
  const hero = parseList(heroCards);
  const board = parseList(boardCards);
  const made = madeFromEval(hero, board);
  const fd = flushDrawInfo(hero, board);
  const sd = straightDrawInfo(hero, board);
  const comboDraw = fd.flushDraw && sd.straightDraw;
  const pairPlusDraw = ['pair', 'top_pair', 'second_pair', 'overpair'].includes(made.made)
    && (fd.flushDraw || sd.straightDraw);
  const madeWithoutDraw = made.made !== 'high_card' && !fd.flushDraw && !sd.straightDraw
    && !['pair', 'top_pair', 'second_pair', 'overpair', 'set', 'trips', 'two_pair', 'straight', 'flush', 'full_house', 'quads', 'straight_flush'].every(() => false);

  const blockers = {
    ace: hero.some((c) => rankOf(c) === 14),
    nutFlushBlocker: hero.some((c) => rankOf(c) === 14),
    suits: hero.map(suitOf)
  };

  return {
    made: made.made,
    pairKind: made.pairKind,
    category: made.category,
    flushDraw: fd.flushDraw,
    nutFlushDraw: fd.nutFlushDraw,
    backdoorFlushDraw: fd.backdoorFlushDraw && !fd.flushDraw,
    straightDraw: sd.straightDraw,
    gutshot: sd.gutshot,
    openEnded: sd.openEnded,
    doubleGutter: sd.doubleGutter,
    comboDraw,
    pairPlusDraw,
    madeWithoutDraw: made.made !== 'high_card' && !fd.flushDraw && !sd.straightDraw,
    blockers,
    hero,
    board
  };
}

export function postflopBucket(heroCards, boardCards) {
  const c = classifyPostflopHand(heroCards, boardCards);
  if (c.made === 'straight_flush' || c.made === 'quads' || c.made === 'full_house') return 'NUTTED';
  if (c.made === 'flush' || c.made === 'straight') return 'NUT_VALUE';
  if (c.made === 'set' || c.made === 'trips') return 'SET_PLUS';
  if (c.made === 'two_pair') return 'TWO_PAIR';
  if (c.comboDraw) return 'COMBO_DRAW';
  if (c.flushDraw || c.openEnded) return 'DRAW_STRONG';
  if (c.gutshot || c.doubleGutter || c.backdoorFlushDraw) return 'DRAW_WEAK';
  if (c.made === 'overpair' || c.made === 'top_pair') return 'PAIR_STRONG';
  if (c.made === 'second_pair' || c.made === 'pair') return 'PAIR_WEAK';
  if (c.blockers.ace) return 'ACE_HIGH';
  return 'AIR';
}
