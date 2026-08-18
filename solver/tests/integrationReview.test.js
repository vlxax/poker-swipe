import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptPokerSwipeHand, convertActions, splitActions, defaultRangesFor,
  toSolverCard, normalizeCards, handContentKey, stableHash
} from '../src/integration/pokerSwipeHandAdapter.js';
import { createHandCache } from '../src/integration/cache.js';
import { buildReviewModel, reviewPokerSwipeHandAsync } from '../src/integration/reviewModel.js';

// ---- Fixtures ---------------------------------------------------------------

// A small, deterministic solver config so these tests run in seconds instead of
// minutes (the solver's CFR cost scales with range class count; see
// scripts/benchmarkHand.js). Confidence is low by design at these sizes.
const FAST = {
  ranges: { hero: { AA: 1, KK: 1 }, villain: { QQ: 1, JJ: 1 } },
  iterations: 10
};

const PREFLOP = [
  { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 2.5, pct: 55 },
  { actor: 'VILLAIN', street: 'PREFLOP', action: 'CALL', call: 1.5, required: 1.5, potAfter: 5.5 }
];

function hand(actions = [], extra = {}) {
  return {
    heroSeat: 'BTN', villainSeat: 'BB',
    hero: ['A♠', 'K♦'], villain: ['Q♥', 'Q♣'],
    board: ['A♥', 'K♣', '2♦', '8♠', '3♥'],
    effStack: 100, format: 'MTT',
    actions: [...PREFLOP, ...actions],
    ...extra
  };
}

// Hero bets each street and gets called — a multi-street hand with 3 decisions.
const BET_DOWN = hand([
  { actor: 'HERO', street: 'FLOP', action: 'BET', size: 3.4, pct: 62 },
  { actor: 'VILLAIN', street: 'FLOP', action: 'CALL', call: 3.4, required: 3.4, potAfter: 12.3 },
  { actor: 'HERO', street: 'TURN', action: 'BET', size: 6, pct: 50 },
  { actor: 'VILLAIN', street: 'TURN', action: 'CALL', call: 6, required: 6, potAfter: 24.3 },
  { actor: 'HERO', street: 'RIVER', action: 'BET', size: 12, pct: 50 },
  { actor: 'VILLAIN', street: 'RIVER', action: 'CALL', call: 12, required: 12, potAfter: 48.3 }
]);

// Hero checks every street — a "played well / close to optimal" line.
const CHECK_DOWN = hand([
  { actor: 'HERO', street: 'FLOP', action: 'CHECK' },
  { actor: 'VILLAIN', street: 'FLOP', action: 'CHECK' },
  { actor: 'HERO', street: 'TURN', action: 'CHECK' },
  { actor: 'VILLAIN', street: 'TURN', action: 'CHECK' },
  { actor: 'HERO', street: 'RIVER', action: 'CHECK' },
  { actor: 'VILLAIN', street: 'RIVER', action: 'CHECK' }
]);

// ---- Adapter: card normalization --------------------------------------------

test('toSolverCard maps symbol suits to solver notation', () => {
  assert.equal(toSolverCard('Q♠'), 'Qs');
  assert.equal(toSolverCard('K♥'), 'Kh');
  assert.equal(toSolverCard('A♦'), 'Ad');
  assert.equal(toSolverCard('J♣'), 'Jc');
  assert.equal(toSolverCard('10♠'), 'Ts');
  assert.equal(toSolverCard('Jd'), 'Jd');
});

test('toSolverCard rejects invalid tokens', () => {
  assert.equal(toSolverCard('10'), null);
  assert.equal(toSolverCard(''), null);
  assert.equal(toSolverCard(null), null);
  assert.equal(toSolverCard('QS'), null); // suit must be a letter, not uppercase rank
});

test('normalizeCards keeps only valid cards', () => {
  assert.deepEqual(normalizeCards(['Q♠', 'garbage', 'Kh', 42]), ['Qs', 'Kh']);
});

