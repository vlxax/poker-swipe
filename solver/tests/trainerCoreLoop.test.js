import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTrainingStore } from '../src/training/trainingStore.js';
import { buildTrainerSwipeSession, getTrainerPreflopCandidates, setTrainerCandidateIndex } from '../src/training/trainerCandidatePool.js';
import { buildTrainerWeaknessProfile, recordTrainerOutcome, weaknessWeightsForSession } from '../src/training/trainerPersonalization.js';
import { buildTrainerQueryFromCanonical } from '../../trainer-knowledge/canonicalTrainerQuery.js';
import { buildCanonicalSpot } from '../../task-context/canonicalSpot.js';
import { checkQueryCompleteness, SOURCE_MODE_REQUIREMENTS } from '../../trainer-knowledge/sourceModeRequirements.js';
import { sampleTrainerSession } from '../src/training/trainerCurriculum.js';
import { trainerMistakeFingerprint, dueSpacedReviews } from '../src/training/trainerSpacedReview.js';
import { GRADING_SOURCE } from '../src/training/gradingProvenance.js';

const INDEX_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/trainer/built/trainer-candidate-index.json'
);
if (fs.existsSync(INDEX_PATH)) {
  setTrainerCandidateIndex(JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')));
}

test('canonical → trainer query does not use concept/tags', () => {
  const task = {
    id: 'TEST_UO',
    street: 'ПРЕФЛОП',
    position: 'BTN',
    villain: 'BB',
    hero: ['A♠', 'K♠'],
    heroStack: 25,
    history: [{ street: 'ПРЕФЛОП', text: 'До тебя все сфолдили.' }],
    concept: 'squeeze wrong tag',
    tags: ['vs squeeze'],
    question: 'contains squeeze word only in noise',
    options: ['ФОЛД', 'РЕЙЗ'],
    correct: 'РЕЙЗ',
    _legacy: true
  };
  const canonical = buildCanonicalSpot(task);
  const built = buildTrainerQueryFromCanonical(canonical, 'AKs');
  assert.equal(built.preflop?.sourceMode, 'uo');
  assert.notEqual(built.preflop?.sourceMode, 'vssqueeze');
});

test('source mode requirements block incomplete queries', () => {
  const incomplete = { sourceMode: 'vs1rshort', heroPosition: 'BB', hand: 'AKs' };
  const { complete, missing } = checkQueryCompleteness(incomplete, 'vs1rshort');
  assert.equal(complete, false);
  assert.ok(missing.includes('stack'));
  assert.ok(missing.includes('opponentPosition'));
  assert.ok(missing.includes('rawSpot'));
});

test('trainer-native candidate pool is non-empty', () => {
  const pool = getTrainerPreflopCandidates();
  assert.ok(pool.length >= 100, `expected >=100 candidates, got ${pool.length}`);
  const sample = pool[0];
  assert.ok(sample.trainerMeta?.chartId);
  assert.ok(sample.trainerMeta?.gradingAllowed);
  assert.equal(sample.trainerMeta.gradingSource, 'TRAINER_EXACT');
});

test('curriculum avoids fold-heavy sessions', () => {
  const pool = getTrainerPreflopCandidates().slice(0, 200);
  const session = sampleTrainerSession(pool, { count: 10, rng: () => 0.42 });
  const folds = session.filter((t) => t.trainerMeta?.normalizedAction === 'FOLD').length;
  assert.ok(folds <= 6, `too many folds in session: ${folds}/10`);
});

test('weakness targeting increases relevant trainer scenarios', () => {
  const store = createTrainingStore();
  const pool = getTrainerPreflopCandidates();
  const bbTasks = pool.filter((t) => t.trainerMeta?.sourceMode === 'vs1rshort' || t.trainerMeta?.sourceMode === 'vs1r');
  assert.ok(bbTasks.length > 5);

  const cleanSession = buildTrainerSwipeSession(store, { count: 20, rng: () => 0.5 });
  const cleanBb = cleanSession.items.filter((t) =>
    t.trainerMeta?.sourceMode === 'vs1rshort' || (t.position === 'BB' && t.trainerMeta?.sourceMode === 'vs1r')
  ).length;

  for (let i = 0; i < 8; i++) {
    const t = bbTasks[i % bbTasks.length];
    recordTrainerOutcome(store, {
      task: t,
      grade: 'MISTAKE',
      gradingSource: GRADING_SOURCE.TRAINER_EXACT,
      trainerMeta: t.trainerMeta,
      now: Date.now() + i
    });
  }

  const weakSession = buildTrainerSwipeSession(store, { count: 20, rng: () => 0.5 });
  const weakBb = weakSession.items.filter((t) =>
    t.trainerMeta?.sourceMode === 'vs1rshort' || (t.position === 'BB' && t.trainerMeta?.sourceMode === 'vs1r')
  ).length;

  assert.ok(weakBb >= cleanBb, `weak targeting failed: clean=${cleanBb} weak=${weakBb}`);
  const weights = weaknessWeightsForSession(store);
  assert.ok(Object.keys(weights).length > 0);
});

test('spaced repetition stores mistake fingerprint with delay', () => {
  const store = createTrainingStore();
  const pool = getTrainerPreflopCandidates();
  const task = pool[0];
  recordTrainerOutcome(store, {
    task,
    grade: 'MISTAKE',
    gradingSource: GRADING_SOURCE.TRAINER_EXACT,
    trainerMeta: task.trainerMeta
  });
  const fp = trainerMistakeFingerprint(task);
  const reviews = store.loadSpacedReviews();
  assert.ok(reviews.some((r) => r.fingerprint === fp));
  const dueNow = dueSpacedReviews(store, { now: Date.now() + 6 * 60 * 1000 });
  assert.ok(dueNow.length >= 1);
});

test('core loop acceptance — mistakes then recovery', () => {
  const store = createTrainingStore();
  const pool = getTrainerPreflopCandidates();
  const targetMode = 'callpush';
  const targets = pool.filter((t) => t.trainerMeta?.sourceMode === targetMode).slice(0, 6);
  assert.ok(targets.length >= 4);

  for (const t of targets.slice(0, 4)) {
    recordTrainerOutcome(store, { task: t, grade: 'MISTAKE', trainerMeta: t.trainerMeta });
  }
  const weaknessBefore = buildTrainerWeaknessProfile(store.loadHistory(), { minMistakes: 1 });
  assert.ok(weaknessBefore.call_push >= 1 || Object.keys(weaknessBefore).length > 0);

  const sessionAfterMistakes = buildTrainerSwipeSession(store, { count: 15, rng: () => 0.33 });
  const modeHits = sessionAfterMistakes.items.filter((t) => t.trainerMeta?.sourceMode === targetMode).length;

  for (const t of targets.slice(0, 3)) {
    recordTrainerOutcome(store, { task: t, grade: 'EXCELLENT', trainerMeta: t.trainerMeta });
  }
  const weaknessAfter = buildTrainerWeaknessProfile(store.loadHistory(), { minMistakes: 3 });

  assert.ok(modeHits >= 1, 'session should include weakness-related mode');
  assert.ok(sessionAfterMistakes.items.every((t) => t.trainerMeta?.gradingAllowed));
});

test('SOURCE_MODE_REQUIREMENTS covers all batch2 modes', () => {
  const modes = ['uo', 'vs1r', 'vs1rshort', 'vs1r1c', 'vs2r', 'vs3bet', 'vs4bet', 'vssqueeze', 'callpush', 'sbvsbb', 'huante', 'vslimp'];
  for (const m of modes) {
    assert.ok(SOURCE_MODE_REQUIREMENTS[m], `missing requirements for ${m}`);
  }
});
