// Reconstructs the betting flow of a played heads-up NLH hand into a sequence of
// Hero decision spots plus terminal info, purely from the recorded actions. No
// UI, no RNG — deterministic. Each spot captures the exact pot, effective stack
// and committed split (including any outstanding bet Hero faces) so the solver
// can re-solve that decision in isolation.
//
// Streets are advanced when a betting round closes (both players matched, or a
// fold/all-in terminal) and more board cards are available. Preflop actions seed
// the pot; postflop Hero decisions are the ones analyzed.

import { boardLengthForStreet } from '../game/street.js';
import { SolverError } from '../api/errors.js';

const OTHER = { hero: 'villain', villain: 'hero' };

function otherPlayer(p) {
  return OTHER[p] || p;
}

// Normalize a single recorded action to { player, type, amountBB }.
function normalizeAction(action, ctx) {
  const player = ctx.toKey(action.player);
  const type = String(action.type || action.action || '').toLowerCase();
  if (!['fold', 'check', 'call', 'bet', 'raise', 'all_in'].includes(type)) {
    throw new SolverError('INVALID_ACTION', `unsupported action type: ${type}`);
  }
  const { committed, stack, pot, toCall } = ctx;
  let amountBB;
  if (action.amountBB != null) {
    amountBB = Number(action.amountBB);
  } else if (type === 'call') {
    amountBB = toCall;
  } else if (type === 'all_in') {
    amountBB = stack - committed[player];
  } else if (action.sizePot != null) {
    amountBB = Number(action.sizePot) * pot;
  } else if (action.size != null || action.raiseTo != null) {
    amountBB = Number(action.size != null ? action.size : action.raiseTo) - committed[player];
  } else {
    amountBB = 0;
  }
  if (!Number.isFinite(amountBB) || amountBB < 0) {
    throw new SolverError('INVALID_ACTION', `invalid amount for ${type} by ${player}`);
  }
  return { player, type, amountBB };
}

// Express a Hero action in the solver's abstraction space (type + sizePot). For a
// bet/raise we compute the pot fraction / raise multiplier so the action id maps
// onto a legal action in the built tree.
function heroActionFor(action, ctx) {
  const type = action.type;
  if (type === 'bet') {
    const sizePot = ctx.pot > 0 ? action.amountBB / ctx.pot : 0;
    return { type, sizePot: round(sizePot, 4) };
  }
  if (type === 'raise') {
    const mult = ctx.toCall > 0 ? action.amountBB / ctx.toCall : 1;
    return { type, sizePot: round(mult, 4) };
  }
  return { type };
}

// Determine who posts the blinds from the positions (mirrors preflop blind logic).
function blindAssignment(heroPosition, villainPosition) {
  const h = String(heroPosition || '').toUpperCase();
  const v = String(villainPosition || '').toUpperCase();
  if (v === 'BB') return { sbKey: 'hero', bbKey: 'villain' };
  if (h === 'BB') return { bbKey: 'hero', sbKey: 'villain' };
  return { sbKey: 'hero', bbKey: 'villain' };
}

