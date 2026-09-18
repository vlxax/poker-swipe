/**
 * Atlas Providers - V2.3 Evidence Sources
 *
 * POKER_BRAIN_PACK provides two main atlases:
 * - preflop: lookup by situation|position|stack|handClass
 * - postflop: lookup by street|architecture|bucket|context
 */

import EvidenceProvider from './EvidenceProvider.js';

/**
 * Legacy Preflop Atlas Provider
 */
export class PreflopAtlasProvider extends EvidenceProvider {
  constructor(pack) {
    super('PREFLOP_ATLAS', {
      authority: 'legacy_pack',
      provenance: {
        solverValidated: false,
        curated: true,
        stackSpecific: false // RFI is stack-sensitive, others aren't
      }
    });
    this.pack = pack || (typeof window !== 'undefined' ? window.POKER_BRAIN_PACK : null);
  }

  requirements() {
    return {
      minimumFields: ['heroCards', 'heroPosition', 'effectiveStack'],
      preferredFields: ['board', 'villainPosition', 'actionHistory'],
      incompatibleWith: []
    };
  }

  contextFit(context) {
    if (!context || context.domain !== 'preflop') return 0;

    let fit = 0.8; // base for preflop

    // Perfect: we know everything
    if (context.heroCards && context.heroPosition && context.effectiveStack) {
      fit = 0.95;
    }

    // Degraded if villain unknown
    if (!context.villainPosition && context.threeBettorPosition) {
      fit = 0.75;
    }

    // Degraded if stack is not bucketed
    const stack = context.effectiveStack;
    if (stack && ![20, 25, 30, 40, 50].includes(stack)) {
      fit *= 0.85;
    }

    return Math.min(1, fit);
  }

  analyze(context) {
    if (!this.pack || !this.pack.preflop) {
      return this.nullResult('no_pack');
    }

    if (!context) return this.nullResult('no_context');

    // Preflop only
    if (context.domain && context.domain !== 'preflop') {
      return this.nullResult('not_preflop');
    }

    const { heroCards, heroPosition, effectiveStack, villainPosition, threeBettorPosition } = context;

    if (!heroCards || !heroPosition || !effectiveStack) {
      return this.nullResult('missing_required_fields');
    }

    // Bucket stack
    const stacks = [20, 25, 30, 40, 50];
    let nearest = stacks[0];
    for (const s of stacks) {
      if (Math.abs(s - effectiveStack) < Math.abs(nearest - effectiveStack)) {
        nearest = s;
      }
    }
    const stackDistance = effectiveStack - nearest;

    // Get hand class
    const hc = this.getHandClass(heroCards);
    if (!hc) {
      return this.nullResult('invalid_hand');
    }

    // Determine situation key
    const situation = this.determineSituation(context);
    if (!situation) {
      return this.nullResult('unknown_situation');
    }

    // Build lookup key
    let key = `${situation}|${heroPosition}|${nearest}|${hc}`;

    // Special case: VS_OPEN with collapsed villain position
    if (situation === 'VS_OPEN' && !villainPosition && threeBettorPosition) {
      // This is a context incompleteness we should document
    }

    const policy = this.pack.preflop[key];
    if (!policy) {
      return this.nullResult('policy_not_found');
    }

    return this.result({
      policy,
      context,
      confidence: 82,
      stackSpecific: situation === 'RFI', // only RFI is stack-sensitive in legacy
      ignored: [],
      metadata: {
        situation,
        handClass: hc,
        stackBucket: nearest,
        stackDistance,
        key
      }
    });
  }

  determineSituation(context) {
    const ctx = String(context.ctx || context.description || '').toLowerCase();

    if (/сфолдили|unopened|first in|RFI/i.test(ctx)) {
      return 'RFI';
    }
    if (/4-bet|4bet|3-бет|3bet/i.test(ctx)) {
      return 'VS_3BET';
    }
    if (/open|открыл/i.test(ctx)) {
      if (context.heroPosition === 'BB') {
        return 'BB_DEFEND';
      }
      return 'VS_OPEN';
    }

    return null;
  }

  getHandClass(cards) {
    if (!Array.isArray(cards) || cards.length < 2) return null;

    const RANKS = 'AKQJT98765432';
    const a = cards[0][0].toUpperCase();
    const b = cards[1][0].toUpperCase();

    const ia = RANKS.indexOf(a);
    const ib = RANKS.indexOf(b);

    if (ia < 0 || ib < 0) return null;
    if (a === b) return a + a;

    const suited = cards[0].slice(1) === cards[1].slice(1);
    return ia < ib ? a + b + (suited ? 's' : 'o') : b + a + (suited ? 's' : 'o');
  }
}

/**
 * Legacy Postflop Atlas Provider
 */
export class PostflopAtlasProvider extends EvidenceProvider {
  constructor(pack) {
    super('POSTFLOP_ATLAS', {
      authority: 'legacy_pack',
      provenance: {
        solverValidated: false,
        curated: true,
        stackSpecific: false
      }
    });
    this.pack = pack || (typeof window !== 'undefined' ? window.POKER_BRAIN_PACK : null);
  }

  requirements() {
    return {
      minimumFields: ['heroCards', 'board', 'street'],
      preferredFields: ['heroPosition', 'effectiveStack', 'potBB'],
      incompatibleWith: []
    };
  }

  contextFit(context) {
    if (!context || context.domain === 'preflop') return 0;

    let fit = 0.65; // postflop fitness is lower (more variables)

    if (context.board && context.board.length > 0) {
      fit = 0.75;
    }

    if (context.potBB && context.effectiveStack) {
      fit = 0.80; // SPR known improves fit
    }

    return Math.min(1, fit);
  }

  analyze(context) {
    // Postflop atlas is complex and may not be loaded
    // Return a result indicating availability
    if (!this.pack || !Array.isArray(this.pack.postflop)) {
      return this.nullResult('no_postflop_data');
    }

    if (!context || context.domain === 'preflop') {
      return this.nullResult('not_postflop');
    }

    const { board, heroCards, heroPosition, potBB, effectiveStack } = context;

    if (!board || !Array.isArray(board) || board.length === 0) {
      return this.nullResult('no_board');
    }

    // This is a simplified stub - full postflop matching is complex
    return this.result({
      policy: null, // postflop policy would be looked up here
      context,
      confidence: 50,
      stackSpecific: false,
      unusableReason: 'postflop_matching_complex'
    });
  }
}

/**
 * Reference 6max Provider
 * (for static reference material)
 */
export class ReferenceProvider extends EvidenceProvider {
  constructor() {
    super('REFERENCE_6MAX', {
      authority: 'documented_reference',
      provenance: {
        solverValidated: false,
        curated: true,
        stackSpecific: false // reference is stack-agnostic
      }
    });
  }

  requirements() {
    return {
      minimumFields: ['heroPosition', 'heroCards'],
      preferredFields: ['board', 'effectiveStack'],
      incompatibleWith: []
    };
  }

  contextFit(context) {
    // Reference only applies if we lack solver/atlas data
    return 0.3; // very low priority
  }

  analyze(context) {
    // Reference provider would return curated strategy principles
    return this.nullResult('reference_secondary');
  }
}

export default {
  PreflopAtlasProvider,
  PostflopAtlasProvider,
  ReferenceProvider
};
