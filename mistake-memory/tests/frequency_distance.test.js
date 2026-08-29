/**
 * P0-3: Total Variation Distance regression.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  totalVariationDistance,
  computeFrequencyMastery,
  createMulberry32
} from '../index.js';

describe('P0-3 frequency distance (TVD)', () => {
  it('perfect match → distance 0', () => {
    const d = totalVariationDistance(
      { CALL: 0.7, FOLD: 0.3 },
      { CALL: 0.7, FOLD: 0.3 }
    );
    assert.ok(Math.abs(d) < 1e-12);
    const m = computeFrequencyMastery({ CALL: 70, FOLD: 30 }, { CALL: 0.7, FOLD: 0.3 });
    assert.ok(m.frequencyMastery > 0.8);
  });

  it('completely disjoint → distance ≈ 1, mastery near 0', () => {
    const d = totalVariationDistance(
      { RAISE: 1.0 },
      { CALL: 0.7, FOLD: 0.3 }
    );
    assert.ok(d > 0.99);
    const m = computeFrequencyMastery({ RAISE: 100 }, { CALL: 0.7, FOLD: 0.3 });
    assert.ok(m.frequencyMastery < 0.15);
  });

  it('extra unrelated categories do not artificially improve mastery', () => {
    const target = { CALL: 0.7, FOLD: 0.3 };
    // 100 actions all wrong, spread over 10 actions
    const counters = {};
    for (let i = 0; i < 10; i++) counters[`X${i}`] = 10;
    const m = computeFrequencyMastery(counters, target);
    // Must be near 0, not ~0.67 as with old mean-abs metric
    assert.ok(m.frequencyMastery < 0.15, `got ${m.frequencyMastery}`);
    assert.ok(m.frequencyDeviation > 0.9);
  });

  it('TVD is symmetric', () => {
    const P = { A: 0.6, B: 0.4 };
    const Q = { A: 0.2, B: 0.5, C: 0.3 };
    assert.ok(Math.abs(totalVariationDistance(P, Q) - totalVariationDistance(Q, P)) < 1e-12);
  });

  it('bounds always hold', () => {
    const rng = createMulberry32(7);
    for (let i = 0; i < 50; i++) {
      const emp = { A: rng(), B: rng() };
      const s = emp.A + emp.B;
      emp.A /= s; emp.B /= s;
      const tgt = { A: rng(), C: rng() };
      const s2 = tgt.A + tgt.C;
      tgt.A /= s2; tgt.C /= s2;
      const d = totalVariationDistance(emp, tgt);
      assert.ok(d >= 0 && d <= 1);
      const m = computeFrequencyMastery(
        { A: Math.round(emp.A * 100), B: Math.round(emp.B * 100) },
        tgt
      );
      if (m.frequencyMastery != null) {
        assert.ok(m.frequencyMastery >= 0 && m.frequencyMastery <= 1);
      }
    }
  });

  it('100/0 vs 70/30 is a clear frequency mistake', () => {
    const m = computeFrequencyMastery({ CALL: 100 }, { CALL: 0.7, FOLD: 0.3 });
    assert.ok(m.frequencyMastery < 0.70);
    assert.ok(m.frequencyDeviation >= 0.3);
  });
});
