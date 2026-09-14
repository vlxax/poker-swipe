// Dual-grading audit: library canonical spots via daily (gradeAnswer) vs swipe (gateway/brain).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTaskLibrary, resetTaskLibraryCache } from '../src/training/taskLibraryBridge.js';
import {
  drillFromLibraryTask,
  libraryTaskToBrainSpot,
  choiceToActionType
} from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { gradeSwipeDecision } from '../src/api/modeAdapters.js';
import { gradeDecision as gradeDecisionGateway, resetGatewayDedup } from '../../training-ui/gradingGateway.js';
import { buildCanonicalSpot } from '../../task-context/canonicalSpot.js';
import { installPokerBrainForTests } from './brainTestEnv.js';

const REPORT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'gradingConsistency.report.json'
);

const BRAIN_ACTION_TO_TYPE = {
  FOLD: 'fold',
  CALL: 'call',
  CHECK: 'check',
  BET: 'bet',
  RAISE: 'raise',
  PUSH: 'all_in'
};

function normBrainAction(action) {
  const a = String(action || '').toUpperCase();
  if (/ФОЛД|FOLD/.test(a)) return 'FOLD';
  if (/КОЛЛ|CALL/.test(a)) return 'CALL';
  if (/ЧЕК|CHECK/.test(a)) return 'CHECK';
  if (/СТАВ|BET/.test(a)) return 'BET';
  if (/ПУШ|ОЛЛ|PUSH|JAM/.test(a)) return 'PUSH';
  if (/РЕЙЗ|RAISE|3-БЕТ|3BET|4-БЕТ|4BET/.test(a)) return 'RAISE';
  return a;
}

function swipeActionFromLabel(labelRu) {
  const t = choiceToActionType(labelRu);
  const map = {
    fold: 'FOLD',
    call: 'CALL',
    check: 'CHECK',
    bet: 'BET',
    raise: 'RAISE',
    '3bet': 'RAISE',
    '4bet': 'RAISE',
    all_in: 'PUSH'
  };
  if (t.startsWith('bet_')) return 'BET';
  return map[t] || normBrainAction(labelRu);
}

function dailyStrategicBucket(result) {
  if (!result) return 'unknown';
  if (result.chosenRecommended || result.grade === 'EXCELLENT') return 'optimal';
  if (result.nearOptimal || result.grade === 'GOOD') return 'acceptable';
  if (result.grade === 'INACCURACY') return 'soft';
  if (result.grade === 'MISTAKE' || result.grade === 'BIG MISTAKE') return 'bad';
  return 'unknown';
}

function swipeStrategicBucket(unified) {
  if (!unified || unified.source === 'error') return 'unknown';
  const legacy = unified.legacyResult || {};
  const g = legacy.grade || unified.metadata?.legacyGrade;
  if (g === 'g') return 'optimal';
  if (g === 'y') return 'acceptable';
  if (g === 'r') return 'bad';
  const grade = String(unified.grade || '').toUpperCase();
  if (grade === 'EXCELLENT' || grade === 'GOOD') return 'optimal';
  if (grade === 'INACCURACY') return 'soft';
  if (grade === 'MISTAKE' || grade === 'BIG_MISTAKE') return 'bad';
  return 'unknown';
}

function bucketsAlign(dailyBucket, swipeBucket, { isAlsoOk = false } = {}) {
  if (dailyBucket === 'unknown' || swipeBucket === 'unknown') return null;
  if (dailyBucket === swipeBucket) return 'same';
  // alsoOk lines use NEAR_EV (0.8bb) → often MISTAKE vs INACCURACY band; same strategic lane
  if (isAlsoOk && dailyBucket === 'bad' && swipeBucket === 'soft') return 'presentation';
  if (isAlsoOk && dailyBucket === 'soft' && swipeBucket === 'bad') return 'presentation';
  const pass = new Set(['optimal', 'acceptable', 'soft']);
  const fail = new Set(['bad']);
  const dPass = pass.has(dailyBucket);
  const sPass = pass.has(swipeBucket);
  const dFail = fail.has(dailyBucket);
  const sFail = fail.has(swipeBucket);
  if (dPass && sPass) return 'same';
  if (dFail && sFail) return 'same';
  if (dPass && swipeBucket === 'soft') return 'presentation';
  if (dailyBucket === 'soft' && sPass) return 'presentation';
  return 'conflict';
}

function canonicalIdForTask(task) {
  try {
    const c = buildCanonicalSpot({ ...task, _library: true });
    return c?.id || task.id;
  } catch (_) {
    return task.id;
  }
}

