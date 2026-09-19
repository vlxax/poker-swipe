import { UNKNOWN, isUnknown } from './DecisionContext.js';
import { normalizeActionHistory } from './actionHistory.js';
import { deriveEffectiveStackBB } from './effectiveStack.js';
import { derivePotAndSpr } from './potSpr.js';
import { derivePreflopTree } from './preflopTree.js';
import { nearestStackBucket } from './stackBucket.js';

/**
 * Apply canonical derivations on a partially normalized DecisionContext.
 */
export function enrichDecisionContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return ctx;

  const sourceKind = ctx.source?.feature || 'generic';
  if (!Array.isArray(ctx.actionHistory) || !ctx.actionHistory.length) {
    const raw = ctx._raw || {};
    const spot = raw.spot || raw.scenario || raw.hand || raw;
    const hist = spot.history || spot.actionHistory || raw.hand?.actions;
    if (hist) {
      ctx.actionHistory = normalizeActionHistory(hist, sourceKind === 'myhands' ? 'myhands' : 'generic');
    }
  } else {
    ctx.actionHistory = normalizeActionHistory(ctx.actionHistory, sourceKind);
  }

  const villainStacks = (ctx.villains || []).map((v) => v.stackBB);
  const eff = deriveEffectiveStackBB({
    heroStackBB: ctx.hero?.stackBB,
    villainStacksBB: villainStacks,
    explicitEffective: ctx.effectiveStackBB,
    villains: ctx.villains
  });
  if (!isUnknown(eff.effectiveStackBB)) {
    ctx.effectiveStackBB = eff.effectiveStackBB;
  }
  ctx.effectiveStackMeta = eff;

  ctx.preflopTree = derivePreflopTree(ctx.actionHistory);
  ctx.stackBucket = nearestStackBucket(ctx.effectiveStackBB);

  const potSpr = derivePotAndSpr({
    potBB: ctx.potBB,
    effectiveStackBB: ctx.effectiveStackBB,
    actionHistory: ctx.actionHistory,
    street: ctx.street
  });
  if (!isUnknown(potSpr.potBB)) ctx.potBB = potSpr.potBB;
  ctx.spr = potSpr.spr;
  ctx.potMeta = {
    source: potSpr.potSource,
    sprReliable: potSpr.sprReliable
  };

  if (isUnknown(ctx.facing?.type) || isUnknown(ctx.facing?.aggressorPosition)) {
    const lastAgg = [...ctx.actionHistory].reverse().find((a) =>
      ['OPEN', '3BET', '4BET', 'BET', 'RAISE', 'JAM'].includes(a.action)
    );
    if (lastAgg) {
      ctx.facing = {
        type: lastAgg.action,
        aggressorPosition: lastAgg.position,
        amountBB: lastAgg.amountBB
      };
    }
  }

  return ctx;
}
