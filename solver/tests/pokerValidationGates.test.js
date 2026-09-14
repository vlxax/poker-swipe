import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPreflopStackSensitivity } from '../scripts/preflopStackSensitivity.mjs';
import { runPostflopContextSensitivity } from '../scripts/postflopContextSensitivity.mjs';
import { runPokerProvenanceAudit } from '../scripts/pokerProvenanceAudit.mjs';
import { runBlockerClassification } from '../scripts/pokerPolicyBlockerClassification.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

test('preflop stack sensitivity report', () => {
  const r = runPreflopStackSensitivity();
  assert.ok(r.totalComparablePolicies > 0);
  assert.equal(r.solverVerified, false);
  assert.ok(fs.existsSync(path.join(DIR, 'preflopStackSensitivity.report.json')));
});

test('postflop context sensitivity report', () => {
  runPostflopContextSensitivity();
  assert.ok(fs.existsSync(path.join(DIR, 'postflopContextSensitivity.report.json')));
});

test('poker provenance audit', () => {
  const r = runPokerProvenanceAudit();
  assert.ok(r.datasets.some((d) => d.file.includes('strategy_pack')));
  assert.ok(fs.existsSync(path.join(DIR, 'pokerProvenance.report.json')));
});

test('policy blocker classification', () => {
  const r = runBlockerClassification();
  assert.ok(r.brainPolicyBlockersCount >= 0);
  assert.ok(fs.existsSync(path.join(DIR, 'pokerPolicyBlockerClassification.report.json')));
});
