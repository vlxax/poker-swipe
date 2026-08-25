#!/usr/bin/env node
// Build a curated trainer-native candidate index for runtime curriculum sampling.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listTrainerGradableCells } from '../trainerNativeGenerator.js';
import { getTrainerMeta } from '../lookup.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'data/trainer/built/trainer-candidate-index.json');

const { candidates, actionCounts, modeCounts, totalCharts, chartsScanned } = listTrainerGradableCells({
  maxCharts: 400,
  maxPerChart: 12
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
  meta: getTrainerMeta()?.stats || null,
  candidates: slim
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  path: OUT,
  candidateCount: slim.length,
  actionCounts,
  modeCounts
}, null, 2));
