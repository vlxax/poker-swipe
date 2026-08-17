import { emptyInfoSetStore } from './informationSet.js';

// Registry of information sets keyed by canonical public-state key. For the fixed
// tree abstraction we also allow keying directly by node id (faster, since the
// tree is deterministic and never merges equivalent states).
export class InformationSetMap {
  constructor() {
    this.sets = new Map();
  }

  get(key, actionIds = null) {
    let s = this.sets.get(key);
    if (!s) {
      s = emptyInfoSetStore(actionIds || []);
      this.sets.set(key, s);
    }
    return s;
  }

  has(key) {
    return this.sets.has(key);
  }

  size() {
    return this.sets.size;
  }

  keys() {
    return [...this.sets.keys()];
  }
}

// Resolve the store for an action node: prefer the node id (fixed tree), else the
// canonical key. Falls back to canonical key so multiple nodes sharing a public
// state would be correctly treated as the same information set.
export function resolveStore(map, node, actionIds) {
  if (node && node.id) {
    return map.get(`node:${node.id}`, actionIds);
  }
  return null;
}