// Semantic legend reapply — idempotent regeneration without image reparse

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  resolveSemanticEntry,
  applySemanticsToCell,
  loadTrainerSemanticLegend
} from '../../trainer-knowledge/semanticLegend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

describe('trainer semantic legend layer', () => {
  test('central legend file exists with frozen blocked entries', () => {
    const legend = loadTrainerSemanticLegend();
    assert.equal(legend.policy.onlyVerifiedEnablesGrading, true);
    const nai = legend.entries.find((e) => e.id === 'nAI');
    const unsel = legend.entries.find((e) => e.id === 'UNSELECTED');
    assert.equal(nai.gradingAllowed, false);
    assert.equal(nai.awaitingTrainerConfirmation, true);
    assert.equal(unsel.gradingAllowed, false);
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

  test('mixed cell blocks grading until all components verified', () => {
    const cell = applySemanticsToCell(
      {
        actionRaw: 'AI',
        isMixed: true,
        strategies: [
          { rawAction: 'AI', frequency: 60, frequencyType: 'VISUAL_APPROX', gradingAllowed: true, dataStatus: 'EXACT_TRAINER_DATA' },
          { rawAction: 'UNSELECTED', frequency: 40, frequencyType: 'VISUAL_APPROX', gradingAllowed: false, dataStatus: 'NEEDS_CLARIFICATION' }
        ],
        dataStatus: 'EXACT_TRAINER_DATA',
        gradingAllowed: false
      },
      'UO_STYLE'
    );
    assert.equal(cell.gradingAllowed, false);
    assert.equal(cell.isMixed, true);
  });

  test('reapply report confirms no image reparse required', () => {
    const reportPath = join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_REAPPLY_REPORT.json');
    assert.ok(existsSync(reportPath));
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.reparseRequired, false);
    assert.equal(report.after.grading, 14358);
    assert.equal(report.after.verified, 14358);
    assert.equal(report.delta.grading, 0);
  });

  test('legend scheme index covers all batch2 charts', () => {
    const schemes = JSON.parse(
      readFileSync(join(ROOT, 'trainer-knowledge/batch2-legend-schemes.json'), 'utf8')
    );
    assert.equal(Object.keys(schemes.schemes).length, 1578);
  });
});
