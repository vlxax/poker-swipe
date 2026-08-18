// Personalised drill generator. Given a normalised candidate (a concrete
// analysed mistake), it builds a NEW decision spot on the same street/concept —
// varied board, hero combo and stack bucket — re-solves it, validates it, and
// produces a self-contained drill model. It never ships an unvalidated spot and
// never fabricates an EV the solver did not produce.
//
// `solve` is injected so the deterministic logic is unit-testable without a CFR
// run; the browser wires it to `analyzeHand` (via the adapter). `generateDrill`
// is synchronous; the async/cancellable orchestration lives in
// personalizedTraining.js.

import { adaptPokerSwipeHand, defaultRangesFor, stableHash } from '../integration/pokerSwipeHandAdapter.js';
import { boardLengthForStreet } from '../game/street.js';
import { leakLabelRu } from './concepts.js';
import { validateDrillDecision } from './drillValidator.js';

// ---- Card dealing ------------------------------------------------------------

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['s', 'h', 'd', 'c'];

function fullDeck() {
  const out = [];
  for (const r of RANKS) for (const s of SUITS) out.push(r + s);
  return out;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// Deal hero/villain hole cards and the board for a street, excluding any cards
// that must not collide (e.g. the source board). Deterministic when rng is.
export function dealCards({ heroCount = 2, villainCount = 2, boardCount = 3, exclude = [], rng = Math.random } = {}) {
  const ex = new Set(exclude);
  const pool = shuffle(fullDeck().filter((c) => !ex.has(c)), rng);
  let i = 0;
  const hero = pool.slice(i, (i += heroCount));
  const villain = pool.slice(i, (i += villainCount));
  const board = pool.slice(i, (i += boardCount));
  return { hero, villain, board };
}

// A fresh variant for a candidate: same street + stack, new board and combos.
export function nextVariant({ candidate, rng = Math.random, keepHeroCards = false } = {}) {
  const street = candidate && candidate.street ? candidate.street : 'flop';
  const need = boardLengthForStreet(street);
  const exclude = candidate && candidate.board ? candidate.board : [];
  const deal = dealCards({ heroCount: 2, villainCount: 2, boardCount: need, exclude, rng });
  return {
    street,
    board: deal.board,
    heroCards: keepHeroCards && candidate.heroCards && candidate.heroCards.length ? candidate.heroCards : deal.hero,
    villainCards: deal.villain,
    effectiveStackBb: candidate && candidate.effectiveStackBb != null ? candidate.effectiveStackBb : 100
  };
}

// ---- Scenario construction ---------------------------------------------------

// The preflop seed used to reach a postflop decision (hero raises, BB calls).
const PREFLOP_BUILDER = [
  { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 2.5, pct: 55 },
  { actor: 'VILLAIN', street: 'PREFLOP', action: 'CALL', call: 1.5, required: 1.5, potAfter: 5.5 }
];

// Minimal betting history that reaches each street with Hero to act, building a
// realistic pot (so SPR stays sane and the spot is not trivial). Bets use `pct`
// (authoritative in the adapter).
function pipelineFor(street) {
  if (street === 'flop') {
    return [{ actor: 'HERO', street: 'FLOP', action: 'BET', pct: 50 }];
  }
  if (street === 'turn') {
    return [
      { actor: 'HERO', street: 'FLOP', action: 'BET', pct: 50 },
      { actor: 'VILLAIN', street: 'FLOP', action: 'CALL', call: 2.5 },
      { actor: 'HERO', street: 'TURN', action: 'CHECK' }
    ];
  }
  // river
  return [
    { actor: 'HERO', street: 'FLOP', action: 'BET', pct: 50 },
    { actor: 'VILLAIN', street: 'FLOP', action: 'CALL', call: 2.5 },
    { actor: 'HERO', street: 'TURN', action: 'BET', pct: 50 },
    { actor: 'VILLAIN', street: 'TURN', action: 'CALL', call: 5.5 },
    { actor: 'HERO', street: 'RIVER', action: 'CHECK' }
  ];
}

// Build the analyzeHand input for a decision spot on the target street. Ranges
// come from the candidate positions (or an explicit override).
export function buildScenarioInput({
  candidate,
  street,
  board,
  heroCards,
  villainCards,
  effectiveStackBb,
  ranges,
  heroSeat,
  villainSeat
} = {}) {
  const hSeat = heroSeat || (candidate.positions && candidate.positions.hero) || 'BTN';
  const vSeat = villainSeat || (candidate.positions && candidate.positions.villain) || 'BB';
  const streetName = street || candidate.street || 'flop';
  const boardFor = (board || candidate.board || []).slice(0, boardLengthForStreet(streetName));
  const eff = effectiveStackBb != null
    ? effectiveStackBb
    : candidate.effectiveStackBb != null ? candidate.effectiveStackBb : 100;

  const hand = {
    heroSeat: hSeat,
    villainSeat: vSeat,
    hero: heroCards || candidate.heroCards || [],
    villain: villainCards || [],
    board: boardFor,
    effStack: eff,
    format: 'MTT',
    actions: [...PREFLOP_BUILDER, ...pipelineFor(streetName)]
  };
  const { input } = adaptPokerSwipeHand(hand, ranges ? { ranges } : {});
  return input;
}

// ---- Difficulty (requirement 9): 1..5 ----------------------------------------

const BLOCKER_SENSITIVE = new Set([
  'bluff', 'bluff_catch', 'blocker_selection', 'blocker_usage', 'thin_value', 'overbet'
]);

export function classifyDifficulty({
  evSpreadBb = null,
  recommendedFrequency = null,
  plausibleActions = 0,
  confidence = null,
  concept = null
} = {}) {
  let d = 1;
  // Smaller EV gap between the best line and the alternatives is harder to read.
  if (evSpreadBb != null && evSpreadBb < 0.1) d += 1;
  const mixed = recommendedFrequency != null && recommendedFrequency > 0.2 && recommendedFrequency < 0.8;
  if (mixed) d += 1;
  if (plausibleActions > 3) d += 1;
  if (confidence != null && confidence < 0.6) d += 1;
  if (concept && BLOCKER_SENSITIVE.has(concept)) d += 1;
  return clamp(Math.round(d), 1, 5);
}

// ---- Drill model -------------------------------------------------------------

// Russian label for a legal action option.
export function actionLabelRu(action = {}) {
  switch (action.type) {
    case 'check': return 'Чек';
    case 'fold': return 'Фолд';
    case 'call': return 'Колл';
    case 'all_in': return 'Олл-ин';
    case 'bet':
      return action.sizePot != null ? `Ставка ${Math.round(action.sizePot * 100)}% пота` : 'Ставка';
    case 'raise':
      return action.sizePot != null ? `Рейз ${Math.round(action.sizePot * 100)}%` : 'Рейз';
    default: return action.type || '—';
  }
}

// Assemble a drill model from a validated solved decision.
export function buildDrillModel({ candidate, decision, street, variant }) {
  const legal = (decision.legalActions || []).map((a) => ({
    id: a.id,
    action: a.action || null,
    evBB: a.evBB,
    frequency: a.frequency,
    labelRu: actionLabelRu(a.action)
  }));
  const actionEVs = {};
  for (const a of legal) actionEVs[a.id] = a.evBB;

  const evs = legal.map((a) => a.evBB).filter((n) => Number.isFinite(n));
  const evSpreadBb = evs.length > 1 ? Math.max(...evs) - Math.min(...evs) : null;
  const plausible = legal.filter((a) => a.action && a.action.type !== 'fold').length;

  const difficulty = classifyDifficulty({
    evSpreadBb,
    recommendedFrequency: decision.recommendedFrequency,
    plausibleActions: plausible,
    confidence: decision.confidence ? decision.confidence.score : null,
    concept: candidate.concept
  });

  const recommendedAction = decision.recommendedAction || null;
  const recommendedSizeBb = recommendedAction && recommendedAction.amountBB != null
    ? recommendedAction.amountBB
    : recommendedAction && recommendedAction.type === 'bet' && decision.potBB != null
      ? decision.potBB * (recommendedAction.sizePot || 0) : null;

  const drillId = stableHash([
    candidate.concept,
    street,
    (variant && variant.board || []).join(','),
    (variant && variant.heroCards || []).join(','),
    recommendedAction ? recommendedAction.type : '',
    decision.potBB != null ? decision.potBB : ''
  ].join('|'));

  return {
    drillId,
    sourceCandidateId: candidate.id,
    concept: candidate.concept,
    street,
    difficulty,
    scenario: {
      heroPosition: (variant && variant.heroSeat) || (candidate.positions && candidate.positions.hero) || 'BTN',
      villainPosition: (variant && variant.villainSeat) || (candidate.positions && candidate.positions.villain) || 'BB',
      effectiveStackBb: (variant && variant.effectiveStackBb != null)
        ? variant.effectiveStackBb : candidate.effectiveStackBb,
      potBb: decision.potBB != null ? decision.potBB : null,
      board: street ? (variant && variant.board || []).slice(0, boardLengthForStreet(street)) : [],
      heroCards: variant && variant.heroCards ? variant.heroCards : candidate.heroCards || [],
      heroCardsHidden: true // range-level training: do not bias the answer
    },
    options: legal.map((a) => ({ id: a.id, action: a.action, labelRu: a.labelRu })),
    solution: {
      recommendedAction,
      recommendedSizeBb,
      recommendedFrequency: decision.recommendedFrequency,
      bestEV: decision.bestEV,
      actionEVs,
      evSpreadBb,
      confidence: decision.confidence
    },
    explanation: {
      keyConcept: candidate.concept,
      conceptLabelRu: leakLabelRu(candidate.concept),
      promptRu: `Ваш ход на ${streetLabelRu(street)}. Выберите линию, которую считаете лучшей.`
    },
    metadata: {
      analyzerVersion: candidate.solverMetadata && candidate.solverMetadata.analyzerVersion,
      sourceDecisionId: candidate.sourceDecisionId,
      generatedAt: variant && variant.now ? variant.now : null
    }
  };
}

// ---- Generation --------------------------------------------------------------

export function generateDrill({
  candidate,
  ranges,
  solve,
  solveOpts = {},
  variant,
  rng = Math.random,
  keepHeroCards = false
} = {}) {
  if (!candidate) return { ok: false, reason: 'no_candidate' };
  if (typeof solve !== 'function') return { ok: false, reason: 'no_solve' };

  const v = variant || nextVariant({ candidate, rng, keepHeroCards });
  const rangeOpts = ranges || (candidate.positions
    ? defaultRangesFor(candidate.positions.hero || 'BTN', candidate.positions.villain || 'BB')
    : null);

  let input;
  try {
    input = buildScenarioInput({ candidate, ...v, ranges: rangeOpts });
  } catch (err) {
    return { ok: false, reason: 'scenario_error', error: String(err && err.message || err) };
  }

  let raw;
  try {
    raw = solve(input, solveOpts);
  } catch (err) {
    return { ok: false, reason: 'solve_error', error: String(err && err.message || err) };
  }

  const street = v.street || candidate.street || 'flop';
  const decisions = (raw && raw.decisions) || [];
  const decision = decisions.find((d) => d.solved && d.street === street) || decisions.find((d) => d.solved);
  if (!decision) return { ok: false, reason: 'no_solved_decision', raw };

  const check = validateDrillDecision(decision);
  if (!check.ok) return { ok: false, reason: check.reason, decision, raw };

  const drill = buildDrillModel({ candidate, decision, street, variant: v });
  return { ok: true, drill, decision };
}

function streetLabelRu(s) {
  return ({ preflop: 'префлопе', flop: 'флопе', turn: 'тёрне', river: 'ривере' })[s] || s;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n, d) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}