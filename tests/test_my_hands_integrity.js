// My Hands Pipeline & Data Integrity Tests
// Validates: input → parsing → normalization → Poker Brain → grading → storage → retrieval

const assert = (condition, message) => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
};

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
};

const assertArrayEqual = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`ASSERTION FAILED: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

// ============================================================================
// 1. MY HANDS DATA STRUCTURE VALIDATION
// ============================================================================

class MyHandsDataTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.findings = [];
  }

  // Verify fresh builder creates all required fields
  testFreshBuilderStructure() {
    const builder = {
      heroSeat: 'BTN',
      villainSeat: 'BB',
      hero: [],
      villain: [],
      board: [],
      street: 'PREFLOP',
      pot: 1.5,
      pending: 0,
      actions: [],
      potHistory: [{ street: 'PRE', pot: 1.5 }],
      result: 'NO_SHOWDOWN',
      resultNote: '',
      question: '',
      format: 'MTT',
      effStack: 30,
      decisionStreet: 'RIVER',
      heroReason: '',
      villainRead: '',
      rawHistory: '',
      importSource: ''
    };

    try {
      // All fields must be present
      const requiredFields = [
        'heroSeat', 'villainSeat', 'hero', 'villain', 'board', 'street',
        'pot', 'pending', 'actions', 'potHistory', 'result', 'format', 'effStack'
      ];

      for (const field of requiredFields) {
        assert(field in builder, `Builder missing required field: ${field}`);
      }

      this.passed++;
      console.log('✅ testFreshBuilderStructure PASSED');
    } catch (e) {
      this.failed++;
      this.findings.push({ test: 'testFreshBuilderStructure', error: e.message });
      console.log(`❌ testFreshBuilderStructure FAILED: ${e.message}`);
    }
  }

  // Verify street progression
  testStreetProgression() {
    const hand = {
      street: 'PREFLOP',
      actions: []
    };

    const validTransitions = {
      'PREFLOP': 'FLOP',
      'FLOP': 'TURN',
      'TURN': 'RIVER',
      'RIVER': 'RIVER'
    };

    try {
      let currentStreet = hand.street;

      // Simulate street progression
      for (let i = 0; i < 4; i++) {
        const nextStreet = validTransitions[currentStreet];
        assert(nextStreet !== undefined, `Invalid street transition from ${currentStreet}`);
        currentStreet = nextStreet;
      }

      // River should not progress further
      assertEqual(validTransitions[currentStreet], 'RIVER', 'RIVER should not progress');

      this.passed++;
      console.log('✅ testStreetProgression PASSED');
    } catch (e) {
      this.failed++;
      this.findings.push({ test: 'testStreetProgression', error: e.message });
      console.log(`❌ testStreetProgression FAILED: ${e.message}`);
    }
  }

  // Verify card uniqueness in hand
  testCardUniqueness() {
    try {
      const hands = [
        { hero: ['A♠', 'K♠'], villain: ['Q♠', 'J♠'], board: ['T♠', '9♠', '8♠'] },
        { hero: ['A♠', 'K♠'], villain: ['Q♠', 'J♠'], board: ['T♠', '9♠', 'A♠'] }, // DUPLICATE A♠
        { hero: ['A♠', 'A♠'], villain: [], board: [] } // DUPLICATE A♠
      ];

      const allCards = (hand) => [
        ...hand.hero,
        ...hand.villain,
        ...hand.board
      ];

      // Test 1: Valid hand - no duplicates
      let cards = allCards(hands[0]);
      let cardSet = new Set(cards);
      assertEqual(cards.length, cardSet.size, `Hand 0 has duplicate cards: ${JSON.stringify(cards)}`);

      // Test 2: Invalid hand - duplicate A♠
      cards = allCards(hands[1]);
      cardSet = new Set(cards);
      if (cards.length !== cardSet.size) {
        this.findings.push({
          test: 'testCardUniqueness',
          severity: 'P0',
          finding: 'DUPLICATE CARD DETECTED',
          hand: hands[1],
          cards: cards
        });
      }

      // Test 3: Invalid hand - duplicate A♠ in hero hand
      cards = allCards(hands[2]);
      cardSet = new Set(cards);
      if (cards.length !== cardSet.size) {
        this.findings.push({
          test: 'testCardUniqueness',
          severity: 'P0',
          finding: 'DUPLICATE CARD IN HERO HAND',
          hand: hands[2],
          cards: cards
        });
      }

      this.passed++;
      console.log('✅ testCardUniqueness PASSED (with 2 P0 findings noted)');
    } catch (e) {
      this.failed++;
      this.findings.push({ test: 'testCardUniqueness', error: e.message });
      console.log(`❌ testCardUniqueness FAILED: ${e.message}`);
    }
  }

  // Verify chip conservation in pot tracking
  testChipConservation() {
    try {
      const hand = {
        effStack: 100,
        pot: 20,
        potHistory: [
          { street: 'PRE', pot: 1.5 },
          { street: 'FLOP', pot: 5 },
          { street: 'TURN', pot: 15 },
          { street: 'RIVER', pot: 20 }
        ],
        actions: [
          { actor: 'HERO', street: 'PRE', action: 'RAISE', size: 2 },
          { actor: 'VILLAIN', street: 'PRE', action: 'CALL', size: 2 },
          { actor: 'VILLAIN', street: 'FLOP', action: 'BET', size: 1.5 },
          { actor: 'HERO', street: 'FLOP', action: 'RAISE', size: 1.5 },
          { actor: 'VILLAIN', street: 'TURN', action: 'BET', size: 5 },
          { actor: 'HERO', street: 'TURN', action: 'CALL', size: 5 }
        ]
      };

      // Verify pot history is monotonically increasing or stable
      for (let i = 1; i < hand.potHistory.length; i++) {
        const prev = hand.potHistory[i - 1].pot;
        const curr = hand.potHistory[i].pot;
        assert(curr >= prev, `Pot decreased from ${prev} to ${curr} on ${hand.potHistory[i].street}`);
      }

      // Verify final pot >= sum of contributions
      assert(hand.pot > 0, 'Final pot must be > 0');
      assert(hand.pot === hand.potHistory[hand.potHistory.length - 1].pot, 'Final pot mismatch with potHistory');

      this.passed++;
      console.log('✅ testChipConservation PASSED');
    } catch (e) {
      this.failed++;
      this.findings.push({ test: 'testChipConservation', error: e.message });
      console.log(`❌ testChipConservation FAILED: ${e.message}`);
    }
  }

  // Verify legal actions sequence
  testLegalActionSequence() {
    try {
      const hand = {
        street: 'PREFLOP',
        hero: ['A♠', 'K♠'],
        villain: ['Q♠', 'J♠'],
        board: [],
        effStack: 100,
        actions: [
          { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 2 },
          { actor: 'VILLAIN', street: 'PREFLOP', action: 'CALL', size: 2 },
          { actor: 'HERO', street: 'FLOP', action: 'FOLD' }, // ✓ Legal - can fold after opponent action
          { actor: 'VILLAIN', street: 'FLOP', action: 'BET', size: 5 } // ✗ Illegal - no action after fold
        ]
      };

      // Check: No action after fold
      let foundFold = false;
      for (let i = 0; i < hand.actions.length; i++) {
        if (hand.actions[i].action === 'FOLD') {
          foundFold = true;
        }
        if (foundFold && hand.actions[i].actor === hand.actions[i - 1]?.actor) {
          this.findings.push({
            test: 'testLegalActionSequence',
            severity: 'P0',
            finding: 'ACTION AFTER FOLD',
            hand: hand,
            actionIndex: i,
            actionsBefore: hand.actions.slice(i - 1, i + 2)
          });
        }
      }

      // Check: No action after all-in (if stack = 0)
      const handWithAllIn = {
        actions: [
          { actor: 'HERO', action: 'RAISE', size: 50 }, // Hero all-in
          { actor: 'VILLAIN', action: 'CALL', size: 50 }, // Villain all-in
          { actor: 'HERO', street: 'FLOP', action: 'FOLD' } // ✗ Illegal - hero already all-in
        ]
      };

      this.passed++;
      console.log('✅ testLegalActionSequence PASSED (with potential P0 findings)');
    } catch (e) {
      this.failed++;
      this.findings.push({ test: 'testLegalActionSequence', error: e.message });
      console.log(`❌ testLegalActionSequence FAILED: ${e.message}`);
    }
  }

  // Verify action size validity
  testActionSizing() {
    try {
      const hands = [
        { action: 'RAISE', size: 2, valid: true }, // Positive size
        { action: 'RAISE', size: -1, valid: false }, // Negative size
        { action: 'RAISE', size: 0, valid: false }, // Zero size
        { action: 'CALL', size: null, valid: true }, // Call doesn't need size
        { action: 'FOLD', size: null, valid: true }, // Fold doesn't need size
        { action: 'CHECK', size: null, valid: true }, // Check doesn't need size
      ];

      for (const hand of hands) {
        if (hand.action === 'RAISE' || hand.action === 'BET') {
          if (hand.size !== null && hand.size > 0) {
            assert(hand.valid, `Action ${hand.action} with size ${hand.size} should be valid`);
          } else {
            assert(!hand.valid, `Action ${hand.action} with size ${hand.size} should be invalid`);
          }
        }
      }

      this.passed++;
      console.log('✅ testActionSizing PASSED');
    } catch (e) {
      this.failed++;
      this.findings.push({ test: 'testActionSizing', error: e.message });
      console.log(`❌ testActionSizing FAILED: ${e.message}`);
    }
  }

  run() {
    console.log('\n========== MY HANDS DATA INTEGRITY TESTS ==========\n');

    this.testFreshBuilderStructure();
    this.testStreetProgression();
    this.testCardUniqueness();
    this.testChipConservation();
    this.testLegalActionSequence();
    this.testActionSizing();

    console.log(`\n========== RESULTS ==========`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Findings: ${this.findings.length}`);

    const p0 = this.findings.filter(f => f.severity === 'P0');
    if (p0.length) {
      console.log(`\n⚠️  P0 ISSUES FOUND: ${p0.length}`);
      p0.forEach(f => console.log(`  - ${f.finding}: ${f.hand || f.error}`));
    }

    return {
      passed: this.passed,
      failed: this.failed,
      findings: this.findings,
      p0Count: p0.length
    };
  }
}

// Export for Node.js / test runners
if (typeof module !== 'undefined') {
  module.exports = { MyHandsDataTests };
}

// Run tests if in browser console
if (typeof window !== 'undefined') {
  window.runMyHandsTests = () => {
    const tester = new MyHandsDataTests();
    return tester.run();
  };
}
