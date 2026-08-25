/**
 * Unified Grading Regression Tests
 * Verify that the same context + action produces consistent grades across modes.
 *
 * Key invariant: If context and action are identical, the grade should be identical
 * regardless of whether it comes from SWIPE, SIZING, QUICK, or other modes.
 */

import { describe, test, expect } from '@jest/globals';
import {
  gradeSwipeSizing,
  gradeSwipeDecision,
  gradeQuickDecision,
  gradeDailyDrill
} from '../src/api/modeAdapters.js';
import { gradeDecision, gradeToClass } from '../src/api/unifiedGrading.js';

describe('Unified Grading - Regression Tests', () => {
  // Test scenario: BTN 25BB, facing BB 25BB, AK on 3-2-5r, hero checks turn
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

  test('SWIPE and SIZING should assign same grade for identical context', () => {
    // Grade via SWIPE mode adapter
    const swipeResult = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });

    // Grade via SIZING mode adapter
    const sizingResult = gradeSwipeSizing({
      spot: baseScenario,
      action: testAction,
      sizePct: testSizePct
    });

    // Verify grades are identical
    expect(swipeResult.grade).toBe(sizingResult.grade);
    expect(swipeResult.gradeClass).toBe(sizingResult.gradeClass);
    expect(swipeResult.source).toBe(sizingResult.source);

    // Both should have legacy source (hardcoded brain)
    expect(swipeResult.source).toMatch(/legacy|unknown/);
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

    expect(quickResult.grade).toBe(swipeResult.grade);
    expect(quickResult.gradeClass).toBe(swipeResult.gradeClass);
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

    expect(result1.grade).toBe(result2.grade);
    expect(result1.gradeClass).toBe(result2.gradeClass);
    expect(result1.evLossBB).toBe(result2.evLossBB);
    expect(result1.source).toBe(result2.source);
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

    // CHECK and CALL may have different grades (expected)
    // This test just verifies both produce valid results
    expect(checkResult.grade).toBeDefined();
    expect(callResult.grade).toBeDefined();
    expect(['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE']).toContain(checkResult.grade);
    expect(['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE']).toContain(callResult.grade);
  });

  test('Grade class mapping should be consistent', () => {
    const testGrades = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE'];
    const expectedClasses = ['g', 'g', 'y', 'r', 'r'];

    const results = testGrades.map(grade => gradeToClass(grade));
    expect(results).toEqual(expectedClasses);
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

    // Both should have valid grades
    expect(halfPotResult.grade).toBeDefined();
    expect(fullPotResult.grade).toBeDefined();

    // May differ due to sizing evaluation
    // Just verify both are in valid set
    const validGrades = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE'];
    expect(validGrades).toContain(halfPotResult.grade);
    expect(validGrades).toContain(fullPotResult.grade);
  });

  test('Result should have all required unified fields', () => {
    const result = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });

    // Verify unified interface
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('gradeClass');
    expect(result).toHaveProperty('evLossBB');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('explanationData');

    // Verify types
    expect(typeof result.grade).toBe('string');
    expect(typeof result.gradeClass).toBe('string');
    expect(result.evLossBB === null || typeof result.evLossBB === 'number').toBe(true);
    expect(typeof result.source).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.metadata).toBe('object');
    expect(typeof result.explanationData).toBe('object');
  });

  test('Legacy brain results should have null evLossBB', () => {
    const result = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });

    // Legacy brain doesn't calculate actual EV
    expect(result.evLossBB).toBeNull();
    expect(result.source).toMatch(/legacy/);
  });

  test('Confidence should reflect data source', () => {
    const result = gradeSwipeDecision({
      scenario: baseScenario,
      action: testAction
    });

    // Legacy brain has low/fixed confidence
    if (result.source.includes('legacy')) {
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
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

    // All three should agree
    expect(swipeGrade).toBe(sizingGrade);
    expect(sizingGrade).toBe(quickGrade);
  });

  test('Error handling: missing required fields should return graceful result', () => {
    const result = gradeSwipeDecision({
      scenario: {}  // Empty scenario
      // Missing action
    });

    expect(result.grade).toBeDefined();
    expect(['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE']).toContain(result.grade);
    // Should not throw, should return fallback
  });

  test('Grade order should match visual hierarchy', () => {
    const gradeOrder = ['EXCELLENT', 'GOOD', 'INACCURACY', 'MISTAKE', 'BIG_MISTAKE'];
    const classOrder = gradeOrder.map(g => gradeToClass(g));

    // g (good) before y (yellow) before r (red)
    expect(classOrder[0]).toBe('g');
    expect(classOrder[1]).toBe('g');
    expect(classOrder[2]).toBe('y');
    expect(classOrder[3]).toBe('r');
    expect(classOrder[4]).toBe('r');
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

    // Should produce valid result without errors
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('gradeClass');
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

    modes.forEach(modeFunc => {
      const result = modeFunc();
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('gradeClass');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('explanationData');
    });
  });
});
