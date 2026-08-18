// Adapter that transforms a PokerSwipe "My Hands" hand record (as produced by the
// in-app builder / hand-history import) into the input shape consumed by
// `analyzeHand`. It owns the product-specific normalization: suits (♠♥♦♣) → solver
// notation (As,Kh), the builder action format → solver {player,type,amountBB},
// position/blind assignment, and — because a saved hand carries no ranges — a set
// of honest, documented default ranges chosen from the seats. Everything it infers
// (especially ranges) is surfaced as a warning so the review never overstates
// certainty about an opponent's actual range.
//
// Pure transformation: no solver, no I/O. Deterministic given the same hand.

import { SolverError, assert } from '../api/errors.js';

const SUIT_MAP = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
const ACTOR_MAP = { HERO: 'hero', VILLAIN: 'villain' };
const ACTION_MAP = { FOLD: 'fold', CHECK: 'check', CALL: 'call', BET: 'bet', RAISE: 'raise' };

// ---- Card helpers ------------------------------------------------------------

// 'Q♠' → 'Qs'; 'Q♥' → 'Qh'; '10' handled by builder rank tokens (T..A). Accepts
// both symbol and already-normalized (rank+suit-letter) cards. Null when invalid.
export function toSolverCard(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  // Symbol suits. The builder writes '10♠' for a ten; map to solver 'Ts'.
  const ten = str.match(/^10([♠♥♦♣])$/);
  if (ten) return 'T' + (SUIT_MAP[ten[1]] || '');
  const sym = str.match(/^([2-9TJQKA])([♠♥♦♣])$/);
  if (sym) return sym[1] + (SUIT_MAP[sym[2]] || '');
  // Already-normalized rank + lowercase suit letter ('Jd', 'Ts', '10s' → 'Ts').
  const normTen = str.match(/^10([shdc])$/);
  if (normTen) return 'T' + normTen[1].toLowerCase();
  const norm = str.match(/^([2-9TJQKA])([shdc])$/);
  if (norm) return norm[1].toUpperCase() + norm[2].toLowerCase();
  return null;
}

export function normalizeCards(cards = []) {
  return cards.map(toSolverCard).filter(Boolean);
}

function assertCards(cards, where) {
  for (const c of cards) {
    if (!toSolverCard(c)) {
      throw new SolverError('INVALID_CARD', `invalid card in ${where}: ${JSON.stringify(c)}`);
    }
  }
}

// ---- Default ranges ----------------------------------------------------------

// Saved hands carry no opponent ranges, so the adapter must assign a documented
// default. The solver's CFR cost scales with the number of range classes (each
// class expands into its board-legal combinations), so these defaults are kept
// intentionally SMALL and COARSE — three classes per side — to keep a single
// decision spot solvable in a few seconds (see scripts/probePerf.js). This is a
// deliberate product trade-off: a realistic ~40% open is far too slow to solve
// interactively, so we ship a small, honest approximation and surface it as a
// warning rather than pretending to model the full range.
//
// The classes chosen are broadly representative of a heads-up open/defend
// encounter (a pair + an ace-broadway combo per side) and are position-aware:
// the opener gets the wider set and the defender the caller set.

// Coarse opener set (~representative of BTN/SB raising a wide value+bluff mix).
const COARSE_OPENER = ['JJ', 'TT', 'AKs'];
// Coarse defender set (~representative of a BB call vs a small open).
const COARSE_DEFENDER = ['QQ', '99', 'AKo'];

function toRangeMap(classes) {
  const out = {};
  for (const c of classes) out[c] = 1;
  return out;
}

// Assign raiser/defender ranges from seats. Returns { hero, villain } ranges.
export function defaultRangesFor(heroSeat, villainSeat) {
  const h = String(heroSeat || '').toUpperCase();
  const v = String(villainSeat || '').toUpperCase();
  if (h === 'BB') {
    // Hero defends from the BB vs a raiser (BTN/SB).
    return { hero: toRangeMap(COARSE_DEFENDER), villain: toRangeMap(COARSE_OPENER) };
  }
  // Hero is the opener (BTN/SB/unknown) heads-up.
  return { hero: toRangeMap(COARSE_OPENER), villain: toRangeMap(COARSE_DEFENDER) };
}

// ---- Action conversion -------------------------------------------------------

