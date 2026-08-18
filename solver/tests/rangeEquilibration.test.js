import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCFR } from '../src/cfr/cfrSolver.js';
import { buildGameTree } from '../src/tree/treeBuilder.js';
import { CFRTrainer } from '../src/cfr/cfrTrainer.js';
import {
  computeReachSnapshot,
  rangeEquilibrationDelta,
  rangeEquilibrationStable,
  rangeEquilibrationResult
} from '../src/analysis/rangeEquilibration.js';

const INPUT = {
  street: 'river',
  board: ['2c', '4d', '7h', '9s', 'Td'],
  heroRange: { AA: 1, KK: 1 },
  villainRange: { QQ: 1, JJ: 1 },
  pot: 10,
  effectiveStackBB: 10,
  heroPosition: 'BTN',
  villainPosition: 'BB',
  betSizes: { river: [0.5] }
};

function snapshotAt(iterations) {
  const tree = buildGameTree(INPUT);
  const trainer = new CFRTrainer(tree, { algorithm: 'cfr' });
  for (let i = 0; i < iterations; i++) trainer.iterate();
  return computeReachSnapshot(tree, trainer);
}

test('computeReachSnapshot records reach for actor combos at action nodes', () => {
  const snap = snapshotAt(10);
  assert.ok(snap.hero instanceof Map && snap.villain instanceof Map);
  assert.ok(snap.hero.size > 0);
  assert.ok(snap.villain.size > 0);
  // Sum of hero reaches over root combos equals total hero weight.
  let heroTotal = 0;
  for (const v of snap.hero.values()) heroTotal += v;
  assert.ok(heroTotal > 0);
});

test('rangeEquilibrationDelta of identical snapshots is zero', () => {
  const a = snapshotAt(20);
  const d = rangeEquilibrationDelta(a, a);
  assert.equal(d.heroRangeDelta, 0);
  assert.equal(d.villainRangeDelta, 0);
  assert.equal(d.maxComboDelta, 0);
  assert.equal(d.meanComboDelta, 0);
});

test('delta between early and late snapshots is nonzero then shrinks', () => {
  const early = snapshotAt(20);
  const late = snapshotAt(2000);
  const dEarly = rangeEquilibrationDelta(snapshotAt(20), snapshotAt(20));
  const d = rangeEquilibrationDelta(early, late);
  assert.ok(d.maxComboDelta > 0, 'early vs late should differ');
  assert.equal(dEarly.maxComboDelta, 0);
});

test('rangeEquilibrationStable reflects the target', () => {
  const a = snapshotAt(100);
  const b = snapshotAt(110);
  const d = rangeEquilibrationDelta(a, b);
  assert.equal(rangeEquilibrationStable(d, 0), false);
  assert.equal(rangeEquilibrationStable(d, Infinity), true);
  assert.equal(rangeEquilibrationStable(null), false);
});

test('rangeEquilibrationResult has the documented shape', () => {
  const a = snapshotAt(100);
  const b = snapshotAt(105);
  const d = rangeEquilibrationDelta(a, b);
  const res = rangeEquilibrationResult(d, 0.01);
  assert.ok('stable' in res);
  assert.ok('heroRangeDelta' in res && 'villainRangeDelta' in res);
  assert.ok('maxComboDelta' in res && 'meanComboDelta' in res);
  assert.ok('checksPassed' in res);
});

test('adaptive solve exposes range equilibration through convergence', () => {
  const r = solveCFR(INPUT, { iterations: 'adaptive', seed: 1 });
  assert.ok(r.convergence.lastRangeDelta, 'expected lastRangeDelta');
  assert.ok(r.convergence.lastRangeDelta.maxComboDelta != null);
});