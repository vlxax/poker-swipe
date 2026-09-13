import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countCanonicalTrainerCallCells } from '../../trainer-knowledge/trainerNativeGenerator.js';
import { canGradeWithTrainerAction } from '../../trainer-knowledge/status.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX = join(ROOT, 'data/trainer/built/trainer-candidate-index.json');

test('canonical CALL count comes from chart data, not a hardcoded quota', () => {
  const canonical = countCanonicalTrainerCallCells();
  assert.ok(canonical.totalCharts >= 1578, `charts ${canonical.totalCharts}`);
  assert.ok(canonical.callCells > 0, 'canonical CALL cells must exist');
  assert.ok(canonical.callCharts > 0);
});

test('live trainer-candidate-index includes gradable CALL from production generation', () => {
  assert.equal(existsSync(INDEX), true, 'trainer-candidate-index.json missing — rebuild required');
  const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
  const canonical = idx.canonicalCall || countCanonicalTrainerCallCells();
  assert.ok(idx.chartsScanned >= 1578, `chartsScanned ${idx.chartsScanned}`);
  assert.ok(idx.totalCharts >= 1578);
  assert.ok(canonical.callCells > 0);
  assert.ok(idx.actionCounts.CALL > 0, 'CALL missing from live candidate pool');
  assert.ok(idx.actionCounts.CALL <= canonical.callCells);
  const call = (idx.candidates || []).find((c) =>
    c.correct === 'КОЛЛ' || c.trainerMeta?.normalizedAction === 'CALL'
  );
  assert.ok(call, 'no CALL candidate in index');
  assert.equal(
    canGradeWithTrainerAction(
      call.trainerMeta.actionRaw,
      call.trainerMeta.normalizedAction,
      call.trainerMeta.contextualAction
    ),
    true
  );
  assert.ok(call.position);
  assert.ok(call.heroStack != null);
  assert.ok(Array.isArray(call.options) && call.options.includes('КОЛЛ'));
  assert.ok(call.trainerMeta?.provenance || call.trainerMeta?.gradingSource);
});
