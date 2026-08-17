// A thin container around the built tree: provides node indexing, statistics,
// and traversal helpers used by the CFR solver and the public API.

export class GameTree {
  constructor({ root, stats, game, cfg, heroCombos, villainCombos }) {
    this.root = root;
    this.stats = stats;
    this.game = game;
    this.cfg = cfg;
    this.heroCombos = heroCombos;
    this.villainCombos = villainCombos;
    this.nodesByType = this._index();
  }

  _index() {
    const byType = { ACTION: [], CHANCE: [], TERMINAL: [] };
    const stack = [this.root];
    while (stack.length) {
      const n = stack.pop();
      if (byType[n.type]) byType[n.type].push(n);
      for (const c of n.children || []) stack.push(c);
    }
    return byType;
  }

  get actionNodes() { return this.nodesByType.ACTION; }
  get chanceNodes() { return this.nodesByType.CHANCE; }
  get terminalNodes() { return this.nodesByType.TERMINAL; }

  summary() {
    return {
      nodeCount: this.stats.nodeCount,
      actionNodeCount: this.stats.actionNodeCount,
      chanceNodeCount: this.stats.chanceNodeCount,
      terminalNodeCount: this.stats.terminalNodeCount,
      maxDepth: this.stats.maxDepth,
      heroComboCount: this.heroCombos.length,
      villainComboCount: this.villainCombos.length
    };
  }

  // Depth-first pre-order list of all nodes.
  allNodes() {
    const out = [];
    const stack = [this.root];
    while (stack.length) {
      const n = stack.pop();
      out.push(n);
      for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
    }
    return out;
  }
}