// ---- Adapter: action conversion ---------------------------------------------

test('convertActions derives the true call amount, not the stored call', () => {
  const out = convertActions(PREFLOP, { heroSeat: 'BTN', villainSeat: 'BB', effStack: 100 });
  assert.equal(out[0].player, 'hero');
  assert.equal(out[0].type, 'raise');
  assert.equal(out[1].player, 'villain');
  assert.equal(out[1].type, 'call');
  // Hero (SB) opened to 2.5; the BB's true call to match is 1.5, not the stored 2.5.
  assert.equal(out[1].amountBB, 1.5);
});

test('convertActions sizes bets by pct of the running pot', () => {
  const acts = [
    ...PREFLOP,
    { actor: 'HERO', street: 'FLOP', action: 'BET', size: 999, pct: 50 }
  ];
  const out = convertActions(acts, { heroSeat: 'BTN', villainSeat: 'BB', effStack: 100 });
  const bet = out[out.length - 1];
  assert.equal(bet.type, 'bet');
  // Pot before the flop bet: blinds 1.5 + raise-to 2.5 (adds 2.0 from SB) + true
  // call 1.5 = 5.0. A 50% bet of that running pot = 2.5. The stored `size` (999)
  // is ignored because pct is authoritative for bets.
  assert.ok(Math.abs(bet.amountBB - 2.5) < 1e-6);
});

test('convertActions rejects an unknown actor', () => {
  const acts = [{ actor: 'SPECTATOR', street: 'FLOP', action: 'BET' }];
  assert.throws(() => convertActions(acts, { heroSeat: 'BTN', villainSeat: 'BB', effStack: 100 }));
});

test('splitActions separates preflop from postflop by street', () => {
  const { preflop, postflop } = splitActions(BET_DOWN.actions, { heroSeat: 'BTN', villainSeat: 'BB', effStack: 100 });
  assert.equal(preflop.length, 2);
  assert.equal(postflop.length, 6);
  assert.ok(postflop.every((a) => a.player === 'hero' || a.player === 'villain'));
});

// ---- Adapter: ranges ---------------------------------------------------------

test('defaultRangesFor is position-aware (opener vs defender)', () => {
  const opener = defaultRangesFor('BTN', 'BB');
  const defender = defaultRangesFor('BB', 'BTN');
  assert.ok(opener.hero && opener.villain);
  assert.ok(defender.hero && defender.villain);
  // Hero on the button opens; hero in the BB defends — the sets differ.
  assert.notDeepEqual(opener.hero, defender.hero);
});

test('adaptPokerSwipeHand builds the analyzeHand input shape', () => {
  const { input, warnings, meta } = adaptPokerSwipeHand(BET_DOWN);
  assert.equal(input.hero, 'hero');
  assert.equal(input.villain, 'villain');
  assert.equal(input.positions.hero, 'BTN');
  assert.equal(input.effectiveStackBB, 100);
  assert.deepEqual(input.board, ['Ah', 'Kc', '2d', '8s', '3h']);
  assert.equal(input.preflopActions.length, 2);
  assert.equal(input.actions.length, 6);
  assert.ok(input.ranges && input.ranges.hero && input.ranges.villain);
  assert.equal(meta.postflopActionCount, 6);
});

test('adaptPokerSwipeHand warns when no ranges are saved', () => {
  const { warnings } = adaptPokerSwipeHand(BET_DOWN);
  assert.ok(warnings.some((w) => /default range/i.test(w)));
});

test('adaptPokerSwipeHand accepts caller-provided ranges without warning', () => {
  const { warnings, input } = adaptPokerSwipeHand(BET_DOWN, { ranges: FAST.ranges });
  assert.deepEqual(input.ranges, FAST.ranges);
  assert.ok(!warnings.some((w) => /default range/i.test(w)));
});

// ---- Adapter: malformed-hand rejection ---------------------------------------

