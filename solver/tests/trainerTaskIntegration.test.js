// Stage 3C — training task library trainer integration tests

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resetTrainerCache, lookupTrainerSpot, lookupTrainerHandAction } from '../../trainer-knowledge/index.js';
import { loadTaskLibrary, resetTaskLibraryCache } from '../src/training/taskLibraryBridge.js';
import { libraryTaskToBrainSpot } from '../src/training/libraryDrill.js';
import {
  auditTaskLibrary,
  auditTaskTrainerCoverage,
  enrichBrainSpotWithTrainer,
  trainerActionToLibraryChoice
} from '../../trainer-knowledge/adapters/taskAdapter.js';
import { buildBrainTrainerResult } from '../../trainer-knowledge/adapters/brainAdapter.js';

const nodeLookup = {
  lookupSpot: lookupTrainerSpot,
  lookupHandAction: lookupTrainerHandAction
};

describe('trainer task integration', { concurrency: 1 }, () => {
  test('preflop RFI task resolves trainer via Russian street', () => {
    resetTrainerCache();
    resetTaskLibraryCache();
    const task = loadTaskLibrary().find((t) => t.id === 'PRE_RFI_UTG_AJO');
    assert.ok(task);
    const spot = libraryTaskToBrainSpot(task);
    const result = buildBrainTrainerResult(nodeLookup, spot, 'AJo');
    assert.notEqual(result.status, 'NO_TRAINER_DATA');
    assert.ok(['EXACT_TRAINER_MATCH', 'PARTIAL_TRAINER_MATCH', 'TRAINER_DATA_NEEDS_CLARIFICATION'].includes(result.status));
  });

  test('postflop task never trainer-graded', () => {
    resetTrainerCache();
    const task = loadTaskLibrary().find((t) => t.id === 'F_DRY_CBET');
    const audit = auditTaskTrainerCoverage(task, nodeLookup);
    assert.equal(audit.exactAnswerPossible, false);
    assert.equal(audit.fallback, true);
    assert.equal(audit.reason, 'postflop_no_trainer_grading');
  });

  test('UNSELECTED trainer action maps to FOLD for grading', () => {
    resetTrainerCache();
    const task = {
      id: 'TEST_K2S',
      street: 'ПРЕФЛОП',
      position: 'EP',
      hero: ['Ks', '2s'],
      heroStack: 3,
      history: [{ street: 'ПРЕФЛОП', text: 'До тебя все сфолдили.' }],
      options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'],
      correct: 'ФОЛД',
      concept: 'RFI EP'
    };
    const audit = auditTaskTrainerCoverage(task, nodeLookup);
    assert.equal(audit.gradingAllowed, true);
    assert.equal(audit.mappedChoice, 'ФОЛД');
  });

  test('library audit produces trainer-graded and fallback counts', () => {
    resetTrainerCache();
    resetTaskLibraryCache();
    const tasks = loadTaskLibrary();
    const report = auditTaskLibrary(tasks, nodeLookup);
    assert.ok(report.total > 50);
    assert.ok(report.preflopTasks > 20);
    assert.ok(report.trainerGradedTasks >= 0);
    assert.equal(report.trainerGradedTasks + report.fallbackTasks, report.total);
    assert.deepEqual(report.miniAppsConnected, ['swipe', 'memory']);
  });

  test('trainer AI maps to library raise/all-in when exact', () => {
    const task = { options: ['ФОЛД', 'РЕЙЗ', 'ОЛЛ-ИН'], correct: 'ОЛЛ-ИН', alsoOk: ['РЕЙЗ'] };
    assert.equal(trainerActionToLibraryChoice('AI', task), 'ОЛЛ-ИН');
    assert.equal(trainerActionToLibraryChoice('RAISE', { options: ['ФОЛД', 'РЕЙЗ'], correct: 'РЕЙЗ' }), 'РЕЙЗ');
    assert.equal(trainerActionToLibraryChoice('UNSELECTED', task), 'ФОЛД');
  });

  test('enrichBrainSpotWithTrainer keeps library correct as fallback', () => {
    resetTrainerCache();
    const task = loadTaskLibrary().find((t) => t.id === 'PRE_RFI_BTN_A8S');
    const spot = libraryTaskToBrainSpot(task);
    const enriched = enrichBrainSpotWithTrainer(spot, task, nodeLookup);
    assert.ok(enriched.trainerMeta);
    assert.equal(enriched.preferred[0], task.correct);
    if (!enriched.trainerMeta.useForGrading) {
      assert.ok(enriched.trainerMeta.referenceOnly || enriched.trainerMeta.status === 'NO_TRAINER_DATA');
    }
  });

  test('no duplicate task generation — audit uses library ids only', () => {
    resetTrainerCache();
    const tasks = loadTaskLibrary();
    const ids = new Set(tasks.map((t) => t.id));
    assert.equal(ids.size, tasks.length);
    const report = auditTaskLibrary(tasks, nodeLookup);
    const auditIds = new Set(report.rows.map((r) => r.taskId));
    assert.equal(auditIds.size, tasks.length);
  });
});
