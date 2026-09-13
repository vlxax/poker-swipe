/**
 * Compare reconstruction worktree data files with combined branch copies.
 */
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const COMBINED = '/Users/a1111/Downloads/poker-swipe-fresh-main-20260829';
const RECON = '/Users/a1111/Downloads/poker-swipe-trainer-1698-recon';

function walk(root, rel = '') {
  const dir = join(root, rel);
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'strategy-map-index-cache.json') continue;
    const p = join(rel, name);
    const st = statSync(join(root, p));
    if (st.isDirectory()) out.push(...walk(root, p));
    else out.push(p);
  }
  return out;
}

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const reconFiles = execSync('git -C "' + RECON + '" status --short', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => line.replace(/^.. /, '').trim());

const dataPreserved = [
  'data/trainer/built/charts-index.json',
  'data/trainer/built/trainer-shard-index.json',
  'data/trainer/built/uo-hand-records.json',
  'data/trainer/built/uo-hand-records.legacy.json',
  'data/trainer/built/uo-regression-discrepancy.json',
  'data/trainer/built/recon-qa-report.json',
  'data/trainer/recon-baseline-1638/charts-index.json',
  'data/trainer/recon-baseline-1638/meta.json',
  'data/trainer/recon-baseline-1638/uo-hand-records.json',
  'trainer-knowledge/scripts/compileTrainerProduction.py',
  'trainer-knowledge/scripts/testTrainerReconstruction.py',
  'trainer-knowledge/scripts/COMPILER_RECONSTRUCTION_NOTES.md',
  'trainer-knowledge/scripts/runtimeAcceptanceGate.mjs',
  'consumer-gate.html',
  'runtime-gate.html'
];

const shardDir = 'data/trainer/built/trainer-shards';
const shards = existsSync(join(RECON, shardDir))
  ? readdirSync(join(RECON, shardDir)).filter((f) => f.endsWith('.json')).map((f) => join(shardDir, f))
  : [];

const indexes = existsSync(join(RECON, 'data/trainer/built/indexes'))
  ? readdirSync(join(RECON, 'data/trainer/built/indexes')).map((f) => join('data/trainer/built/indexes', f))
  : [];

const check = [...dataPreserved, ...shards, ...indexes];
const mismatches = [];
const missing = [];
let matched = 0;

for (const rel of check) {
  const a = join(RECON, rel);
  const b = join(COMBINED, rel);
  if (!existsSync(a)) { missing.push({ rel, where: 'recon' }); continue; }
  if (!existsSync(b)) { missing.push({ rel, where: 'combined' }); continue; }
  const ha = sha(a);
  const hb = sha(b);
  if (ha !== hb) mismatches.push(rel);
  else matched += 1;
}

console.log(JSON.stringify({
  sourceReconstructionListedFiles: reconFiles.length,
  preservedChecked: check.length,
  matched,
  HASH_MISMATCHES: mismatches.length,
  MISSING_FILES: missing.length,
  mismatches,
  missing,
  reconDirtyFiles: reconFiles
}, null, 2));
