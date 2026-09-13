#!/usr/bin/env node
// Build a curated trainer-native candidate index for runtime curriculum sampling.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listTrainerGradableCells, countCanonicalTrainerCallCells } from '../trainerNativeGenerator.js';
import { getTrainerMeta } from '../lookup.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'data/trainer/built/trainer-candidate-index.json');

const canonical = countCanonicalTrainerCallCells();
const {
  candidates,
  actionCounts,
  modeCounts,
  totalCharts,
  chartsScanned,
  invalidCandidates,
  disabledCandidates,
  callChartsInIndex
} = listTrainerGradableCells({
  maxCharts: Infinity,
  maxPerChart: 8,
  reserveCall: 2
});

const slim = candidates.map((t) => ({
  id: t.id,
  street: t.street,
  position: t.position,
  villain: t.villain,
  hero: t.hero,
  heroStack: t.heroStack,
  effStack: t.effStack,
  history: t.history,
  options: t.options,
  correct: t.correct,
  concept: t.concept,
  question: t.question,
  explain: t.explain,
  trainerMeta: t.trainerMeta
}));

const report = {
  generatedAt: new Date().toISOString(),
  totalCharts,
  chartsScanned,
  candidateCount: slim.length,
  actionCounts,
  modeCounts,
  invalidCandidates,
  disabledCandidates,
  callChartsInIndex,
  canonicalCall: canonical,
  meta: getTrainerMeta()?.stats || null,
  candidates: slim
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  path: OUT,
  candidateCount: slim.length,
  actionCounts,
  modeCounts,
  chartsScanned,
  totalCharts,
  invalidCandidates,
  disabledCandidates,
  callChartsInIndex,
  canonicalCall: canonical
}, null, 2));
