#!/usr/bin/env node
/**
 * CALL=0 audit — why trainer-native generator produces zero CALL tasks.
 * Uses actual Trainer Knowledge data; does not reinterpret orange/yellow.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { canGradeWithTrainerAction } from '../status.js';
import { buildTrainerNativeTask } from '../trainerNativeGenerator.js';
import { listCharts } from '../lookup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const PARSED = join(ROOT, 'data/trainer/built/batch2-parsed-hands.json');
const HC1 = join(ROOT, 'trainer-knowledge/TRAINER_HC1_RECONCILIATION.json');
const INDEX = join(ROOT, 'data/trainer/built/trainer-candidate-index.json');

const ORANGE = 'ORANGE_208_160_32';
const YELLOW = 'YELLOW_240_240_48';

function isCallLikeCell(cell, chart) {
  const na = cell.normalizedAction;
  const raw = cell.actionRaw ?? cell.a;
  const ctx = cell.contextualAction;
  if (na === 'CALL') return true;
  if (ctx === 'NON_ALL_IN_CALL') return true;
  if (raw === ORANGE) return true;
  if (raw === 'LOW_PLAYABILITY') return true;
  if (raw === 'nAI' && chart?.sourceMode === 'callpush') return true;
  return false;
}

function blockReason(cell) {
  if (cell.isMixed) return 'MIXED';
  const raw = cell.actionRaw ?? cell.a;
  if (raw === ORANGE) return 'ORANGE';
  if (raw === YELLOW) return 'YELLOW';
  if (raw === 'nAI' && !cell.gradingAllowed) return 'nAI_BLOCKED';
  if (raw === 'LOW_PLAYABILITY') return 'LOW_PLAYABILITY';
  if (!cell.gradingAllowed && cell.normalizedAction == null) return 'UNKNOWN';
  if (!canGradeWithTrainerAction(raw, cell.normalizedAction)) return 'NOT_GRADABLE';
  return 'OTHER';
}

function auditDataset(charts) {
  const stats = {
    rawCallLike: 0,
    gradingAllowedCall: 0,
    blockedCallLike: 0,
    blockedBy: { MIXED: 0, ORANGE: 0, YELLOW: 0, UNKNOWN: 0, OTHER: 0, nAI_BLOCKED: 0, LOW_PLAYABILITY: 0, NOT_GRADABLE: 0 },
    generatorEligibleCall: 0,
    generatedCall: 0,
    filteredCall: 0,
    examples: { gradingAllowed: [], blocked: [], naiCallContext: [] }
  };

  for (const [chartId, chart] of Object.entries(charts)) {
    for (const [hand, cell] of Object.entries(chart.hands || {})) {
      if (!isCallLikeCell(cell, chart)) continue;
      stats.rawCallLike++;

      const handRec = {
        hand,
        actionRaw: cell.actionRaw ?? cell.a,
        normalizedAction: cell.normalizedAction,
        contextualAction: cell.contextualAction,
        gradingAllowed: cell.gradingAllowed,
        isMixed: cell.isMixed,
        provenance: cell.provenance
      };

      if (cell.normalizedAction === 'CALL' && cell.gradingAllowed) {
        stats.gradingAllowedCall++;
        if (stats.examples.gradingAllowed.length < 5) {
          stats.examples.gradingAllowed.push({ chartId, hand, ...handRec });
        }
      }

      if (cell.contextualAction === 'NON_ALL_IN_CALL') {
        if (stats.examples.naiCallContext.length < 5) {
          stats.examples.naiCallContext.push({ chartId, hand, gradingAllowed: cell.gradingAllowed, mode: chart.sourceMode });
        }
      }

      if (!cell.gradingAllowed || cell.isMixed) {
        stats.blockedCallLike++;
        const reason = blockReason(cell);
        stats.blockedBy[reason] = (stats.blockedBy[reason] || 0) + 1;
        if (stats.examples.blocked.length < 8) {
          stats.examples.blocked.push({ chartId, hand, reason, raw: handRec.actionRaw, na: handRec.normalizedAction });
        }
        continue;
      }

      if (cell.normalizedAction === 'CALL') {
        stats.generatorEligibleCall++;
        const task = buildTrainerNativeTask({ chart, hand, handRec, lookup: null });
        if (task) stats.generatedCall++;
        else stats.filteredCall++;
      }
    }
  }
  return stats;
}

function classifyRootCause(stats, hc1) {
  if (stats.gradingAllowedCall > 0 && stats.generatedCall === 0) {
    return { code: 'D', label: 'candidate generator accidentally filters CALL' };
  }
  if (stats.gradingAllowedCall === 0 && stats.rawCallLike > 0) {
    const orange = stats.blockedBy.ORANGE || 0;
    const mixed = stats.blockedBy.MIXED || 0;
    const yellow = stats.blockedBy.YELLOW || 0;
    if (orange + mixed + yellow >= stats.blockedCallLike * 0.5) {
      return { code: 'B', label: 'CALL semantics live primarily in unresolved orange/yellow/mixed' };
    }
    return { code: 'A', label: 'Trainer dataset genuinely has no grading-allowed pure CALL cells' };
  }
  if (stats.gradingAllowedCall === 0 && stats.rawCallLike === 0) {
    return { code: 'A', label: 'Trainer dataset genuinely has no grading-allowed pure CALL cells' };
  }
  return { code: 'E', label: 'another reason' };
}

function main() {
  if (!existsSync(PARSED)) {
    console.error('Missing', PARSED);
    process.exit(1);
  }
  const charts = JSON.parse(readFileSync(PARSED, 'utf8'));
  const hc1 = existsSync(HC1) ? JSON.parse(readFileSync(HC1, 'utf8')) : null;
  const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : null;

  const stats = auditDataset(charts);
  const rootCause = classifyRootCause(stats, hc1);

  // Supplement from HC1 reconciliation when parsed cells lack orange labels
  const hc1Orange = hc1?.postHumanConfirmation?.orangeRaw ?? 0;
  const hc1OrangeGrading = hc1?.postHumanConfirmation?.orangeGrading ?? 0;
  const hc1NaiCallContext = hc1?.postHumanConfirmation?.naiResolvedByMode?.callpush ?? 0;
  const hc1NaiBlockedCallpush = hc1?.postHumanConfirmation?.naiBlockedByMode?.callpush ?? 0;

  if (stats.rawCallLike === 0 && hc1Orange > 0) {
    stats.rawCallLike = hc1Orange + hc1NaiCallContext + hc1NaiBlockedCallpush;
    stats.blockedCallLike = hc1Orange + hc1NaiBlockedCallpush;
    stats.blockedBy.ORANGE = hc1Orange;
    stats.blockedBy.nAI_BLOCKED = hc1NaiBlockedCallpush;
    stats.blockedBy.MIXED = hc1?.postHumanConfirmation?.mixedWithOrange ?? 0;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    RAW_CALL_LIKE_CELLS: stats.rawCallLike,
    GRADING_ALLOWED_CALL_CELLS: stats.gradingAllowedCall,
    BLOCKED_CALL_LIKE_CELLS: stats.blockedCallLike,
    BLOCKED_BY: stats.blockedBy,
    GENERATOR_ELIGIBLE_CALL: stats.generatorEligibleCall,
    GENERATED_CALL: stats.generatedCall,
    FILTERED_CALL: stats.filteredCall,
    INDEX_GENERATED_CALL: index?.actionCounts?.CALL ?? null,
    HC1_GRADING_BY_SEMANTIC: hc1?.postHumanConfirmation?.gradingBySemanticId || null,
    HC1_ORANGE_GRADING: hc1?.postHumanConfirmation?.orangeGrading ?? null,
    ROOT_CAUSE: stats.gradingAllowedCall === 0
      ? { code: 'A', label: 'Trainer dataset genuinely has no grading-allowed pure CALL cells; call-like semantics in orange/nAI are blocked' }
      : rootCause,
    CALL_0_EXPECTED: stats.gradingAllowedCall === 0 ? 'YES' : 'NO',
    examples: stats.examples,
    semanticNote: 'HC1 has no confirmed gradable normalizedAction=CALL. Orange rawLabel "кол" is NEEDS_CLARIFICATION. nAI in callpush resolves to NON_ALL_IN_CALL contextually but normalizedAction is NON_ALL_IN, not CALL.'
  };

  const outPath = join(ROOT, 'trainer-knowledge/CALL_ACTION_AUDIT.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ path: outPath, ...report, examples: undefined }, null, 2));
}

main();
