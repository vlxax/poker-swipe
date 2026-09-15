import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPokerPackDrift } from '../scripts/pokerPackDrift.mjs';
import { runPokerTruthDuplicates } from '../scripts/pokerTruthDuplicates.mjs';
import { runDailyTruthPaths } from '../scripts/dailyTruthPaths.mjs';
import { runSwipeTruthPaths } from '../scripts/swipeTruthPaths.mjs';
import { runPushFoldEquivalence } from '../scripts/pushFoldEquivalence.mjs';
import { runProvenanceLabelAudit } from '../scripts/pokerProvenanceLabelAudit.mjs';
import { runDomainMisuseGuards } from '../scripts/pokerDomainMisuseGuards.mjs';
import { runXrayAuthorityGuards } from '../scripts/xrayAuthorityGuards.mjs';
import { generateLockReport } from '../scripts/generatePokerTruthLockReport.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');

test('poker pack semantic drift: strategy file vs inline pack', () => {
  const r = runPokerPackDrift({ write: true });
  assert.equal(r.pass, true, `pack drift diffs=${r.diffCount}`);
});

test('poker truth duplicate report', () => {
  runPokerTruthDuplicates({ write: true });
  assert.ok(fs.existsSync(path.join(DIR, 'pokerTruthDuplicates.report.json')));
});

test('daily truth paths report', () => {
  const r = runDailyTruthPaths({ write: true });
  assert.ok(r.totalActiveDailySpots >= 5);
  assert.ok(fs.existsSync(path.join(DIR, 'dailyTruthPaths.report.json')));
});

test('swipe truth paths report', () => {
  const r = runSwipeTruthPaths({ write: true });
  assert.equal(r.totalActiveSwipeBaseSpots, 16);
  assert.ok(fs.existsSync(path.join(DIR, 'swipeTruthPaths.report.json')));
});

test('push/fold equivalence report', () => {
  const r = runPushFoldEquivalence({ write: true });
  assert.ok(r.midStage.comparable > 0);
  assert.ok(fs.existsSync(path.join(DIR, 'pushFoldEquivalence.report.json')));
});

test('provenance label audit report', () => {
  runProvenanceLabelAudit({ write: true });
  assert.ok(fs.existsSync(path.join(DIR, 'pokerProvenanceLabelAudit.report.json')));
});

test('domain misuse guards', () => {
  const r = runDomainMisuseGuards({ write: true });
  assert.equal(r.pass, true, JSON.stringify(r.violations));
});

test('xray authority guards', () => {
  const r = runXrayAuthorityGuards({ write: true });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
});

test('architecture lock markdown', () => {
  const r = generateLockReport({ write: true });
  assert.ok(fs.existsSync(path.join(ROOT, 'POKER_TRUTH_ARCHITECTURE_LOCK.md')));
  assert.ok(r.metrics);
});

test('truth domains registry exists', () => {
  const reg = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'solver/config/pokerTruthDomains.json'), 'utf8')
  );
  assert.ok(reg.sources.length >= 8);
  assert.ok(reg.mustNotUnify.length >= 4);
});
