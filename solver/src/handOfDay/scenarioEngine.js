// Hand of the Day scenario engine — branching logic, state machine, node traversal
// Supports multi-decision scenarios with authored branching trees

export class ScenarioEngine {
  constructor(scenario = {}) {
    this.scenario = scenario;
    this.currentNodeId = scenario.rootNodeId || 'root';
    this.history = [];  // [(nodeId, action, timestamp)]
    this.observations = [];  // collected observations
    this.selectedReads = {};  // node -> selected read choice
    this.state = 'init';  // init | playing | showdown | read | complete
  }

  currentNode() {
    if (!this.scenario.nodes) return null;
    return this.scenario.nodes.find((n) => n.id === this.currentNodeId);
  }

  getAllNodes() {
    return this.scenario.nodes || [];
  }

  getNodeById(nodeId) {
    return this.scenario.nodes?.find((n) => n.id === nodeId) || null;
  }

  // Advance scenario via action (hero choice, villain action, etc)
  advance(action) {
    const node = this.currentNode();
    if (!node) return { ok: false, reason: 'no_current_node' };

    // Record in history
    this.history.push({
      nodeId: node.id,
      action,
      timestamp: Date.now(),
      nodeType: node.type
    });

    // Collect observation if present
    if (node.observation && !this.observations.some((o) => o.nodeId === node.id)) {
      this.observations.push({
        nodeId: node.id,
        text: node.observation.text,
        count: node.observation.count || 1,
        totalCount: node.observation.totalCount || 3,
        types: node.observation.types || []
      });
    }

    // Resolve next node based on action
    const nextNodeId = this._resolveNext(node, action);
    if (!nextNodeId) {
      return { ok: false, reason: 'no_next_node', node };
    }

    const nextNode = this.getNodeById(nextNodeId);
    if (!nextNode) {
      return { ok: false, reason: 'invalid_next_node', nodeId: nextNodeId };
    }

    // Update state based on next node type
    if (nextNode.type === 'showdown') {
      this.state = 'showdown';
    } else if (nextNode.type === 'read-question') {
      this.state = 'read';
    } else if (nextNode.type === 'complete') {
      this.state = 'complete';
    } else {
      this.state = 'playing';
    }

    this.currentNodeId = nextNodeId;
    return { ok: true, node: nextNode, action, history: this.history };
  }

  // Resolve which node comes next based on action choice
  _resolveNext(node, action) {
    // If no actions on this node, just follow nextNode
    if (!node.actions || !Array.isArray(node.actions)) {
      return node.nextNode || null;
    }

    // Find the action config
    const actionCfg = node.actions.find((a) => a.id === action);

    if (!actionCfg) {
      // Action not found, fall back to default next
      return node.nextNode || null;
    }

    // Return next node ID (can be explicit or computed)
    if (actionCfg.nextNode) return actionCfg.nextNode;

    // Fallback to node's default next
    return node.nextNode || null;
  }

  // Get villain's likely reaction to hero's action (if pre-authored)
  getVillainReaction(action) {
    const node = this.currentNode();
    if (!node || !node.villainDialogue) return null;

    const archetype = this.scenario.villain?.archetype || 'regular';
    const dialogue = node.villainDialogue[archetype] || node.villainDialogue.default;
    return dialogue || null;
  }

  // Get observations collected so far
  getObservations() {
    return [...this.observations];
  }

  // Is scenario complete?
  isComplete() {
    return this.state === 'complete';
  }

  // Can we go back one step?
  canBack() {
    return this.history.length > 0;
  }

  // Back up one decision
  back() {
    if (!this.canBack()) return { ok: false, reason: 'at_start' };

    const lastEntry = this.history.pop();
    this.currentNodeId = lastEntry.nodeId;
    this.state = 'playing';

    return { ok: true, nodeId: this.currentNodeId, lastAction: lastEntry.action };
  }

  // Record which read the user chose (before reveal)
  recordRead(readChoice) {
    const node = this.currentNode();
    if (node?.type !== 'read-question') {
      return { ok: false, reason: 'not_on_read_screen' };
    }
    this.selectedReads[node.id] = readChoice;
    return { ok: true, choice: readChoice };
  }

  // Get reveal data (villain cards, correct read, explanation)
  getReveal() {
    if (!this.scenario.reveal) return null;

    return {
      villainCards: this.scenario.villain?.cards || this.scenario.reveal.villainCards,
      villainHand: this.scenario.reveal.hand || this.scenario.reveal.villainLine,
      userSelectedRead: this.selectedReads[this.currentNodeId?.id],
      correctRead: this.scenario.reveal.correctReadId,
      explanation: this.scenario.reveal.explanation,
      keyTakeaway: this.scenario.reveal.keyTakeaway
    };
  }

  // Get the entire hand path taken so far
  getHandPath() {
    return this.history.map((h) => {
      const node = this.getNodeById(h.nodeId);
      return {
        street: node?.street || '—',
        action: h.action,
        nodeType: h.nodeType,
        nodeName: node?.context?.history || node?.label || h.nodeId
      };
    });
  }

  // Reset to beginning (for replay)
  reset() {
    this.currentNodeId = this.scenario.rootNodeId || 'root';
    this.history = [];
    this.observations = [];
    this.selectedReads = {};
    this.state = 'init';
  }

  // Export state for persistence
  toJSON() {
    return {
      scenarioId: this.scenario.id,
      currentNodeId: this.currentNodeId,
      state: this.state,
      history: this.history,
      observations: this.observations,
      selectedReads: this.selectedReads
    };
  }

  // Restore from exported state
  static fromJSON(scenario, exported) {
    const engine = new ScenarioEngine(scenario);
    if (exported) {
      engine.currentNodeId = exported.currentNodeId;
      engine.state = exported.state;
      engine.history = exported.history || [];
      engine.observations = exported.observations || [];
      engine.selectedReads = exported.selectedReads || {};
    }
    return engine;
  }
}

// Validate scenario data structure
export function validateScenario(scenario) {
  const errors = [];

  if (!scenario.id) errors.push('Missing scenario.id');
  if (!scenario.tournament) errors.push('Missing scenario.tournament');
  if (!scenario.hero) errors.push('Missing scenario.hero');
  if (!scenario.villain) errors.push('Missing scenario.villain');
  if (!Array.isArray(scenario.nodes) || scenario.nodes.length === 0) {
    errors.push('Missing or empty scenario.nodes array');
  }

  if (scenario.nodes) {
    const nodeIds = new Set(scenario.nodes.map((n) => n.id));
    scenario.nodes.forEach((node, idx) => {
      if (!node.id) errors.push(`Node ${idx} missing id`);
      if (!node.type) errors.push(`Node ${node.id} missing type`);

      // Validate action references
      if (node.actions && Array.isArray(node.actions)) {
        node.actions.forEach((action) => {
          if (action.nextNode && !nodeIds.has(action.nextNode)) {
            errors.push(`Node ${node.id}: action ${action.id} references invalid next node ${action.nextNode}`);
          }
        });
      }

      // Validate default next
      if (node.nextNode && !nodeIds.has(node.nextNode)) {
        errors.push(`Node ${node.id}: nextNode ${node.nextNode} does not exist`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
