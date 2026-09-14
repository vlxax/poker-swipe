#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'solver/tests/pokerProvenance.report.json');

const SOURCES = [
  {
    file: 'strategy_pack_v17.js',
    sourceName: 'POKER_BRAIN_PACK',
    load: () => loadPokerBrainPackFromStrategyFile()
  },
  {
    file: 'task-context/library.js',
    sourceName: 'TRAINING_LIBRARY',
    load: () => ({ sourceType: 'CURATED', solverOutput: false, description: 'Authoritative for Daily/Swipe quiz grading via LIBRARY_CURATED' })
  },
  {
    file: 'solver/src/training/libraryDrill.js',
    sourceName: 'LIBRARY_DRILL_GATEWAY',
    load: () => ({ sourceType: 'CURATED', solverOutput: false, evAvailable: false, policySource: 'LIBRARY_CURATED' })
  },
  {
    file: 'ranges-ui/referenceRangesPack.js',
    sourceName: 'REFERENCE_RANGES_UI',
    load: () => ({ sourceType: 'CURATED', solverVerified: false })
  }
];

function classify(pack) {
  if (pack.truth?.solverOutput === true) return 'SOLVER_VERIFIED';
  if (pack.solverVerified === true) return 'SOLVER_VERIFIED';
  if (pack.sourceType === 'HEURISTIC') return 'HEURISTIC';
  if (pack.sourceType === 'SYNTHETIC') return 'SYNTHETIC';
  if (pack.truth?.solverOutput === false) return 'CURATED';
  return 'UNKNOWN';
}

export function runPokerProvenanceAudit({ write = true } = {}) {
  const datasets = [];
  for (const s of SOURCES) {
    const data = s.load();
    datasets.push({
      file: s.file,
      sourceName: s.sourceName,
      sourceType: classify(data),
      solverOutput: data.truth?.solverOutput ?? data.solverOutput ?? data.solverVerified ?? false,
      version: data.version || null,
      gameType: 'MTT/CASH mixed',
      authoritativeUse: data.truth?.description || data.description || 'training/quiz',
      externalValidation: false,
      frequencyPrecision: data.truth?.solverOutput ? 'solver' : 'atlas/heuristic'
    });
  }

  const uiClaims = [
    { location: 'index.html brainPanel', claim: 'GTO BRAIN label', honest: 'PARTIAL — shows brainSource when available' },
    { location: 'libraryDrill grading', claim: 'EV loss BB', honest: 'evAvailable:false for library quiz' },
    { location: 'strategy_pack truth', claim: 'solverOutput:false', honest: 'Must not market as exact GTO frequencies' }
  ];

  const report = { generatedAt: new Date().toISOString(), datasets, uiClaims };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('pokerProvenanceAudit.mjs')) {
  runPokerProvenanceAudit();
  console.log(JSON.stringify({ path: OUT }, null, 2));
}
