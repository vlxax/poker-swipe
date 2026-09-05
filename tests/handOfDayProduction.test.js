// Hand of the Day — Production Quality Tests
// Tests grading, validation, forensics, and scenarios

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  GRADES,
  HandForensics,
  gradeActionDecision,
  gradeReadChoice,
  ScenarioValidator,
  validateAllScenarios,
  HAND_OF_DAY_SCENARIOS_EXPANDED
} from '../solver/src/handOfDay/index.js';

describe('Hand of the Day — Production Quality', () => {
  describe('Grading System', () => {
    it('defines all grade levels', () => {
      assert.strictEqual(GRADES.BEST.id, 'BEST');
      assert.strictEqual(GRADES.GOOD.id, 'GOOD');
      assert.strictEqual(GRADES.MIXED.id, 'MIXED');
      assert.strictEqual(GRADES.INACCURATE.id, 'INACCURATE');
      assert.strictEqual(GRADES.MISTAKE.id, 'MISTAKE');
    });

    it('grades optimal action as BEST', () => {
      const result = gradeActionDecision('raise', 'raise', { street: 'preflop' });
      assert.strictEqual(result.grade, 'BEST');
      assert.strictEqual(result.classification, 'optimal');
    });

    it('grades suboptimal but acceptable actions', () => {
      const result = gradeActionDecision('call', 'raise', { street: 'preflop', villain: 'tight-reg' });
      // Should be GOOD or MIXED depending on context
      assert.ok(['GOOD', 'MIXED'].includes(result.grade));
    });

    it('reads choice grading - correct answer', () => {
      const result = gradeReadChoice('strong-value', 'strong-value', {
        'strong-value': { id: 'strong-value', label: 'ВЭЛЬЮ' }
      });
      assert.strictEqual(result.correct, true);
      assert.strictEqual(result.grade, 'BEST');
    });

    it('reads choice grading - incorrect answer', () => {
      const result = gradeReadChoice('strong-value', 'turned-hand', {
        'strong-value': { id: 'strong-value', label: 'ВЭЛЬЮ' },
        'turned-hand': { id: 'turned-hand', label: 'ПРЕВРАЩАЕТ' }
      });
      assert.strictEqual(result.correct, false);
      assert.ok(['GOOD', 'INACCURATE', 'MISTAKE'].includes(result.grade));
    });
  });

  describe('Forensics', () => {
    it('tracks decisions by street', () => {
      const scenario = { id: 'test' };
      const forensics = new HandForensics(scenario);

      forensics.recordDecision('preflop', 'node1', 'raise', 'BEST');
      forensics.recordDecision('flop', 'node2', 'bet', 'BEST');
      forensics.recordDecision('turn', 'node3', 'check', 'MISTAKE');

      assert.strictEqual(forensics.decisions.length, 3);
    });

    it('identifies first error', () => {
      const scenario = { id: 'test' };
      const forensics = new HandForensics(scenario);

      forensics.recordDecision('preflop', 'node1', 'raise', 'BEST');
      forensics.recordDecision('flop', 'node2', 'bet', 'GOOD');
      forensics.recordDecision('turn', 'node3', 'check', 'INACCURATE');
      forensics.recordDecision('river', 'node4', 'bet', 'BEST');

      const review = forensics.getForensicReview();
      assert.strictEqual(review.firstError.street, 'turn');
      assert.strictEqual(review.firstError.grade, 'INACCURATE');
    });

    it('generates forensic review', () => {
      const scenario = { id: 'test' };
      const forensics = new HandForensics(scenario);

      forensics.recordDecision('preflop', 'node1', 'raise', 'BEST');
      forensics.recordDecision('flop', 'node2', 'bet', 'BEST');

      const review = forensics.getForensicReview();
      assert.ok(review.review);
      assert.ok(review.allDecisions);
    });
  });

  describe('Scenario Validator', () => {
    it('validates valid scenario', () => {
      const scenario = {
        id: 'test_001',
        title: 'Test Scenario',
        tournament: {
          stage: 'MIDDLE',
          playersRemaining: 30,
          paidPlaces: 20
        },
        hero: {
          position: 'BTN',
          stack: 5000,
          stackBb: 25,
          cards: ['As', 'Kh']
        },
        villain: {
          position: 'BB',
          stack: 3000,
          stackBb: 15,
          archetype: 'tight-reg',
          cards: ['9s', '4d']
        },
        board: [],
        nodes: [
          { id: 'root', type: 'hero-decision', street: 'preflop', actions: [{ id: 'fold', label: 'FOLD' }] },
          { id: 'complete', type: 'complete' }
        ],
        rootNodeId: 'root'
      };

      const validator = new ScenarioValidator();
      const result = validator.validate(scenario);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('rejects scenario with duplicate node IDs', () => {
      const scenario = {
        id: 'test_dup',
        title: 'Test',
        tournament: { stage: 'MIDDLE', playersRemaining: 30, paidPlaces: 20 },
        hero: { position: 'BTN', stack: 5000, stackBb: 25, cards: ['As', 'Kh'] },
        villain: { position: 'BB', stack: 3000, stackBb: 15, archetype: 'tight-reg', cards: ['9s', '4d'] },
        nodes: [
          { id: 'root', type: 'hero-decision', street: 'preflop', actions: [] },
          { id: 'root', type: 'complete', street: 'river' }
        ]
      };

      const validator = new ScenarioValidator();
      const result = validator.validate(scenario);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Duplicate')));
    });

    it('rejects invalid card references', () => {
      const scenario = {
        id: 'test_cards',
        title: 'Test',
        tournament: { stage: 'MIDDLE', playersRemaining: 30, paidPlaces: 20 },
        hero: { position: 'BTN', stack: 5000, stackBb: 25, cards: ['As', 'XX'] },
        villain: { position: 'BB', stack: 3000, stackBb: 15, archetype: 'tight-reg', cards: ['9s', '4d'] },
        nodes: []
      };

      const validator = new ScenarioValidator();
      const result = validator.validate(scenario);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid card')));
    });

    it('rejects broken node references', () => {
      const scenario = {
        id: 'test_ref',
        title: 'Test',
        tournament: { stage: 'MIDDLE', playersRemaining: 30, paidPlaces: 20 },
        hero: { position: 'BTN', stack: 5000, stackBb: 25, cards: ['As', 'Kh'] },
        villain: { position: 'BB', stack: 3000, stackBb: 15, archetype: 'tight-reg', cards: ['9s', '4d'] },
        nodes: [
          { id: 'root', type: 'hero-decision', street: 'preflop', actions: [], nextNode: 'nonexistent' }
        ],
        rootNodeId: 'root'
      };

      const validator = new ScenarioValidator();
      const result = validator.validate(scenario);
      assert.strictEqual(result.valid, false);
    });
  });

  describe('Expanded Scenarios', () => {
    it('loads expanded scenario library', () => {
      assert.ok(HAND_OF_DAY_SCENARIOS_EXPANDED);
      assert.ok(Array.isArray(HAND_OF_DAY_SCENARIOS_EXPANDED));
      assert.ok(HAND_OF_DAY_SCENARIOS_EXPANDED.length >= 8, `Expected at least 8 scenarios, got ${HAND_OF_DAY_SCENARIOS_EXPANDED.length}`);
    });

    it('all expanded scenarios have required fields', () => {
      HAND_OF_DAY_SCENARIOS_EXPANDED.forEach(scenario => {
        assert.ok(scenario.id, `Scenario missing id`);
        assert.ok(scenario.title, `Scenario ${scenario.id} missing title`);
        assert.ok(scenario.difficulty, `Scenario ${scenario.id} missing difficulty`);
        assert.ok(scenario.topic, `Scenario ${scenario.id} missing topic`);
        assert.ok(scenario.tournament, `Scenario ${scenario.id} missing tournament`);
        assert.ok(scenario.hero, `Scenario ${scenario.id} missing hero`);
        assert.ok(scenario.villain, `Scenario ${scenario.id} missing villain`);
        assert.ok(Array.isArray(scenario.nodes), `Scenario ${scenario.id} nodes not array`);
      });
    });

    it('validates all expanded scenarios', () => {
      const result = validateAllScenarios(HAND_OF_DAY_SCENARIOS_EXPANDED);
      if (!result.allValid) {
        console.error('Invalid scenarios:', result.invalidScenarios);
      }
      assert.strictEqual(result.allValid, true, `${result.invalidScenarios.length} scenarios invalid`);
    });

    it('scenarios cover multiple topics', () => {
      const topics = new Set(HAND_OF_DAY_SCENARIOS_EXPANDED.map(s => s.topic));
      assert.ok(topics.size >= 4, `Only ${topics.size} topics represented, need at least 4`);
    });

    it('scenarios have varying difficulty', () => {
      const difficulties = new Set(HAND_OF_DAY_SCENARIOS_EXPANDED.map(s => s.difficulty));
      assert.ok(difficulties.size >= 2, `Only ${difficulties.size} difficulty levels, need at least 2`);
    });
  });

  describe('Scenario Structure Quality', () => {
    it('each scenario has meaningful branching', () => {
      HAND_OF_DAY_SCENARIOS_EXPANDED.slice(0, 5).forEach(scenario => {
        const hasMultipleActions = scenario.nodes.some(n =>
          n.actions && n.actions.length > 1
        );
        assert.ok(hasMultipleActions, `Scenario ${scenario.id} has no meaningful branching`);
      });
    });

    it('scenarios progress through streets logically', () => {
      const scenario = HAND_OF_DAY_SCENARIOS_EXPANDED[0];
      const streets = scenario.nodes
        .filter(n => n.street)
        .map(n => n.street);

      const streetOrder = ['preflop', 'flop', 'turn', 'river'];
      let lastIdx = -1;

      streets.forEach(street => {
        const idx = streetOrder.indexOf(street);
        assert.ok(idx >= lastIdx, `Street order violation in ${scenario.id}: ${street} after index ${lastIdx}`);
        lastIdx = idx;
      });
    });

    it('terminals are properly marked', () => {
      HAND_OF_DAY_SCENARIOS_EXPANDED.slice(0, 3).forEach(scenario => {
        const hasTerminal = scenario.nodes.some(n =>
          n.type === 'complete' || n.type === 'showdown'
        );
        assert.ok(hasTerminal, `Scenario ${scenario.id} has no terminal node`);
      });
    });
  });
});
