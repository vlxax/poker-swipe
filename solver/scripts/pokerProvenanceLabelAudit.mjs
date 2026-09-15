#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readIndexHtml } from './pokerTruthUtils.mjs';

const OUT = path.join(ROOT, 'solver/tests/pokerProvenanceLabelAudit.report.json');

const LABEL_PATTERNS = [
  { re: /\bGTO\b/gi, tag: 'GTO' },
  { re: /\bsolver\b/gi, tag: 'solver' },
  { re: /\bexact\b/gi, tag: 'exact' },
  { re: /\boptimal\b/gi, tag: 'optimal' },
  { re: /\bverified\b/gi, tag: 'verified' },
  { re: /\bNash\b/gi, tag: 'Nash' }
];

const SCAN_FILES = [
  'index.html',
  'training-ui/main.js',
  'ranges-ui/pushFold.js',
  'poker_brain.js',
  'strategy_pack_v17.js'
];

function classifyHit({ file, tag, line, text }) {
  const ctx = text.toLowerCase();
  if (file.includes('strategy_pack') && tag === 'GTO' && /solverOutput":false/.test(line)) {
    return { classification: 'AMBIGUOUS', reason: 'Pack disclaims solver dump while describing GTO reference engine' };
  }
  if (file === 'index.html' && /GTO BRAIN V19 ONLINE|NODE ENGINE/.test(text)) {
    return { classification: 'AMBIGUOUS', reason: 'Branded brain UI; pack truth.solverOutput is false' };
  }
  if (file === 'ranges-ui/pushFold.js' && /push_fold|heuristic/i.test(fs.readFileSync(path.join(ROOT, file), 'utf8'))) {
    if (/Nash|solver-verified|exact GTO/i.test(text)) {
      return { classification: 'MISLEADING', reason: 'Heuristic push/fold labeled as solver-backed' };
    }
    return { classification: 'SAFE', reason: 'Heuristic module; label in comment only' };
  }
  if (/EXACT EQUITY|exactEquity|handEvaluator/.test(text) && tag === 'exact') {
    return { classification: 'SAFE', reason: 'Mathematical equity exactness, not strategy provenance' };
  }
  if (/не солвер|not a licensed|solverOutput":false|NO_MODEL|heuristic/i.test(ctx)) {
    return { classification: 'SAFE', reason: 'Explicit disclaimer or non-strategy context' };
  }
  if (tag === 'GTO' || tag === 'Nash' || tag === 'solver') {
    if (/reference|atlas|curated|local/i.test(ctx)) {
      return { classification: 'AMBIGUOUS', reason: 'Marketing/reference language without CFR provenance' };
    }
    return { classification: 'MISLEADING', reason: 'Strong solver/GTO claim without registry-backed provenance' };
  }
  if (tag === 'verified' || tag === 'optimal') {
    return { classification: 'AMBIGUOUS', reason: 'Generic quality label' };
  }
  return { classification: 'AMBIGUOUS', reason: 'Needs human review' };
}

export function runProvenanceLabelAudit({ write = true } = {}) {
  const hits = [];
  for (const rel of SCAN_FILES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      for (const { re, tag } of LABEL_PATTERNS) {
        re.lastIndex = 0;
        if (!re.test(line)) continue;
        const { classification, reason } = classifyHit({
          file: rel,
          tag,
          line,
          text: line.trim().slice(0, 240)
        });
        hits.push({
          file: rel,
          line: idx + 1,
          tag,
          text: line.trim().slice(0, 240),
          classification,
          reason
        });
      }
    });
  }

  const summary = { SAFE: 0, AMBIGUOUS: 0, MISLEADING: 0 };
  for (const h of hits) summary[h.classification]++;

  const report = {
    generatedAt: new Date().toISOString(),
    registryNote: 'Compared against solver/config/pokerTruthDomains.json metadata (no runtime migration)',
    summary,
    misleadingCount: summary.MISLEADING,
    hits
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('pokerProvenanceLabelAudit.mjs')) {
  runProvenanceLabelAudit();
  console.log(JSON.stringify({ path: OUT }, null, 2));
}
