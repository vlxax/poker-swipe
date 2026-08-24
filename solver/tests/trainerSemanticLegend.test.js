// Semantic legend reapply — idempotent regeneration without image reparse

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  resolveSemanticEntry,
  resolveNaiContextualAction,
  applySemanticsToCell,
  loadTrainerSemanticLegend
} from '../../trainer-knowledge/semanticLegend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

describe('trainer semantic legend layer', () => {
  test('central legend file has trainer-confirmed nAI and UNSELECTED entries', () => {
    const legend = loadTrainerSemanticLegend();
    assert.equal(legend.policy.onlyVerifiedEnablesGrading, true);
    assert.equal(legend.policy.mixedGradingAllowed, false);
    const nai = legend.entries.find((e) => e.id === 'nAI');
    const unsel = legend.entries.find((e) => e.id === 'UNSELECTED');
    assert.equal(nai.normalizedAction, 'NON_ALL_IN');
    assert.equal(nai.status, 'TRAINER_CONFIRMED');
    assert.equal(nai.provenance, 'TRAINER_CONFIRMED');
    assert.equal(nai.gradingAllowed, false);
    assert.equal(unsel.normalizedAction, 'FOLD');
    assert.equal(unsel.status, 'TRAINER_CONFIRMED');
    assert.equal(unsel.gradingAllowed, true);
    assert.equal(unsel.provenance, 'TRAINER_CONFIRMED');
  });

  test('nAI contextual grading requires chart AI presence and sourceMode', () => {
    const blocked = resolveNaiContextualAction('callpush', { chartHasAI: false });
    assert.equal(blocked.normalizedAction, 'NON_ALL_IN');
    assert.equal(blocked.gradingAllowed, false);

    const callpush = resolveNaiContextualAction('callpush', { chartHasAI: true });
    assert.equal(callpush.contextualAction, 'NON_ALL_IN_CALL');
    assert.equal(callpush.gradingAllowed, true);

    const vs3bet = resolveNaiContextualAction('vs3bet', { chartHasAI: true });
    assert.equal(vs3bet.contextualAction, 'NON_ALL_IN_3BET');
    assert.equal(vs3bet.gradingAllowed, true);

    const unknown = resolveNaiContextualAction('vslimp', { chartHasAI: true });
    assert.equal(unknown.gradingAllowed, false);
  });

  test('UNSELECTED maps to FOLD with trainer-confirmed grading', () => {
    const cell = applySemanticsToCell(
      { actionRaw: 'UNSELECTED', isMixed: false, dataStatus: 'NEEDS_CLARIFICATION' },
      'UO_STYLE',
      { sourceMode: 'vssqueeze', chartHasAI: true }
    );
    assert.equal(cell.normalizedAction, 'FOLD');
    assert.equal(cell.semanticStatus, 'TRAINER_CONFIRMED');
    assert.equal(cell.provenance, 'TRAINER_CONFIRMED');
    assert.equal(cell.gradingAllowed, true);
  });

  test('orange resolves differently by legend scheme without reparse', () => {
    const uo = resolveSemanticEntry('ORANGE_208_160_32', 'UO_STYLE');
    const margin = resolveSemanticEntry('ORANGE_208_160_32', 'MARGIN_STYLE');
    assert.equal(uo.id, 'ORANGE_UO');
    assert.equal(margin.id, 'ORANGE_MARGIN');
    assert.notEqual(uo.rawLabel, margin.rawLabel);
    assert.equal(uo.gradingAllowed, false);
    assert.equal(margin.gradingAllowed, false);
  });

  test('mixed cell blocks grading with UNKNOWN_OR_CONDITIONAL frequency semantics', () => {
    const cell = applySemanticsToCell(
      {
        actionRaw: 'AI',
        isMixed: true,
        strategies: [
          { rawAction: 'AI', frequency: 60, frequencyType: 'VISUAL_APPROX', gradingAllowed: true },
          { rawAction: 'UNSELECTED', frequency: 40, frequencyType: 'VISUAL_APPROX', gradingAllowed: false }
        ],
        dataStatus: 'EXACT_TRAINER_DATA',
        gradingAllowed: false
      },
      'UO_STYLE',
      { sourceMode: 'vssqueeze', chartHasAI: true }
    );
    assert.equal(cell.gradingAllowed, false);
    assert.equal(cell.isMixed, true);
    assert.equal(cell.normalizedAction, 'MIXED');
    assert.equal(cell.frequencySemantics, 'UNKNOWN_OR_CONDITIONAL');
    assert.equal(cell.provenance, 'TRAINER_CONFIRMED');
    assert.equal(cell.strategies[1].normalizedAction, 'FOLD');
  });

  test('reapply report exists and records human confirmation #1', () => {
    const reportPath = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_REAPPLY_REPORT.json');
    assert.ok(existsSync(reportPath));
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.reparseRequired, false);
    assert.equal(report.trainerConfirmation, 'HUMAN_CONFIRMATION_1');
    assert.equal(report.safeToMerge, false);
    assert.ok(report.humanConfirmation1);
    assert.equal(report.humanConfirmation1.gradingAfter, 210642);
    assert.equal(report.humanConfirmation1.verifiedAfter, 210642);
  });

  test('legend scheme index covers all batch2 charts', () => {
    const schemes = JSON.parse(
      readFileSync(join(ROOT, 'trainer-knowledge/batch2-legend-schemes.json'), 'utf8')
    );
    assert.equal(Object.keys(schemes.schemes).length, 1578);
  });
});
