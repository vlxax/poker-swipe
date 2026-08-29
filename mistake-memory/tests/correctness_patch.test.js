import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialMemoryState,
  updateMemoryState,
  scheduleRetry,
  SAME_SESSION_WINDOW_MS,
  validateAttempt,
  adaptRangeIntelligence
} from '../index.js';

const T0 = 1_700_000_000_000;
const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

describe('P0 single severe without attemptId', () => {
  it('one severe without attemptId → recentSevereInWindow === 1', () => {
    let s = createInitialMemoryState('x');
    s = updateMemoryState(s, {
      itemId: 'x', timestamp: 1000, classification: 'OUT_OF_STRATEGY'
    });
    assert.equal(s.severeErrors, 1);
    assert.equal(s.recentSevereInWindow, 1);
  });

  it('two severe without attemptId same timestamp → window === 2', () => {
    let s = createInitialMemoryState('y');
    s = updateMemoryState(s, {
      itemId: 'y', timestamp: 1000, classification: 'OUT_OF_STRATEGY'
    });
    s = updateMemoryState(s, {
      itemId: 'y', timestamp: 1000, classification: 'OUT_OF_STRATEGY'
    });
    assert.equal(s.severeErrors, 2);
    assert.equal(s.recentSevereInWindow, 2);
  });

  it('survives rebuild path (extra updates)', () => {
    let s = createInitialMemoryState('z');
    s = updateMemoryState(s, {
      itemId: 'z', timestamp: 1000, classification: 'OUT_OF_STRATEGY'
    });
    s = updateMemoryState(s, {
      itemId: 'z', timestamp: 2000, classification: 'PURE_MATCH', chosenAction: 'CALL', attemptId: 'ok'
    });
    assert.equal(s.recentSevereInWindow, 1);
  });
});

describe('P1 short-term retry horizons', () => {
  function base(overrides = {}) {
    return {
      itemId: 'r',
      status: 'REVIEW',
      lastErrorAt: 0,
      recentSevereInWindow: 1,
      severeErrors: 1,
      ...overrides
    };
  }

  it('1 min → shouldRetry true', () => {
    const r = scheduleRetry(base({ lastErrorAt: T0 }), [], { now: T0 + MIN });
    assert.equal(r.shouldRetry, true);
  });

  it('24 min → shouldRetry true', () => {
    const r = scheduleRetry(base({ lastErrorAt: T0 }), [], { now: T0 + 24 * MIN });
    assert.equal(r.shouldRetry, true);
  });

  it('26 min → shouldRetry false for REVIEW', () => {
    const r = scheduleRetry(base({ lastErrorAt: T0 }), [], { now: T0 + 26 * MIN });
    assert.equal(r.shouldRetry, false);
  });

  it('1 day → false', () => {
    const r = scheduleRetry(base({ lastErrorAt: T0 }), [], { now: T0 + DAY });
    assert.equal(r.shouldRetry, false);
  });

  it('10 days REVIEW → false even if recentSevereInWindow=1', () => {
    const r = scheduleRetry(base({ lastErrorAt: T0, recentSevereInWindow: 1 }), [], {
      now: T0 + 10 * DAY
    });
    assert.equal(r.shouldRetry, false);
  });

  it('WEAK at 10 days → candidate', () => {
    const r = scheduleRetry(base({ status: 'WEAK', lastErrorAt: T0 }), [], {
      now: T0 + 10 * DAY
    });
    assert.equal(r.shouldRetry, true);
  });

  it('LAPSED at 10 days → candidate', () => {
    const r = scheduleRetry(base({ status: 'LAPSED', lastErrorAt: T0 }), [], {
      now: T0 + 10 * DAY
    });
    assert.equal(r.shouldRetry, true);
  });
});

describe('P1 RI passthrough independent', () => {
  it('only actionRecency', () => {
    const out = adaptRangeIntelligence(
      { components: { actionRecency: 123 } },
      { itemId: 'a', timestamp: T0 }
    );
    assert.equal(out.context.actionRecency, 123);
    assert.equal(out.context?.frequencyRecency, undefined);
  });

  it('only frequencyRecency', () => {
    const out = adaptRangeIntelligence(
      { components: { frequencyRecency: 456 } },
      { itemId: 'a', timestamp: T0 }
    );
    assert.equal(out.context.frequencyRecency, 456);
  });

  it('only evidenceStrength', () => {
    const out = adaptRangeIntelligence(
      { components: { evidenceStrength: 0.5 } },
      { itemId: 'a', timestamp: T0 }
    );
    assert.equal(out.context.evidenceStrength, 0.5);
  });

  it('all three', () => {
    const out = adaptRangeIntelligence(
      { components: { actionRecency: 1, frequencyRecency: 2, evidenceStrength: 0.8 } },
      { itemId: 'a', timestamp: T0 }
    );
    assert.equal(out.context.actionRecency, 1);
    assert.equal(out.context.frequencyRecency, 2);
    assert.equal(out.context.evidenceStrength, 0.8);
  });

  it('none', () => {
    const out = adaptRangeIntelligence(
      { components: {} },
      { itemId: 'a', timestamp: T0 }
    );
    assert.ok(!out.context || (
      out.context.actionRecency == null &&
      out.context.frequencyRecency == null &&
      out.context.evidenceStrength == null
    ));
  });

  it('NaN evidenceStrength not passed', () => {
    const out = adaptRangeIntelligence(
      { components: { evidenceStrength: NaN, actionRecency: 9 } },
      { itemId: 'a', timestamp: T0 }
    );
    assert.equal(out.context.actionRecency, 9);
    assert.ok(out.context.evidenceStrength === undefined);
  });
});

describe('P1 numeric domain validation', () => {
  it('rejects weaknessScore -0.01, 1.01, NaN, Infinity', () => {
    for (const w of [-0.01, 1.01, NaN, Infinity, -Infinity]) {
      const r = validateAttempt({
        itemId: 'v', timestamp: T0, weaknessScore: w
      });
      assert.equal(r.ok, false, `should reject ${w}`);
    }
  });

  it('accepts boundaries 0 and 1', () => {
    assert.equal(validateAttempt({ itemId: 'v', timestamp: T0, weaknessScore: 0 }).ok, true);
    assert.equal(validateAttempt({ itemId: 'v', timestamp: T0, weaknessScore: 1 }).ok, true);
  });

  it('rejects frequencyDeviation out of range', () => {
    assert.equal(validateAttempt({
      itemId: 'v', timestamp: T0, classification: 'PURE_MATCH', frequencyDeviation: -0.01
    }).ok, false);
    assert.equal(validateAttempt({
      itemId: 'v', timestamp: T0, classification: 'PURE_MATCH', frequencyDeviation: 1.01
    }).ok, false);
  });

  it('updateMemoryState rejects weaknessScore=-5', () => {
    assert.throws(() => {
      updateMemoryState(createInitialMemoryState('w'), {
        itemId: 'w', timestamp: T0, weaknessScore: -5
      });
    });
  });
});
