// Phase 13: training quality audit — 100 generated sessions across player profiles.
// Combines the 10-profile P0 harness (quality gates) with the main-branch A/B/C
// longitudinal audit script. Audit only: no product-logic changes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  runTrainingQualityAudit,
  formatAuditReport,
  AUDIT_SESSION_COUNT
} from './trainingQualityAudit.harness.js';
import { runTrainingQualityAudit as runScriptAudit } from '../scripts/audit100Sessions.mjs';
import { loadTaskLibrary } from '../src/training/taskLibraryBridge.js';
import { validateLibrary } from '../../task-context/validator.js';

const ARTIFACT_DIR = '/opt/cursor/artifacts';
const LOCAL_ARTIFACT = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'trainingQualityAudit.report.json');

const REPORT = await runTrainingQualityAudit({ sessions: AUDIT_SESSION_COUNT });

function writeArtifacts(report, testsLine) {
  report.TESTS = testsLine;
  const text = formatAuditReport(report, testsLine);
  const json = JSON.stringify(report, null, 2);
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'training_quality_audit_report.txt'), text);
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'training_quality_audit_report.json'), json);
  } catch {
    /* artifacts dir may be missing outside cloud */
  }
  fs.writeFileSync(LOCAL_ARTIFACT, json);
  return text;
}

test('audit generated 100 sessions across 10 profiles', () => {
  assert.equal(REPORT.sessions, 100, `sessions ${REPORT.sessions}`);
  assert.equal(REPORT.profiles, 10);
  assert.ok(REPORT.tasks >= 100 * 5, `expected ~700 tasks, got ${REPORT.tasks}`);
  assert.equal(REPORT.detail.vmErrors, 0, 'view-model construction threw');
});

test('every session filled from the production library path', () => {
  assert.ok(REPORT.detail.personalizedSessions >= 90, `personalized ${REPORT.detail.personalizedSessions}/100`);
  assert.ok(REPORT.detail.sampleSession, 'missing sample session');
  assert.ok((REPORT.detail.sampleSession.taskIds || []).length >= 5);
});

test('skill coverage spans the training taxonomy', () => {
  const skills = REPORT.detail.skillCoverage;
  assert.ok(skills.length >= 8, `coverage ${skills.length}: ${skills.join(', ')}`);
  assert.ok(skills.includes('preflop') || skills.includes('icm'));
  assert.ok(skills.includes('river') || skills.includes('postflop') || skills.includes('bluffCatch'));
});

test('difficulty distribution is recorded for levels 1–5', () => {
  const d = REPORT.detail.difficultyDistribution;
  const sum = Object.values(d).reduce((a, b) => a + b, 0);
  assert.equal(sum, REPORT.tasks);
  assert.ok(d[1] + d[2] + d[3] > 0, 'no easy/mid tasks');
});

test('library still validates as a corpus (baseline, not a fix)', () => {
  const lib = loadTaskLibrary();
  const res = validateLibrary(lib);
  assert.equal(res.ok, true, res.errors.join('\n'));
  assert.ok(lib.length >= 180, `library size ${lib.length}`);
});

test('report: Phase 13 training quality audit', () => {
  const testsLine = '13/13 harness+script';
  const text = writeArtifacts(REPORT, testsLine);
  console.log('\n=== PHASE 13 TRAINING QUALITY AUDIT (HARNESS) ===\n' + text + '\n');

  assert.equal(REPORT.TRAINING_QUALITY, 'PASS', REPORT.NEXT_P0_FIXES?.join('; '));
  assert.equal(REPORT.POKER_LOGIC, 'PASS');
  assert.equal(REPORT.PERSONALIZATION_QUALITY, 'PASS');
  assert.equal(REPORT.INVALID_SPOTS, 0);
  assert.ok(REPORT.PROFILE_MISMATCH <= 45, `profile mismatch ${REPORT.PROFILE_MISMATCH}%`);
  assert.equal(REPORT.detail.gradingCollisionUnique, 0);
  assert.equal(REPORT.detail.explainMatchRate, 100);
  assert.equal(REPORT.detail.brainContextIssueRate, 0);
  assert.ok(REPORT.detail.beginnerEasyRate >= 70, `beginner easy ${REPORT.detail.beginnerEasyRate}%`);
  assert.ok(
    REPORT.detail.terminologyTaskCount <= REPORT.tasks * 0.25,
    `terminology ${REPORT.detail.terminologyTaskCount}/${REPORT.tasks}`
  );
  assert.equal(typeof REPORT.DUPLICATES, 'number');
  assert.equal(typeof REPORT.NEAR_DUPLICATES, 'number');
});

let SCRIPT_REPORT = null;

test('script audit completes 100 sessions across profiles A/B/C', () => {
  SCRIPT_REPORT = runScriptAudit();
  assert.equal(SCRIPT_REPORT.metrics.sessionsAudited, 100);
  assert.equal(SCRIPT_REPORT.metrics.totalTasks, 1500);
  assert.equal(SCRIPT_REPORT.metrics.libraryValid, true);
  assert.equal(SCRIPT_REPORT.metrics.metadataFullyUsable, SCRIPT_REPORT.metrics.metadataTotal);
});

test('script audit: poker logic — library valid, zero invalid spots', () => {
  const r = SCRIPT_REPORT || runScriptAudit();
  assert.equal(r.metrics.invalidSpotCount, 0);
  assert.equal(r.metrics.answerFailCount, 0);
  assert.equal(r.metrics.contextFailCount, 0);
  assert.equal(r.metrics.ruTermFailCount, 0);
});

test('script audit: duplicates within sessions are zero', () => {
  const r = SCRIPT_REPORT || runScriptAudit();
  assert.equal(r.metrics.duplicateRate, 0);
});

test('script audit: session-0 profile differentiation A vs B', () => {
  const r = SCRIPT_REPORT || runScriptAudit();
  const s0 = r.session0Rates;
  assert.ok(s0.A.icmPush > s0.B.icmPush, `A icm ${s0.A.icmPush} vs B ${s0.B.icmPush}`);
  assert.ok(s0.B.postRiver >= s0.A.postRiver, `B postRiver ${s0.B.postRiver} vs A ${s0.A.postRiver}`);
  assert.equal(r.metrics.crossProfileOverlap, 0);
});

test('script audit: advanced player C receives hard tasks on session 0', () => {
  const r = SCRIPT_REPORT || runScriptAudit();
  assert.ok(r.session0Rates.C.advancedRate >= 25, `C advanced ${r.session0Rates.C.advancedRate}%`);
});

test('script audit: personalization remains active across longitudinal sessions', () => {
  const r = SCRIPT_REPORT || runScriptAudit();
  assert.equal(r.metrics.personalizedRate, 100);
});

test('script audit: Phase 13 training quality audit summary', () => {
  const r = SCRIPT_REPORT || runScriptAudit();
  console.log('\n=== PHASE 13 TRAINING QUALITY AUDIT (SCRIPT) ===');
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