// The builder's accounting seeds the pot with SB+BB then adds every bet/call on
// top symmetrically, which silently ignores that the BB already has 0.5 BB more
// committed than the SB. The solver's replay seeds blinds the same way but tracks
// a per-player committed split. To feed it consistent amounts we walk the same
// committed-split state ourselves and re-derive each added amount:
//   - call   = the true amount needed to match the opponent (not the stored `call`)
//   - bet/raise = `pct` × the running pot (authoritative), else the stored `size`
//   - check/fold = 0
// This keeps the pot geometry identical to the solver's view instead of trusting
// the product's looser numbers.

function blindAssignment(heroSeat, villainSeat) {
  const h = String(heroSeat || '').toUpperCase();
  const v = String(villainSeat || '').toUpperCase();
  if (v === 'BB') return { sbKey: 'hero', bbKey: 'villain' };
  if (h === 'BB') return { bbKey: 'hero', sbKey: 'villain' };
  return { sbKey: 'hero', bbKey: 'villain' };
}

const opponent = (p) => (p === 'hero' ? 'villain' : 'hero');

// Convert the full ordered action list into solver { player, type, amountBB }.
export function convertActions(actions, { heroSeat, villainSeat, effStack }) {
  const { sbKey, bbKey } = blindAssignment(heroSeat, villainSeat);
  const sb = 0.5;
  const bb = 1.0;
  const committed = { hero: 0, villain: 0 };
  let pot = sb + bb;
  let toCall = Math.max(0, bb - sb);
  committed[sbKey] = sb;
  committed[bbKey] = bb;

  const out = [];
  for (const a of actions || []) {
    const actor = ACTOR_MAP[String(a.actor || '').toUpperCase()];
    if (!actor) throw new SolverError('INVALID_ACTION', `unknown actor: ${a.actor}`);
    const type = ACTION_MAP[String(a.action || '').toUpperCase()];
    if (!type) throw new SolverError('INVALID_ACTION', `unsupported action: ${a.action}`);

    let amountBB = 0;
    if (type === 'call') {
      // True call = the gap between the two players' committed totals. The
      // product's stored `call` field double-counts the blinds, so it is ignored.
      amountBB = Math.max(0, committed[opponent(actor)] - committed[actor]);
    } else if (type === 'raise') {
      // `size` is the raise-to target (total committed). Emit the added gap so the
      // solver's committed/pot walk stays consistent (see replayHand).
      const size = toNumber(a.size);
      const pct = toNumber(a.pct);
      const target = size != null ? size : pct != null ? committed[actor] + (pct / 100) * pot : committed[actor];
      amountBB = Math.max(0, target - committed[actor]);
    } else if (type === 'bet') {
      // For a bet the product's `pct` (of the running pot) is authoritative;
      // fall back to the stored size only when no pct is present.
      const pct = toNumber(a.pct);
      const size = toNumber(a.size);
      amountBB = pct != null ? (pct / 100) * pot : (size != null ? size : 0);
    }

    amountBB = Math.min(amountBB, Math.max(0, Number(effStack) - committed[actor]));
    out.push({ player: actor, type, amountBB: round(amountBB, 6) });

    committed[actor] += amountBB;
    pot += amountBB;
    toCall = Math.max(0, committed[actor] - committed[opponent(actor)]);
  }
  return out;
}

export function splitActions(actions, opts) {
  const converted = convertActions(actions, opts);
  const preflop = [];
  const postflop = [];
  const source = actions || [];
  for (let i = 0; i < converted.length; i++) {
    const s = String(source[i].street || '').toUpperCase();
    if (s === 'PREFLOP') preflop.push(converted[i]);
    else postflop.push(converted[i]);
  }
  return { preflop, postflop };
}

// ---- Public adapter ----------------------------------------------------------

