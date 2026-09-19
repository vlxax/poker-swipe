/**
 * Canonical decision context contract. UNKNOWN stays UNKNOWN — no invented defaults.
 */

export const UNKNOWN = 'UNKNOWN';

export function createEmptyDecisionContext() {
  return {
    street: UNKNOWN,
    game: {
      type: UNKNOWN,
      tableSize: UNKNOWN,
      chipModel: UNKNOWN,
      rake: UNKNOWN,
      ante: UNKNOWN,
      bounty: UNKNOWN
    },
    hero: {
      position: UNKNOWN,
      stackBB: UNKNOWN,
      cards: UNKNOWN
    },
    villains: [],
    effectiveStackBB: UNKNOWN,
    potBB: UNKNOWN,
    board: UNKNOWN,
    actionHistory: [],
    facing: {
      type: UNKNOWN,
      aggressorPosition: UNKNOWN,
      amountBB: UNKNOWN
    },
    tournament: {
      icm: UNKNOWN,
      payouts: UNKNOWN,
      playersRemaining: UNKNOWN,
      bountyContext: UNKNOWN
    },
    source: {
      feature: UNKNOWN,
      taskId: UNKNOWN,
      handId: UNKNOWN
    },
    _raw: null
  };
}

export function isUnknown(value) {
  return value === UNKNOWN || value === null || value === undefined;
}

export function listMissingContextFields(ctx) {
  const missing = [];
  const c = ctx || {};
  if (isUnknown(c.street)) missing.push('street');
  if (isUnknown(c.game?.type)) missing.push('game.type');
  if (isUnknown(c.hero?.position)) missing.push('hero.position');
  if (isUnknown(c.effectiveStackBB) && isUnknown(c.hero?.stackBB)) missing.push('effectiveStackBB');
  return missing;
}

export function contextQualityLevel(ctx) {
  const missing = listMissingContextFields(ctx);
  if (missing.length === 0) return 'HIGH';
  if (missing.length <= 2) return 'MEDIUM';
  if (missing.length <= 5) return 'LOW';
  return 'VERY_LOW';
}
