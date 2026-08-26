/**
 * Hand Data Validation Layer — PHASE 16
 * Validates poker hand data across: loading, saving, and analysis stages
 * P0-1: Storage data loss prevention
 * P0-2: Card uniqueness validation
 * P0-3: Action legality validation
 */

const HandValidation = (() => {
  const VALID_STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
  const VALID_ACTIONS = ['FOLD', 'CALL', 'CHECK', 'BET', 'RAISE', 'PUSH'];
  const VALID_POSITIONS = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const VALID_RESULTS = ['HERO_WIN', 'VILLAIN_WIN', 'CHOP', 'NO_SHOWDOWN'];
  const VALID_FORMATS = ['MTT', 'CASH'];

  // ===== CARD VALIDATION =====

  function isValidCard(card) {
    if (typeof card !== 'string') return false;
    const match = card.match(/^[2-9TJQKA][♠♥♦♣]$/);
    return !!match;
  }

  function getAllCards(hand) {
    const cards = new Set();
    if (Array.isArray(hand.hero)) hand.hero.forEach(c => cards.add(c));
    if (Array.isArray(hand.villain)) hand.villain.forEach(c => cards.add(c));
    if (Array.isArray(hand.board)) hand.board.forEach(c => cards.add(c));
    return cards;
  }

  // P0-2: Card uniqueness validation
  function validateCardUniqueness(hand) {
    const hero = hand.hero || [];
    const villain = hand.villain || [];
    const board = hand.board || [];

    // Check all cards are valid
    [...hero, ...villain, ...board].forEach(card => {
      if (!isValidCard(card)) {
        return { valid: false, error: `Invalid card format: ${card}` };
      }
    });

    // Check hero cards (must be exactly 2 if present)
    if (hero.length > 0 && hero.length !== 2) {
      return { valid: false, error: `Hero must have 0 or 2 cards, got ${hero.length}` };
    }

    // Check uniqueness
    const allCards = getAllCards(hand);
    const totalCards = hero.length + villain.length + board.length;

    if (allCards.size !== totalCards) {
      const duplicates = [];
      const seen = new Set();
      [...hero, ...villain, ...board].forEach(card => {
        if (seen.has(card)) duplicates.push(card);
        seen.add(card);
      });
      return {
        valid: false,
        error: `Duplicate cards found: ${duplicates.join(', ')}`,
        duplicates
      };
    }

    return { valid: true };
  }

  // ===== ACTION SEQUENCE VALIDATION =====

  // P0-3: Action legality validation with betting state machine
  function validateActionSequence(hand) {
    const actions = hand.actions || [];
    if (actions.length === 0) return { valid: true };

    const effStack = hand.effStack || 100;
    const streetOrder = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

    // Betting state per actor
    const state = {
      HERO: { contributed: 0, remaining: effStack, allIn: false },
      VILLAIN: { contributed: 0, remaining: effStack, allIn: false }
    };

    let currentBetTo = 0;  // How much the aggressor bet/raised to
    let lastActor = null;
    let lastActorWasFold = false;
    let handEnded = false;
    let lastStreet = 'PREFLOP';
    let streetRoundClosed = false;
    let hasAnyAction = false;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Required fields
      if (!action.actor || !action.action) {
        return { valid: false, error: `Action ${i} missing actor or action` };
      }

      if (!['HERO', 'VILLAIN'].includes(action.actor)) {
        return { valid: false, error: `Invalid actor: ${action.actor}` };
      }

      if (!VALID_ACTIONS.includes(action.action)) {
        return { valid: false, error: `Invalid action: ${action.action}` };
      }

      const street = action.street || lastStreet;
      const streetChanged = street !== lastStreet;

      // P0-3-0: Reset betting state on new street (bets don't carry over)
      if (streetChanged) {
        currentBetTo = 0;
      }

      // P0-3-1: No action after fold
      if (lastActorWasFold && action.actor === lastActor) {
        // Same actor acting twice means first action wasn't fold
        lastActorWasFold = false;
      }
      if (lastActorWasFold && action.actor !== lastActor) {
        return {
          valid: false,
          error: `Action after fold at index ${i}: cannot continue after fold`
        };
      }

      // P0-3-2: No action after hand ends
      if (handEnded) {
        return { valid: false, error: `Action after hand ended at index ${i}` };
      }

      // P0-3-3: Street progression validation
      const lastIdx = streetOrder.indexOf(lastStreet);
      const currIdx = streetOrder.indexOf(street);
      if (currIdx < lastIdx) {
        return { valid: false, error: `Invalid street regression at ${i}: ${street} < ${lastStreet}` };
      }

      // P0-3-4: Bet sizing validation
      if ((action.action === 'BET' || action.action === 'RAISE' || action.action === 'PUSH') && action.size !== undefined) {
        if (typeof action.size !== 'number' || action.size <= 0) {
          return { valid: false, error: `Invalid bet size at ${i}: ${action.size} must be > 0` };
        }
        // Size cannot exceed remaining stack
        if (action.size > state[action.actor].remaining + state[action.actor].contributed) {
          return { valid: false, error: `Bet size ${action.size} exceeds stack at ${i}` };
        }
      }

      // P0-3-5: Action-specific validation
      const amountToCall = Math.max(0, currentBetTo - state[action.actor].contributed);

      if (action.action === 'CHECK') {
        // CHECK only legal if no bet to call (amountToCall === 0)
        if (amountToCall > 0) {
          return { valid: false, error: `Cannot CHECK facing bet of ${amountToCall} at ${i}` };
        }
        // First action preflop cannot be CHECK (must address big blind)
        if (i === 0 && street === 'PREFLOP') {
          return { valid: false, error: `Cannot CHECK as first action preflop at ${i}` };
        }
      }

      if (action.action === 'CALL') {
        // CALL requires something to call
        if (amountToCall <= 0 && currentBetTo > 0) {
          return { valid: false, error: `Cannot CALL: already matched bet at ${i}` };
        }
        if (amountToCall === 0 && currentBetTo === 0) {
          return { valid: false, error: `Cannot CALL: no bet to call at ${i}` };
        }
      }

      if (action.action === 'BET' && currentBetTo > 0) {
        // Can't BET when facing a bet, must RAISE
        return { valid: false, error: `Cannot BET facing bet at ${i}, must RAISE` };
      }

      if (action.action === 'RAISE') {
        // RAISE must be greater than current bet
        const raiseSize = action.size || 0;
        if (raiseSize <= currentBetTo) {
          return { valid: false, error: `Raise ${raiseSize} not greater than bet ${currentBetTo} at ${i}` };
        }
      }

      // Update betting state
      if (action.action === 'BET' || action.action === 'RAISE') {
        currentBetTo = action.size || 0;
        state[action.actor].contributed = state[action.actor].contributed + (action.size || 0);
        state[action.actor].remaining -= (action.size || 0);
      } else if (action.action === 'CALL') {
        const toAdd = amountToCall;
        state[action.actor].contributed += toAdd;
        state[action.actor].remaining -= toAdd;
      } else if (action.action === 'PUSH') {
        // All-in
        const allInAmount = state[action.actor].remaining + state[action.actor].contributed;
        state[action.actor].allIn = true;
        state[action.actor].contributed = allInAmount;
        state[action.actor].remaining = 0;
        currentBetTo = allInAmount;
      } else if (action.action === 'FOLD') {
        lastActorWasFold = true;
        handEnded = true;
      }

      // Check if both are all-in
      if (state.HERO.allIn && state.VILLAIN.allIn) {
        handEnded = true;
      }

      // Negative stack is illegal
      if (state[action.actor].remaining < 0) {
        return { valid: false, error: `Negative stack for ${action.actor} at ${i}` };
      }

      lastActor = action.actor;
      lastStreet = street;
    }

    return { valid: true };
  }

  // ===== HAND STRUCTURE VALIDATION =====

  function validateHandStructure(hand) {
    if (!hand || typeof hand !== 'object') {
      return { valid: false, error: 'Hand must be an object' };
    }

    // Required fields
    const required = ['hero', 'villain', 'board', 'street', 'pot', 'actions', 'effStack', 'format', 'result'];
    for (const field of required) {
      if (!(field in hand)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Field type checks
    if (!Array.isArray(hand.hero)) return { valid: false, error: 'hero must be array' };
    if (!Array.isArray(hand.villain)) return { valid: false, error: 'villain must be array' };
    if (!Array.isArray(hand.board)) return { valid: false, error: 'board must be array' };
    if (typeof hand.street !== 'string') return { valid: false, error: 'street must be string' };
    if (typeof hand.pot !== 'number') return { valid: false, error: 'pot must be number' };
    if (!Array.isArray(hand.actions)) return { valid: false, error: 'actions must be array' };
    if (typeof hand.effStack !== 'number') return { valid: false, error: 'effStack must be number' };

    // Value checks
    if (!VALID_STREETS.includes(hand.street)) {
      return { valid: false, error: `Invalid street: ${hand.street}` };
    }
    if (!VALID_FORMATS.includes(hand.format)) {
      return { valid: false, error: `Invalid format: ${hand.format}` };
    }
    if (!VALID_RESULTS.includes(hand.result)) {
      return { valid: false, error: `Invalid result: ${hand.result}` };
    }
    if (hand.pot < 0) return { valid: false, error: 'pot cannot be negative' };
    if (hand.effStack <= 0) return { valid: false, error: 'effStack must be positive' };

    return { valid: true };
  }

  // ===== POT HISTORY VALIDATION =====

  function validatePotHistory(hand) {
    const potHistory = hand.potHistory || [];

    if (!Array.isArray(potHistory)) {
      return { valid: false, error: 'potHistory must be array' };
    }

    for (let i = 0; i < potHistory.length; i++) {
      const entry = potHistory[i];
      if (!entry.street || typeof entry.pot !== 'number') {
        return { valid: false, error: `potHistory entry ${i} missing street or pot` };
      }

      // Check monotonic increase
      if (i > 0) {
        const prevPot = potHistory[i - 1].pot;
        if (entry.pot < prevPot) {
          return { valid: false, error: `potHistory decreased at index ${i}: ${prevPot} -> ${entry.pot}` };
        }
      }
    }

    return { valid: true };
  }

  // ===== COMPLETE HAND VALIDATION =====

  function validateHand(hand, strict = true) {
    // Structure validation (required for all)
    const structCheck = validateHandStructure(hand);
    if (!structCheck.valid) return structCheck;

    // Card uniqueness (P0-2)
    const cardCheck = validateCardUniqueness(hand);
    if (!cardCheck.valid) return cardCheck;

    // Action sequence (P0-3)
    const actionCheck = validateActionSequence(hand);
    if (!actionCheck.valid) return actionCheck;

    // Pot history validation
    const potCheck = validatePotHistory(hand);
    if (!potCheck.valid && strict) return potCheck;

    return { valid: true };
  }

  // ===== SAFE LOAD DESERIALIZATION =====

  function safeLoadHands(oldHands, lastValidState = null) {
    if (!Array.isArray(oldHands)) {
      return {
        valid: false,
        hands: lastValidState || [],
        error: `Corrupted localStorage: hands field is ${typeof oldHands}, not array`,
        recovered: !!lastValidState
      };
    }

    const recovered = [];
    const invalid = [];

    for (let i = 0; i < oldHands.length; i++) {
      const validation = validateHand(oldHands[i], false);
      if (validation.valid) {
        recovered.push(oldHands[i]);
      } else {
        invalid.push({ index: i, error: validation.error, hand: oldHands[i] });
      }
    }

    return {
      valid: invalid.length === 0,
      hands: recovered,
      invalid,
      recoveredCount: recovered.length,
      invalidCount: invalid.length
    };
  }

  // ===== PUBLIC API =====

  return {
    validateHand,
    validateHandStructure,
    validateCardUniqueness,
    validateActionSequence,
    validatePotHistory,
    safeLoadHands,
    isValidCard,
    getAllCards,
    VALID_STREETS,
    VALID_ACTIONS,
    VALID_POSITIONS,
    VALID_RESULTS,
    VALID_FORMATS
  };
})();

// Export for Node.js / test runners (ES modules)
export { HandValidation };
