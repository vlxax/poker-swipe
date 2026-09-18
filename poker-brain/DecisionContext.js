/**
 * Canonical DecisionContext format for PokerBrain V2/V3
 *
 * Represents ALL poker knowledge that PokerSwipe features can provide,
 * independent of source feature or domain.
 *
 * PokerBrain consumes DecisionContext.
 * Features produce DecisionContext via adapters.
 * Evidence providers understand DecisionContext.
 * Resolver uses DecisionContext to select evidence.
 */

export class DecisionContext {
  constructor(input = {}) {
    // Identity
    this.contextId = input.contextId || null;
    this.featureSource = input.featureSource || null; // 'swipe' | 'daily' | 'myhands' | 'ranges' | 'sizing'
    this.domain = input.domain || null; // 'preflop' | 'flop' | 'turn' | 'river' | null

    // Core decision point
    this.heroCards = input.heroCards || []; // ['As', 'Kd'] or []
    this.board = input.board || []; // [] | ['2h', '3d'] | ['2h', '3d', '5s'] | etc
    this.street = input.street || null; // 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER'

    // Positions and player info
    this.heroPosition = input.heroPosition || null; // 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'
    this.villainPosition = input.villainPosition || null; // opener/aggressor position
    this.villainPositions = input.villainPositions || []; // all villain positions (multiway)
    this.villainType = input.villainType || null; // 'random' | 'unknown' | null

    // Stack information
    this.heroStack = input.heroStack || null; // in BB
    this.villainStack = input.villainStack || null;
    this.effectiveStack = input.effectiveStack || null; // min(hero, villain)
    this.allStacks = input.allStacks || {}; // {position: stackBB, ...}

    // Pot and betting
    this.potBB = input.potBB || null;
    this.SPR = input.SPR || null; // stackBB / potBB
    this.facingBet = input.facingBet || null; // amount we're facing
    this.facingBetPercent = input.facingBetPercent || null; // % of pot

    // Action history
    this.actionHistory = input.actionHistory || []; // [{street, actor, action, size, ...}, ...]
    this.preActionKey = input.preActionKey || null; // e.g., 'OPEN_2.2_BTN'

    // Preflop-specific action tree
    this.openerPosition = input.openerPosition || null;
    this.openSizeBB = input.openSizeBB || null;
    this.threeBettorPosition = input.threeBettorPosition || null;
    this.threeBetSizeBB = input.threeBetSizeBB || null;
    this.fourBettorPosition = input.fourBettorPosition || null;
    this.fourBetSizeBB = input.fourBetSizeBB || null;
    this.jamState = input.jamState || null; // null | 'hero_jammed' | 'villain_jammed'

    // Context quality markers
    this.contextQuality = input.contextQuality || 'FULL'; // FULL | PARTIAL | COLLAPSED | UNKNOWN
    this.collapsedFields = input.collapsedFields || []; // fields that were ignored/collapsed
    this.unknownFields = input.unknownFields || []; // fields data doesn't have
    this.stackBucketDistance = input.stackBucketDistance || null; // actual - bucket

    // Source constraints
    this.sourceConstraints = input.sourceConstraints || {
      stackSpecific: null, // true | false | null
      actionTreeComplete: null, // true | false | null
      boardKnown: null, // true | false | null
      villainKnown: null // true | false | null
    };

    // Metadata
    this.timestamp = input.timestamp || Date.now();
    this.gameType = input.gameType || null;
    this.preset = input.preset || null; // 'mtt' | 'cash' | null
  }

  /**
   * Assess readiness for specific decision domain
   */
  readinessFor(domain) {
    const missing = [];

    if (!domain) return { ready: false, missing: ['domain'] };

    const domainRequirements = {
      'preflop': ['heroCards', 'heroPosition'],
      'flop': ['heroCards', 'board'],
      'turn': ['heroCards', 'board'],
      'river': ['heroCards', 'board']
    };

    const required = domainRequirements[domain.toLowerCase()];
    if (!required) return { ready: false, missing: ['unknown_domain'] };

    for (const field of required) {
      const val = this[field];
      if (!val || (Array.isArray(val) && val.length === 0)) {
        missing.push(field);
      }
    }

    return {
      ready: missing.length === 0,
      missing,
      quality: this.contextQuality
    };
  }

  /**
   * Compute normalized domain from context
   */
  normalizeDomain() {
    if (this.street) {
      const s = String(this.street).toUpperCase();
      if (s === 'PREFLOP') return 'preflop';
      if (s === 'FLOP') return 'flop';
      if (s === 'TURN') return 'turn';
      if (s === 'RIVER') return 'river';
    }
    if (this.board.length === 0) return 'preflop';
    if (this.board.length === 3) return 'flop';
    if (this.board.length === 4) return 'turn';
    if (this.board.length === 5) return 'river';
    return null;
  }

  /**
   * For debugging: show what's missing/collapsed
   */
  summary() {
    return {
      source: this.featureSource,
      domain: this.normalizeDomain(),
      quality: this.contextQuality,
      missing: this.unknownFields,
      collapsed: this.collapsedFields,
      haveHeroCards: this.heroCards.length > 0,
      havePosition: !!this.heroPosition,
      haveStack: !!this.effectiveStack,
      haveBoard: this.board.length > 0,
      haveActionHistory: this.actionHistory.length > 0
    };
  }
}

export default DecisionContext;
