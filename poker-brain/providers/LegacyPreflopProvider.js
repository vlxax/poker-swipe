/**
 * LegacyPreflopProvider
 *
 * Wraps POKER_BRAIN_PACK.preflop lookup
 * Reproduces exact legacy behavior
 */

export class LegacyPreflopProvider {
  constructor(pokerbrain = null) {
    // Accept injected POKER_BRAIN_PACK for testing
    this.pokerbrain = pokerbrain || this._getGlobalPokerBrain();
  }

  _getGlobalPokerBrain() {
    if (typeof window !== 'undefined' && window.POKER_BRAIN_PACK) {
      return window.POKER_BRAIN_PACK;
    }
    return null;
  }

  source() {
    return 'POKER_BRAIN_PACK.preflop';
  }

  authority() {
    return 'UNKNOWN';
  }

  /**
   * Lookup a preflop policy given normalized context
   *
   * Context format derived from POKER_BRAIN_PACK.preflop key schema:
   * - 4-part: SITUATION|POSITION|STACK|HAND
   * - 5-part: SITUATION|DEFENDER_POSITION|OPENER_POSITION|STACK|HAND
   *
   * For 4-part situations (RFI, BB_DEFEND, VS_3BET):
   *   context: {situation, heroPosition, heroStack, handClass, ...}
   *
   * For 5-part situations (VS_OPEN):
   *   context: {situation, heroPosition, villainPosition, heroStack, handClass, ...}
   */
  lookup(context = {}) {
    if (!this.pokerbrain || !this.pokerbrain.preflop) {
      return null;
    }

    // Extract and normalize context fields
    const situation = String(context.situation || '').toUpperCase();
    const heroPosition = String(context.heroPosition || '').toUpperCase();
    const heroStack = Number(context.heroStack);
    const handClass = String(context.handClass || '').toUpperCase();

    // Normalize stack to nearest bucket (20, 25, 30, 40, 50)
    const normalizedStack = this._normalizeStack(heroStack);

    // Normalize hand class (handle card order variations, suits, etc)
    const normalizedHand = this._normalizeHand(handClass);

    if (!situation || !heroPosition || !normalizedStack || !normalizedHand) {
      return null;
    }

    // Build lookup key based on situation type (4-part or 5-part)
    let key;

    if (situation === 'VS_OPEN') {
      // 5-part key
      const villainPosition = String(context.villainPosition || '').toUpperCase();
      if (!villainPosition) return null;
      key = `${situation}|${heroPosition}|${villainPosition}|${normalizedStack}|${normalizedHand}`;
    } else {
      // 4-part key (RFI, BB_DEFEND, VS_3BET, VS_4BET, etc)
      key = `${situation}|${heroPosition}|${normalizedStack}|${normalizedHand}`;
    }

    // Lookup and return policy
    const policy = this.pokerbrain.preflop[key];
    return policy || null;
  }

  /**
   * Normalize effective stack to nearest bucket
   * Legacy behavior: nearest neighbor
   */
  _normalizeStack(stack) {
    const stacks = [20, 25, 30, 40, 50];
    if (!Number.isFinite(stack)) return null;

    // Find nearest
    let nearest = stacks[0];
    let minDist = Math.abs(stack - nearest);
    for (const s of stacks) {
      const dist = Math.abs(stack - s);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }
    return String(nearest);
  }

  /**
   * Normalize hand class
   * Handles: AA, AKs, AKo, suits, case variations, etc
   */
  _normalizeHand(hand) {
    if (!hand) return null;

    // Already normalized
    if (/^[AKQJT98765432]{2}[so]?$/.test(hand)) {
      return hand;
    }

    // Remove non-essential characters
    const cleaned = hand.replace(/[^AKQJT98765432so]/gi, '').toUpperCase();
    if (cleaned.length < 2) return null;

    const rank1 = cleaned[0];
    const rank2 = cleaned[1];
    const suit = cleaned.length >= 3 ? cleaned[2].toLowerCase() : null;

    if (!rank1 || !rank2) return null;

    // Normalize pair notation
    if (rank1 === rank2) {
      return rank1 + rank2;
    }

    // Normalize suited/offsuit
    const isHigher = 'AKQJT98765432'.indexOf(rank1) < 'AKQJT98765432'.indexOf(rank2);
    const highRank = isHigher ? rank1 : rank2;
    const lowRank = isHigher ? rank2 : rank1;
    const notation = suit === 's' ? 's' : 'o';

    return highRank + lowRank + notation;
  }
}

export default LegacyPreflopProvider;
