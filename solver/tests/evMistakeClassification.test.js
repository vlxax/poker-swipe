import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMistake } from '../src/analysis/mistakeClassifier.js';
import { classifySeverity, SEVERITY_ORDER } from '../src/config/thresholds.js';

test('classifyMistake keeps the legacy GOOD..BLUNDER severity', () => {
  assert.equal(classifyMistake({ evLossBB: 0.01 }).severity, 'GOOD');
  assert.equal(classifyMistake({ evLossBB: 0.1 }).severity, 'INACCURACY');
  assert.equal(classifyMistake({ evLossBB: 0.5 }).severity, 'MISTAKE');
  assert.equal(classifyMistake({ evLossBB: 2 }).severity, 'BLUNDER');
});

test('classifyMistake adds the negligible..severe scale', () => {
  assert.equal(classifyMistake({ evLossBB: 0.01 }).mistakeSeverity, 'negligible');
  assert.equal(classifyMistake({ evLossBB: 0.1 }).mistakeSeverity, 'small');
  assert.equal(classifyMistake({ evLossBB: 0.5 }).mistakeSeverity, 'medium');
  assert.equal(classifyMistake({ evLossBB: 2 }).mistakeSeverity, 'large');
  assert.equal(classifyMistake({ evLossBB: 5 }).mistakeSeverity, 'severe');
});

test('classifySeverity is monotonic across the scale', () => {
  const order = (loss) => SEVERITY_ORDER.indexOf(classifySeverity(loss));
  assert.ok(order(0.01) < order(0.1));
  assert.ok(order(0.1) < order(0.5));
  assert.ok(order(0.5) < order(2));
  assert.ok(order(2) < order(5));
});

test('evLossPctPot is computed from potBB', () => {
  const r = classifyMistake({ evLossBB: 2, potBB: 10 });
  assert.ok(Math.abs(r.evLossPctPot - 0.2) < 1e-6);
  assert.equal(classifyMistake({ evLossBB: 2, potBB: 0 }).evLossPctPot, null);
});

test('mistake confidence is returned and in range', () => {
  for (const loss of [0.01, 0.1, 0.5, 2, 5]) {
    const r = classifyMistake({ evLossBB: loss });
    assert.ok(r.confidence >= 0 && r.confidence <= 1);
    assert.ok(Number.isFinite(r.confidence));
  }
});

test('a negative EV loss is not misclassified as a large mistake', () => {
  const r = classifyMistake({ evLossBB: -1 });
  assert.equal(r.severity, 'GOOD');
  assert.equal(r.mistakeSeverity, 'negligible');
  assert.equal(r.mistakeSeverityIndex, 0);
});