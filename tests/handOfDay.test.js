// Hand of the Day scenario engine — branching logic, observations, reads

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ScenarioEngine,
  validateScenario,
  ObservationCollector,
  READ_CATEGORIES,
  buildReadQuestion,
  gradeRead,
  getVillainDialogue,
  VILLAIN_ARCHETYPES,
  getScenarioById
} from '../solver/src/handOfDay/index.js';
import { HAND_OF_DAY_SCENARIOS } from '../solver/src/handOfDay/scenarios.js';

describe('Hand of the Day — Scenario Engine', () => {
  it('validates scenario structure', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const result = validateScenario(scenario);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('initializes engine with scenario', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    assert.strictEqual(engine.currentNodeId, 'root');
    assert.strictEqual(engine.state, 'init');
    assert.strictEqual(engine.history.length, 0);
  });

  it('advances through nodes based on actions', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    const result = engine.advance('call');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.node.id, 'villain-response');
    assert.strictEqual(engine.history.length, 1);
  });

  it('tracks action history', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    engine.advance('call');
    engine.advance('call');  // villain's default next
    engine.advance('check');

    assert.strictEqual(engine.history.length, 3);
    assert.strictEqual(engine.history[0].action, 'call');
  });

  it('collects observations during hand', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    // Manual path to reach flop-hero-decision which has observation
    engine.currentNodeId = 'flop-hero-decision';  // Jump to node with observation
    const result = engine.advance('check');  // Advance from node with observation

    const obs = engine.getObservations();
    assert.ok(obs.length > 0, `Expected observations but got ${obs.length}`);
    if (obs.length > 0) {
      assert.ok(obs[0].text);
    }
  });

  it('supports going back one step', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    engine.advance('call');
    const nodeAfterFirstStep = engine.currentNodeId;

    engine.back();
    assert.strictEqual(engine.currentNodeId, 'root');
    assert.strictEqual(engine.history.length, 0);

    engine.advance('call');
    assert.strictEqual(engine.currentNodeId, nodeAfterFirstStep);
  });

  it('cannot go back at start', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    const result = engine.back();
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'at_start');
  });

  it('resets to initial state', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    engine.advance('call');
    engine.advance('call');

    engine.reset();
    assert.strictEqual(engine.currentNodeId, 'root');
    assert.strictEqual(engine.state, 'init');
    assert.strictEqual(engine.history.length, 0);
    assert.strictEqual(engine.observations.length, 0);
  });

  it('exports and restores state', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine1 = new ScenarioEngine(scenario);

    engine1.advance('call');
    engine1.advance('call');
    engine1.advance('check');

    const exported = engine1.toJSON();
    const engine2 = ScenarioEngine.fromJSON(scenario, exported);

    assert.strictEqual(engine2.currentNodeId, engine1.currentNodeId);
    assert.strictEqual(engine2.history.length, engine1.history.length);
  });
});

describe('Hand of the Day — Observations', () => {
  it('collects observations up to max', () => {
    const collector = new ObservationCollector();

    collector.addObservation({
      nodeId: 'n1',
      text: 'First observation',
      count: 1,
      totalCount: 3
    });

    collector.addObservation({
      nodeId: 'n2',
      text: 'Second observation',
      count: 2,
      totalCount: 3
    });

    assert.strictEqual(collector.getAll().length, 2);
    assert.strictEqual(collector.isFull(), false);
  });

  it('prevents duplicate observations', () => {
    const collector = new ObservationCollector();

    const obs = {
      nodeId: 'n1',
      text: 'Observation',
      count: 1,
      totalCount: 3
    };

    collector.addObservation(obs);
    const result = collector.addObservation(obs);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'duplicate_observation');
    assert.strictEqual(collector.getAll().length, 1);
  });

  it('enforces max observations limit', () => {
    const collector = new ObservationCollector();

    for (let i = 0; i < 5; i++) {
      collector.addObservation({
        nodeId: `n${i}`,
        text: `Observation ${i}`,
        count: i + 1,
        totalCount: 5
      });
    }

    assert.strictEqual(collector.getAll().length, 4);
    assert.strictEqual(collector.isFull(), true);
  });
});

