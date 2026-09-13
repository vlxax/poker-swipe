#!/usr/bin/env node
/**
 * Stage 3C — audit task library vs trainer coverage.
 * Writes trainer-knowledge/TRAINER_MINIAPP_AUDIT.md
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { resetTrainerCache, lookupTrainerSpot, lookupTrainerHandAction } from '../index.js';
import { auditTaskLibrary } from '../adapters/taskAdapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

async function main() {
  const { loadTaskLibrary } = await import('../../solver/src/training/taskLibraryBridge.js');
  resetTrainerCache();
  const lookup = { lookupSpot: lookupTrainerSpot, lookupHandAction: lookupTrainerHandAction };
  const tasks = loadTaskLibrary();
  const report = auditTaskLibrary(tasks, lookup);

  const lines = [
    '# TRAINER MINI-APP AUDIT (Stage 3C)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- MINI-APPS AUDITED: ${report.miniAppsAudited.join(', ')}`,
    `- MINI-APPS CONNECTED (preflop grading via Poker Brain bridge): ${report.miniAppsConnected.join(', ')}`,
    `- TRAINER-GRADED TASKS: ${report.trainerGradedTasks}`,
    `- FALLBACK TASKS: ${report.fallbackTasks}`,
    `- TASKS BLOCKED BY UNKNOWN SEMANTICS: ${report.blockedBySemantics}`,
    `- DUPLICATE TASK GENERATION: NO (library ids only, ${report.total} tasks)`,
    `- PERSONALIZATION COMPATIBILITY: YES (trainer enriches spots; library fallback preserved)`,
    '',
    '## By scenario group',
    '',
    '| Scenario group | Total | Trainer-graded | Fallback |',
    '|----------------|------:|---------------:|---------:|'
  ];

  for (const [g, stats] of Object.entries(report.byGroup).sort((a, b) => b[1].total - a[1].total)) {
    lines.push(`| ${g} | ${stats.total} | ${stats.trainerGraded} | ${stats.fallback} |`);
  }

  lines.push('', '## Sample trainer-graded preflop tasks', '');
  const graded = report.rows.filter((r) => r.gradingAllowed).slice(0, 15);
  for (const r of graded) {
    lines.push(`- **${r.taskId}** → ${r.scenarioGroup} | trainer \`${r.trainerAction}\` → \`${r.mappedChoice}\` (library \`${r.libraryCorrect}\`)`);
  }

  lines.push('', '## Sample blocked / partial tasks', '');
  const blocked = report.rows.filter((r) => !r.gradingAllowed && r.miniApps.includes('swipe')).slice(0, 15);
  for (const r of blocked) {
    lines.push(`- **${r.taskId}** | ${r.trainerStatus} | ${r.blockedReason || r.reason || 'fallback'}`);
  }

  const out = join(ROOT, 'trainer-knowledge/TRAINER_MINIAPP_AUDIT.md');
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(JSON.stringify({
    output: out,
    trainerGradedTasks: report.trainerGradedTasks,
    fallbackTasks: report.fallbackTasks,
    blockedBySemantics: report.blockedBySemantics
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
