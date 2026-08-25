// Human Confirmation #1 — regression tests for semantic reconciliation

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  applySemanticsToCell,
  resolveNaiContextualAction,
  resolveSemanticEntry,
  loadTrainerSemanticLegend
} from '../../trainer-knowledge/semanticLegend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const PARSED = join(ROOT, 'data/trainer/built/batch2-parsed-hands.json');
const RECON = join(ROOT, 'trainer-knowledge/TRAINER_HC1_RECONCILIATION.json');

describe('human confirmation #1 regression', () => {
  test('1. plain UNSELECTED → FOLD', () => {
    const cell = applySemanticsToCell(
      { actionRaw: 'UNSELECTED', isMixed: false },
      'UO_STYLE',
      { sourceMode: 'vssqueeze', chartHasAI: true }
    );
    assert.equal(cell.actionRaw, 'UNSELECTED');
    assert.equal(cell.normalizedAction, 'FOLD');
    assert.equal(cell.provenance, 'TRAINER_CONFIRMED');
    assert.equal(cell.gradingAllowed, true);
  });

  test('2. mixed containing UNSELECTED stays MIXED blocked', () => {
    const cell = applySemanticsToCell(
      {
        actionRaw: 'AI',
        isMixed: true,
        strategies: [
          { rawAction: 'AI', frequency: 55 },
          { rawAction: 'UNSELECTED', frequency: 45 }
        ]
      },
      'UO_STYLE',
      { sourceMode: 'vssqueeze', chartHasAI: true }
    );
    assert.equal(cell.normalizedAction, 'MIXED');
    assert.equal(cell.gradingAllowed, false);
    assert.equal(cell.frequencySemantics, 'UNKNOWN_OR_CONDITIONAL');
    assert.equal(cell.strategies[1].normalizedAction, 'FOLD');
  });

  test('3. nAI raw preserved', () => {
    const cell = applySemanticsToCell(
      { actionRaw: 'nAI', isMixed: false },
      'UO_STYLE',
      { sourceMode: 'callpush', chartHasAI: true }
    );
    assert.equal(cell.actionRaw, 'nAI');
    assert.equal(cell.normalizedAction, 'NON_ALL_IN');
  });

  test('4. nAI resolves only through approved context', () => {
    const ok = resolveNaiContextualAction('callpush', { chartHasAI: true });
    assert.equal(ok.contextualAction, 'NON_ALL_IN_CALL');
    assert.equal(ok.gradingAllowed, true);
    assert.equal(ok.provenance, 'TRAINER_CONFIRMED');
  });

  test('5. ambiguous nAI stays blocked', () => {
    const blocked = resolveNaiContextualAction('vslimp', { chartHasAI: true });
    assert.equal(blocked.gradingAllowed, false);
    assert.equal(blocked.normalizedAction, 'NON_ALL_IN');
    assert.equal(blocked.contextualAction, null);
  });

  test('6. mixed grading count = 0 in rebuilt dataset', () => {
    assert.ok(existsSync(RECON), 'run hc1ReconciliationAudit.mjs first');
    const recon = JSON.parse(readFileSync(RECON, 'utf8'));
    assert.equal(recon.mixedSafety.gradable, 0);
    assert.equal(recon.mixedSafety.pass, true);
  });

  test('7. orange not guessed', () => {
    const orange = resolveSemanticEntry('ORANGE_208_160_32', 'UO_STYLE');
    assert.equal(orange.gradingAllowed, false);
    assert.equal(orange.status, 'NEEDS_CLARIFICATION');
    assert.ok(existsSync(RECON));
    const recon = JSON.parse(readFileSync(RECON, 'utf8'));
    assert.equal(recon.orangeYellowSafety.orangeNewGrading, 0);
  });

  test('8. yellow not guessed', () => {
    const yellow = resolveSemanticEntry('YELLOW_240_240_48', 'MARGIN_STYLE');
    assert.equal(yellow.gradingAllowed, false);
    assert.ok(existsSync(RECON));
    const recon = JSON.parse(readFileSync(RECON, 'utf8'));
    assert.equal(recon.orangeYellowSafety.yellowNewGrading, 0);
  });

  test('9. reapply idempotent on current dataset', () => {
    assert.ok(existsSync(RECON));
    const recon = JSON.parse(readFileSync(RECON, 'utf8'));
    assert.equal(recon.idempotentReapply.pass, true);
    assert.deepEqual(recon.idempotentReapply.delta, {
      grading: 0,
      verified: 0,
      fold: 0,
      naiGradingAllowed: 0,
      mixedGradable: 0
    });
  });

  test('10. rebuild keeps same semantic counts', () => {
    assert.ok(existsSync(PARSED));
    assert.ok(existsSync(RECON));
    const recon = JSON.parse(readFileSync(RECON, 'utf8'));
    const report = JSON.parse(readFileSync(join(ROOT, 'trainer-knowledge/TRAINER_SEMANTIC_REAPPLY_REPORT.json'), 'utf8'));
    assert.equal(recon.postHumanConfirmation.grading, report.after.grading);
    assert.equal(recon.postHumanConfirmation.verified, report.after.verified);
    assert.equal(recon.postHumanConfirmation.unselectedRaw, report.after.unselected);
  });

  test('legend stores MIXED existence-only provenance', () => {
    const legend = loadTrainerSemanticLegend();
    assert.equal(legend.mixedPolicy.provenance, 'TRAINER_CONFIRMED_FOR_MIX_EXISTENCE_ONLY');
  });
});
