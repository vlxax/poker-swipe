#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runTrainingQualityAudit,
  AUDIT_SESSION_COUNT
} from '../tests/trainingQualityAudit.harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'solver/tests/difficultyAudit.report.json');

export async function runDifficultyAudit({ write = true, seeds = [0] } = {}) {
  const runs = [];
  for (const seed of seeds) {
    const report = await runTrainingQualityAudit({ sessions: AUDIT_SESSION_COUNT });
    runs.push({
      seed,
      beginnerEasyRate: report.detail.beginnerEasyRate,
      advancedHardRate: report.detail.advancedHardRate,
      difficultyDistribution: report.detail.difficultyDistribution,
      trainingQuality: report.TRAINING_QUALITY
    });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    runs,
    phase13Note: 'Harness uses live selector; script audit100Sessions uses fixed seeds — compare both in trainingQualityAudit.test.js'
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  return out;
}

if (process.argv[1]?.endsWith('difficultyAudit.mjs')) {
  runDifficultyAudit().then((r) => {
    console.log(JSON.stringify({ path: OUT, runs: r.runs }, null, 2));
  });
}
