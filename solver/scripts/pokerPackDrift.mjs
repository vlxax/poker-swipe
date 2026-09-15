#!/usr/bin/env node
/**
 * Semantic equivalence: strategy_pack_v17.js vs inline window.POKER_BRAIN_PACK in index.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT,
  loadCanonicalBrainPack,
  loadInlineBrainPackFromIndex,
  semanticPackDiff
} from './pokerTruthUtils.mjs';

const OUT = path.join(ROOT, 'solver/tests/pokerPackDrift.report.json');

export function runPokerPackDrift({ write = true } = {}) {
  const canonical = loadCanonicalBrainPack();
  const inline = loadInlineBrainPackFromIndex();
  const diffs = semanticPackDiff(canonical, inline, 'POKER_BRAIN_PACK');
  const report = {
    generatedAt: new Date().toISOString(),
    canonicalFile: 'strategy_pack_v17.js',
    inlineFile: 'index.html (window.POKER_BRAIN_PACK)',
    diffCount: diffs.length,
    pass: diffs.length === 0,
    samples: diffs.slice(0, 50)
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

export function assertPackDriftOrExit() {
  const r = runPokerPackDrift();
  if (!r.pass) {
    console.error('POKER PACK DRIFT — semantic mismatch between strategy_pack_v17.js and inline pack');
    for (const d of r.samples) {
      console.error(`  section=${d.section} key=${d.key}`);
      console.error(`    canonical: ${JSON.stringify(d.canonical)?.slice(0, 120)}`);
      console.error(`    inline:    ${JSON.stringify(d.inline)?.slice(0, 120)}`);
    }
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, diffCount: 0, report: OUT }, null, 2));
}

if (process.argv[1]?.endsWith('pokerPackDrift.mjs')) {
  assertPackDriftOrExit();
}
