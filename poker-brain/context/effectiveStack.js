import { UNKNOWN, isUnknown } from './DecisionContext.js';

/**
 * Canonical effective stack for heads-up: min(hero relevant, villain relevant).
 * Multiway: min hero vs each villain stack; document selection in meta.
 */
export function deriveEffectiveStackBB({
  heroStackBB,
  villainStacksBB = [],
  explicitEffective,
  heroPosition,
  villains = []
} = {}) {
  const notes = [];
  if (!isUnknown(explicitEffective)) {
    return {
      effectiveStackBB: Number(explicitEffective),
      method: 'EXPLICIT',
      villainStacksBB: villainStacksBB.filter((v) => !isUnknown(v)),
      ambiguity: false,
      notes
    };
  }

  const hero = isUnknown(heroStackBB) ? null : Number(heroStackBB);
  const vStacks = villainStacksBB.length
    ? villainStacksBB.map((v) => (isUnknown(v) ? null : Number(v))).filter((n) => n != null)
    : villains
      .map((v) => (isUnknown(v?.stackBB) ? null : Number(v.stackBB)))
      .filter((n) => n != null);

  if (hero == null && !vStacks.length) {
    return {
      effectiveStackBB: UNKNOWN,
      method: 'UNKNOWN',
      villainStacksBB: [],
      ambiguity: true,
      notes: ['missing_hero_and_villain_stacks']
    };
  }

  if (hero != null && !vStacks.length) {
    notes.push('no_villain_stack_used_hero_only');
    return {
      effectiveStackBB: hero,
      method: 'HERO_ONLY_FALLBACK',
      villainStacksBB: [],
      ambiguity: true,
      notes
    };
  }

  if (hero == null && vStacks.length) {
    const minV = Math.min(...vStacks);
    notes.push('missing_hero_stack_min_villain');
    return {
      effectiveStackBB: minV,
      method: 'VILLAIN_MIN_ONLY',
      villainStacksBB: vStacks,
      ambiguity: true,
      notes
    };
  }

  const effPerVillain = vStacks.map((vs) => Math.min(hero, vs));
  const effective = Math.min(...effPerVillain);
  if (vStacks.length > 1) {
    notes.push(`multiway_min_of_${vStacks.length}_villains`);
  }
  return {
    effectiveStackBB: effective,
    method: vStacks.length > 1 ? 'MULTIWAY_MIN' : 'HEADS_UP_MIN',
    villainStacksBB: vStacks,
    perVillainEffectiveBB: effPerVillain,
    ambiguity: vStacks.length > 1,
    notes
  };
}
