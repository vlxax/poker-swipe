import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installPokerBrainForTests } from './brainTestEnv.js';
import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';
import { grade } from '../../poker-brain/grade.js';

const pack = loadPokerBrainPackFromStrategyFile();

describe('Swipe single Brain authority', () => {
  it('grade returns unified decision with legacy grade from same pipeline', () => {
    installPokerBrainForTests();
    const PB = globalThis.window.PokerBrain;
    const input = {
      mode: 'swipe',
      scenario: {
        street: 'PREFLOP',
        pos: 'BTN',
        hero: ['As', 'Ks'],
        stack: 30,
        ctx: 'unopened, first in'
      }
    };
    const res = grade(input, 'RAISE', {
      pack,
      classOf: PB.classOf.bind(PB),
      legacyGradeDecision: PB.gradeDecision.bind(PB),
      legacyNodeFor: PB.nodeFor.bind(PB)
    });
    assert.ok(res.grading.available);
    assert.ok(res.domain);
    assert.equal(res.grading.grade, res.legacyGrade?.grade);
    assert.equal(res.provenance?.primarySource, 'POKER_BRAIN_PACK');
  });
});
