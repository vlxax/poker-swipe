import { UNKNOWN, isUnknown } from '../context/DecisionContext.js';
import { normalizePosition, normalizeStreet } from '../context/positions.js';
import { normalizeActionHistory } from '../context/actionHistory.js';

function numOrUnknown(v) {
  if (v === null || v === undefined || v === '') return UNKNOWN;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : UNKNOWN;
}

function cardsOrUnknown(c) {
  if (!c) return UNKNOWN;
  if (Array.isArray(c) && c.length) return c;
  if (typeof c === 'string' && c.trim()) return c.trim();
  return UNKNOWN;
}

/**
 * Map task-context canonical spot → DecisionContext fields (before enrich).
 */
export function decisionContextFromCanonical(canonical, feature, rawWrap = {}) {
  const c = canonical;
  if (!c) return null;

  const villains = [];
  if (!isUnknown(normalizePosition(c.villain))) {
    villains.push({
      position: normalizePosition(c.villain),
      stackBB: numOrUnknown(c.villainStack)
    });
  }

  const actionHistory = normalizeActionHistory(c.history || [], 'canonical');

  return {
    street: normalizeStreet(c.street),
    game: {
      type: c.format || UNKNOWN,
      tableSize: /9/i.test(String(c.table || '')) ? 9 : (/6/i.test(String(c.table || '')) ? 6 : UNKNOWN),
      chipModel: /баббл|icm|itm/i.test(String(c.stage || '') + String(c.concept || '')) ? 'ICM' : UNKNOWN,
      rake: UNKNOWN,
      ante: numOrUnknown(c.ante),
      bounty: /pko|bounty|нокаут/i.test(String(c.tags?.join?.(' ') || c.concept || '')) ? true : UNKNOWN
    },
    hero: {
      position: normalizePosition(c.position),
      stackBB: numOrUnknown(c.heroStack),
      cards: cardsOrUnknown(c.hero)
    },
    villains,
    effectiveStackBB: numOrUnknown(c.effStack),
    potBB: numOrUnknown(c.pot),
    board: cardsOrUnknown(c.board),
    actionHistory,
    facing: {
      type: UNKNOWN,
      aggressorPosition: UNKNOWN,
      amountBB: numOrUnknown(c.openSizeBB)
    },
    tournament: {
      icm: /баббл|icm|itm|финал/i.test(String(c.stage || '')) ? true : UNKNOWN,
      payouts: UNKNOWN,
      playersRemaining: UNKNOWN,
      bountyContext: UNKNOWN
    },
    source: {
      feature,
      taskId: c.id || UNKNOWN,
      handId: UNKNOWN
    },
    preflopLine: c.preflopLine || '',
    openSizeBB: numOrUnknown(c.openSizeBB),
    _raw: rawWrap
  };
}
