// Phase 13: Training Quality Audit — read-only verification harness.
// Runs 100-session audit and emits metrics report. Does not modify production code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTrainingQualityAudit } from '../scripts/audit100Sessions.mjs';

let REPORT = null;

test('audit completes 100 sessions across profiles A/B/C', () => {
  REPORT = runTrainingQualityAudit();
  assert.equal(REPORT.metrics.sessionsAudited, 100);
  assert.equal(REPORT.metrics.totalTasks, 1500);
  assert.equal(REPORT.metrics.libraryValid, true);
  assert.equal(REPORT.metrics.metadataFullyUsable, REPORT.metrics.metadataTotal);
});

test('audit: poker logic — library valid, zero invalid spots', () => {
  const r = REPORT || runTrainingQualityAudit();
  assert.equal(r.metrics.invalidSpotCount, 0);
  assert.equal(r.metrics.answerFailCount, 0);
  assert.equal(r.metrics.contextFailCount, 0);
  assert.equal(r.metrics.ruTermFailCount, 0);
});

test('audit: duplicates within sessions are zero', () => {
  const r = REPORT || runTrainingQualityAudit();
  assert.equal(r.metrics.duplicateRate, 0);
});

test('audit: session-0 profile differentiation A vs B', () => {
  const r = REPORT || runTrainingQualityAudit();
  const s0 = r.session0Rates;
  assert.ok(s0.A.icmPush > s0.B.icmPush, `A icm ${s0.A.icmPush} vs B ${s0.B.icmPush}`);
  assert.ok(s0.B.postRiver >= s0.A.postRiver, `B postRiver ${s0.B.postRiver} vs A ${s0.A.postRiver}`);
  assert.equal(r.metrics.crossProfileOverlap, 0);
});

test('audit: advanced player C receives hard tasks on session 0', () => {
  const r = REPORT || runTrainingQualityAudit();
  assert.ok(r.session0Rates.C.advancedRate >= 25, `C advanced ${r.session0Rates.C.advancedRate}%`);
});

test('audit: personalization remains active across longitudinal sessions', () => {
  const r = REPORT || runTrainingQualityAudit();
  assert.equal(r.metrics.personalizedRate, 100);
});

test('report: Phase 13 training quality audit summary', () => {
  const r = REPORT || runTrainingQualityAudit();
  console.log('\n=== PHASE 13 TRAINING QUALITY AUDIT ===');
  console.log('Sessions:', r.metrics.sessionsAudited, '| Tasks:', r.metrics.totalTasks);
  console.log('Duplicate rate:', r.metrics.duplicateRate + '%');
  console.log('Near-duplicate rate:', r.metrics.nearDuplicateRate + '%');
  console.log('Profile mismatch rate:', r.metrics.profileMismatchRate + '%');
  console.log('Invalid spots:', r.metrics.invalidSpotCount);
  console.log('Diff mismatch rate:', r.metrics.diffMismatchRate + '%');
  console.log('Personalized sessions:', r.metrics.personalizedRate + '%');
  console.log('Session-0 A icmPush:', r.session0Rates.A.icmPush + '%');
  console.log('Session-0 B postRiver:', r.session0Rates.B.postRiver + '%');
  console.log('Session-0 C advanced:', r.session0Rates.C.advancedRate + '%');
  console.log('Verdict:', r.verdict);
  console.log('Next P0 fixes:', r.nextP0Fixes.join('; '));
  assert.ok(r.metrics.sessionsAudited === 100);
});
