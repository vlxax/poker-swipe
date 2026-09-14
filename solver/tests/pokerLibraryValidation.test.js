import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPokerLibraryValidation } from '../scripts/pokerLibraryValidation.mjs';

const REPORT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'pokerLibraryValidation.report.json');

test('poker library validation: active corpus counted', () => {
  const r = runPokerLibraryValidation();
  assert.ok(r.summary.totalTasks >= 180);
  assert.equal(r.summary.activeTasks, r.summary.totalTasks);
  assert.equal(r.summary.duplicateIds.length, 0);
});

test('poker library validation: no hard objective errors', () => {
  const r = runPokerLibraryValidation();
  const hard = r.issues.filter((i) => i.severity === 'HARD_ERROR');
  assert.equal(hard.length, 0, hard.slice(0, 5).map((x) => `${x.taskId}: ${x.message}`).join('\n'));
});

test('poker library validation: report artifact', () => {
  runPokerLibraryValidation();
  assert.ok(fs.existsSync(REPORT));
});
