import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConvergenceTracker } from '../src/cfr/convergence.js';
import { InformationSetMap } from '../src/tree/informationSetMap.js';

function fakeInfos() {
  const map = new InformationSetMap();
  const store = map.get('node:n1', ['check', 'bet']);
  store.strategySum['As,Ad'] = { check: 3, bet: 7 };
  return map;
}

test('tracks samples only on the sampleEvery boundary', () => {
  const tracker = new ConvergenceTracker({ sampleEvery: 10 });
  const infos = fakeInfos();
  for (let i = 1; i <= 50; i++) {
    tracker.maybeRecord(i, infos);
  }
  assert.equal(tracker.history.length, 5);
});

test('does not record when sampleEvery is non-positive', () => {
  const tracker = new ConvergenceTracker({ sampleEvery: 0 });
  tracker.maybeRecord(5, fakeInfos());
  assert.equal(tracker.history.length, 0);
});

test('finalStatus is early with no samples', () => {
  const tracker = new ConvergenceTracker({ sampleEvery: 10 });
  const status = tracker.finalStatus();
  assert.equal(status.status, 'early');
  assert.equal(status.samples, 0);
});

test('first recorded sample has a null delta', () => {
  const tracker = new ConvergenceTracker({ sampleEvery: 5 });
  tracker.maybeRecord(5, fakeInfos());
  assert.equal(tracker.history[0].delta, null);
});

test('subsequent samples report a finite delta', () => {
  const tracker = new ConvergenceTracker({ sampleEvery: 5 });
  const infos = fakeInfos();
  tracker.maybeRecord(5, infos);
  tracker.maybeRecord(10, infos);
  const last = tracker.history[tracker.history.length - 1];
  assert.equal(last.delta, 0); // identical snapshots -> zero delta
  assert.ok(Number.isFinite(last.delta));
});

test('identical strategies across samples are marked converged', () => {
  const tracker = new ConvergenceTracker({ sampleEvery: 5 });
  const infos = fakeInfos();
  tracker.maybeRecord(5, infos);
  tracker.maybeRecord(10, infos);
  tracker.maybeRecord(15, infos);
  const status = tracker.finalStatus();
  assert.equal(status.status, 'converged');
  assert.equal(status.delta, 0);
});

test('history is capped by maxSamples', () => {
  const tracker = new ConvergenceTracker({ sampleEvery: 1, maxSamples: 3 });
  const infos = fakeInfos();
  for (let i = 1; i <= 10; i++) tracker.maybeRecord(i, infos);
  assert.ok(tracker.history.length <= 3);
});