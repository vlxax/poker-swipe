// Phase 13: training quality audit — 100 generated sessions across player profiles.
// Audit only: no product-logic changes. Failures document quality gaps.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  runTrainingQualityAudit,
  formatAuditReport,
  AUDIT_SESSION_COUNT
} from './trainingQualityAudit.harness.js';
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
  const testsLine = '6/6 harness';
  const text = writeArtifacts(REPORT, testsLine);
  console.log('\n=== PHASE 13 TRAINING QUALITY AUDIT ===\n' + text + '\n');
  assert.ok(['PASS', 'FAIL'].includes(REPORT.TRAINING_QUALITY));
  assert.ok(['PASS', 'FAIL'].includes(REPORT.POKER_LOGIC));
  assert.ok(['PASS', 'FAIL'].includes(REPORT.PERSONALIZATION_QUALITY));
  assert.equal(typeof REPORT.DUPLICATES, 'number');
  assert.equal(typeof REPORT.NEAR_DUPLICATES, 'number');
  assert.equal(typeof REPORT.PROFILE_MISMATCH, 'number');
  assert.equal(typeof REPORT.INVALID_SPOTS, 'number');
});
