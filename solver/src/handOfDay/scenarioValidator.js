// Comprehensive scenario validator for Hand of the Day
// Ensures poker legality and consistency

const VALID_POSITIONS = ['UTG', 'UTG+1', 'MP', 'MP+1', 'CO', 'BTN', 'SB', 'BB'];
const VALID_STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];
const VALID_NODE_TYPES = ['hero-decision', 'villain-action', 'street-reveal', 'observation', 'read-question', 'reveal', 'showdown', 'complete'];
const VALID_CARDS = ['As', 'Ah', 'Ad', 'Ac', 'Ks', 'Kh', 'Kd', 'Kc', 'Qs', 'Qh', 'Qd', 'Qc', 'Js', 'Jh', 'Jd', 'Jc', 'Ts', 'Th', 'Td', 'Tc', '9s', '9h', '9d', '9c', '8s', '8h', '8d', '8c', '7s', '7h', '7d', '7c', '6s', '6h', '6d', '6c', '5s', '5h', '5d', '5c', '4s', '4h', '4d', '4c', '3s', '3h', '3d', '3c', '2s', '2h', '2d', '2c'];

export class ScenarioValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validate(scenario) {
    this.errors = [];
    this.warnings = [];

    if (!scenario) {
      this.errors.push('Scenario is null or undefined');
      return this.result();
    }

    this._validateMetadata(scenario);
    this._validateTournament(scenario);
    this._validateHeroVillain(scenario);
    this._validateBoard(scenario);
    this._validateNodes(scenario);
    this._validateNodeReferences(scenario);
    this._validateBranchConsistency(scenario);
    this._validatePokerLegality(scenario);

