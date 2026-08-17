import { InformationSetMap } from '../tree/informationSetMap.js';
import { regretMatching } from './regretMatching.js';
import { utilityForPlayer } from './utility.js';

export function comboKey(cards) {
  return [...cards].map((c) => c.toString()).sort().join(',');
}

function ensure(map, key) {
  let o = map[key];
  if (!o) { o = {}; map[key] = o; }
  return o;
}

function overlaps(a, b) {
  for (const c of a) if (b.includes(c)) return true;
  return false;
}

// A chance-card entry may be a single dealt card (postflop turn/river) or an
// array of dealt cards (a capped flop in a preflop transition). It collides if
// any dealt card appears in either private hand.
function chanceCollides(entry, cards) {
  if (Array.isArray(entry)) return entry.some((c) => cards.includes(c));
  return cards.includes(entry);
}

// Per-hand counterfactual regret minimization over the fixed tree abstraction.
// Supports vanilla CFR and CFR+ (non-negative regrets). Chance cards that collide
// with either private hand are excluded during traversal (enumerated chanceMode).
export class CFRTrainer {
  constructor(tree, options = {}) {
    this.tree = tree;
    this.algorithm = options.algorithm || 'cfr';
    this.linearAveraging = !!options.linearAveraging;
    this.infos = new InformationSetMap();
    this.heroCombos = tree.heroCombos;
    this.villainCombos = tree.villainCombos;
    this.iterations = 0;
    this._utilityCache = new Map();
  }

  iterate() {
    this.iterations += 1;
    this._perspective('hero');
    this._perspective('villain');
  }

  _perspective(p) {
    const own = p === 'hero' ? this.heroCombos : this.villainCombos;
    const opp = p === 'hero' ? this.villainCombos : this.heroCombos;
    for (const hc of own) {
      for (const oc of opp) {
        if (overlaps(hc.cards, oc.cards)) continue;
        this._cfr(this.tree.root, p, hc, oc, hc.weight, oc.weight);
      }
    }
  }

  _terminalValue(node, hc, oc, p) {
    const cacheKey = `${node.id}|${comboKey(hc.cards)}|${comboKey(oc.cards)}`;
    let val = this._utilityCache.get(cacheKey);
    if (val == null) {
      // hc is the perspective player's own combo; map it to the correct hand role.
      const [heroHand, villainHand] = p === 'hero'
        ? [hc.cards, oc.cards]
        : [oc.cards, hc.cards];
      val = utilityForPlayer(node, heroHand, villainHand, p);
      this._utilityCache.set(cacheKey, val);
    }
    return val;
  }

  _cfr(node, p, hc, oc, reachP, reachO) {
    if (node.type === 'TERMINAL') {
      return this._terminalValue(node, hc, oc, p);
    }
    if (node.type === 'CHANCE') {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < node.chanceCards.length; i++) {
        const card = node.chanceCards[i];
        if (chanceCollides(card, hc.cards) || chanceCollides(card, oc.cards)) continue;
        sum += this._cfr(node.children[i], p, hc, oc, reachP, reachO);
        count++;
      }
      return count ? sum / count : 0;
    }

    // ACTION node.
    const actionIds = node.actions.map((a) => a.id);
    const store = this.infos.get(`node:${node.id}`, actionIds);
    const actor = node.playerToAct;
    const combo = actor === p ? hc : oc;
    const key = comboKey(combo.cards);
    const strat = this._strategyFor(store, key, actionIds);

    let v = 0;
    const childVals = [];
    for (let i = 0; i < node.actions.length; i++) {
      const action = node.actions[i];
      const f = strat[action.id];
      let rP = reachP;
      let rO = reachO;
      if (actor === 'hero') rP = reachP * f;
      else rO = reachO * f;
      const cv = this._cfr(node.children[i], p, hc, oc, rP, rO);
      childVals.push(cv);
      v += f * cv;
    }

    if (actor === p) {
      const oppReach = p === 'hero' ? reachO : reachP;
      const ownReach = p === 'hero' ? reachP : reachO;
      const regs = ensure(store.regrets, key);
      const ssum = ensure(store.strategySum, key);
      for (let i = 0; i < node.actions.length; i++) {
        const aid = node.actions[i].id;
        const inst = childVals[i] - v;
        let r = (regs[aid] || 0) + oppReach * inst;
        if (this.algorithm === 'cfr_plus') r = Math.max(0, r);
        regs[aid] = r;
        const w = this.linearAveraging ? this.iterations : 1;
        ssum[aid] = (ssum[aid] || 0) + w * ownReach * strat[aid];
      }
    }
    return v;
  }

  _strategyFor(store, key, actionIds) {
    const regs = ensure(store.regrets, key);
    const strat = regretMatching(regs, actionIds);
    store.currentStrategy[key] = strat;
    return strat;
  }

  // Average (normalized) strategy for a combo at an action node store.
  averageStrategyFor(node, actor, combo) {
    const store = this.infos.get(`node:${node.id}`, node.actions.map((a) => a.id));
    const key = comboKey(combo.cards);
    const ssum = store.strategySum[key] || {};
    const ids = node.actions.map((a) => a.id);
    const total = ids.reduce((s, a) => s + (ssum[a] || 0), 0);
    if (total <= 0) {
      const u = 1 / ids.length;
      const out = {};
      for (const a of ids) out[a] = u;
      return out;
    }
    const out = {};
    for (const a of ids) out[a] = (ssum[a] || 0) / total;
    return out;
  }
}