import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTargetDistribution,
  validateTargetProbability,
  updateMemoryState,
  createInitialMemoryState
} from '../index.js';

const T0 = 1_700_000_000_000;

describe('P1-6 frequency target validation', () => {
  it('valid 70/30 accepted', () => {
    const v = validateTargetDistribution({ CALL: 0.7, FOLD: 0.3 });
    assert.equal(v.ok, true);
  });

  it('rejects 70/30 as percentages', () => {
    const v = validateTargetDistribution({ CALL: 70, FOLD: 30 });
    assert.equal(v.ok, false);
  });

  it('rejects negative and >1', () => {
    assert.equal(validateTargetDistribution({ CALL: 1.1, FOLD: -0.1 }).ok, false);
  });

  it('rejects NaN', () => {
    assert.equal(validateTargetDistribution({ CALL: NaN, FOLD: NaN }).ok, false);
  });

  it('rejects targetProbability 1.5 and -0.1', () => {
    assert.equal(validateTargetProbability(1.5).ok, false);
    assert.equal(validateTargetProbability(-0.1).ok, false);
  });

  it('accepts FP sum 0.1+0.2+0.7', () => {
    const v = validateTargetDistribution({ A: 0.1, B: 0.2, C: 0.7 });
    assert.equal(v.ok, true);
  });

  it('updateMemoryState throws on invalid target', () => {
    assert.throws(() => {
      updateMemoryState(createInitialMemoryState('v'), {
        itemId: 'v', timestamp: T0,
        classification: 'PURE_MATCH', chosenAction: 'CALL',
        context: { targetDistribution: { CALL: 70, FOLD: 30 } }
      });
    });
  });
});
