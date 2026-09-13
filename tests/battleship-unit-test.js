/**
 * Battleship Unit Test - Tests core semantic logic with mocked model
 */

import { BattleshipController } from '../ranges-ui/battleship/controller.js';
import { isGradable } from '../ranges-ui/battleship/trainerRangeModel.js';
import { grenadesForMission } from '../ranges-ui/battleship/missions.js';

class MockLearnerMemory {
  constructor() {
    this.attempts = [];
  }
  load() {}
  recordAttempts(attempts) {
    this.attempts.push(...attempts);
  }
}

function createMockModel() {
  return {
    supported: true,
    chartId: 'UO_6-8_EP',
    openSet: new Set(['AA', 'KK', 'QQ', 'JJ', 'KQ', 'KJ', 'QJ', 'AK']),
    blockedHands: new Set(),
    gradable: 150,
    blocked: 19,
    position: 'EP',
    stack: '6-8'
  };
}

function createMockMission() {
  return {
    id: 'broadway',
    type: 'MATRIX_HUNT',
    title: 'BROADWAY',
    goal: 'Which BROADWAY hands enter the open?',
    index: 1,
    getTargetHands() {
      return ['KQ', 'KJ', 'QJ'];
    },
    getActiveHands() {
      return ['AA', 'KK', 'QQ', 'JJ', 'KQ', 'KJ', 'QJ', 'AK'];
    }
  };
}

function setupControllerForTesting(controller) {
  const mission = controller.missions[0];
  const targets = mission.getTargetHands();

  Object.assign(controller.state, {
    missionIndex: 0,
    grenades: grenadesForMission(mission),
    hits: 0,
    misses: 0,
    combo: 0,
    found: 0,
    targetTotal: targets.length,
    resolved: new Set(),
    hitHands: new Set(),
    missHands: new Set(),
    mistakes: [],
    status: 'playing',
    showMissionIntro: false,
    showOverlay: false,
    showFinal: false,
    speech: '',
    feedback: null,
    flashHand: null,
    tutorialPhase: null,
    tutorialHand: null,
    showFailOverlay: false,
    missionFailed: false,
    missedTargets: [],
    wrongHands: []
  });
  controller.state.phase = 'play';
}

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e.message}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message);
}

