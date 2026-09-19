#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, extractIndexConst, gradeBucketFromPreferred, brainGradeBucket, bucketsConflict } from './pokerTruthUtils.mjs';
import { loadTaskLibrary, resetTaskLibraryCache } from '../src/training/taskLibraryBridge.js';
import { installPokerBrainForTests } from '../tests/brainTestEnv.js';

const OUT = path.join(ROOT, 'solver/tests/dailyTruthPaths.report.json');

const DAILY_LIBRARY_MAP = {
  'thin value': 'R_THIN_VALUE',
  'river bluffcatch': 'R_BLUFFCATCH',
  'turn value sizing': 'T_VALUE_BARREL',
  'dynamic board': 'F_DYNAMIC_CBET',
  'river value': 'R_BIG_VALUE'
};

function dailyStreetFromTheme(theme) {
  if (/TURN/i.test(theme)) return 'TURN';
  if (/FLOP/i.test(theme)) return 'FLOP';
  return 'RIVER';
}

export function runDailyTruthPaths({ write = true } = {}) {
  resetTaskLibraryCache();
  installPokerBrainForTests();
  const lib = loadTaskLibrary();
  const tasksById = new Map((lib.tasks || []).map((t) => [t.id, t]));
  const templates = extractIndexConst('DAILY_TEMPLATES') || [];
  const spots = templates.map((t, i) => ({
    ...t,
    id: `DAILY_${i + 1}`,
    number: i + 1
  }));

  const rows = [];
  let matches = 0;
  let conflicts = 0;
  let notComparable = 0;
  const conflictIds = [];

  for (const d of spots) {
    const preferred = d.preferred;
    const libId = DAILY_LIBRARY_MAP[d.concept];
    const libTask = libId ? tasksById.get(libId) : null;
    const street = dailyStreetFromTheme(d.theme);

    const brain = globalThis.window?.PokerBrain?.gradeDecision?.(
      { ...d, spotId: d.id, street, theme: d.theme },
      preferred,
      d.zone ? Math.round((d.zone[0] + d.zone[1]) / 2) : null
    );
    const calendarBucket = gradeBucketFromPreferred({ preferred }, preferred);
    const brainBucket = brain ? brainGradeBucket(brain.grade) : 'unknown';
    const libCorrect = libTask?.correct || null;
    const libBucket = libCorrect
      ? preferred === libCorrect
        ? 'optimal'
        : libTask.alsoOk?.includes?.(preferred)
          ? 'acceptable'
          : 'bad'
      : 'unknown';

    let classification = 'NOT_COMPARABLE';
    const sources = {
      calendar: { authority: 'POSTFLOP_TEACHING', preferred, grading: 'index dailyReveal → PokerSwipeGrading.gradeBrain' },
      library: libTask
        ? { authority: 'LIBRARY_QUIZ_TRUTH', correct: libTask.correct, alsoOk: libTask.alsoOk || [] }
        : null,
      brain: brain
        ? { authority: 'POSTFLOP_POLICY', source: brain.source, grade: brain.grade }
        : null,
      exactNode: d.theme ? { key: `DAILY:${d.theme}`, inPack: !!globalThis.window?.POKER_BRAIN_PACK?.exact?.[`DAILY:${d.theme}`] } : null
    };

    if (brainBucket !== 'unknown' && calendarBucket !== 'unknown') {
      const calVsBrain = bucketsConflict(calendarBucket, brainBucket);
      if (calVsBrain === null) classification = 'NOT_COMPARABLE';
      else if (!calVsBrain) {
        classification = 'MATCH';
        matches++;
      } else {
        classification = 'CONFLICT';
        conflicts++;
        conflictIds.push(d.id);
      }
    } else notComparable++;

    if (libTask && libCorrect && preferred !== libCorrect && !libTask.alsoOk?.includes(preferred)) {
      if (classification === 'MATCH') classification = 'CONFLICT';
      if (!conflictIds.includes(d.id)) {
        conflicts++;
        conflictIds.push(d.id);
      }
    }

    rows.push({
      id: d.id,
      theme: d.theme,
      concept: d.concept,
      preferred,
      classification,
      calendarBucket,
      brainBucket,
      libCorrect,
      libBucket,
      sources
    });
  }

  const multiTruth = rows.filter((r) => r.sources.library && r.sources.brain).length;
  const report = {
    generatedAt: new Date().toISOString(),
    totalActiveDailySpots: spots.length,
    singleTruthSpots: rows.filter((r) => !r.sources.library).length,
    multiTruthComparable: multiTruth,
    matches,
    trueConflicts: conflicts,
    notComparable,
    conflictIds,
    spots: rows
  };
  if (write) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.endsWith('dailyTruthPaths.mjs')) {
  runDailyTruthPaths();
  console.log(JSON.stringify({ path: OUT }, null, 2));
}
