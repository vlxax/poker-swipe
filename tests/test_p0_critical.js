/**
 * Phase 16: P0 Critical Path Tests (SECOND PASS)
 * Strict betting state machine validation
 */

class P0CriticalTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  assert(condition, message) {
    if (!condition) throw new Error(`${message}`);
  }

  run() {
    console.log('\n========== P0 CRITICAL PATH TESTS ==========\n');

    this.test_IllegalCallNobet();
    this.test_CheckFacingBet();
    this.test_BetWhenFacingBet();
    this.test_RaiseTooSmall();
    this.test_CorruptedStorageSafety();
    this.test_CardDuplicateHero();
    this.test_CardDuplicateBoard();
    this.test_ActionAfterFold();
    this.test_BothAllIn();
    this.test_ValidNormalHand();

    console.log(`\n========== RESULTS ==========`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);
    console.log(`Pass Rate: ${Math.round(this.passed / (this.passed + this.failed) * 100)}%`);

    return {
      passed: this.passed,
      failed: this.failed,
      passRate: Math.round(this.passed / (this.passed + this.failed) * 100)
    };
  }

  test_IllegalCallNobet() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: [],
        board: ['T♠', '9♠', '8♠'],
        street: 'FLOP',
        pot: 5,
        pending: 0,
        actions: [
          { actor: 'VILLAIN', street: 'FLOP', action: 'CHECK' },
          { actor: 'HERO', street: 'FLOP', action: 'CALL' }
        ],
        potHistory: [{ street: 'FLOP', pot: 5 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: 'test',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateActionSequence(hand);
      this.assert(!v.valid, 'Should reject CALL with no bet');
      this.assert(v.error.includes('CALL'), 'Error should mention CALL');

      this.passed++;
      console.log('✅ test_IllegalCallNobet');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_IllegalCallNobet: ${e.message}`);
    }
  }

  test_CheckFacingBet() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: [],
        board: ['T♠', '9♠', '8♠'],
        street: 'FLOP',
        pot: 10,
        pending: 5,
        actions: [
          { actor: 'VILLAIN', street: 'FLOP', action: 'BET', size: 5 },
          { actor: 'HERO', street: 'FLOP', action: 'CHECK' }
        ],
        potHistory: [{ street: 'FLOP', pot: 10 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: 'test',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateActionSequence(hand);
      this.assert(!v.valid, 'Should reject CHECK facing bet');
      this.assert(v.error.includes('CHECK'), 'Error should mention CHECK');

      this.passed++;
      console.log('✅ test_CheckFacingBet');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_CheckFacingBet: ${e.message}`);
    }
  }

  test_BetWhenFacingBet() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: [],
        board: ['T♠', '9♠', '8♠'],
        street: 'FLOP',
        pot: 10,
        pending: 5,
        actions: [
          { actor: 'VILLAIN', street: 'FLOP', action: 'BET', size: 5 },
          { actor: 'HERO', street: 'FLOP', action: 'BET', size: 7 }
        ],
        potHistory: [{ street: 'FLOP', pot: 10 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: 'test',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateActionSequence(hand);
      this.assert(!v.valid, 'Should reject BET when facing bet');
      this.assert(v.error.includes('BET'), 'Error should mention BET');

      this.passed++;
      console.log('✅ test_BetWhenFacingBet');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_BetWhenFacingBet: ${e.message}`);
    }
  }

  test_RaiseTooSmall() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: [],
        board: [],
        street: 'PREFLOP',
        pot: 1.5,
        pending: 2.5,
        actions: [
          { actor: 'VILLAIN', street: 'PREFLOP', action: 'RAISE', size: 2.5 },
          { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 2.5 }
        ],
        potHistory: [{ street: 'PRE', pot: 1.5 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: 'test',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateActionSequence(hand);
      this.assert(!v.valid, 'Should reject raise not greater than previous');
      this.assert(v.error.includes('greater'), 'Error should mention raise amount');

      this.passed++;
      console.log('✅ test_RaiseTooSmall');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_RaiseTooSmall: ${e.message}`);
    }
  }

  test_CorruptedStorageSafety() {
    try {
      const corrupted = { 0: { hero: ['A♠'] } };
      const result = HandValidation.safeLoadHands(corrupted);

      this.assert(!result.valid, 'Should flag corrupted as invalid');
      this.assert(Array.isArray(result.hands), 'Should return hands array');
      this.assert(result.hands.length === 0, 'Should not load corrupted data');
      this.assert(result.error, 'Should provide error message');

      this.passed++;
      console.log('✅ test_CorruptedStorageSafety');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_CorruptedStorageSafety: ${e.message}`);
    }
  }

  test_CardDuplicateHero() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'A♠'],
        villain: [],
        board: [],
        street: 'PREFLOP',
        pot: 1.5,
        pending: 0,
        actions: [],
        potHistory: [{ street: 'PRE', pot: 1.5 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: '',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateCardUniqueness(hand);
      this.assert(!v.valid, 'Should reject duplicate hero card');
      this.assert(v.duplicates && v.duplicates.length > 0, 'Should list duplicates');

      this.passed++;
      console.log('✅ test_CardDuplicateHero');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_CardDuplicateHero: ${e.message}`);
    }
  }

  test_CardDuplicateBoard() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: [],
        board: ['T♠', 'T♠', '8♠'],
        street: 'FLOP',
        pot: 10,
        pending: 0,
        actions: [],
        potHistory: [{ street: 'FLOP', pot: 10 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: '',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateCardUniqueness(hand);
      this.assert(!v.valid, 'Should reject duplicate board card');

      this.passed++;
      console.log('✅ test_CardDuplicateBoard');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_CardDuplicateBoard: ${e.message}`);
    }
  }

  test_ActionAfterFold() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: [],
        board: [],
        street: 'PREFLOP',
        pot: 1.5,
        pending: 0,
        actions: [
          { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 2.5 },
          { actor: 'VILLAIN', street: 'PREFLOP', action: 'FOLD' },
          { actor: 'HERO', street: 'PREFLOP', action: 'CHECK' }
        ],
        potHistory: [{ street: 'PRE', pot: 1.5 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: 'test',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateActionSequence(hand);
      this.assert(!v.valid, 'Should reject action after fold');
      this.assert(v.error.includes('fold'), 'Error should mention fold');

      this.passed++;
      console.log('✅ test_ActionAfterFold');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_ActionAfterFold: ${e.message}`);
    }
  }

  test_BothAllIn() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: [],
        board: [],
        street: 'PREFLOP',
        pot: 60,
        pending: 0,
        actions: [
          { actor: 'HERO', street: 'PREFLOP', action: 'PUSH', size: 30 },
          { actor: 'VILLAIN', street: 'PREFLOP', action: 'PUSH', size: 30 },
          { actor: 'HERO', street: 'FLOP', action: 'BET', size: 5 }
        ],
        potHistory: [{ street: 'PRE', pot: 60 }],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'RIVER',
        heroReason: 'test',
        villainRead: '',
        question: '',
        resultNote: ''
      };

      const v = HandValidation.validateActionSequence(hand);
      this.assert(!v.valid, 'Should reject action when both all-in');

      this.passed++;
      console.log('✅ test_BothAllIn');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_BothAllIn: ${e.message}`);
    }
  }

  test_ValidNormalHand() {
    try {
      const hand = {
        heroSeat: 'BTN',
        villainSeat: 'BB',
        hero: ['A♠', 'K♠'],
        villain: ['Q♦', 'J♦'],
        board: ['T♠', '9♠', '8♠'],
        street: 'FLOP',
        pot: 10,
        pending: 0,
        actions: [
          { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 2.5 },
          { actor: 'VILLAIN', street: 'PREFLOP', action: 'CALL', size: 2.5 },
          { actor: 'VILLAIN', street: 'FLOP', action: 'CHECK' },
          { actor: 'HERO', street: 'FLOP', action: 'BET', size: 5 }
        ],
        potHistory: [
          { street: 'PRE', pot: 6 },
          { street: 'FLOP', pot: 10 }
        ],
        result: 'NO_SHOWDOWN',
        format: 'MTT',
        effStack: 30,
        decisionStreet: 'FLOP',
        heroReason: 'Strong equity',
        villainRead: 'Wide',
        question: 'Correct bet size?',
        resultNote: ''
      };

      const v = HandValidation.validateHand(hand, false);
      this.assert(v.valid, `Valid hand should pass: ${v.error || ''}`);

      this.passed++;
      console.log('✅ test_ValidNormalHand');
    } catch (e) {
      this.failed++;
      console.log(`❌ test_ValidNormalHand: ${e.message}`);
    }
  }
}

export { P0CriticalTests };

if (typeof window !== 'undefined') {
  window.runP0Critical = () => {
    const tester = new P0CriticalTests();
    return tester.run();
  };
}
