/**
 * Dual-grading regression: library canonical spots — daily vs swipe gateway.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGradingConsistencyAudit } from './gradingConsistency.harness.js';
import { getTaskById, resetTaskLibraryCache } from '../src/training/taskLibraryBridge.js';
import { drillFromLibraryTask, libraryTaskToBrainSpot } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { gradeDecision } from '../../training-ui/gradingGateway.js';
import { installPokerBrainForTests, resetPokerBrainTestEnv } from './brainTestEnv.js';

const REPORT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'gradingConsistency.report.json');

test('grading consistency report: zero strategic conflicts for library spots', () => {
  resetPokerBrainTestEnv();
  const report = runGradingConsistencyAudit({ writeReport: true });
  assert.ok(fs.existsSync(REPORT), 'gradingConsistency.report.json written');
  assert.equal(
    report.verdict,
    'SAFE_TO_MERGE_FOR_UX_PERSONALIZATION',
    `trueConflicts=${report.trueConflicts} ids=${report.conflictSpotIds.join(',')}`
  );
  assert.equal(report.trueConflicts, 0, JSON.stringify(report.samples.trueConflicts.slice(0, 5), null, 2));
});

test('swipe gateway matches gradeAnswer for library spot (adapter path)', () => {
  resetTaskLibraryCache();
  installPokerBrainForTests();
  const task = getTaskById('PRE_RFI_BTN_A8S');
  assert.ok(task);
  const gen = drillFromLibraryTask(task);
  const spot = libraryTaskToBrainSpot(task);
  const wrong = gen.drill.options.find((o) => o.labelRu !== task.correct);
  const chosenId = wrong.id;

  const direct = gradeAnswer({ drill: gen.drill, chosenId });
  const swipe = gradeDecision({
    mode: 'swipe',
    scenario: spot,
    action: 'FOLD',
    eventKey: `unit|${task.id}`
  });

  assert.ok(swipe.solver, 'library swipe should route to solver');
  assert.equal(swipe.solver.grade, direct.grade);
  assert.equal(swipe.verdict, direct.grade);
});
