import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGameTree } from '../src/tree/treeBuilder.js';
import { solvePreflop, solveCFR } from '../src/cfr/cfrSolver.js';
import { preflopLegalActions, preflopApplyAction } from '../src/preflop/preflopActions.js';
import { SolverError } from '../src/api/errors.js';

const base = {
  street: 'preflop',
  heroRange: { AA: 1, KK: 1 },
  villainRange: { QQ: 1, JJ: 1 },
  effectiveStackBB: 100,
  heroPosition: 'BTN',
  villainPosition: 'BB'
};

// --- legal actions ---------------------------------------------------------

test('preflop first-to-act opener can fold/call/open/jam', () => {
  // BTN (SB) posts 0.5, BB posts 1; BTN faces 0.5 to call.
  const acts = preflopLegalActions({
    committed: { hero: 0.5, villain: 1 },
    stack: 100,
    playerToAct: 'hero',
    raisesThisStreet: 0,
    lastRaiseTo: 1,
    cfg: { betSizes: { preflop: [2.5, 3.0] }, raiseSizes: { preflop: [3.0] }, maxRaisesPerStreet: 1 }
  });
  const ids = acts.map((a) => a.id);
  assert.ok(ids.includes('fold'));
  assert.ok(ids.includes('call'));
  assert.ok(ids.includes('open_2.5'));
  assert.ok(ids.includes('open_3'));
  assert.ok(ids.includes('all_in'));
  const call = acts.find((a) => a.id === 'call');
  assert.equal(call.amountBB, 0.5);
  const open = acts.find((a) => a.id === 'open_3');
  assert.equal(open.semantic, 'open');
  assert.equal(open.sizeBB, 3);
});

test('preflop all-in call is the only call option when short', () => {
  const acts = preflopLegalActions({
    committed: { hero: 0.5, villain: 1 },
    stack: 0.9, // hero has only 0.4 left, less than the 0.5 to call
    playerToAct: 'hero',
    raisesThisStreet: 0,
    lastRaiseTo: 1,
    cfg: { betSizes: { preflop: [2.5, 3.0] }, raiseSizes: { preflop: [3.0] }, maxRaisesPerStreet: 1 }
  });
  const call = acts.find((a) => a.id === 'call');
  assert.equal(call.amountBB, 0.4);
  assert.equal(call.allIn, true);
  // no opens possible (hero can't reach an open size)
  assert.ok(!acts.some((a) => a.id.startsWith('open_')));
});

test('preflop 3bet uses raise multipliers on the last raise-to', () => {
  // BB facing a 2.5 open: hero to act with 3.5 to call.
  const acts = preflopLegalActions({
    committed: { hero: 2.5, villain: 1 },
    stack: 100,
    playerToAct: 'villain',
    raisesThisStreet: 1,
    lastRaiseTo: 2.5,
    cfg: { betSizes: { preflop: [2.5, 3.0] }, raiseSizes: { preflop: [3.0] }, maxRaisesPerStreet: 2 }
  });
  const raise = acts.find((a) => a.type === 'raise' && a.semantic === 'raise');
  assert.ok(raise);
  // 2.5 * 3.0 = 7.5 raise-to
  assert.equal(raise.sizeBB, 7.5);
});

// --- transition ------------------------------------------------------------

test('preflopApplyAction tracks lastRaiseTo and toCall for the opponent', () => {
  const next = preflopApplyAction(
    { playerToAct: 'hero', committed: { hero: 0.5, villain: 1 }, pot: 1.5, stack: 100, raisesThisStreet: 0, lastRaiseTo: 1 },
    { id: 'open_3', type: 'raise', amountBB: 2.5, sizeBB: 3, allIn: false, semantic: 'open' }
  );
  assert.equal(next.playerToAct, 'villain');
  assert.equal(next.toCall, 2); // 3 - 1 (absolute raise-to vs villain committed)
  assert.equal(next.raisesThisStreet, 1);
  assert.equal(next.lastRaiseTo, 3); // lastRaiseTo is the absolute raise-to
  assert.equal(next.pot, 4); // hero committed 3 + villain 1
});

// --- tree ------------------------------------------------------------------

test('preflop tree builds with a capped flop transition', () => {
  const tree = buildGameTree(base);
  const s = tree.summary();
  assert.ok(s.nodeCount > 0);
  assert.ok(tree.chanceNodes.some((n) => n.street === 'flop'));
  // Chance nodes hold arrays of dealt flop cards in the preflop transition.
  const flopChance = tree.chanceNodes.find((n) => n.street === 'flop' && n.board.length === 0);
  assert.ok(flopChance);
  assert.ok(Array.isArray(flopChance.chanceCards[0]));
  // Default chance cap bounds the number of flops.
  assert.ok(flopChance.chanceCards.length <= 4);
});

test('preflop tree exposes the blinds and correct root actor', () => {
  const tree = buildGameTree(base);
  assert.equal(tree.game.street, 'preflop');
  assert.deepEqual(tree.game.blinds, { sb: 0.5, bb: 1 });
  assert.equal(tree.root.playerToAct, 'hero'); // BTN posts SB, acts first
  assert.equal(tree.root.street, 'preflop');
});

test('preflop tree is deterministic across builds', () => {
  const a = buildGameTree(base).summary().nodeCount;
  const b = buildGameTree(base).summary().nodeCount;
  assert.equal(a, b);
});

test('preflop requires positions and derives the pot from blinds', () => {
  assert.throws(() => buildGameTree({ ...base, heroPosition: undefined }),
    (e) => e instanceof SolverError && e.code === 'MISSING_INPUT');
});

// --- solve ---------------------------------------------------------------

test('solvePreflop rejects a non-preflop street', () => {
  assert.throws(() => solvePreflop({ ...base, street: 'river' }),
    (e) => e instanceof SolverError && e.code === 'INVALID_CONFIG');
});

test('solvePreflop returns preflop game meta and bet-sizing abstraction', () => {
  const r = solvePreflop(base, { iterations: 5 });
  assert.equal(r.game.street, 'preflop');
  assert.equal(r.game.potBB, 1.5);
  assert.deepEqual(r.game.blinds, { sb: 0.5, bb: 1 });
  assert.equal(r.betSizingAbstraction.model, 'absolute_raise_to_bb');
  assert.ok(r.meta.preflopAbstraction === true);
  assert.ok(r.bestAction);
  assert.ok(Object.keys(r.actionEV).length > 0);
  assert.ok(r.convergence);
  assert.ok(r.exploitability);
});

test('solveCFR with street preflop behaves like solvePreflop', () => {
  const r = solveCFR({ ...base, street: 'preflop' }, { iterations: 5 });
  assert.equal(r.game.street, 'preflop');
});

test('preflop root strategy maps open actions by combo', () => {
  const r = solvePreflop(base, { iterations: 5 });
  const key = Object.keys(r.rootStrategy)[0];
  assert.ok(key);
  const ids = Object.keys(r.rootStrategy[key]);
  assert.ok(ids.some((id) => id.startsWith('open_')));
  const total = ids.reduce((s, id) => s + r.rootStrategy[key][id], 0);
  assert.ok(Math.abs(total - 1) < 1e-6);
});

test('preflop heroAction maps to an open_* id', () => {
  const r = solvePreflop({ ...base, heroAction: { type: 'raise', amountBB: 3 } }, { iterations: 5 });
  assert.equal(r.heroAction, 'open_3');
  assert.ok(Number.isFinite(r.heroEV));
});