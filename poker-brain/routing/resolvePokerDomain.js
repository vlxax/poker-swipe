import { UNKNOWN, isUnknown } from '../context/DecisionContext.js';

export const POKER_DOMAINS = {
  PREFLOP_RFI: 'PREFLOP_RFI',
  PREFLOP_BB_DEFEND: 'PREFLOP_BB_DEFEND',
  PREFLOP_VS_OPEN: 'PREFLOP_VS_OPEN',
  PREFLOP_VS_3BET: 'PREFLOP_VS_3BET',
  PREFLOP_PUSH_FOLD: 'PREFLOP_PUSH_FOLD',
  POSTFLOP: 'POSTFLOP',
  SIZING: 'SIZING',
  ICM: 'ICM',
  PKO: 'PKO',
  UNKNOWN: 'UNKNOWN'
};

function textBlob(ctx) {
  const raw = ctx._raw || {};
  const spot = raw.spot || raw.scenario || raw.hand || raw;
  return String(spot.ctx || spot.description || spot.preflopLine || '');
}

export function resolvePokerDomain(context) {
  const ctx = context || {};
  const street = ctx.street;
  const feature = ctx.source?.feature;

  if (feature === 'push-fold' || ctx._raw?.situation === 'push_fold') {
    return POKER_DOMAINS.PREFLOP_PUSH_FOLD;
  }

  if (ctx.tournament?.icm === true || ctx.game?.chipModel === 'ICM') {
    if (street === UNKNOWN || street === 'PREFLOP') {
      // Primary poker domain still preflop; ICM is overlay
    }
  }

  if (street === 'FLOP' || street === 'TURN' || street === 'RIVER') {
    if (feature === 'sizing') return POKER_DOMAINS.SIZING;
    return POKER_DOMAINS.POSTFLOP;
  }

  if (street !== 'PREFLOP' && street !== UNKNOWN) {
    return POKER_DOMAINS.UNKNOWN;
  }

  const hero = ctx.hero?.position;
  const desc = textBlob(ctx);
  const hist = ctx.actionHistory || [];

  const unopened = hist.some((a) => a.action === 'UNOPENED')
    || /(?:^|[\s,])(?:unopened|first in|сфолдили)(?:[\s,]|$)/i.test(desc)
    || /^unopened/i.test(desc.trim());
  const has3bet = hist.some((a) => /3BET|3-BET/i.test(a.action))
    || /4-?bet|4bet|3-?bet|3-бет/i.test(desc);
  const hasOpen = !unopened && (
    hist.some((a) => a.action === 'OPEN')
    || /(?:^|[\s,])(?:open|открыл)(?:[\s,]|$)|открыл/i.test(desc)
  );

  if (has3bet) return POKER_DOMAINS.PREFLOP_VS_3BET;
  if (hero === 'BB' && hasOpen) return POKER_DOMAINS.PREFLOP_BB_DEFEND;
  if (hasOpen && hero !== 'BB') return POKER_DOMAINS.PREFLOP_VS_OPEN;
  if (unopened || (!hasOpen && !has3bet && street === 'PREFLOP')) {
    if (!isUnknown(hero) && hero !== 'BB') return POKER_DOMAINS.PREFLOP_RFI;
  }

  if (ctx._raw?.situation === 'bb_defend') return POKER_DOMAINS.PREFLOP_BB_DEFEND;
  if (ctx._raw?.situation === 'vs_open') return POKER_DOMAINS.PREFLOP_VS_OPEN;
  if (ctx._raw?.situation === 'vs_3bet') return POKER_DOMAINS.PREFLOP_VS_3BET;
  if (ctx._raw?.situation === 'rfi') return POKER_DOMAINS.PREFLOP_RFI;

  return POKER_DOMAINS.UNKNOWN;
}
