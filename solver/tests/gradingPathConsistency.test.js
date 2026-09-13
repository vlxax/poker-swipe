/**
 * Regression: same library drill must grade identically via daily path (gradeAnswer)
 * and grading gateway mode daily (no PokerBrain re-grade).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTaskById } from '../src/training/taskLibraryBridge.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { gradeDecision } from '../../training-ui/gradingGateway.js';

test('daily gateway and gradeAnswer agree on library drill', () => {
  const task = getTaskById('PRE_RFI_BTN_A8S') || getTaskById('ADV9B_POSITION_SB_STEAL');
  assert.ok(task, 'fixture task in library');
  const gen = drillFromLibraryTask(task);
  assert.ok(gen.ok);
  const drill = gen.drill;
  const wrong = drill.options.find((o) => o.labelRu !== task.correct);
  const chosenId = wrong ? wrong.id : drill.options[0].id;

  const direct = gradeAnswer({ drill, chosenId });
  const gateway = gradeDecision({
    mode: 'daily',
    drill,
    chosenActionId: chosenId,
    eventKey: `test|${task.id}`
  });

  assert.ok(gateway.solver);
  assert.equal(gateway.solver.grade, direct.grade);
  assert.equal(gateway.solver.evLossBb, direct.evLossBb);
});