function runTests() {
  console.log('🧪 Battleship Unit Tests\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: MISSION_HIT
  {
    console.log('TEST 1: MISSION_HIT (target hand)');
    const passed1 = runTest('target hand increments hits', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const stateBefore = controller.state.hits;
      controller.handleCellTap('KQ');
      assertEqual(controller.state.hits, stateBefore + 1, 'hits should increment');
    });
    passed += passed1 ? 1 : 0;
    failed += passed1 ? 0 : 1;

    const passed2 = runTest('target does not decrease grenades', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const grenadesBefore = controller.state.grenades;
      controller.handleCellTap('KQ');
      assertEqual(controller.state.grenades, grenadesBefore, 'grenades should not change for target');
    });
    passed += passed2 ? 1 : 0;
    failed += passed2 ? 0 : 1;

    const passed3 = runTest('target does not create mistake', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const mistakesBefore = controller.state.mistakes.length;
      controller.handleCellTap('KQ');
      assertEqual(controller.state.mistakes.length, mistakesBefore, 'target should not create mistake');
    });
    passed += passed3 ? 1 : 0;
    failed += passed3 ? 0 : 1;

    const passed4 = runTest('memory records MISSION_HIT', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('KQ');
      assertEqual(memory.attempts.length, 1, 'should record 1 attempt');
      assertEqual(memory.attempts[0].context.missionResult, 'MISSION_HIT', 'missionResult should be MISSION_HIT');
      assertEqual(memory.attempts[0].context.strategyOk, true, 'strategyOk should be true');
    });
    passed += passed4 ? 1 : 0;
    failed += passed4 ? 0 : 1;
    console.log();
  }

  // TEST 2: MISSION_OFF_TARGET
  {
    console.log('TEST 2: MISSION_OFF_TARGET (valid range, not target)');
    const passed1 = runTest('off-target does NOT decrease grenades', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const grenadesBefore = controller.state.grenades;
      controller.handleCellTap('KK');
      assertEqual(controller.state.grenades, grenadesBefore, 'grenades should NOT decrease for off-target');
    });
    passed += passed1 ? 1 : 0;
    failed += passed1 ? 0 : 1;

    const passed2 = runTest('off-target does NOT create mistake', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const mistakesBefore = controller.state.mistakes.length;
      controller.handleCellTap('KK');
      assertEqual(controller.state.mistakes.length, mistakesBefore, 'off-target should NOT create mistake');
    });
    passed += passed2 ? 1 : 0;
    failed += passed2 ? 0 : 1;

    const passed3 = runTest('off-target not in missHands', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('KK');
      assertTrue(!controller.state.missHands.has('KK'), 'off-target should NOT be in missHands');
    });
    passed += passed3 ? 1 : 0;
    failed += passed3 ? 0 : 1;

    const passed4 = runTest('off-target marked resolved', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('KK');
      assertTrue(controller.state.resolved.has('KK'), 'off-target should be marked resolved');
    });
    passed += passed4 ? 1 : 0;
    failed += passed4 ? 0 : 1;

    const passed5 = runTest('off-target feedback type', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('KK');
      assertEqual(controller.state.feedback?.type, 'off-target', 'feedback type should be off-target');
    });
    passed += passed5 ? 1 : 0;
    failed += passed5 ? 0 : 1;

    const passed6 = runTest('memory records MISSION_OFF_TARGET', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('KK');
      assertEqual(memory.attempts.length, 1, 'should record 1 attempt');
      assertEqual(memory.attempts[0].context.missionResult, 'MISSION_OFF_TARGET', 'missionResult should be MISSION_OFF_TARGET');
      assertEqual(memory.attempts[0].context.strategyOk, true, 'strategyOk should be true for off-target');
    });
    passed += passed6 ? 1 : 0;
    failed += passed6 ? 0 : 1;
    console.log();
  }

  // TEST 3: OUT_OF_STRATEGY
  {
    console.log('TEST 3: OUT_OF_STRATEGY (invalid range)');
    const passed1 = runTest('out-of-strategy decreases grenades', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const grenadesBefore = controller.state.grenades;
      controller.handleCellTap('92o');
      assertEqual(controller.state.grenades, grenadesBefore - 1, 'grenades should decrease by 1');
    });
    passed += passed1 ? 1 : 0;
    failed += passed1 ? 0 : 1;

    const passed2 = runTest('out-of-strategy increments misses', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const missesBefore = controller.state.misses;
      controller.handleCellTap('92o');
      assertEqual(controller.state.misses, missesBefore + 1, 'misses should increment');
    });
    passed += passed2 ? 1 : 0;
    failed += passed2 ? 0 : 1;

    const passed3 = runTest('out-of-strategy creates mistake', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      const mistakesBefore = controller.state.mistakes.length;
      controller.handleCellTap('92o');
      assertEqual(controller.state.mistakes.length, mistakesBefore + 1, 'should create 1 mistake');
    });
    passed += passed3 ? 1 : 0;
    failed += passed3 ? 0 : 1;

    const passed4 = runTest('out-of-strategy in missHands', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('92o');
      assertTrue(controller.state.missHands.has('92o'), 'out-of-strategy should be in missHands');
    });
    passed += passed4 ? 1 : 0;
    failed += passed4 ? 0 : 1;

    const passed5 = runTest('out-of-strategy feedback type', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('92o');
      assertEqual(controller.state.feedback?.type, 'miss', 'feedback type should be miss');
    });
    passed += passed5 ? 1 : 0;
    failed += passed5 ? 0 : 1;

    const passed6 = runTest('memory records MISSION_MISS', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      controller.handleCellTap('92o');
      assertEqual(memory.attempts.length, 1, 'should record 1 attempt');
      assertEqual(memory.attempts[0].context.missionResult, 'MISSION_MISS', 'missionResult should be MISSION_MISS');
      assertEqual(memory.attempts[0].context.strategyOk, false, 'strategyOk should be false for out-of-strategy');
    });
    passed += passed6 ? 1 : 0;
    failed += passed6 ? 0 : 1;
    console.log();
  }

  // TEST 4: Exactly-once
  {
    console.log('TEST 4: Exactly-once memory recording');
    const passed1 = runTest('one tap = one attempt', () => {
      const memory = new MockLearnerMemory();
      const controller = new BattleshipController({ storage: null, learnerMemory: memory });
      controller.model = createMockModel();
      controller.missions = [createMockMission()];
      setupControllerForTesting(controller);

      memory.attempts = [];
      controller.handleCellTap('KQ');
      assertEqual(memory.attempts.length, 1, 'should record exactly 1 attempt');
    });
    passed += passed1 ? 1 : 0;
    failed += passed1 ? 0 : 1;
    console.log();
  }

  console.log('═══════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════\n');

  return failed === 0 ? 0 : 1;
}

process.exit(runTests());
