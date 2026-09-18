import { UNKNOWN, isUnknown } from '../context/DecisionContext.js';
import { POKER_DOMAINS } from '../routing/resolvePokerDomain.js';

const STACK_BUCKETS = [20, 25, 30, 40, 50];

function nearestStack(bb) {
  const n = Number(bb);
  if (!Number.isFinite(n)) return 30;
  return STACK_BUCKETS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a), STACK_BUCKETS[0]);
}

function handClass(cards, classOfFn) {
  if (typeof classOfFn === 'function') {
    try {
      const hc = classOfFn(cards);
      if (hc) return hc;
    } catch (_) { /* ignore */ }
  }
  if (typeof cards === 'string') return cards;
  if (Array.isArray(cards) && cards.length >= 2) return cards.join('');
  return null;
}

function buildKey(domain, ctx, hc) {
  const stack = nearestStack(ctx.effectiveStackBB);
  const hero = ctx.hero?.position;
  if (!hc || isUnknown(hero)) return null;

  switch (domain) {
    case POKER_DOMAINS.PREFLOP_RFI:
      return `RFI|${hero}|${stack}|${hc}`;
    case POKER_DOMAINS.PREFLOP_BB_DEFEND: {
      const opener = ctx.facing?.aggressorPosition
        || ctx.villains?.[0]?.position
        || UNKNOWN;
      if (isUnknown(opener)) return null;
      return `BB_DEFEND|${opener}|${stack}|${hc}`;
    }
    case POKER_DOMAINS.PREFLOP_VS_OPEN: {
      const opener = ctx.facing?.aggressorPosition || ctx.villains?.[0]?.position;
      if (isUnknown(opener)) return null;
      return `VS_OPEN|${hero}|${opener}|${stack}|${hc}`;
    }
    case POKER_DOMAINS.PREFLOP_VS_3BET:
      return `VS_3BET|${hero}|${stack}|${hc}`;
    default:
      return null;
  }
}

export function collectPreflopAtlasEvidence(context, domain, deps = {}) {
  const pack = deps.pack;
  if (!pack?.preflop) return null;

  const hc = handClass(context.hero?.cards, deps.classOf);
  if (!hc) return null;

  const key = buildKey(domain, context, hc);
  if (!key) return null;

  const policy = pack.preflop[key];
  if (!policy) return null;

  const stackSensitive = domain === POKER_DOMAINS.PREFLOP_RFI;

  return {
    source: 'POKER_BRAIN_PACK',
    layerId: 'PREFLOP_ATLAS',
    domain,
    policy: { ...policy },
    key,
    provenance: 'CURATED_UNKNOWN',
    solverValidated: false,
    contextMatch: 'PARTIAL',
    meta: {
      solverValidated: false,
      stackSpecific: stackSensitive,
      openSizingDimension: false,
      threeBetSizingDimension: false,
      fourBetSizingDimension: false,
      villainPositionDimension: domain !== POKER_DOMAINS.PREFLOP_VS_3BET,
      stackBuckets: STACK_BUCKETS,
      contextComplete: false
    }
  };
}

export const PREFLOP_ATLAS_LIMITATIONS = {
  solverValidated: false,
  stackBuckets: STACK_BUCKETS,
  RFI: { stackSensitive: true },
  BB_DEFEND: { stackSensitive: false },
  VS_OPEN: { stackSensitive: false },
  VS_3BET: {
    stackSensitive: false,
    villainPositionDimension: false,
    openSizingDimension: false,
    threeBetSizingDimension: false
  }
};
