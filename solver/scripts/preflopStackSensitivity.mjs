#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'solver/tests/preflopStackSensitivity.report.json');

const DEPTHS = [15, 20, 25, 30, 40, 50, 75, 100];
const HANDS = ['AA', 'KK', 'AKs', 'AQo', 'A5s', 'KQo', 'K7o', '76s', '22', '72o'];
const SPOTS = [
  { id: 'RFI_UTG', key: (d, h) => `RFI|UTG|${d}|${h}` },
  { id: 'RFI_BTN', key: (d, h) => `RFI|BTN|${d}|${h}` },
  { id: 'BB_VS_BTN', key: (d, h) => `BB_DEFEND|BTN|${d}|${h}` }
];

const SUSPICIOUS_CASES = [
  { label: 'UTG 20bb K7o', key: 'RFI|UTG|20|K7o' },
  { label: 'UTG 20bb A2o', key: 'RFI|UTG|20|A2o' },
  { label: 'UTG 20bb 22', key: 'RFI|UTG|20|22' },
  { label: 'BTN 20bb 72o', key: 'RFI|BTN|20|72o' },
  { label: 'BB vs BTN 20bb 72o', key: 'BB_DEFEND|BTN|20|72o' },
  { label: 'BB vs BTN 20bb 32o', key: 'BB_DEFEND|BTN|20|32o' },
  { label: 'BB vs BTN 20bb J2o', key: 'BB_DEFEND|BTN|20|J2o' },
  { label: 'AA vs 3bet 20bb', key: 'VS_3BET|BTN|20|AA' },
  { label: 'AA vs 3bet 50bb', key: 'VS_3BET|BTN|50|AA' }
];

function policyFingerprint(pol) {
  if (!pol) return null;
  return JSON.stringify(pol);
}

function nearestDepth(pack, baseKey, depth) {
  const pre = pack.preflop || {};
  if (pre[baseKey.replace(/\|\d+\|/, `|${depth}|`)]) return depth;
  const depths = DEPTHS.filter((d) => pre[baseKey.replace(/\|\d+\|/, `|${d}|`)]);
  if (!depths.length) return null;
  return depths.reduce((a, b) => (Math.abs(b - depth) < Math.abs(a - depth) ? b : a));
}

export function runPreflopStackSensitivity({ write = true } = {}) {
  const pack = loadPokerBrainPackFromStrategyFile();
  const pre = pack.preflop || {};
  const source = {
    file: 'strategy_pack_v17.js',
    sourceName: 'POKER_BRAIN_PACK',
    sourceType: pack.truth?.solverOutput ? 'SOLVER_VERIFIED' : 'CURATED',
    solverOutput: !!pack.truth?.solverOutput,
    version: pack.version,
    authoritativeUse: 'REFERENCE_ATLAS — not licensed solver dump'
  };

  const comparisons = [];
  let identicalAcrossAllDepths = 0;
  let partiallyChanging = 0;
  let materiallyChanging = 0;
  let unknownSource = 0;

  for (const spot of SPOTS) {
    for (const hand of HANDS) {
      const fps = [];
      const byDepth = {};
      for (const d of DEPTHS) {
        const k = spot.key(d, hand);
        const pol = pre[k];
        byDepth[d] = pol || null;
        fps.push(policyFingerprint(pol));
      }
      const known = fps.filter(Boolean);
      if (!known.length) {
        unknownSource++;
        continue;
      }
      const unique = new Set(known);
      comparisons.push({ spot: spot.id, hand, byDepth, uniquePolicies: unique.size });
      if (unique.size === 1) identicalAcrossAllDepths++;
      else if (unique.size <= 3) partiallyChanging++;
      else materiallyChanging++;
    }
  }

  const suspicious = SUSPICIOUS_CASES.map((c) => {
    const pol = pre[c.key];
    const depthInKey = Number(c.key.split('|')[2]);
    return {
      label: c.label,
      key: c.key,
      frequencies: pol || null,
      source: source.sourceType,
      stackSpecificRow: !!pol,
      interpolated: !pol,
      solverVerified: source.solverOutput
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    strategySource: source,
    depths: DEPTHS,
    totalComparablePolicies: comparisons.length,
    identicalAcrossAllDepths,
    partiallyChanging,
    materiallyChanging,
    unknownSource,
    solverVerified: source.solverOutput,
    suspiciousIdenticalClusters: comparisons.filter((c) => c.uniquePolicies === 1).slice(0, 20),
    suspiciousCases: suspicious,
    comparisons
  };

  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('preflopStackSensitivity.mjs')) {
  const r = runPreflopStackSensitivity();
  console.log(JSON.stringify({ path: OUT, totalComparablePolicies: r.totalComparablePolicies }, null, 2));
}
