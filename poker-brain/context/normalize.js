import { UNKNOWN, createEmptyDecisionContext, isUnknown } from './DecisionContext.js';
import { normalizePosition, normalizeStreet } from './positions.js';
import { enrichDecisionContext } from './enrichContext.js';
import { decisionContextFromCanonical } from '../adapters/canonicalSpotAdapter.js';
import { decisionContextFromMyHand } from '../adapters/myHandsAdapter.js';
import { normalizeActionHistory } from './actionHistory.js';

export { normalizePosition, normalizeStreet } from './positions.js';

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

function inferFeature(raw) {
  if (raw?.source?.feature && !isUnknown(raw.source.feature)) return raw.source.feature;
  if (raw?.mode) return String(raw.mode).toLowerCase();
  if (raw?._library) return 'daily-library';
  if (raw?.handId || raw?.actions) return 'myhands';
  if (raw?.situation || raw?.dataSource) return 'ranges';
  return UNKNOWN;
}

function historyFromDescription(desc) {
  const text = String(desc || '');
  const history = [];
  const isUnopened = /(?:^|[\s,])(?:unopened|first in|сфолдили)(?:[\s,]|$)/i.test(text) || /^unopened/i.test(text.trim());
  if (isUnopened) {
    history.push({ actor: 'TABLE', position: UNKNOWN, action: 'UNOPENED', sizeBB: UNKNOWN });
  }
  if (!isUnopened && /(?:^|[\s,])(?:open|открыл)(?:[\s,]|$)|открыл/i.test(text)) {
    const m = text.match(/(UTG|HJ|CO|BTN|SB|BB)/i);
    history.push({
      actor: 'VILLAIN',
      position: m ? normalizePosition(m[1]) : UNKNOWN,
      action: 'OPEN',
      sizeBB: UNKNOWN
    });
  }
  if (/3-?bet|3-бет/i.test(text)) {
    history.push({ actor: 'VILLAIN', position: UNKNOWN, action: '3BET', sizeBB: UNKNOWN });
  }
  return history;
}

function baseFromSpot(spot, raw, feature) {
  const base = createEmptyDecisionContext();
  base.source = {
    feature,
    taskId: raw.taskId || spot.taskId || spot.id || spot.spotId || UNKNOWN,
    handId: raw.handId || spot.handId || UNKNOWN
  };
  base._raw = raw;

  base.street = normalizeStreet(spot.street || raw.street || (feature === 'ranges' ? 'PREFLOP' : UNKNOWN));
  base.hero = {
    position: normalizePosition(spot.pos || spot.position || spot.heroPosition || spot.heroSeat || raw.heroPosition),
    stackBB: numOrUnknown(spot.stack ?? spot.heroStack ?? spot.effStack ?? spot.effectiveStackBb ?? spot.effectiveStackBB ?? raw.effectiveStackBB),
    cards: cardsOrUnknown(spot.hero || spot.heroCards || raw.heroCards)
  };
  base.effectiveStackBB = numOrUnknown(
    spot.effStack ?? spot.effectiveStackBb ?? spot.effectiveStackBB ?? spot.stack ?? base.hero.stackBB
  );
  base.potBB = numOrUnknown(spot.pot ?? spot.potBb ?? spot.potBB ?? raw.potBB);
  base.board = cardsOrUnknown(spot.board || raw.board);

  const villainPos = normalizePosition(spot.villainPos || spot.villainPosition || spot.villain || spot.villainSeat);
  if (!isUnknown(villainPos)) {
    base.villains.push({
      position: villainPos,
      stackBB: numOrUnknown(spot.villainStack ?? spot.villainStackBb)
    });
  }

  const desc = spot.ctx || spot.description || spot.preflopLine || raw.description || '';
  if (Array.isArray(spot.history) && spot.history.length) {
    base.actionHistory = normalizeActionHistory(spot.history, 'generic');
  } else if (Array.isArray(spot.actionHistory)) {
    base.actionHistory = normalizeActionHistory(spot.actionHistory, 'generic');
  } else {
    base.actionHistory = historyFromDescription(desc).map((a) => normalizeActionHistory([a])[0]).filter(Boolean);
  }

  if (spot.openSizeBB != null && !base.actionHistory.some((a) => a.action === 'OPEN')) {
    const opener = base.villains[0]?.position || UNKNOWN;
    base.actionHistory.push({
      street: 'PREFLOP',
      actor: 'VILLAIN',
      position: opener,
      action: 'OPEN',
      amountBB: numOrUnknown(spot.openSizeBB),
      raiseToBB: UNKNOWN,
      allIn: false
    });
  }

  if (spot.facing || spot.facingType) {
    base.facing = {
      type: String(spot.facing?.type || spot.facingType || UNKNOWN).toUpperCase(),
      aggressorPosition: normalizePosition(spot.facing?.aggressorPosition || spot.aggressorPosition),
      amountBB: numOrUnknown(spot.facing?.amountBB ?? spot.facingAmountBB)
    };
  } else if (/open|открыл/i.test(desc)) {
    const m = desc.match(/(UTG|HJ|CO|BTN|SB)/i);
    base.facing = { type: 'OPEN', aggressorPosition: m ? normalizePosition(m[1]) : UNKNOWN, amountBB: numOrUnknown(spot.openSizeBB) };
  }

  base.game = {
    type: spot.format || spot.gameType || raw.gameType || UNKNOWN,
    tableSize: numOrUnknown(spot.tableSize) !== UNKNOWN ? numOrUnknown(spot.tableSize) : (spot.format === '9max' ? 9 : spot.format === '6max' ? 6 : UNKNOWN),
    chipModel: spot.icm ? 'ICM' : (spot.chipModel || UNKNOWN),
    rake: spot.rake ?? UNKNOWN,
    ante: spot.ante ?? UNKNOWN,
    bounty: spot.bounty ?? UNKNOWN
  };

  base.tournament = {
    icm: spot.icm ?? raw.icm ?? UNKNOWN,
    payouts: spot.payouts ?? UNKNOWN,
    playersRemaining: numOrUnknown(spot.playersLeft ?? spot.playersRemaining),
    bountyContext: spot.bountyContext ?? UNKNOWN
  };

  if (raw.situation === 'push_fold' || spot.situation === 'push_fold') {
    base.source.feature = 'push-fold';
  }

  return base;
}

