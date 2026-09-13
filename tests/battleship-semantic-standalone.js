/**
 * Standalone Battleship Semantic Test
 * Runs without vitest to verify core gameplay logic
 */

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

async function runTests() {
  console.log('🧪 Battleship Semantic Verification - Standalone Tests\n');

  let passCount = 0;
  let failCount = 0;

  // Load test model
  console.log('Loading test model...');
  const sel = {
    dataSource: 'trainer',
    position: 'EP',
    stackBand: '6-8',
    trainerSourceMode: 'uo',
    situation: 'uo_open'
  };

  let testModel, testMissions;
  try {
    const matrix = await buildTrainerMatrixAsync(sel);
    testModel = buildRangeModelFromMatrix(matrix);
    testMissions = buildMissions(testModel);
    console.log(`✓ Model loaded: ${testModel.openSet.size} open hands, ${testMissions.length} missions\n`);
  } catch (e) {
    console.error('✗ Failed to load test model:', e.message);
    process.exit(1);
  }

  // TEST 1: MISSION_HIT
  {
    console.log('TEST 1: MISSION_HIT (target hand)');
    const mockMemory = new MockLearnerMemory();
    const controller = new BattleshipController({ storage: null, learnerMemory: mockMemory });

    controller.model = testModel;
    controller.missions = testMissions;
    controller.state.phase = 'play';
    controller.state.status = 'playing';
    controller.state.missionIndex = 0;
    controller.state.grenades = 7;

    const mission = testMissions[0];
    const targets = mission.getTargetHands();
    const targetHand = targets[0];

    const stateBefore = {
      hits: controller.state.hits,
      grenades: controller.state.grenades,
      misses: controller.state.misses,
      mistakes: controller.state.mistakes.length
    };

    controller.handleCellTap(targetHand);

    const checks = [
      ['hits increased', controller.state.hits === stateBefore.hits + 1],
      ['grenades unchanged', controller.state.grenades === stateBefore.grenades],
      ['misses unchanged', controller.state.misses === stateBefore.misses],
      ['no mistake added', controller.state.mistakes.length === stateBefore.mistakes],
      ['memory recorded', mockMemory.attempts.length === 1],
      ['missionResult=MISSION_HIT', mockMemory.attempts[0]?.context?.missionResult === 'MISSION_HIT'],
      ['strategyOk=true', mockMemory.attempts[0]?.context?.strategyOk === true]
    ];

    checks.forEach(([name, passed]) => {
      if (passed) {
        console.log(`  ✓ ${name}`);
        passCount++;
      } else {
        console.log(`  ✗ ${name}`);
        failCount++;
      }
    });
    console.log();
  }

  // TEST 2: MISSION_OFF_TARGET
  {
    console.log('TEST 2: MISSION_OFF_TARGET (valid range, not target)');
    const mockMemory = new MockLearnerMemory();
    const controller = new BattleshipController({ storage: null, learnerMemory: mockMemory });

    controller.model = testModel;
    controller.missions = testMissions;
    controller.state.phase = 'play';
    controller.state.status = 'playing';
    controller.state.missionIndex = 0;
    controller.state.grenades = 7;

    const mission = testMissions[0];
    const targets = new Set(mission.getTargetHands());

    let offTargetHand = null;
    for (const hand of testModel.openSet) {
      if (!targets.has(hand)) {
        offTargetHand = hand;
        break;
      }
    }

    if (!offTargetHand) {
      console.log('  ⚠ SKIPPED: No off-target hands available');
      console.log();
      return;
    }

    const stateBefore = {
      grenades: controller.state.grenades,
      misses: controller.state.misses,
      mistakes: controller.state.mistakes.length,
      missHands: controller.state.missHands.size
    };

    controller.handleCellTap(offTargetHand);

    const checks = [
      ['grenades NOT decreased', controller.state.grenades === stateBefore.grenades],
      ['misses NOT increased', controller.state.misses === stateBefore.misses],
      ['no mistake added', controller.state.mistakes.length === stateBefore.mistakes],
      ['NOT in missHands', !controller.state.missHands.has(offTargetHand)],
      ['marked resolved', controller.state.resolved.has(offTargetHand)],
      ['feedback type=off-target', controller.state.feedback.type === 'off-target'],
      ['memory recorded', mockMemory.attempts.length === 1],
      ['missionResult=MISSION_OFF_TARGET', mockMemory.attempts[0]?.context?.missionResult === 'MISSION_OFF_TARGET'],
      ['strategyOk=true', mockMemory.attempts[0]?.context?.strategyOk === true]
    ];

    checks.forEach(([name, passed]) => {
      if (passed) {
        console.log(`  ✓ ${name}`);
        passCount++;
      } else {
        console.log(`  ✗ ${name}`);
        failCount++;
      }
    });
    console.log();
  }

  // TEST 3: OUT_OF_STRATEGY
  {
    console.log('TEST 3: OUT_OF_STRATEGY (invalid range)');
    const mockMemory = new MockLearnerMemory();
    const controller = new BattleshipController({ storage: null, learnerMemory: mockMemory });

    controller.model = testModel;
    controller.missions = testMissions;
    controller.state.phase = 'play';
    controller.state.status = 'playing';
    controller.state.missionIndex = 0;
    controller.state.grenades = 7;

    // Find a hand outside the range
    const ranks = [...'AKQJT98765432'];
    let outOfStrategyHand = null;
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        let hand;
        if (r === c) hand = ranks[r] + ranks[c];
        else if (r < c) hand = ranks[r] + ranks[c] + 's';
        else hand = ranks[c] + ranks[r] + 'o';

        if (!testModel.openSet.has(hand) && !testModel.blockedHands.has(hand)) {
          outOfStrategyHand = hand;
          break;
        }
      }
      if (outOfStrategyHand) break;
    }

    if (!outOfStrategyHand) {
      console.log('  ⚠ SKIPPED: No out-of-range hands available');
      console.log();
      return;
    }

    const stateBefore = {
      grenades: controller.state.grenades,
      misses: controller.state.misses,
      mistakes: controller.state.mistakes.length,
      missHands: controller.state.missHands.size
    };

    controller.handleCellTap(outOfStrategyHand);

    const checks = [
      ['grenades decreased by 1', controller.state.grenades === stateBefore.grenades - 1],
      ['misses increased by 1', controller.state.misses === stateBefore.misses + 1],
      ['mistake added', controller.state.mistakes.length === stateBefore.mistakes + 1],
      ['in missHands', controller.state.missHands.has(outOfStrategyHand)],
      ['feedback type=miss', controller.state.feedback.type === 'miss'],
      ['memory recorded', mockMemory.attempts.length === 1],
      ['missionResult=MISSION_MISS', mockMemory.attempts[0]?.context?.missionResult === 'MISSION_MISS'],
      ['strategyOk=false', mockMemory.attempts[0]?.context?.strategyOk === false]
    ];

    checks.forEach(([name, passed]) => {
      if (passed) {
        console.log(`  ✓ ${name}`);
        passCount++;
      } else {
        console.log(`  ✗ ${name}`);
        failCount++;
      }
    });
    console.log();
  }

  // TEST 4: Exactly-once recording
  {
    console.log('TEST 4: Exactly-once memory recording');
    const mockMemory = new MockLearnerMemory();
    const controller = new BattleshipController({ storage: null, learnerMemory: mockMemory });

    controller.model = testModel;
    controller.missions = testMissions;
    controller.state.phase = 'play';
    controller.state.status = 'playing';
    controller.state.missionIndex = 0;

    const mission = testMissions[0];
    const targetHand = mission.getTargetHands()[0];

    mockMemory.attempts = [];
    controller.handleCellTap(targetHand);

    const passed = mockMemory.attempts.length === 1;
    if (passed) {
      console.log(`  ✓ Exactly 1 attempt recorded per tap`);
      passCount++;
    } else {
      console.log(`  ✗ Expected 1 attempt, got ${mockMemory.attempts.length}`);
      failCount++;
    }
    console.log();
  }

  // SUMMARY
  console.log('═══════════════════════════════════════');
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('═══════════════════════════════════════\n');

  if (failCount === 0) {
    console.log('✅ All semantic tests passed');
    return 0;
  } else {
    console.log('❌ Some tests failed');
    return 1;
  }
}

runTests().then(code => process.exit(code));