// Normalize a saved hand into the analyzeHand input plus an explicit list of
// product warnings. Throws SolverError for malformed hands (rejected, never
// analyzed). `options.ranges` lets a caller override the default ranges (used by
// tests and by future UI range selection).
export function adaptPokerSwipeHand(hand = {}, options = {}) {
  assert(hand && typeof hand === 'object', 'INVALID_HAND', 'hand record is required');
  const warnings = [];

  const heroSeat = String(hand.heroSeat || 'BTN').toUpperCase();
  const villainSeat = String(hand.villainSeat || 'BB').toUpperCase();
  const rawEff = hand.effStack != null ? hand.effStack : hand.effectiveStackBB;
  const effStack = rawEff == null ? 100 : Number(rawEff);
  assert(Number.isFinite(effStack) && effStack > 0, 'INVALID_STACK', 'effective stack must be positive');

  const heroCards = normalizeCards(hand.hero || []);
  const villainCards = normalizeCards(hand.villain || []);
  const board = normalizeCards(hand.board || []);

  assert(heroCards.length === 2, 'INVALID_HAND', 'Hero needs exactly two hole cards');
  assertCards(heroCards, 'Hero hand');
  assertCards(villainCards, 'villain hand');
  assertCards(board, 'board');
  assert(board.length === 0 || board.length === 3 || board.length === 4 || board.length === 5,
    'INVALID_BOARD', `board must have 0, 3, 4 or 5 cards (got ${board.length})`);

  const seen = new Set();
  for (const c of [...heroCards, ...villainCards, ...board]) {
    if (seen.has(c)) throw new SolverError('DUPLICATE_CARD', `duplicate card: ${c}`);
    seen.add(c);
  }

  const { preflop, postflop } = splitActions(hand.actions || [], { heroSeat, villainSeat, effStack });
  assert(Array.isArray(hand.actions) || hand.actions == null, 'INVALID_ACTION', 'actions must be an array');

  if ((hand.actions || []).length === 0) {
    warnings.push('No betting actions recorded — only context can be shown, decisions will not solve.');
  }
  if (postflop.length === 0) {
    warnings.push('No postflop Hero decision found in this hand, so street-by-street EV analysis is unavailable.');
  }

  // Positions. The analyzer only distinguishes BB vs non-BB for blind assignment.
  let ranges;
  if (options && options.ranges && options.ranges.hero && options.ranges.villain) {
    ranges = { hero: options.ranges.hero, villain: options.ranges.villain };
  } else {
    ranges = defaultRangesFor(heroSeat, villainSeat);
    warnings.push(
      'No saved ranges for this hand — a documented default range was assumed for Hero and Villain based on position.'
    );
  }

  const format = String(hand.format || 'MTT').toUpperCase();
  const preset = format === 'CASH' ? 'cash' : effStack <= 15 ? 'shortStack' : 'mtt';
  if (format !== 'CASH' && format !== 'MTT') {
    warnings.push(`Unknown format "${hand.format}" — treated as MTT.`);
  }

  if (heroSeat !== 'BTN' && heroSeat !== 'BB' && heroSeat !== 'SB') {
    warnings.push(`Non-heads-up seat "${heroSeat}" — using BTN/BB blind defaults for the solve.`);
  }

  // The solver works on ranges, not Hero's exact two cards; be explicit about it.
  warnings.push(
    'This is range-level analysis (the solver re-solves the decision spot for the whole range, not just your two cards).'
  );

  const input = {
    hero: 'hero',
    villain: 'villain',
    positions: { hero: heroSeat, villain: villainSeat },
    effectiveStackBB: effStack,
    ranges,
    preflopActions: preflop,
    actions: postflop,
    board,
    blinds: hand.blinds || { sb: 0.5, bb: 1 },
    thresholdPreset: preset
  };

  return {
    input,
    warnings,
    meta: {
      heroCards,
      villainCards,
      board,
      effStack,
      heroSeat,
      villainSeat,
      preset,
      preflopActionCount: preflop.length,
      postflopActionCount: postflop.length
    }
  };
}

// Stable, order-insensitive content key for a saved hand (used for caching). The
// analyzer's own input normalizes suits, so we key from the normalized cards +
// seats + eff stack + actions, which is exactly what determines the solve.
export function handContentKey(hand = {}, options = {}) {
  const adapted = adaptPokerSwipeHand(hand, options);
  const input = adapted.input;
  const flat = JSON.stringify({
    seats: [input.positions.hero, input.positions.villain],
    effStack: input.effectiveStackBB,
    ranges: options && options.ranges ? options.ranges : input.ranges,
    preflop: input.preflopActions,
    actions: input.actions,
    board: input.board,
    preset: input.thresholdPreset
  });
  return stableHash(flat);
}

// Small FNV-1a hash → hex string (stable, dependency-free, browser-safe).
export function stableHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}