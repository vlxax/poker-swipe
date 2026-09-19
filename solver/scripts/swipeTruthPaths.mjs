#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, extractIndexConst, gradeBucketFromPreferred, brainGradeBucket, bucketsConflict } from './pokerTruthUtils.mjs';
import { loadTaskLibrary, resetTaskLibraryCache, getTaskById } from '../src/training/taskLibraryBridge.js';
import { drillFromLibraryTask, libraryTaskToBrainSpot } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { gradeDecision } from '../../training-ui/gradingGateway.js';
import { installPokerBrainForTests, resetPokerBrainTestEnv } from '../tests/brainTestEnv.js';

const OUT = path.join(ROOT, 'solver/tests/swipeTruthPaths.report.json');

const SWIPE_ID_ALIASES = {
  PF_BTN_A8S: 'PRE_RFI_BTN_A8S',
  PF_BB_K8S: 'PRE_BB_K8S',
  PF_SB_A5S: 'PRE_3B_SB_A5S'
};

function cardSig(cards) {
  return (cards || []).map((c) => String(c).replace(/\s/g, '')).join('|');
}

function resolveLibraryTask(swipeSpot) {
  const alias = SWIPE_ID_ALIASES[swipeSpot.id];
  if (alias && getTaskById(alias)) return getTaskById(alias);
  const lib = loadTaskLibrary();
  for (const t of lib.tasks || []) {
    if (cardSig(t.hero) !== cardSig(swipeSpot.hero)) continue;
    if (cardSig(t.board) !== cardSig(swipeSpot.board)) continue;
    return t;
  }
  return null;
}

function preferredBucket(spot, action) {
  return gradeBucketFromPreferred(spot, action);
}

function libraryBucketForAction(task, action) {
  if (!task) return 'unknown';
  if (action === task.correct) return 'optimal';
  if (task.alsoOk?.includes(action)) return 'acceptable';
  return 'bad';
}

export function runSwipeTruthPaths({ write = true } = {}) {
  resetPokerBrainTestEnv();
  resetTaskLibraryCache();
  installPokerBrainForTests();
  loadTaskLibrary();

  const base = extractIndexConst('SWIPE_BASE') || [];
  const rows = [];
  let matches = 0;
  let conflicts = 0;
  let notComparable = 0;
  const conflictIds = [];

  for (const s of base) {
    const preferred = s.preferred?.[0];
    const live = s.live?.[0] || null;
    const libTask = resolveLibraryTask(s);
    const libId = libTask?.id || null;

    const brain = globalThis.window?.PokerBrain?.gradeDecision?.(
      { ...s, spotId: s.id },
      preferred,
      s.sizeZone ? Math.round((s.sizeZone[0] + s.sizeZone[1]) / 2) : null
    );
    const prefBucket = preferredBucket(s, preferred);
    const brainBucket = brain ? brainGradeBucket(brain.grade) : 'unknown';

    let runtimeGradingSource = 'POSTFLOP_POLICY (PokerSwipeGrading.gradeBrain → PokerBrain)';
    let gatewayBucket = 'unknown';
    if (libTask) {
      const built = drillFromLibraryTask(libTask);
      if (built.ok) {
        const opt = built.drill.options.find((o) => o.labelRu === preferred);
        if (opt) {
          const g = gradeAnswer({ drill: built.drill, chosenId: opt.id });
          gatewayBucket =
            g.grade === 'EXCELLENT'
              ? 'optimal'
              : g.nearOptimal || g.grade === 'GOOD'
                ? 'acceptable'
                : 'bad';
        }
        const spot = libraryTaskToBrainSpot(libTask);
        const gw = gradeDecision({
          mode: 'swipe',
          scenario: spot,
          action: 'FOLD',
          eventKey: `audit|${libTask.id}`
        });
        if (gw.solver) runtimeGradingSource = 'LIBRARY_QUIZ_TRUTH (gradingGateway → gradeAnswer when _library)';
      }
    }

    let classification = 'NOT_COMPARABLE';
    const prefVsBrain = bucketsConflict(prefBucket, brainBucket);
    if (prefVsBrain === false) {
      classification = 'MATCH';
      matches++;
    } else if (prefVsBrain === true) {
      classification = 'CONFLICT';
      conflicts++;
      conflictIds.push(s.id);
    } else notComparable++;

    if (libTask && gatewayBucket !== 'unknown' && prefBucket !== 'unknown') {
      const prefVsLib = bucketsConflict(prefBucket, gatewayBucket);
      if (prefVsLib === true) {
        classification = 'CONFLICT';
        if (!conflictIds.includes(s.id)) {
          conflicts++;
          conflictIds.push(s.id);
        }
      }
    }

    rows.push({
      id: s.id,
      libraryLinked: !!libTask,
      libraryTaskId: libId,
      preferred,
      live,
      prefBucket,
      brainBucket,
      gatewayBucket,
      runtimeGradingSource,
      classification,
      pokerBrainGradeAvailable: !!brain
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalActiveSwipeBaseSpots: base.length,
    libraryLinked: rows.filter((r) => r.libraryLinked).length,
    dualSourceComparable: rows.filter((r) => r.preferred && r.brainBucket !== 'unknown').length,
    matches,
    trueConflicts: conflicts,
    notComparable,
    conflictIds,
    spots: rows
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('swipeTruthPaths.mjs')) {
  runSwipeTruthPaths();
  console.log(JSON.stringify({ path: OUT }, null, 2));
}
