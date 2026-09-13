/**
 * Battleship Semantic Verification Tests
 *
 * Validates that the controller correctly handles:
 * 1. MISSION_HIT (target hand)
 * 2. MISSION_OFF_TARGET (valid in range, not this mission's target)
 * 3. OUT_OF_STRATEGY (not valid in range)
 *
 * And that Mistake Memory records each correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleshipController } from '../ranges-ui/battleship/controller.js';
import { buildRangeModelFromMatrix } from '../ranges-ui/battleship/trainerRangeModel.js';
import { buildTrainerMatrixAsync } from '../ranges-ui/trainerRanges.js';
import { buildMissions } from '../ranges-ui/battleship/missions.js';

class MockLearnerMemory {
  constructor() {
    this.attempts = [];
  }
  load() {}
  recordAttempts(attempts) {
    this.attempts.push(...attempts);
  }
}

describe('Battleship Semantic Verification', () => {
  let controller;
  let mockMemory;
  let testModel;
  let testMissions;

  beforeEach(async () => {
    mockMemory = new MockLearnerMemory();
    controller = new BattleshipController({ storage: null, learnerMemory: mockMemory });

    // Load a real test model from trainer data
    const sel = {
      dataSource: 'trainer',
      position: 'EP',
      stackBand: '6-8',
      trainerSourceMode: 'uo',
      situation: 'uo_open'
    };
    const matrix = await buildTrainerMatrixAsync(sel);
    testModel = buildRangeModelFromMatrix(matrix);
    testMissions = buildMissions(testModel);

    // Setup controller with test data
    controller.model = testModel;
    controller.missions = testMissions;
    controller.state.phase = 'play';
    controller.state.status = 'playing';
    controller.state.missionIndex = 0;
    controller.state.grenades = 7;
    controller.state.hits = 0;
    controller.state.misses = 0;
    controller.state.found = 0;
    controller.state.targetTotal = testMissions[0].getTargetHands().length;
  });

  it('should load valid test model', () => {
    expect(testModel.supported).toBe(true);
    expect(testModel.openSet.size).toBeGreaterThan(0);
    expect(testMissions.length).toBeGreaterThan(0);
  });

  it('TEST 1: MISSION_HIT - target hand should increment hits and found', () => {
    const mission = testMissions[0];
    const targets = mission.getTargetHands();
    expect(targets.length).toBeGreaterThanOrEqual(1);

    const targetHand = targets[0];
    const stateBeforeTap = {
      hits: controller.state.hits,
      found: controller.state.found,
      grenades: controller.state.grenades,
      misses: controller.state.misses,
      resolved: controller.state.resolved.size,
      mistakes: controller.state.mistakes.length
    };

    // Tap a target hand
    controller.handleCellTap(targetHand);

    // Verify gameplay state
    expect(controller.state.hits).toBe(stateBeforeTap.hits + 1);
    expect(controller.state.found).toBe(stateBeforeTap.found + 1);
    expect(controller.state.grenades).toBe(stateBeforeTap.grenades); // Not decremented
    expect(controller.state.misses).toBe(stateBeforeTap.misses); // Not incremented
    expect(controller.state.resolved.size).toBe(stateBeforeTap.resolved + 1);
    expect(controller.state.mistakes.length).toBe(stateBeforeTap.mistakes); // No mistake added

    // Verify Mistake Memory
    expect(mockMemory.attempts.length).toBe(1);
    const attempt = mockMemory.attempts[0];
    expect(attempt.context.missionResult).toBe('MISSION_HIT');
    expect(attempt.context.strategyOk).toBe(true);
    expect(attempt.classification).toBe('PURE_MATCH');
  });

  it('TEST 2: MISSION_OFF_TARGET - valid range hand should NOT reduce grenades or create mistake', () => {
    const mission = testMissions[0];
    const targets = new Set(mission.getTargetHands());

    // Find a hand that is in the range but NOT a target for this mission
    let offTargetHand = null;
    for (const hand of testModel.openSet) {
      if (!targets.has(hand)) {
        offTargetHand = hand;
        break;
      }
    }

    // Skip test if we can't find an off-target hand
    if (!offTargetHand) {
      console.log('⚠ Skipping MISSION_OFF_TARGET test: no off-target hands available in this mission');
      return;
    }

    const stateBeforeTap = {
      hits: controller.state.hits,
      found: controller.state.found,
      grenades: controller.state.grenades,
      misses: controller.state.misses,
      resolved: controller.state.resolved.size,
      mistakes: controller.state.mistakes.length,
      missHands: controller.state.missHands.size,
      hitHands: controller.state.hitHands.size
    };

    // Tap an off-target hand
    controller.handleCellTap(offTargetHand);

    // Verify gameplay state - CRITICAL: grenades should NOT decrease
    expect(controller.state.grenades).toBe(stateBeforeTap.grenades,
      'Off-target hand should NOT consume grenades');
    expect(controller.state.misses).toBe(stateBeforeTap.misses,
      'Off-target hand should NOT increment misses');
    expect(controller.state.mistakes.length).toBe(stateBeforeTap.mistakes,
      'Off-target hand should NOT create a mistake');
    expect(controller.state.missHands.size).toBe(stateBeforeTap.missHands,
      'Off-target hand should NOT be in missHands');
    expect(controller.state.hitHands.has(offTargetHand)).toBe(false,
      'Off-target hand should NOT be marked as hit');
    expect(controller.state.resolved.has(offTargetHand)).toBe(true,
      'Off-target hand should be marked resolved');

    // Verify feedback indicates off-target, not miss
    expect(controller.state.feedback.type).toBe('off-target');

    // Verify Mistake Memory
    expect(mockMemory.attempts.length).toBe(1);
    const attempt = mockMemory.attempts[0];
    expect(attempt.context.missionResult).toBe('MISSION_OFF_TARGET',
      'Memory should record MISSION_OFF_TARGET');
    expect(attempt.context.strategyOk).toBe(true,
      'Off-target hand is strategically valid');
    expect(attempt.classification).toBe('PURE_MATCH',
      'Off-target classification should be PURE_MATCH');
  });

  it('TEST 3: OUT_OF_STRATEGY - invalid range hand should decrease grenades and create mistake', () => {
    const mission = testMissions[0];

    // Find a hand that is NOT in the range
    let outOfStrategyHand = null;
    const allHands = [];
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const ranks = [...'AKQJT98765432'];
        if (r === c) allHands.push(ranks[r] + ranks[c]);
        else if (r < c) allHands.push(ranks[r] + ranks[c] + 's');
        else allHands.push(ranks[c] + ranks[r] + 'o');
      }
    }

    for (const hand of allHands) {
      if (!testModel.openSet.has(hand) && testModel.blockedHands.size < 10) {
        outOfStrategyHand = hand;
        break;
      }
    }

    // Skip if we can't find one
    if (!outOfStrategyHand) {
      console.log('⚠ Skipping OUT_OF_STRATEGY test: no out-of-range hands available');
      return;
    }

    const stateBeforeTap = {
      grenades: controller.state.grenades,
      misses: controller.state.misses,
      resolved: controller.state.resolved.size,
      mistakes: controller.state.mistakes.length,
      missHands: controller.state.missHands.size
    };

    // Tap an out-of-strategy hand
    controller.handleCellTap(outOfStrategyHand);

    // Verify gameplay state - CRITICAL: grenades should decrease
    expect(controller.state.grenades).toBe(stateBeforeTap.grenades - 1,
      'Out-of-strategy hand should consume 1 grenade');
    expect(controller.state.misses).toBe(stateBeforeTap.misses + 1,
      'Out-of-strategy hand should increment misses');
    expect(controller.state.mistakes.length).toBe(stateBeforeTap.mistakes + 1,
      'Out-of-strategy hand should create a mistake');
    expect(controller.state.missHands.has(outOfStrategyHand)).toBe(true,
      'Out-of-strategy hand should be in missHands');

    // Verify feedback indicates miss
    expect(controller.state.feedback.type).toBe('miss');

    // Verify Mistake Memory
    expect(mockMemory.attempts.length).toBe(1);
    const attempt = mockMemory.attempts[0];
    expect(attempt.context.missionResult).toBe('MISSION_MISS',
      'Memory should record MISSION_MISS');
    expect(attempt.context.strategyOk).toBe(false,
      'Out-of-strategy hand is invalid');
    expect(attempt.classification).toBe('OUT_OF_STRATEGY');
  });

  it('TEST 4: Exactly-once memory recording per tap', () => {
    const mission = testMissions[0];
    const targets = mission.getTargetHands();
    const targetHand = targets[0];

    mockMemory.attempts = []; // Clear
    controller.handleCellTap(targetHand);

    expect(mockMemory.attempts.length).toBe(1,
      'Should record exactly 1 attempt per tap');
  });

  it('TEST 5: Grenade state transitions', () => {
    // Test that grenades only decrease on OUT_OF_STRATEGY, not on hits or off-targets
    const mission = testMissions[0];
    const targets = new Set(mission.getTargetHands());

    let offTargetHand = null;
    for (const hand of testModel.openSet) {
      if (!targets.has(hand)) {
        offTargetHand = hand;
        break;
      }
    }

    if (!offTargetHand) return; // Skip if unavailable

    const initialGrenades = controller.state.grenades;

    // Tap off-target hand
    controller.handleCellTap(offTargetHand);
    expect(controller.state.grenades).toBe(initialGrenades,
      'Grenades should not change for off-target');

    // Tap target hand
    const targetHand = targets.values().next().value;
    controller.handleCellTap(targetHand);
    expect(controller.state.grenades).toBe(initialGrenades,
      'Grenades should not change for hit');
  });

  it('TEST 6: resolved set behavior', () => {
    const mission = testMissions[0];
    const targets = new Set(mission.getTargetHands());
    const targetHand = targets.values().next().value;

    expect(controller.state.resolved.size).toBe(0);

    controller.handleCellTap(targetHand);
    expect(controller.state.resolved.has(targetHand)).toBe(true);

    // Tapping same hand again should be ignored
    const stateAfter = { ...controller.state };
    controller.handleCellTap(targetHand);
    expect(controller.state.resolved.size).toBe(stateAfter.resolved.size);
  });
});