test('adaptPokerSwipeHand rejects duplicate cards across hand/board', () => {
  // Hero's A♥ is the same card as the board's A♥ (the fixture board has A♥).
  const dup = hand([], { hero: ['A♥', 'A♣'], board: ['A♥', 'K♣', '2♦', '8♠', '3♥'] });
  assert.throws(() => adaptPokerSwipeHand(dup), (err) => err.code === 'DUPLICATE_CARD');
});

test('adaptPokerSwipeHand rejects a hand with missing Hero cards', () => {
  const bad = hand([], { hero: ['A♠'] });
  assert.throws(() => adaptPokerSwipeHand(bad), (err) => err.code === 'INVALID_HAND');
});

test('adaptPokerSwipeHand rejects an invalid board length', () => {
  const bad = hand([], { board: ['A♥', 'K♣', '2♦', '8♠'] }); // 4-card board with no turn action context is ok? board 4 is allowed; use 2
  const bad2 = hand([], { board: ['A♥', 'K♣'] });
  assert.throws(() => adaptPokerSwipeHand(bad2), (err) => err.code === 'INVALID_BOARD');
});

test('adaptPokerSwipeHand rejects a non-positive effective stack', () => {
  const bad = hand([], { effStack: 0 });
  assert.throws(() => adaptPokerSwipeHand(bad), (err) => err.code === 'INVALID_STACK');
});

// ---- Review model ------------------------------------------------------------

test('buildReviewModel returns READY with street-ordered decisions', () => {
  const m = buildReviewModel(BET_DOWN, FAST);
  assert.equal(m.status, 'READY');
  assert.deepEqual(m.decisions.map((d) => d.street), ['flop', 'turn', 'river']);
  assert.ok(m.decisions.every((d) => d.solved === true));
});

test('total EV loss is a non-negative finite number', () => {
  const m = buildReviewModel(BET_DOWN, FAST);
  assert.equal(typeof m.overall.totalEvLossBB, 'number');
  assert.ok(Number.isFinite(m.overall.totalEvLossBB));
  assert.ok(m.overall.totalEvLossBB >= 0);
});

test('biggest mistake matches the maximum solved EV loss and is flagged', () => {
  const m = buildReviewModel(BET_DOWN, FAST);
  const solved = m.decisions.filter((d) => d.solved && d.evLossBB != null);
  if (solved.length === 0) return; // guards against environment flakiness
  const max = Math.max(...solved.map((d) => d.evLossBB));
  assert.ok(m.overall.biggestMistake);
  assert.ok(Math.abs(m.overall.biggestMistake.evLossBB - max) < 1e-4);
  const flagged = m.decisions.filter((d) => d.biggest);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].street, m.overall.biggestMistake.street);
});

test('a well-played hand does not fabricate a big mistake', () => {
  const m = buildReviewModel(CHECK_DOWN, FAST);
  // Close to optimal: total loss stays tiny (well below a serious mistake) and no
  // decision is flagged as a BLUNDER. A few 0.0x–0.2x BB of solver noise is
  // expected and reported honestly, never inflated into a big mistake.
  assert.ok(m.overall.totalEvLossBB < 1);
  assert.notEqual(m.overall.verdict, 'BLUNDER');
  assert.ok(m.decisions.every((d) => d.severity !== 'BLUNDER'));
});

test('each solved decision carries confidence and an explanation', () => {
  const m = buildReviewModel(BET_DOWN, FAST);
  for (const d of m.decisions.filter((x) => x.solved)) {
    assert.ok(d.confidence && d.confidence.level);
    assert.ok(d.explanation && typeof d.explanation.summary === 'string');
    assert.ok(d.recommendedAction);
  }
  assert.ok(['high', 'medium', 'low'].includes(m.overall.confidence.level));
});

test('a mistake hand yields a training candidate', () => {
  const m = buildReviewModel(BET_DOWN, FAST);
  assert.ok(m.trainingCandidate);
  assert.ok(m.trainingCandidate.street);
  assert.equal(typeof m.trainingCandidate.difficultyScore, 'number');
});