export function runGradingConsistencyAudit({ writeReport = true } = {}) {
  resetTaskLibraryCache();
  installPokerBrainForTests();
  resetGatewayDedup();

  const tasks = loadTaskLibrary();
  const samples = {
    exactMatches: [],
    normalizedMatches: [],
    trueConflicts: [],
    uncomparable: []
  };

  let totalComparable = 0;
  let exactMatches = 0;
  let normalizedMatches = 0;
  let trueConflicts = 0;
  let uncomparable = 0;

  for (const task of tasks) {
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) {
      uncomparable += 1;
      samples.uncomparable.push({ taskId: task.id, reason: gen.reason || 'drill_failed' });
      continue;
    }
    const drill = gen.drill;
    const spot = libraryTaskToBrainSpot(task);
    const canonicalId = canonicalIdForTask(task);

    for (const opt of drill.options) {
      const chosenId = opt.id;
      const swipeAction = swipeActionFromLabel(opt.labelRu);

      const daily = gradeAnswer({ drill, chosenId });
      resetGatewayDedup();
      const dailyGw = gradeDecisionGateway({
        mode: 'daily',
        drill,
        chosenActionId: chosenId,
        eventKey: `audit|${task.id}|${chosenId}`
      });

      resetGatewayDedup();
      const swipeGw = gradeDecisionGateway({
        mode: 'swipe',
        scenario: spot,
        spot,
        chosenActionId: chosenId,
        action: swipeAction,
        eventKey: `audit|${task.id}|${chosenId}`
      });

      const swipeAdapter = gradeSwipeDecision({ scenario: spot, action: swipeAction });

      const brain = globalThis.window?.PokerBrain;
      let brainDirect = null;
      if (brain && typeof brain.gradeDecision === 'function') {
        brainDirect = brain.gradeDecision(spot, opt.labelRu, null);
      }

      if (!swipeGw.ok && swipeGw.errorType) {
        uncomparable += 1;
        samples.uncomparable.push({
          taskId: task.id,
          option: opt.labelRu,
          reason: 'swipe_gateway_error',
          errorType: swipeGw.errorType
        });
        continue;
      }

      totalComparable += 1;
      const dBucket = dailyStrategicBucket(daily);
      const sBucket = swipeGw.solver
        ? dailyStrategicBucket(swipeGw.solver)
        : swipeStrategicBucket(swipeGw.unified || swipeAdapter);
      const isAlsoOk = (task.alsoOk || []).includes(opt.labelRu);
      const align = bucketsAlign(dBucket, sBucket, { isAlsoOk });

      const row = {
        taskId: task.id,
        canonicalId,
        option: opt.labelRu,
        isAuthorCorrect: opt.labelRu === task.correct,
        isAlsoOk,
        daily: {
          grade: daily.grade,
          bucket: dBucket,
          chosenRecommended: daily.chosenRecommended,
          nearOptimal: daily.nearOptimal
        },
        dailyGateway: {
          grade: dailyGw.solver?.grade,
          verdict: dailyGw.verdict
        },
        swipeGateway: {
          grade: swipeGw.verdict,
          solverGrade: swipeGw.solver?.grade,
          routedLibrary: !!swipeGw.solver,
          legacyGrade: swipeGw.brain?.grade,
          source: swipeGw.source,
          brainSource: swipeGw.brain?.source
        },
        swipeAdapter: {
          grade: swipeAdapter.grade,
          legacyGrade: swipeAdapter.legacyResult?.grade,
          source: swipeAdapter.source
        },
        brainDirect: brainDirect
          ? {
            grade: brainDirect.grade,
            source: brainDirect.source,
            topAction: brainDirect.topActions?.[0]?.action || null
          }
          : null
      };

      if (dailyGw.solver?.grade !== daily.grade) {
        row.gatewayDailyMismatch = true;
      }

      if (align === 'same' && daily.grade === (swipeGw.solver?.grade || swipeGw.verdict)) {
        exactMatches += 1;
        if (samples.exactMatches.length < 12) samples.exactMatches.push(row);
      } else if (align === 'same' || align === 'presentation') {
        normalizedMatches += 1;
        if (samples.normalizedMatches.length < 12) samples.normalizedMatches.push(row);
      } else if (align === 'conflict') {
        trueConflicts += 1;
        samples.trueConflicts.push(row);
      } else {
        uncomparable += 1;
        samples.uncomparable.push({ ...row, reason: 'unknown_bucket' });
      }
    }
  }

  const conflictSpotIds = [...new Set(samples.trueConflicts.map((r) => r.taskId))];

  const brainPolicyBlockers = [];
  for (const task of tasks) {
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    const spot = libraryTaskToBrainSpot(task);
    const brain = globalThis.window?.PokerBrain;
    if (!brain) break;
    const correctOpt = gen.drill.options.find((o) => o.labelRu === task.correct);
    if (!correctOpt) continue;
    const dailyCorrect = gradeAnswer({ drill: gen.drill, chosenId: correctOpt.id });
    const brainCorrect = brain.gradeDecision(spot, correctOpt.labelRu, null);
    const dailyOk = dailyCorrect.chosenRecommended || dailyCorrect.grade === 'EXCELLENT';
    const brainOk = brainCorrect.grade === 'g';
    if (dailyOk && !brainOk) {
      brainPolicyBlockers.push({
        taskId: task.id,
        libraryCorrect: task.correct,
        dailyGrade: dailyCorrect.grade,
        brainGrade: brainCorrect.grade,
        brainSource: brainCorrect.source,
        brainTop: brainCorrect.topActions?.[0] || null
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalComparable,
    exactMatches,
    normalizedMatches,
    trueConflicts,
    uncomparable,
    conflictSpotIds,
    brainPolicyBlockersCount: brainPolicyBlockers.length,
    brainPolicyBlockersSample: brainPolicyBlockers.slice(0, 20),
    verdict:
      trueConflicts > 0
        ? 'BLOCKED_BY_STRATEGIC_GRADING_CONFLICTS'
        : 'SAFE_TO_MERGE_FOR_UX_PERSONALIZATION',
    note:
      'Daily path uses library EV tiers (gradeAnswer). Swipe path uses gradingGateway; library tasks with _library/_drill route to the same gradeAnswer when wired.',
    categories: {
      A_exactEquivalent: exactMatches,
      B_presentationOnly: normalizedMatches,
      C_trueStrategicConflict: trueConflicts,
      D_uncomparable: uncomparable
    },
    samples
  };

  if (writeReport) {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  }

  return report;
}