describe('Hand of the Day — Reads & Reveals', () => {
  it('builds read question from categories', () => {
    const question = buildReadQuestion({}, ['7d', '4c'], []);

    assert.ok(question.choices.length > 5);
    assert.strictEqual(question.choices.some((c) => c.id === 'strong-value'), true);
    assert.strictEqual(question.choices.some((c) => c.id === 'bb-defense'), true);
  });

  it('grades read choices correctly', () => {
    const gradeCorrect = gradeRead('bb-defense', 'bb-defense', {});
    assert.strictEqual(gradeCorrect.correct, true);
    assert.strictEqual(gradeCorrect.grade, 'EXCELLENT');

    const gradeWrong = gradeRead('strong-value', 'bb-defense', {});
    assert.strictEqual(gradeWrong.correct, false);
    assert.strictEqual(gradeWrong.grade, 'MISTAKE');
  });
});

describe('Hand of the Day — Villain Personality', () => {
  it('retrieves villain archetypes', () => {
    assert.ok(VILLAIN_ARCHETYPES['tight-reg']);
    assert.ok(VILLAIN_ARCHETYPES['lag']);
    assert.ok(VILLAIN_ARCHETYPES['calling-station']);
  });

  it('generates dialogue based on archetype', () => {
    const dialogue1 = getVillainDialogue('tight-reg', 'preflop-challenge');
    assert.strictEqual(typeof dialogue1, 'string');
    assert.ok(dialogue1.length > 0);

    const dialogue2 = getVillainDialogue('lag', 'large-bet');
    assert.strictEqual(typeof dialogue2, 'string');
  });

  it('provides dialogue in Russian', () => {
    const dialogue = getVillainDialogue('tight-reg', 'preflop-challenge');
    // Simple check for Cyrillic characters
    assert.strictEqual(/[а-яё]/i.test(dialogue), true);
  });
});

describe('Hand of the Day — Scenarios', () => {
  it('loads scenario by ID', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    assert.ok(scenario);
    assert.strictEqual(scenario.id, 'hod_001_bubble_btn_bb_short');
  });

  it('validates all predefined scenarios', () => {
    for (const scenario of HAND_OF_DAY_SCENARIOS) {
      const result = validateScenario(scenario);
      assert.strictEqual(result.valid, true, `Scenario ${scenario.id} has errors: ${result.errors.join(', ')}`);
    }
  });

  it('all scenarios have required structure', () => {
    for (const scenario of HAND_OF_DAY_SCENARIOS) {
      assert.ok(scenario.id);
      assert.ok(scenario.tournament);
      assert.ok(scenario.hero);
      assert.ok(scenario.villain);
      assert.ok(scenario.nodes);
      assert.strictEqual(Array.isArray(scenario.nodes), true);
      assert.ok(scenario.nodes.length > 0);
    }
  });

  it('all nodes have valid references', () => {
    for (const scenario of HAND_OF_DAY_SCENARIOS) {
      const nodeIds = new Set(scenario.nodes.map((n) => n.id));
      for (const node of scenario.nodes) {
        if (node.nextNode) {
          assert.strictEqual(nodeIds.has(node.nextNode), true, `Node ${node.id}: nextNode ${node.nextNode} not found`);
        }
        if (node.actions) {
          for (const action of node.actions) {
            if (action.nextNode) {
              assert.strictEqual(nodeIds.has(action.nextNode), true, `Node ${node.id}: action next node ${action.nextNode} not found`);
            }
          }
        }
      }
    }
  });
});

describe('Hand of the Day — Integration', () => {
  it('plays through a complete scenario', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    // Play through one path
    let node = engine.currentNode();
    assert.strictEqual(node.type, 'hero-decision');

    engine.advance('call');  // villain response
    node = engine.currentNode();
    assert.ok(node.type === 'villain-action' || node.type === 'street-reveal');

    // Continue through the scenario
    let steps = 0;
    while (steps < 10 && node && node.type !== 'showdown' && node.type !== 'read-question') {
      if (node.actions && node.actions.length > 0) {
        engine.advance(node.actions[0].id);
      } else if (node.nextNode) {
        // For non-choice nodes, resolve next manually
        engine.currentNodeId = node.nextNode;
      } else {
        break;
      }
      node = engine.currentNode();
      steps++;
    }

    assert.ok(engine.history.length > 0);
  });

  it('reaches read screen', () => {
    const scenario = getScenarioById('hod_001_bubble_btn_bb_short');
    const engine = new ScenarioEngine(scenario);

    // Advance until we hit showdown or read
    let steps = 0;
    while (engine.state !== 'read' && engine.state !== 'showdown' && steps < 20) {
      const node = engine.currentNode();
      if (node?.actions && node.actions.length > 0) {
        engine.advance(node.actions[0].id);
      } else if (node?.nextNode) {
        engine.advance('continue');
      } else {
        break;
      }
      steps++;
    }

    assert.match(engine.state, /read|showdown/);
  });
});