    return this.result();
  }

  result() {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      errorCount: this.errors.length,
      warningCount: this.warnings.length
    };
  }

  _validateMetadata(scenario) {
    if (!scenario.id) this.errors.push('Missing scenario.id');
    if (!scenario.title) this.errors.push('Missing scenario.title');
    if (!scenario.nodes || !Array.isArray(scenario.nodes)) {
      this.errors.push('Missing or invalid scenario.nodes array');
    }
    if (scenario.nodes && scenario.nodes.length === 0) {
      this.errors.push('Scenario.nodes is empty');
    }
    if (!scenario.rootNodeId) {
      this.warnings.push('Missing scenario.rootNodeId, defaulting to "root"');
    }
  }

  _validateTournament(scenario) {
    const t = scenario.tournament;
    if (!t) this.errors.push('Missing tournament object');
    if (t && !t.stage) this.errors.push('Tournament missing stage (EARLY/MIDDLE/LATE/BUBBLE/FT)');
    if (t && (!t.playersRemaining || typeof t.playersRemaining !== 'number')) {
      this.errors.push('Tournament playersRemaining must be a number');
    }
    if (t && (!t.paidPlaces || typeof t.paidPlaces !== 'number')) {
      this.errors.push('Tournament paidPlaces must be a number');
    }
  }

  _validateHeroVillain(scenario) {
    const hero = scenario.hero;
    const villain = scenario.villain;

    if (!hero) this.errors.push('Missing hero object');
    if (!villain) this.errors.push('Missing villain object');

    if (hero) {
      if (!VALID_POSITIONS.includes(hero.position)) {
        this.errors.push(`Invalid hero position: ${hero.position}`);
      }
      if (typeof hero.stack !== 'number' || hero.stack <= 0) {
        this.errors.push('Hero stack must be positive number');
      }
      if (typeof hero.stackBb !== 'number' || hero.stackBb <= 0) {
        this.errors.push('Hero stackBb must be positive number');
      }
      if (!Array.isArray(hero.cards) || hero.cards.length !== 2) {
        this.errors.push('Hero must have exactly 2 cards');
      }
      if (hero.cards) {
        this._validateCards(hero.cards, 'hero');
      }
    }

    if (villain) {
      if (!VALID_POSITIONS.includes(villain.position)) {
        this.errors.push(`Invalid villain position: ${villain.position}`);
      }
      if (typeof villain.stack !== 'number' || villain.stack <= 0) {
        this.errors.push('Villain stack must be positive number');
      }
      if (!villain.archetype) {
        this.warnings.push('Villain missing archetype');
      }
      if (villain.cards && Array.isArray(villain.cards)) {
        if (villain.cards.length !== 2) {
          this.errors.push('Villain must have exactly 2 cards (revealed at end)');
        }
        this._validateCards(villain.cards, 'villain');
      }
    }

    // Positions shouldn't be the same
    if (hero && villain && hero.position === villain.position) {
      this.errors.push('Hero and villain cannot have the same position');
    }
  }

  _validateBoard(scenario) {
    if (!scenario.board) scenario.board = [];

    const board = scenario.board;
    if (!Array.isArray(board)) {
      this.errors.push('Board must be an array');
      return;
    }

    if (board.length > 5) {
      this.errors.push('Board cannot have more than 5 cards');
    }

    this._validateCards(board, 'board');

    // Check for duplicate cards across hero, villain, board
    const allCards = [
      ...(scenario.hero?.cards || []),
      ...(scenario.villain?.cards || []),
      ...(board || [])
    ];

    const cardCounts = {};
    allCards.forEach(card => {
      cardCounts[card] = (cardCounts[card] || 0) + 1;
    });

    Object.entries(cardCounts).forEach(([card, count]) => {
      if (count > 1) {
        this.errors.push(`Duplicate card: ${card} appears ${count} times`);
      }
    });
  }

  _validateCards(cards, context) {
    if (!Array.isArray(cards)) {
      this.errors.push(`${context} cards must be an array`);
      return;
    }

    cards.forEach((card, idx) => {
      if (!VALID_CARDS.includes(card)) {
        this.errors.push(`Invalid card in ${context}[${idx}]: ${card}`);
      }
    });
  }

  _validateNodes(scenario) {
    if (!scenario.nodes || !Array.isArray(scenario.nodes)) return;

    const nodeIds = new Set();
    scenario.nodes.forEach((node, idx) => {
      if (!node.id) {
        this.errors.push(`Node ${idx} missing id`);
        return;
      }

      if (nodeIds.has(node.id)) {
        this.errors.push(`Duplicate node id: ${node.id}`);
      }
      nodeIds.add(node.id);

      if (!VALID_NODE_TYPES.includes(node.type)) {
        this.errors.push(`Node ${node.id}: invalid type ${node.type}`);
      }

      // Terminal nodes don't need streets
      if (!['complete', 'showdown', 'reveal'].includes(node.type)) {
        if (node.street && !VALID_STREETS.includes(node.street)) {
          this.errors.push(`Node ${node.id}: invalid street ${node.street}`);
        }
      }

      // Check node-specific requirements
      if (node.type === 'hero-decision' && (!node.actions || node.actions.length === 0)) {
        this.errors.push(`Node ${node.id}: hero-decision must have actions`);
      }

      if (node.actions) {
        node.actions.forEach((action, aIdx) => {
          if (!action.id) {
            this.errors.push(`Node ${node.id} action ${aIdx}: missing id`);
          }
          if (!action.label) {
            this.warnings.push(`Node ${node.id} action ${action.id}: missing label`);
          }
        });
      }

      if (node.observation && typeof node.observation.text !== 'string') {
        this.errors.push(`Node ${node.id}: observation.text must be a string`);
      }
    });
  }

  _validateNodeReferences(scenario) {
    if (!scenario.nodes) return;

    const nodeIds = new Set(scenario.nodes.map(n => n.id));

    scenario.nodes.forEach(node => {
      // Check nextNode references
      if (node.nextNode && !nodeIds.has(node.nextNode)) {
        this.errors.push(`Node ${node.id}: nextNode references non-existent node ${node.nextNode}`);
      }

      // Check action references
      if (node.actions && Array.isArray(node.actions)) {
        node.actions.forEach(action => {
          if (action.nextNode && !nodeIds.has(action.nextNode)) {
            this.errors.push(`Node ${node.id} action ${action.id}: nextNode references non-existent node ${action.nextNode}`);
          }
        });
      }
    });

    // Check rootNodeId
    if (scenario.rootNodeId && !nodeIds.has(scenario.rootNodeId)) {
      this.errors.push(`rootNodeId references non-existent node: ${scenario.rootNodeId}`);
    }
  }

  _validateBranchConsistency(scenario) {
    if (!scenario.nodes) return;

    // Detect infinite loops
    const visited = new Set();
    const recursionStack = new Set();

    const detectLoop = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        this.errors.push(`Infinite loop detected: ${path.join(' → ')} → ${nodeId}`);
        return true;
      }

      if (visited.has(nodeId)) return false;

      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = scenario.nodes.find(n => n.id === nodeId);
      if (node) {
        if (node.nextNode && detectLoop(node.nextNode, [...path])) return true;
        if (node.actions) {
          for (const action of node.actions) {
            if (action.nextNode && detectLoop(action.nextNode, [...path])) return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    if (scenario.rootNodeId) {
      detectLoop(scenario.rootNodeId);
    }
  }

  _validatePokerLegality(scenario) {
    const hero = scenario.hero;
    const villain = scenario.villain;

    if (!hero || !villain) return;

    // Stack sizes should make sense relative to blinds
    if (hero.stackBb < 1) {
      this.errors.push('Hero stack is less than 1 BB');
    }
    if (villain.stackBb < 1) {
      this.errors.push('Villain stack is less than 1 BB');
    }

    // Stack sizes should be reasonable
    if (hero.stackBb > 500) {
      this.warnings.push('Hero stack is extremely deep (>500 BB)');
    }
    if (hero.stackBb < 3 && hero.stackBb > 0) {
      this.warnings.push('Hero is short-stacked (<3 BB)');
    }

    // Check tournament stage consistency
    const tournament = scenario.tournament;
    if (tournament) {
      if (tournament.stage === 'FT' || tournament.stage === 'FINAL TABLE') {
        if (tournament.playersRemaining > 10) {
          this.warnings.push('Stage says FT but more than 10 players remain');
        }
      }
      if (tournament.stage === 'BUBBLE' || tournament.stage === 'БАББЛ') {
        if (tournament.playersRemaining <= tournament.paidPlaces) {
          this.warnings.push('Stage says BUBBLE but ITM is already reached');
        }
      }
    }
  }
}

export function validateAllScenarios(scenarios) {
  const validator = new ScenarioValidator();
  const results = [];

  scenarios.forEach((scenario, idx) => {
    const result = validator.validate(scenario);
    if (!result.valid) {
      results.push({
        scenarioId: scenario.id || `unknown_${idx}`,
        ...result
      });
    }
  });

  return {
    allValid: results.length === 0,
    invalidScenarios: results,
    validCount: scenarios.length - results.length,
    totalCount: scenarios.length
  };
}
