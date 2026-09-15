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

const CONCEPT_TO_LIBRARY = {
  'RFI BTN': 'PRE_RFI_BTN_A8S',
  'BB defence': 'PRE_BB_K8S',
  'polar 3-bet': 'PRE_3B_SB_A5S',
  'dry board c-bet': 'F_DRY_CBET',
  'dynamic board': 'F_DYNAMIC_CBET',
  'vs overbet': 'F_OVERBET_VS',
  'small bet defence': 'F_SMALL_BET_DEF',
  'turn value barrel': 'T_VALUE_BARREL',
  'turn showdown': 'T_CHECK_SD',
  'thin value': 'R_THIN_VALUE',
  'river bluffcatch': 'R_BLUFFCATCH',
  'price defence': 'R_PRICE_DEF',
  'river value': 'R_BIG_VALUE'
};

function resolveLibraryTask(swipeSpot) {
  const byConcept = swipeSpot.concept ? CONCEPT_TO_LIBRARY[swipeSpot.concept] : null;
  if (byConcept && getTaskById(byConcept)) return getTaskById(byConcept);
  const direct = getTaskById(swipeSpot.id);
  if (direct) return direct;
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
