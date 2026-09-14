#!/usr/bin/env node
/**
 * Classify library vs raw PokerBrain policy disagreements (no auto-fix).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTaskLibrary, resetTaskLibraryCache } from '../src/training/taskLibraryBridge.js';
import { drillFromLibraryTask, libraryTaskToBrainSpot } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { installPokerBrainForTests } from '../tests/brainTestEnv.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'pokerPolicyReconciliation.report.json');

function classify(row) {
  if (!row.brainTop && /INSUFFICIENT|NO_MODEL/i.test(row.brainSource || '')) return 'CONTEXT_LOSS';
  if (row.brainSource === 'INSUFFICIENT_CONTEXT') return 'D_BRAIN_UNSUPPORTED_CONTEXT';
  if (!row.brainTop) return 'C_LIBRARY_UNSUPPORTED_BY_BRAIN';
  const lib = String(row.libraryCorrect || '').toUpperCase();
  const top = String(row.brainTop?.action || '').toUpperCase();
  if (lib.includes('РЕЙЗ') && top === 'RAISE') return 'B_ACTION_NORMALIZATION';
  if (lib.includes('ФОЛД') && top === 'FOLD') return 'B_ACTION_NORMALIZATION';
  if (lib.includes('КОЛЛ') && top === 'CALL') return 'B_ACTION_NORMALIZATION';
  return 'E_TRUE_POLICY_CONFLICT';
}

async function main() {
  resetTaskLibraryCache();
  installPokerBrainForTests();
  const lib = loadTaskLibrary();
  const tasks = lib.tasks || [];
  const blockers = [];

  for (const task of tasks) {
    const built = drillFromLibraryTask(task);
    if (!built.ok) continue;
    const drill = built.drill;
    const correctOpt = drill.options.find((o) => o.labelRu === task.correct);
    if (!correctOpt) continue;
    const daily = gradeAnswer({ drill, chosenId: correctOpt.id });
    const spot = libraryTaskToBrainSpot(task);
    const brain = globalThis.PokerBrain?.gradeDecision?.(spot, task.correct);
    const brainGrade = brain?.grade;
    const dailyOk = daily.grade === 'EXCELLENT';
    const brainOk = brainGrade === 'g' || brainGrade === 'y';
    if (dailyOk && brainOk) continue;
    if (dailyOk && !brainOk) {
      blockers.push({
        spotId: task.id,
        libraryContext: { street: task.street, position: task.position, correct: task.correct },
        libraryCorrect: task.correct,
        libraryAlsoOk: task.alsoOk || [],
        brainContext: { source: brain?.source, confidence: brain?.confidence },
        brainAction: brain?.action,
        brainPolicy: brain?.topActions,
        brainGrade,
        dailyGrade: daily.grade,
        reason: brain?.explanation || '',
        classification: classify({
          libraryCorrect: task.correct,
          brainTop: brain?.topActions?.[0],
          brainSource: brain?.source
        })
      });
    }
  }

  const byClass = {};
  for (const b of blockers) {
    byClass[b.classification] = (byClass[b.classification] || 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalCompared: tasks.length,
    brainPolicyBlockersCount: blockers.length,
    byClassification: byClass,
    samples: blockers.slice(0, 40),
    note: 'Engineering fixes only for A/B/C/D. E/F/G require poker/solver validation — not auto-reconciled.'
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ path: OUT, brainPolicyBlockersCount: blockers.length, byClassification: byClass }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
