import { SolverError, assert } from '../api/errors.js';
import { normalizeAction, actionToString } from './actionState.js';

// Build a stable key for a node in a future game tree.
// Used so a later CFR/decision-tree implementation can key information sets.
export function buildNodeKey({ street, potBB, effectiveStackBB, actor, actions }) {
  const aKey = (actions || []).map((a) => actionToString(a, potBB)).sort().join('|');
  return [street, Math.round(potBB * 100), Math.round(effectiveStackBB), actor, aKey].join(':');
}

export class ActionTree {
  constructor(root) {
    this.root = root || { id: 'root', children: new Map() };
  }

  addNode(node) {
    const key = buildNodeKey(node);
    this.root.children.set(key, node);
    return key;
  }

  find(key) {
    return this.root.children.get(key) || null;
  }
}

export function createActionTree() {
  return new ActionTree();
}