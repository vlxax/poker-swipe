/**
 * Unified Grading Regression Tests
 * Verify that the same context + action produces consistent grades across modes.
 *
 * Key invariant: If context and action are identical, the grade should be identical
 * regardless of whether it comes from SWIPE, SIZING, QUICK, or other modes.
 *
 * Runner: node:test (project canonical). Previously imported @jest/globals.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeSwipeSizing,
  gradeSwipeDecision,
  gradeQuickDecision,
  gradeDailyDrill
} from '../src/api/modeAdapters.js';
import { gradeDecision, gradeToClass } from '../src/api/unifiedGrading.js';

void gradeDailyDrill;
void gradeDecision;

describe('Unified Grading - Regression Tests', () => {
  const baseScenario = {
    id: 'TEST_REGRESSION_001',
    spotId: 'TEST_REGRESSION_001',
    street: 'turn',
    hero: ['A♣', 'K♥'],
    villain: ['Q♦', 'J♠'],
    board: ['3♦', '2♥', '5♠', '2♣'],
    pos: 'BTN',
    heroPosition: 'BTN',
    villainPos: 'BB',
    villainPosition: 'BB',
    stack: 25,
    effectiveStackBb: 25,
    pot: 4,
    potBb: 4,
    ctx: 'facing bet 50%',
    description: 'BTN AK on paired board, facing 2BB bet'
  };

  const testAction = 'CALL';
  const testSizePct = null;
  const VALID_GRADES = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE'];

  test('SWIPE and SIZING should assign same grade for identical context', () => {
    const swipeResult = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });
    const sizingResult = gradeSwipeSizing({
      spot: baseScenario,
      action: testAction,
      sizePct: testSizePct
    });
    assert.equal(swipeResult.grade, sizingResult.grade);
    assert.equal(swipeResult.gradeClass, sizingResult.gradeClass);
    assert.equal(swipeResult.source, sizingResult.source);
    assert.match(String(swipeResult.source), /legacy|unknown/);
  });

  test('QUICK mode should match SWIPE for same context', () => {
    const swipeResult = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });
    const quickResult = gradeQuickDecision({
      scenario: baseScenario,
      action: testAction
    });
    assert.equal(quickResult.grade, swipeResult.grade);
    assert.equal(quickResult.gradeClass, swipeResult.gradeClass);
  });

  test('Grade consistency: calling same function twice should give same result', () => {
    const result1 = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });
    const result2 = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });
    assert.equal(result1.grade, result2.grade);
    assert.equal(result1.gradeClass, result2.gradeClass);
    assert.equal(result1.evLossBB, result2.evLossBB);
    assert.equal(result1.source, result2.source);
  });

  test('Different actions on same scenario should possibly differ', () => {
    const checkResult = gradeSwipeDecision({
      scenario: baseScenario,
      action: 'CHECK'
    });
    const callResult = gradeSwipeDecision({
      scenario: baseScenario,
      action: 'CALL'
    });
    assert.ok(checkResult.grade);
    assert.ok(callResult.grade);
    assert.ok(VALID_GRADES.includes(checkResult.grade));
    assert.ok(VALID_GRADES.includes(callResult.grade));
  });

  test('Grade class mapping should be consistent', () => {
    const testGrades = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE'];
    const expectedClasses = ['g', 'g', 'y', 'r', 'r'];
    const results = testGrades.map((grade) => gradeToClass(grade));
    assert.deepEqual(results, expectedClasses);
  });

  test('Sizing with specific size should grade action + sizing', () => {
    const bettingScenario = {
      ...baseScenario,
      street: 'flop'
    };
    const halfPotResult = gradeSwipeSizing({
      spot: bettingScenario,
      action: 'BET',
      sizePct: 50
    });
    const fullPotResult = gradeSwipeSizing({
      spot: bettingScenario,
      action: 'BET',
      sizePct: 100
    });
    assert.ok(halfPotResult.grade);
    assert.ok(fullPotResult.grade);
    assert.ok(VALID_GRADES.includes(halfPotResult.grade));
    assert.ok(VALID_GRADES.includes(fullPotResult.grade));
  });

  test('Result should have all required unified fields', () => {
    const result = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });
    for (const key of ['grade', 'gradeClass', 'evLossBB', 'source', 'confidence', 'metadata', 'explanationData']) {
      assert.ok(Object.prototype.hasOwnProperty.call(result, key), `missing ${key}`);
    }
    assert.equal(typeof result.grade, 'string');
    assert.equal(typeof result.gradeClass, 'string');
    assert.ok(result.evLossBB === null || typeof result.evLossBB === 'number');
    assert.equal(typeof result.source, 'string');
    assert.equal(typeof result.confidence, 'number');
    assert.equal(typeof result.metadata, 'object');
    assert.equal(typeof result.explanationData, 'object');
  });

  test('Legacy brain results should have null evLossBB', () => {
    const result = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });
    assert.equal(result.evLossBB, null);
    assert.match(String(result.source), /legacy/);
  });

  test('Confidence should reflect data source', () => {
    const result = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });
    if (String(result.source).includes('legacy')) {
      assert.ok(result.confidence <= 100);
      assert.ok(result.confidence >= 0);
    }
  });

  test('Multi-mode consistency: SWIPE/SIZING/QUICK should form equivalence class', () => {
    const swipeGrade = gradeSwipeDecision({
      scenario: baseScenario,
      action: 'CALL'
    }).grade;
    const sizingGrade = gradeSwipeSizing({
      spot: baseScenario,
      action: 'CALL',
      sizePct: null
    }).grade;
    const quickGrade = gradeQuickDecision({
      scenario: baseScenario,
      action: 'CALL'
    }).grade;
    assert.equal(swipeGrade, sizingGrade);
    assert.equal(sizingGrade, quickGrade);
  });

  test('Error handling: missing required fields should return graceful result', () => {
    const result = gradeSwipeDecision({
      scenario: {}
    });
    assert.ok(result.grade);
    assert.ok(VALID_GRADES.includes(result.grade));
  });

  test('Grade order should match visual hierarchy', () => {
    const gradeOrder = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE'];
    const classOrder = gradeOrder.map((g) => gradeToClass(g));
    assert.equal(classOrder[0], 'g');
    assert.equal(classOrder[1], 'g');
    assert.equal(classOrder[2], 'y');
    assert.equal(classOrder[3], 'r');
    assert.equal(classOrder[4], 'r');
  });
});

describe('Unified Grading - Mode Adapter Consistency', () => {
  test('scenarioFromCompact should preserve all fields', () => {
    const compactSpot = {
      id: 'TEST_123',
      spotId: 'SPOT_123',
      street: 'flop',
      hero: ['K♠', 'J♠'],
      villain: ['A♥', 'Q♥'],
      board: ['K♥', '8♠', '4♣'],
      pos: 'CO',
      villainPos: 'BB',
      stack: 50,
      pot: 10,
      ctx: 'facing 25% bet'
    };
    const result = gradeSwipeSizing({
      spot: compactSpot,
      action: 'CALL',
      sizePct: null
    });
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'grade'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'gradeClass'));
  });

  test('All adapters should return unified format', () => {
    const scenario = {
      id: 'TEST_FORMAT',
      spotId: 'TEST_FORMAT',
      street: 'river',
      hero: ['A♠', 'A♥'],
      board: ['K♠', 'Q♥', 'J♠', '9♣', '2♦'],
      stack: 30,
      pot: 6,
      pos: 'BTN'
    };
    const modes = [
      () => gradeSwipeDecision({ scenario, action: 'BET' }),
      () => gradeSwipeSizing({ spot: scenario, action: 'BET', sizePct: 50 }),
      () => gradeQuickDecision({ scenario, action: 'BET' })
    ];
    for (const modeFunc of modes) {
      const result = modeFunc();
      for (const key of ['grade', 'gradeClass', 'source', 'confidence', 'metadata', 'explanationData']) {
        assert.ok(Object.prototype.hasOwnProperty.call(result, key), `missing ${key}`);
      }
    }
  });
});
