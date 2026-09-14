#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IN = path.join(ROOT, 'solver/tests/gradingConsistency.report.json');
const OUT = path.join(ROOT, 'solver/tests/pokerPolicyBlockerClassification.report.json');

function classify(row) {
  const src = row.brainSource || '';
  if (/INSUFFICIENT|NO_MODEL/i.test(src)) return 'CONTEXT_LOSS';
  if (!row.brainTop) return 'UNSUPPORTED_BY_BRAIN';
  const lib = String(row.libraryCorrect || '').toUpperCase();
  const top = String(row.brainTop?.action || '').toUpperCase();
  const map = [
    [/РЕЙЗ|ОЛЛ-ИН|3-БЕТ|4-БЕТ|СТАВКА/, 'RAISE'],
    [/ФОЛД/, 'FOLD'],
    [/КОЛЛ/, 'CALL'],
    [/ЧЕК/, 'CHECK']
  ];
  let libAct = null;
  for (const [re, act] of map) if (re.test(lib)) { libAct = act; break; }
  if (libAct && top === libAct) return 'ACTION_NORMALIZATION';
  if (libAct === 'RAISE' && top === 'RAISE') return 'ACTION_NORMALIZATION';
  return 'TRUE_POLICY_CONFLICT';
}

export function runBlockerClassification({ write = true } = {}) {
  const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const sample = raw.brainPolicyBlockersSample || [];
  const byClass = {};
  const rows = sample.map((row) => {
    const c = classify(row);
    byClass[c] = (byClass[c] || 0) + 1;
    return { spotId: row.taskId, ...row, classification: c };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    brainPolicyBlockersCount: raw.brainPolicyBlockersCount,
    note: 'Full list requires grading harness export; sample classified from gradingConsistency.report.json',
    byClassification: byClass,
    rows
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('pokerPolicyBlockerClassification.mjs')) {
  const r = runBlockerClassification();
  console.log(JSON.stringify({ path: OUT, byClassification: r.byClassification }, null, 2));
}