export function normalizeDecisionContext(raw = {}) {
  const feature = inferFeature(raw);
  const spot = raw.spot || raw.scenario || raw.item || raw.hand || raw;

  if (spot?._canonical) {
    const fromCanon = decisionContextFromCanonical(spot._canonical, feature, raw);
    return enrichDecisionContext(fromCanon);
  }

  if (feature === 'myhands' && (raw.hand?.actions || raw.actions || spot.actions)) {
    const hand = raw.hand || spot;
    return enrichDecisionContext(decisionContextFromMyHand(hand, raw));
  }

  const base = baseFromSpot(spot, raw, feature);
  return enrichDecisionContext(base);
}

/** Adapters named by consumer */
export const adapters = {
  daily: (input) => {
    const spot = input.drill || input.spot;
    const withCanon = spot?._canonical ? spot : { ...spot, _canonical: undefined };
    if (withCanon._canonical || input.drill) {
      const s = input.drill || input.spot;
      if (s && !s._canonical && s.history) {
        return normalizeDecisionContext({ ...input, mode: 'daily', spot: s, _drill: input.drill });
      }
    }
    return normalizeDecisionContext({ ...input, mode: 'daily', spot: input.drill || input.spot, _drill: input.drill });
  },
  swipe: (input) => {
    const scenario = input.scenario || {};
    if (!scenario._canonical && scenario.id) {
      return normalizeDecisionContext({ ...input, mode: 'swipe', scenario });
    }
    return normalizeDecisionContext({ ...input, mode: 'swipe', scenario });
  },
  myhands: (input) => normalizeDecisionContext({ ...input, mode: 'myhands', hand: input.hand || input }),
  ranges: (input) => normalizeDecisionContext({
    ...input,
    mode: 'ranges',
    situation: input.sel?.situation || input.situation,
    spot: input.scenario || { ...(input.sel || {}), position: input.sel?.position, stack: input.sel?.stack }
  }),
  sizing: (input) => normalizeDecisionContext({ ...input, mode: 'sizing', spot: input.spot }),
  training: (input) => normalizeDecisionContext(input)
};
