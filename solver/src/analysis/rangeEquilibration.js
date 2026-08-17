// Range equilibration: an internal solver validation metric that measures how
// stable each combo's reach weight into a decision node is between checkpoints.
//
// IMPORTANT: this is NOT about making private ranges public. Combo ranges remain
// private to their owner. This module only verifies that the reach-weight profile
// (how likely each combo reaches each of its decision nodes) has stopped moving,
// which is a signal that the CFR strategies have equilibrated.
import { comboKey } from '../cfr/cfrTrainer.js';

// Walk the tree from the root, carrying each combo's absolute reach (root weight
// times the owner's action frequencies along the path). At every action node we
// record the reach of each combo belonging to the actor. Returns two maps keyed
// by `nodeId|comboKey` -> reach.
export function computeReachSnapshot(tree, trainer) {
  const hero = new Map();
  const villain = new Map();

  const initReach = (combos) => {
    const m = new Map();
    for (const c of combos) m.set(comboKey(c.cards), c.weight);
    return m;
  };
  const initHero = initReach(tree.heroCombos);
  const initVillain = initReach(tree.villainCombos);

  const walk = (node, heroReach, villainReach) => {
    if (node.type !== 'ACTION') {
      for (const child of node.children || []) walk(child, heroReach, villainReach);
      return;
    }
    const actor = node.playerToAct;
    if (actor === 'hero') {
      for (const combo of tree.heroCombos) {
        hero.set(`${node.id}|${comboKey(combo.cards)}`, heroReach.get(comboKey(combo.cards)) || 0);
      }
    } else {
      for (const combo of tree.villainCombos) {
        villain.set(`${node.id}|${comboKey(combo.cards)}`, villainReach.get(comboKey(combo.cards)) || 0);
      }
    }

    for (let i = 0; i < node.actions.length; i++) {
      const aid = node.actions[i].id;
      const nextHero = new Map(heroReach);
      const nextVillain = new Map(villainReach);
      if (actor === 'hero') {
        for (const combo of tree.heroCombos) {
          const k = comboKey(combo.cards);
          const f = trainer.averageStrategyFor(node, 'hero', combo)[aid] || 0;
          nextHero.set(k, (heroReach.get(k) || 0) * f);
        }
      } else {
        for (const combo of tree.villainCombos) {
          const k = comboKey(combo.cards);
          const f = trainer.averageStrategyFor(node, 'villain', combo)[aid] || 0;
          nextVillain.set(k, (villainReach.get(k) || 0) * f);
        }
      }
      walk(node.children[i], nextHero, nextVillain);
    }
  };

  walk(tree.root, initHero, initVillain);
  return { hero, villain };
}

// Per-map L1 delta: mean and max absolute weight change over the union of keys.
function mapDelta(prev, curr) {
  const keys = new Set([...prev.keys(), ...curr.keys()]);
  let sum = 0;
  let max = 0;
  let n = 0;
  for (const k of keys) {
    const d = Math.abs((curr.get(k) || 0) - (prev.get(k) || 0));
    sum += d;
    n++;
    if (d > max) max = d;
  }
  return { max, mean: n ? sum / n : 0 };
}

// Delta between two reach snapshots. Range weight is a probability over the
// owner's own combos, so a delta of e.g. 0.01 means a combo's reach shifted by
// 1% of the total range on average.
export function rangeEquilibrationDelta(prev, curr) {
  if (!prev || !curr) {
    return { heroRangeDelta: null, villainRangeDelta: null, maxComboDelta: null, meanComboDelta: null };
  }
  const h = mapDelta(prev.hero, curr.hero);
  const v = mapDelta(prev.villain, curr.villain);
  return {
    heroRangeDelta: h.mean,
    villainRangeDelta: v.mean,
    maxComboDelta: Math.max(h.max, v.max),
    meanComboDelta: (h.mean + v.mean) / 2
  };
}

// Stable iff max single-combo weight delta is under the target.
export function rangeEquilibrationStable(delta, target = 0.01) {
  if (!delta || delta.maxComboDelta == null) return false;
  return delta.maxComboDelta <= target;
}

// Full report used by the solver output.
export function rangeEquilibrationResult(delta, target = 0.01) {
  if (!delta) {
    return {
      stable: false,
      heroRangeDelta: null,
      villainRangeDelta: null,
      maxComboDelta: null,
      meanComboDelta: null,
      checksPassed: 0,
      target
    };
  }
  const stable = rangeEquilibrationStable(delta, target);
  return {
    stable,
    heroRangeDelta: round4(delta.heroRangeDelta),
    villainRangeDelta: round4(delta.villainRangeDelta),
    maxComboDelta: round4(delta.maxComboDelta),
    meanComboDelta: round4(delta.meanComboDelta),
    checksPassed: stable ? 1 : 0,
    target
  };
}

function round4(n) {
  if (n == null) return null;
  return Math.round(n * 1e4) / 1e4;
}