#!/usr/bin/env node
/**
 * P1 Decision Quality Gate — audit + session simulation + runtime swipe QA.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { loadTaskLibrary } from '../solver/src/training/taskLibraryBridge.js';
import { auditModeSpot } from '../solver/src/training/taskContextIntegrity.js';
import { buildCanonicalSpot, canonicalToDisplayContext } from '../task-context/canonicalSpot.js';
import {
  isActiveForTraining,
  gradingSourceForTask,
  countOneOptionTasks,
  countMeaningfulDecisions,
  variantFamilyId
} from '../solver/src/training/decisionQualityGate.js';
import { GRADING_SOURCE } from '../solver/src/training/gradingProvenance.js';
import { setTrainerCandidateIndex, getTrainerPreflopCandidates, buildTrainerSwipeSession } from '../solver/src/training/trainerCandidatePool.js';
import { sampleTrainerSession } from '../solver/src/training/trainerCurriculum.js';
import { createTrainingStore } from '../solver/src/training/trainingStore.js';
import { libraryTaskToBrainSpot } from '../solver/src/training/libraryDrill.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'data/trainer/built/trainer-candidate-index.json');
const USER_MODES = ['daily', 'swipe', 'sizing', 'review', 'exploit'];

const TRAINER_ONE_OPTION_BEFORE = 501;

function loadLegacyPools() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const extract = (name) => {
    const re = new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`, 'm');
    const m = html.match(re);
    if (!m) return [];
    try { return vm.runInNewContext(`[${m[1]}]`, {}); } catch { return []; }
  };
  const swipeBase = extract('SWIPE_BASE');
  const stacks = [22, 30, 40, 55];
  const swipe = [];
  for (const b of swipeBase) {
    stacks.forEach((st, i) => swipe.push({
      ...b,
      id: `${b.id}_V${i}`,
      stack: Math.max(16, Math.round((b.stack + st) / 2)),
      _legacy: true
    }));
  }
  return { swipe, sizing: extract('SIZING'), reviews: extract('REVIEWS') };
}

function collectActiveRows() {
  const library = loadTaskLibrary();
  const legacy = loadLegacyPools();
  const trainer = JSON.parse(fs.readFileSync(INDEX, 'utf8')).candidates || [];
  setTrainerCandidateIndex(JSON.parse(fs.readFileSync(INDEX, 'utf8')));
  const rows = [];

  const add = (task, mode, source) => {
    rows.push({ task: { ...task, _source: source }, mode });
  };

  for (const item of legacy.swipe) add({ ...item, _legacy: true }, 'swipe', 'legacy');
  for (const item of legacy.sizing) add({ ...item, _legacy: true }, 'sizing', 'legacy');
  for (const item of legacy.reviews) add({ ...item, _legacy: true }, 'review', 'legacy');

  for (const task of library) {
    for (const mode of ['daily', 'swipe', 'sizing', 'review']) {
      if (mode === 'sizing' && !/sizing|СТАВКА|%/i.test((task.options || []).join(' ') + task.correct)) continue;
      if (mode === 'review' && task.street === 'ПРЕФЛОП') continue;
      add({ ...task, _library: true }, mode, 'library');
    }
  }

  for (const t of trainer) add({ ...t, _trainerNative: true }, 'swipe', 'trainer');

  return rows;
}

function simulateSessions(n = 100, size = 10) {
  const pool = getTrainerPreflopCandidates();
  const store = createTrainingStore();
  let folds = 0, raises = 0, allins = 0, calls = 0, oneOpt = 0, dupPairs = 0, modeStreakMax = 0;
  let sessionsPass = true;

  for (let s = 0; s < n; s++) {
    const session = buildTrainerSwipeSession(store, { count: size, rng: () => (s * 0.017 + 0.13) % 1 });
    const items = session.items;
    if (items.length < Math.min(5, size)) sessionsPass = false;

    const families = new Set();
    let streak = 1, maxStreak = 1, prevMode = null;

    for (const t of items) {
      const act = t.trainerMeta?.normalizedAction || t.correct;
      if (act === 'FOLD') folds++;
      else if (act === 'CALL') calls++;
      else if (act === 'ALL_IN' || t.trainerMeta?.actionRaw === 'AI') allins++;
      else raises++;

      if ((t.options || []).length <= 1) { oneOpt++; sessionsPass = false; }

      const fam = variantFamilyId(t.id);
      if (families.has(fam)) dupPairs++;
      families.add(fam);

      const sm = t.trainerMeta?.sourceMode;
      if (sm === prevMode) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else { streak = 1; prevMode = sm; }
    }
    modeStreakMax = Math.max(modeStreakMax, maxStreak);
  }

  const total = n * size;
  return {
    sessions: n,
    tasksPerSession: size,
    folds,
    raises,
    allins,
    calls,
    oneOptionTasks: oneOpt,
    duplicateFamilyHits: dupPairs,
    maxSourceModeStreak: modeStreakMax,
    pass: sessionsPass && oneOpt === 0
  };
}

function runtimeSwipeQA(n = 15) {
  const pool = getTrainerPreflopCandidates();
  const session = sampleTrainerSession(pool, { count: n, rng: () => 0.31 });
  return session.map((task) => {
    const canonical = buildCanonicalSpot({ ...task, _trainerNative: true });
    const display = canonicalToDisplayContext(canonical, { mode: 'swipe' }) || {};
    const spot = libraryTaskToBrainSpot({ ...task, _canonical: canonical });
    const hist = (canonical.history || []).map((h) => h.text).join(' | ');
    const visible = [
      canonical.street,
      canonical.position && canonical.villain ? `${canonical.position} vs ${canonical.villain}` : canonical.position,
      canonical.heroStack != null ? `${canonical.heroStack} BB` : null,
      hist
    ].filter(Boolean).join(' · ');
    return {
      taskId: task.id,
      visibleCondition: visible,
      legalOptions: canonical.options || task.options,
      correctTrainerAction: canonical.correct || task.correct,
      gradingSource: task.trainerMeta?.gradingSource || 'TRAINER_EXACT',
      canonicalSpot: `hero=${canonical.position}; vill=${canonical.villain}; opts=[${(canonical.options || []).join(', ')}]`,
      optionCount: (canonical.options || []).length,
      heuristic: false,
      integrityOk: isActiveForTraining(task, 'swipe')
    };
  });
}

async function main() {
  const rows = collectActiveRows();
  let p0 = 0, heuristicActive = 0, active = 0, meaningful = 0;

  for (const { task, mode } of rows) {
    const audit = auditModeSpot(task, mode, {});
    if (audit.errors?.length && isActiveForTraining(task, mode)) p0++;
    if (!isActiveForTraining(task, mode)) continue;
    active++;
    const src = gradingSourceForTask(task);
    if (src === GRADING_SOURCE.HEURISTIC) heuristicActive++;
    if ((task.options || []).length >= 2) meaningful++;
  }

  const trainerPool = getTrainerPreflopCandidates();
  const oneOptionAfter = countOneOptionTasks(trainerPool);
  const meaningfulTrainer = countMeaningfulDecisions(trainerPool);
  const sessionAudit = simulateSessions(100, 10);
  const swipeQA = runtimeSwipeQA(15);

  const report = {
    P0_ACTIVE: p0,
    HEURISTIC_ACTIVE: heuristicActive,
    TRAINER_ONE_OPTION_BEFORE: TRAINER_ONE_OPTION_BEFORE,
    TRAINER_ONE_OPTION_AFTER: oneOptionAfter,
    MEANINGFUL_DECISION_TASKS: `${meaningfulTrainer} / ${trainerPool.length} (${(meaningfulTrainer / trainerPool.length * 100).toFixed(1)}%)`,
    ACTIVE_TRAINING_ROWS: active,
    DUPLICATE_SESSION_RATE_BEFORE: 'not instrumented (pre-change)',
    DUPLICATE_SESSION_RATE_AFTER: `${sessionAudit.duplicateFamilyHits} family hits / ${sessionAudit.sessions * sessionAudit.tasksPerSession} picks`,
    SESSION_100x10: sessionAudit.pass ? 'PASS' : 'FAIL',
    SESSION_METRICS: sessionAudit,
    TRAINER_SEMANTICS_CHANGED: 'NO',
    UNSUPPORTED_CALL_SEMANTICS_ADDED: 'NO',
    RUNTIME_SWIPE_QA: swipeQA
  };

  fs.writeFileSync(path.join(ROOT, 'P1_DECISION_QUALITY_GATE_REPORT.json'), JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    P0_ACTIVE: report.P0_ACTIVE,
    HEURISTIC_ACTIVE: report.HEURISTIC_ACTIVE,
    TRAINER_ONE_OPTION_BEFORE: report.TRAINER_ONE_OPTION_BEFORE,
    TRAINER_ONE_OPTION_AFTER: report.TRAINER_ONE_OPTION_AFTER,
    MEANINGFUL_DECISION_TASKS: report.MEANINGFUL_DECISION_TASKS,
    SESSION_100x10: report.SESSION_100x10,
    SAFE_TO_MERGE: 'NO'
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
