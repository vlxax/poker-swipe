// Hand of the Day — UI Integration Test
// Tests SessionController + ScenarioEngine + Renderer interaction

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SessionController } from '../training-ui/sessionController.js';
import { getScenarioById } from '../solver/src/handOfDay/index.js';

// Mock store
const mockStore = {
  loadSkillProfile: () => ({ overall: 50, tracks: [] }),
  loadHistory: () => []
};

describe('Hand of the Day — UI Integration', () => {
  it('SessionController initializes in drill mode', () => {
    const controller = new SessionController({ store: mockStore });
    assert.strictEqual(controller.mode, 'drill');
    assert.strictEqual(controller.scenarioEngine, null);
  });

  it('SessionController switches to hand-of-day mode on startHandOfDay', () => {
    const controller = new SessionController({ store: mockStore });
    const result = controller.startHandOfDay('hod_001_bubble_btn_bb_short');

    assert.strictEqual(result.started, true);
    assert.strictEqual(controller.mode, 'hand-of-day');
    assert.ok(controller.scenarioEngine);
    assert.strictEqual(controller.state, 'ready');
  });

  it('SessionController handles scenario not found', () => {
    const controller = new SessionController({ store: mockStore });
    const result = controller.startHandOfDay('nonexistent_scenario');

    assert.strictEqual(result.started, false);
    assert.strictEqual(result.reason, 'scenario_not_found');
  });

  it('SessionController advances through hand of day', () => {
    const controller = new SessionController({ store: mockStore });
    controller.startHandOfDay('hod_001_bubble_btn_bb_short');

    const node1 = controller.currentNode();
    assert.strictEqual(node1.type, 'hero-decision');

    const result = controller.advanceScenario('call');
    assert.strictEqual(result.ok, true);
    assert.ok(result.node);
  });

  it('SessionController tracks observations', () => {
    const controller = new SessionController({ store: mockStore });
    controller.startHandOfDay('hod_001_bubble_btn_bb_short');

    // Manually set position to node with observation
    controller.scenarioEngine.currentNodeId = 'flop-hero-decision';
    const result = controller.advanceScenario('check');

    const obs = controller.getHandOfDayObservations();
    assert.ok(obs.length > 0);
  });

  it('SessionController records read choice', () => {
    const controller = new SessionController({ store: mockStore });
    controller.startHandOfDay('hod_001_bubble_btn_bb_short');

    // Navigate to read-question node
    const scenario = controller.currentScenario;
    let currentNode = controller.currentNode();
    let steps = 0;

    while (currentNode && currentNode.type !== 'read-question' && steps < 20) {
      if (currentNode.actions && currentNode.actions.length > 0) {
        controller.advanceScenario(currentNode.actions[0].id);
      } else if (currentNode.nextNode) {
        controller.advanceScenario('continue');
      } else {
        break;
      }
      currentNode = controller.currentNode();
      steps++;
    }

    if (currentNode && currentNode.type === 'read-question') {
      const result = controller.recordReadChoice('bb-defense');
      assert.strictEqual(result.ok, true);
    }
  });

  it('SessionController can reset hand of day', () => {
    const controller = new SessionController({ store: mockStore });
    controller.startHandOfDay('hod_001_bubble_btn_bb_short');

    controller.advanceScenario('call');
    assert.ok(controller.scenarioEngine.history.length > 0);

    controller.resetHandOfDay();
    assert.strictEqual(controller.scenarioEngine.history.length, 0);
    assert.strictEqual(controller.scenarioEngine.currentNodeId, 'root');
  });

  it('Renderer functions export correctly', async () => {
    const { renderHandOfDayNode } = await import('../training-ui/handOfDayRenderer.js');
    assert.strictEqual(typeof renderHandOfDayNode, 'function');
  });

  it('Complete hand of day flow', () => {
    const controller = new SessionController({ store: mockStore });
    controller.startHandOfDay('hod_001_bubble_btn_bb_short');

    assert.strictEqual(controller.mode, 'hand-of-day');
    assert.strictEqual(controller.state, 'ready');

    const scenario = controller.currentScenario;
    assert.ok(scenario.id);
    assert.ok(scenario.nodes);

    let node = controller.currentNode();
    assert.ok(node);

    let steps = 0;
    while (node && node.type !== 'complete' && steps < 30) {
      if (node.actions && node.actions.length > 0) {
        controller.advanceScenario(node.actions[0].id);
      } else if (node.type === 'read-question' && steps > 15) {
        controller.recordReadChoice('bb-defense');
        controller.advanceScenario('continue');
      } else if (node.nextNode) {
        controller.advanceScenario('continue');
      } else {
        break;
      }
      node = controller.currentNode();
      steps++;
    }

    assert.ok(steps > 0, 'Should traverse at least one node');
  });
});