// Replay a hand and return Hero decision spots + terminal info.
export function replayHand({
  hero = 'hero',
  villain = 'villain',
  heroPosition = 'BTN',
  villainPosition = 'BB',
  effectiveStackBB = 100,
  blinds = { sb: 0.5, bb: 1 },
  preflopActions = [],
  actions = [],
  board = []
} = {}) {
  if (!Array.isArray(preflopActions) || !Array.isArray(actions)) {
    throw new SolverError('INVALID_INPUT', 'preflopActions and actions must be arrays');
  }
  const stack = Number(effectiveStackBB);
  if (!Number.isFinite(stack) || stack <= 0) {
    throw new SolverError('INVALID_STACK', 'effectiveStackBB must be a positive number');
  }
  const sb = Number.isFinite(Number(blinds.sb)) && Number(blinds.sb) > 0 ? Number(blinds.sb) : 0.5;
  const bb = Number.isFinite(Number(blinds.bb)) && Number(blinds.bb) > 0 ? Number(blinds.bb) : 1;

  const toKey = (p) => {
    if (p === hero || p === 'hero') return 'hero';
    if (p === villain || p === 'villain') return 'villain';
    throw new SolverError('INVALID_ACTION', `unknown player: ${p}`);
  };

  let committed = { hero: 0, villain: 0 };
  let pot = 0;
  let street = 'preflop';
  let toCall = 0;
  let raisesThisStreet = 0;
  let actedThisStreet = new Set();
  const actionHistory = [];

  // Seed the blinds.
  const { sbKey, bbKey } = blindAssignment(heroPosition, villainPosition);
  committed[sbKey] = sb;
  committed[bbKey] = bb;
  pot = sb + bb;
  toCall = Math.max(0, bb - sb);
  actedThisStreet.add(sbKey);

  const decisions = [];
  let terminal = null;

  const closeStreet = () => {
    if (street === 'preflop') {
      street = 'flop';
    } else {
      const order = ['flop', 'turn', 'river'];
      const i = order.indexOf(street);
      street = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
    }
    raisesThisStreet = 0;
    actedThisStreet = new Set();
    toCall = 0;
  };

  const apply = (a) => {
    const player = a.player;
    const amount = Math.min(a.amountBB, Math.max(0, stack - committed[player]));
    committed[player] += amount;
    pot += amount;
    toCall = Math.max(0, committed[player] - committed[otherPlayer(player)]);
    actedThisStreet.add(player);
    actionHistory.push({ player, type: a.type, amountBB: round(amount, 4) });
    const allIn = stack - committed[player] <= 1e-9;
    const aggressive = ['bet', 'raise', 'all_in'].includes(a.type);
    if (aggressive) raisesThisStreet++;
    return allIn;
  };

  const process = (a) => {
    const ctx = { toKey, committed, stack, pot, toCall };
    const norm = normalizeAction(a, ctx);

    // Capture a Hero postflop decision BEFORE applying it.
    if (street !== 'preflop' && norm.player === 'hero') {
      const heroAction = heroActionFor(norm, ctx);
      decisions.push({
        index: decisions.length,
        street,
        board: boardFor(street),
        potBB: round(pot, 4),
        effectiveStackBB: stack,
        startingCommitted: { hero: round(committed.hero, 4), villain: round(committed.villain, 4) },
        toCall: round(toCall, 4),
        firstToAct: 'hero',
        heroAction,
        actionHistory: actionHistory.map((x) => ({ ...x }))
      });
    }

    if (norm.type === 'fold') {
      apply(norm);
      terminal = { type: 'fold', winner: otherPlayer(norm.player), street, pot: round(pot, 4) };
      return true;
    }

    const allIn = apply(norm);
    if (allIn) {
      // An all-in can end the hand only if the opponent cannot/does not respond
      // (no more stack to act). If the opponent still has chips and an action is
      // expected, the hand continues — the recorded timeline will tell us.
      const opponentCanAct = stack - committed[otherPlayer(norm.player)] > 1e-9;
      if (allIn && !opponentCanAct) {
        terminal = { type: 'all_in', street, pot: round(pot, 4) };
        return true;
      }
    }

    // Betting round closes when both players matched (no outstanding bet) and
    // both have acted this street. Then advance to the next street.
    if (toCall <= 1e-9 && actedThisStreet.size === 2) {
      if (street === 'preflop' || nextStreetAvailable(street)) {
        closeStreet();
      }
    }
    return false;
  };

  const boardFor = (s) => {
    return (board || []).slice(0, boardLengthForStreet(s));
  };

  const nextStreetAvailable = (s) => {
    // Advance only if a later street was actually dealt (board has more cards).
    return (board || []).length > boardLengthForStreet(s);
  };

  // Preflop actions first.
  for (const a of preflopActions) {
    const done = process(a);
    if (done) break;
  }

  // Postflop actions.
  if (!terminal) {
    // If no preflop round was recorded, assume the hand starts on the flop with
    // just the blinds committed. The blind gap (SB vs BB) is settled money already
    // in the pot, not an outstanding bet, so rebalance the committed split evenly
    // (pot unchanged) to keep later check-downs from stalling street advancement.
    if (preflopActions.length === 0 && street === 'preflop') {
      committed = { hero: round(pot / 2, 4), villain: round(pot / 2, 4) };
      closeStreet();
    }
    for (const a of actions) {
      const done = process(a);
      if (done) break;
    }
  }

  return {
    decisions,
    terminal,
    pot,
    committed: { hero: round(committed.hero, 4), villain: round(committed.villain, 4) },
    actionHistory
  };
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}