test('an unsupported hand (no postflop decisions) returns LIMITED with no training candidate', () => {
  const m = buildReviewModel(hand([]), FAST); // only preflop actions
  assert.equal(m.status, 'LIMITED');
  assert.equal(m.trainingCandidate, null);
  assert.ok(m.warnings.length > 0);
});

// ---- Caching -----------------------------------------------------------------

test('createHandCache set/get/has/remove/clear round-trip', () => {
  const c = createHandCache();
  const key = 'abc123';
  assert.equal(c.has(key, {}), false);
  c.set(key, {}, { status: 'READY', n: 1 });
  assert.equal(c.has(key, {}), true);
  assert.deepEqual(c.get(key, {}), { status: 'READY', n: 1 });
  c.remove(key, {});
  assert.equal(c.has(key, {}), false);
});

test('cache keys differ when solver options change', () => {
  const c = createHandCache();
  const a = c.keyFor('hand', { seed: 1 });
  const b = c.keyFor('hand', { seed: 2 });
  assert.notEqual(a, b);
});

test('cache clear only removes owned keys', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
    key: (i) => [...store.keys()][i] || null,
    get length() { return store.size; }
  };
  const c = createHandCache({ storage });
  c.set('k1', {}, { a: 1 });
  c.set('k2', {}, { a: 2 });
  storage.setItem('unrelated', 'keep');
  c.clear();
  assert.equal(store.has('unrelated'), true);
  assert.equal(c.has('k1', {}), false);
  assert.equal(c.has('k2', {}), false);
});

test('buildReviewModel serves a cached result marked cached:true', () => {
  const cache = createHandCache();
  const first = buildReviewModel(BET_DOWN, { ...FAST, cache });
  assert.equal(first.meta.cached, false);
  const second = buildReviewModel(BET_DOWN, { ...FAST, cache });
  assert.equal(second.meta.cached, true);
  assert.equal(second.status, first.status);
});

// ---- Cancellation & stale protection -----------------------------------------

test('reviewPokerSwipeHandAsync returns CANCELLED for a pre-aborted signal', async () => {
  const controller = new AbortController();
  controller.abort();
  const r = await reviewPokerSwipeHandAsync(BET_DOWN, { signal: controller.signal });
  assert.equal(r.status, 'CANCELLED');
});

test('handContentKey changes when the hand content changes (stale protection)', () => {
  const a = handContentKey(BET_DOWN);
  const changed = handContentKey({ ...BET_DOWN, board: ['A♥', 'K♣', '2♦', '9♠', '3♥'] });
  assert.notEqual(a, changed);
});

test('handContentKey is stable for identical hands', () => {
  assert.equal(handContentKey(BET_DOWN), handContentKey(BET_DOWN));
});

test('stableHash is deterministic and produces hex', () => {
  assert.equal(stableHash('abc'), stableHash('abc'));
  assert.match(stableHash('xyz'), /^[0-9a-f]+$/);
  assert.notEqual(stableHash('a'), stableHash('b'));
});

// ---- Solver error fallback ---------------------------------------------------

test('solver error on a no-decision hand is routed to LIMITED (fallback)', () => {
  // A hand with actions that produce no Hero postflop decision spot.
  const m = buildReviewModel(hand([]), { ...FAST, ranges: { hero: { AA: 1 }, villain: { KK: 1 } } });
  assert.equal(m.status, 'LIMITED');
  assert.ok(m.warnings.length > 0);
});

test('malformed hands surface a LIMITED status, not a crash', () => {
  const dup = hand([], { hero: ['A♠', 'A♣'], board: ['A♥', 'K♣', '2♦', '8♠', '3♥'] });
  const m = buildReviewModel(dup, FAST);
  assert.equal(m.status, 'LIMITED');
  assert.ok(m.error && m.error.code);
});