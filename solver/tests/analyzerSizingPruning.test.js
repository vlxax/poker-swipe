import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBetSizingModel, pruneSizes, mergeNearDuplicates } from '../src/abstraction/betSizingModel.js';
import { buildGameTree } from '../src/tree/treeBuilder.js';

test('near-duplicate bet sizes are merged', () => {
  const merged = mergeNearDuplicates([0.5, 0.51, 0.75, 0.76], 0.05);
  assert.deepEqual(merged, [0.5, 0.75]);
});

test('sizes exceeding the remaining stack are pruned (all-in kept)', () => {
  const pruned = pruneSizes({ sizes: [0.25, 1.5, 3], pot: 10, stack: 10, maxPerNode: 4 });
  assert.ok(pruned.usedSizes.includes(0.25));
  // A 1.5x- and 3x-pot bet both exceed the remaining stack: they become all-ins
  // (first-class jam actions) rather than normal pot-sized bets.
  assert.ok(pruned.allInSizes.includes(1.5));
  assert.ok(pruned.allInSizes.includes(3));
});

test('buildBetSizingModel caps the number of sizes per node', () => {
  const model = buildBetSizingModel({
    street: 'flop', pot: 10, stack: 100,
    requestedBetSizes: [0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1.0, 1.5],
    maxBetSizesPerNode: 3
  });
  assert.ok(model.usedSizes.length <= 3);
});

test('game tree uses the pruned, deduplicated bet-sizing abstraction', () => {
  const model = buildBetSizingModel({
    street: 'flop', pot: 10, stack: 45,
    requestedBetSizes: [0.5, 0.52, 0.54, 0.99, 1.5],
    maxBetSizesPerNode: 3
  });
  const tree = buildGameTree({
    street: 'flop',
    board: ['As', 'Kd', '2h'],
    heroRange: { AA: 1 },
    villainRange: { KK: 1 },
    pot: 10,
    effectiveStackBB: 50,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    betSizes: { flop: model.usedSizes },
    maxChanceBranches: 1
  });
  const ids = tree.root.actions.map((a) => a.id);
  // Near-duplicates (0.52, 0.54) are merged and the set is capped to the model.
  const betIds = ids.filter((i) => i.startsWith('bet_'));
  assert.ok(betIds.length >= 1);
  assert.ok(betIds.length <= 3);
  assert.equal(new Set(betIds).size, betIds.length);
});

test('tree honors a facing-bet root with startingCommitted', () => {
  const tree = buildGameTree({
    street: 'flop',
    board: ['As', 'Kd', '2h'],
    heroRange: { AA: 1 },
    villainRange: { KK: 1 },
    pot: 12,
    effectiveStackBB: 50,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    startingCommitted: { hero: 5, villain: 7 },
    firstToAct: 'hero',
    maxChanceBranches: 1
  });
  const root = tree.root;
  assert.equal(root.playerToAct, 'hero');
  const ids = root.actions.map((a) => a.id);
  assert.ok(ids.includes('fold'));
  assert.ok(ids.includes('call'));
});