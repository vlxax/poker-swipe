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

  // P0-3: Action legality validation
  function validateActionSequence(hand) {
    const actions = hand.actions || [];
    if (actions.length === 0) return { valid: true };

    let lastActorWasFold = false;
    let allInActors = new Set();
    let handEnded = false;
    let lastStreet = 'PREFLOP';
    let pending = hand.pending || 0;
    let lastActor = null;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Check required fields
      if (!action.actor || !action.action) {
        return { valid: false, error: `Action ${i} missing actor or action` };
      }

      // Check valid actor
      if (!['HERO', 'VILLAIN'].includes(action.actor)) {
        return { valid: false, error: `Invalid actor: ${action.actor}` };
      }

      // Check valid action
      if (!VALID_ACTIONS.includes(action.action)) {
        return { valid: false, error: `Invalid action: ${action.action}` };
      }

      const street = action.street || lastStreet;

      // P0-3-1: No action after fold
      if (lastActorWasFold) {
        return {
          valid: false,
          error: `Action after fold at index ${i}: ${action.actor} cannot act after previous fold`
        };
      }

      // P0-3-2: No action after hand ends (both all-in)
      if (handEnded) {
        return {
          valid: false,
          error: `Action after hand ended at index ${i}: both actors are all-in`
        };
      }

      // P0-3-3: Valid street progression
      const streetOrder = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];
      const lastIdx = streetOrder.indexOf(lastStreet);
      const currIdx = streetOrder.indexOf(street);

      if (currIdx < lastIdx) {
        return { valid: false, error: `Invalid street progression at index ${i}: ${street} comes before ${lastStreet}` };
      }

      // P0-3-4: Check action validity for street
      if (street === 'PREFLOP' && action.action === 'CHECK') {
        return { valid: false, error: `Invalid action at index ${i}: cannot CHECK preflop` };
      }

      // P0-3-5: Check BET/RAISE when there's a pending bet (cannot BET when facing bet)
      if (pending > 0 && action.action === 'BET') {
        return { valid: false, error: `Invalid action at index ${i}: cannot BET when facing a bet, must RAISE or FOLD` };
      }

      // P0-3-6: Check bet sizing (must be positive)
      if ((action.action === 'BET' || action.action === 'RAISE' || action.action === 'PUSH') && action.size !== undefined) {
        if (typeof action.size !== 'number' || action.size <= 0) {
          return { valid: false, error: `Invalid bet size at index ${i}: ${action.size} must be > 0` };
        }
      }

      // Update state for next iteration
      if (action.action === 'FOLD') {
        lastActorWasFold = true;
        handEnded = true;  // Hand ends when someone folds
      } else {
        lastActorWasFold = false;
      }

      // Track all-in actors
      if (action.action === 'PUSH') {
        allInActors.add(action.actor);
        if (allInActors.size === 2) {
          handEnded = true;  // Hand ends when both all-in
        }
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
