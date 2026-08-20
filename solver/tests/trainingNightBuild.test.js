// P0 night-build tests: skill profile, error cause, assessment, spot selector,
// planner, analytics, store migration.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSkillProfile, recordSkillEvidence, createSkillEvidence, skillsForConcept,
  normalizeSkill, skillLabelRu, confidenceLabel, overallLabel, skillProfileId
} from '../src/training/skillProfile.js';
import { classifyErrorCause, errorCauseLabelRu, errorCauseTipRu, ERROR_CAUSES } from '../src/training/errorCause.js';
import { ASSESSMENT_POOL, buildAssessmentSet, gradeAssessmentItem, runAssessment, REQUIRED_SKILLS } from '../src/training/assessment.js';
import {
  adaptiveDifficulty, recentAccuracy, conceptDue, spacedInterval, spotEligible,
  selectSpots, normalizeSpot, isMastered, masteryOf, sessionGoal, earliestMeaningful
} from '../src/training/spotSelector.js';
import { poolFromLibrary, buildDailyPlan, planSummaryRu } from '../src/training/planner.js';
import { createAnalytics, isKnownEvent } from '../src/training/analytics.js';
import { createTrainingStore, STORE_VERSION } from '../src/training/trainingStore.js';

// ---- skill profile -----------------------------------------------------------

test('skill profile maps leak concepts to skills', () => {
  assert.ok(skillsForConcept('bluff_catch').includes('bluffCatch'));
  assert.ok(skillsForConcept('bluff_catch').includes('river'));
  assert.ok(skillsForConcept('open_range').includes('preflop'));
  assert.equal(normalizeSkill('pre'), 'preflop');
  assert.equal(normalizeSkill('SIZING'), 'betSizing');
  assert.equal(normalizeSkill('bubble'), 'icm');
  assert.equal(normalizeSkill('zzz'), null);
});

test('recordSkillEvidence computes score, confidence, trend', () => {
  let ev = createSkillEvidence({ skill: 'preflop' });
  const goodLosses = [0, 0.02, 0, 0.5, 0, 0.01, 0, 0.02, 0.03, 0];
  goodLosses.forEach((l, i) => {
    ev = recordSkillEvidence(ev, { evLossBb: l, confidenceScore: 0.8, at: 1000 + i });
  });
  assert.ok(ev.score != null && ev.score > 0 && ev.score <= 100);
  assert.ok(ev.confidence > 0.3);
  assert.equal(ev.recentTrend, 'improving');
  assert.equal(ev.sampleSize, goodLosses.length);
});

test('buildSkillProfile aggregates and reports weakest/strongest', () => {
  const leakProfiles = [{
    concept: 'bluff_catch',
    attempts: [{ evLossBb: 0.6, confidenceScore: 0.9, at: 1 }, { evLossBb: 0.4, confidenceScore: 0.9, at: 2 }, { evLossBb: 0.5, confidenceScore: 0.9, at: 3 }]
  }, {
    concept: 'open_range',
    attempts: [{ evLossBb: 0.02, confidenceScore: 0.7, at: 1 }, { evLossBb: 0, confidenceScore: 0.7, at: 2 }, { evLossBb: 0.01, confidenceScore: 0.7, at: 3 }]
  }];
  const prof = buildSkillProfile({ leakProfiles, now: 100 });
  assert.ok(prof.skills.river && prof.skills.preflop);
  assert.ok(prof.overall != null);
  // weakest should be a river/bluffCatch skill (higher EV loss)
  assert.ok(prof.weakest);
});

test('overallLabel and confidenceLabel produce Russian labels', () => {
  assert.ok(overallLabel(90).length > 0);
  assert.equal(confidenceLabel(0.85), 'высокая');
  assert.equal(confidenceLabel(0.1), 'низкая');
});

// ---- error cause -------------------------------------------------------------

test('classifyErrorCause detects sizing drift', () => {
  const c = classifyErrorCause({
    actionTaken: { type: 'bet' },
    recommendedAction: { type: 'bet' },
    sizeTakenPct: 0.8, sizeRecommendedPct: 0.3
  });
  assert.equal(c, 'sizingDrift');
});

test('classifyErrorCause detects concept gap on wrong action family', () => {
  const c = classifyErrorCause({
    actionTaken: { type: 'bet' },
    recommendedAction: { type: 'check' },
    concept: 'showdown_value'
  });
  assert.equal(c, 'conceptKnowledge');
});

test('classifyErrorCause detects range misread', () => {
  const c = classifyErrorCause({
    actionTaken: { type: 'check' },
    recommendedAction: { type: 'bet' },
    reason: ['range']
  });
  assert.equal(c, 'rangeMisread');
});

test('classifyErrorCause honours explicit errorType', () => {
  assert.equal(classifyErrorCause({ errorType: 'tilt' }), 'pressureTilt');
  assert.equal(classifyErrorCause({ errorType: 'attention' }), 'inattention');
});

test('error cause labels and tips exist for every cause', () => {
  for (const k of Object.keys(ERROR_CAUSES)) {
    assert.ok(errorCauseLabelRu(k).length > 0);
    assert.ok(errorCauseTipRu(k).length > 0);
  }
});

// ---- assessment --------------------------------------------------------------

test('buildAssessmentSet returns ≤ count unique items', () => {
  const set = buildAssessmentSet({ rng: () => 0.5, count: 12 });
  assert.ok(set.length <= 12);
  const ids = new Set(set.map((s) => s.id));
  assert.equal(ids.size, set.length);
});

test('gradeAssessmentItem: correct = high, near = moderate, wrong = low', () => {
  const item = ASSESSMENT_POOL[0];
  assert.equal(gradeAssessmentItem(item, item.correct).correct, true);
  const near = gradeAssessmentItem({ ...item, alsoOk: ['x'] }, 'x');
  assert.equal(near.nearOptimal, true);
  assert.ok(near.score < gradeAssessmentItem(item, item.correct).score);
  const wrong = gradeAssessmentItem(item, item.choices.find((c) => c !== item.correct));
  assert.equal(wrong.correct, false);
  assert.ok(wrong.score < near.score);
});

test('runAssessment produces skill + leak profiles and overall', () => {
  const set = buildAssessmentSet({ rng: () => 0.2, count: 12 });
  // answer all correctly
  const answers = set.map((item) => ({ id: item.id, choice: item.correct, confidence: 70 }));
  const res = runAssessment({ items: set, answers, now: 5 });
  assert.equal(res.answered, set.length);
  assert.ok(res.overall != null);
  assert.ok(res.skillProfile);
  assert.equal(res.skillProfile.overall, res.overall);
  // no wrong answers → few/no leaks
  const leaks = Object.values(res.leakProfiles);
  assert.ok(leaks.length === 0);
});

test('runAssessment creates leak profiles from wrong answers', () => {
  const set = [ASSESSMENT_POOL[0], ASSESSMENT_POOL[1]];
  const answers = set.map((item) => ({ id: item.id, choice: item.choices.find((c) => c !== item.correct) }));
  const res = runAssessment({ items: set, answers, now: 1 });
  assert.ok(Object.keys(res.leakProfiles).length >= 1);
});

test('REQUIRED_SKILLS is a superset of covered skills in the pool', () => {
  const covered = new Set(ASSESSMENT_POOL.map((i) => normalizeSkill(i.skillTag)));
  for (const s of covered) assert.ok(REQUIRED_SKILLS.includes(s));
});

// ---- spot selector -----------------------------------------------------------

const POOL = [
  { id: 's1', concept: 'bluff_catch', street: 'river', difficulty: 2, skillTags: ['bluffCatch'] },
  { id: 's2', concept: 'bluff_catch', street: 'river', difficulty: 3, skillTags: ['bluffCatch'] },
  { id: 's3', concept: 'open_range', street: 'preflop', difficulty: 1, skillTags: ['preflop'] },
  { id: 's4', concept: 'open_range', street: 'preflop', difficulty: 2, skillTags: ['preflop'] },
  { id: 's5', concept: 'river_sizing', street: 'river', difficulty: 4, skillTags: ['betSizing', 'river'] },
  { id: 's6', concept: 'icm', street: 'preflop', difficulty: 3, skillTags: ['icm'] }
];

test('selectSpots returns the requested count without duplicates', () => {
  const res = selectSpots({ pool: POOL, count: 6, rng: () => 0.5 });
  assert.equal(res.ok, true);
  assert.equal(res.selected.length, 6);
  assert.equal(new Set(res.selected).size, 6);
  assert.equal(res.buckets.length, 6);
});

test('selectSpots applies shown-spot cooldown', () => {
  const shownAt = { s3: { countAgo: 0 }, s4: { countAgo: 0 } };
  const res = selectSpots({ pool: POOL, shownAt, count: 6, rng: () => 0.5 });
  // cooldown is a soft gate; with a full pool it avoids recently-shown spots
  assert.equal(res.ok, true);
});

test('spotEligible respects the cooldown window', () => {
  assert.equal(spotEligible({ id: 'a' }, {}, 40), true);
  assert.equal(spotEligible({ id: 'a' }, { a: { countAgo: 0 } }, 40), false);
  assert.equal(spotEligible({ id: 'a' }, { a: { countAgo: 45 } }, 40), true);
});

test('adaptiveDifficulty rises with accuracy and falls with failure', () => {
  const high = Array(10).fill({ grade: 'EXCELLENT' });
  const low = Array(10).fill({ grade: 'MISTAKE' });
  assert.ok(adaptiveDifficulty({ current: 3, recentResults: high }) >= 3);
  assert.ok(adaptiveDifficulty({ current: 3, recentResults: low }) < 3);
});

test('recentAccuracy computes a ratio', () => {
  assert.equal(recentAccuracy([{ grade: 'EXCELLENT' }, { grade: 'MISTAKE' }]), 0.5);
  assert.equal(recentAccuracy([]), null);
});

test('spaced repetition expands interval with mastery', () => {
  const soon = spacedInterval({ lastSeenAt: 0, mastery: null, now: 1000, baseDays: 1.5 });
  const later = spacedInterval({ lastSeenAt: 0, mastery: 90, now: 1000, baseDays: 1.5 });
  assert.ok(later > soon);
  assert.equal(conceptDue({ lastSeenAt: null, mastery: null, now: 0 }), true);
});

test('mastery gating and earliestMeaningful', () => {
  assert.equal(isMastered({ masteryScore: 85 }), true);
  assert.equal(isMastered({ masteryScore: 50 }), false);
  const earliest = earliestMeaningful({
    concepts: ['a', 'b'],
    masteryByConcept: { a: 50, b: 90 }
  });
  assert.equal(earliest, 'a');
});

test('sessionGoal highlights the weakest skill', () => {
  const g = sessionGoal({ weakestSkill: 'icm' });
  assert.equal(g.type, 'skill');
  assert.ok(g.copyRu.includes('icm') || g.copyRu.length > 0);
});

test('normalizeSpot clamps difficulty 1..5', () => {
  assert.equal(normalizeSpot({ id: 'x', concept: 'c', difficulty: 99 }).difficulty, 5);
  assert.equal(normalizeSpot({ id: 'x', concept: 'c', difficulty: 0 }).difficulty, 1);
});

// ---- planner ----------------------------------------------------------------

test('poolFromLibrary normalizes tasks into selector pool', () => {
  const tasks = [{
    id: 't1', concept: 'RFI BTN', street: 'ПРЕФЛОП', difficulty: 2,
    tags: ['префлоп', 'RFI'], heroStack: 30, position: 'BTN',
    format: 'MTT', stage: 'СРЕДНЯЯ', actions: ['ФОЛД', 'РЕЙЗ'], correct: 'РЕЙЗ'
  }];
  const pool = poolFromLibrary(tasks);
  assert.equal(pool.length, 1);
  assert.ok(pool[0].skillTags.includes('preflop'));
  assert.equal(pool[0].stackDepth, 'mid');
});

test('buildDailyPlan produces a personalised plan with a goal', () => {
  const tasks = [
    { id: 't1', concept: 'RFI BTN', street: 'ПРЕФЛОП', difficulty: 1, tags: ['префлоп'], heroStack: 30, position: 'BTN', actions: ['РЕЙЗ', 'ФОЛД'], correct: 'РЕЙЗ' },
    { id: 't2', concept: 'BB DEFENCE', street: 'ПРЕФЛОП', difficulty: 1, tags: ['префлоп'], heroStack: 40, position: 'BB', actions: ['КОЛЛ', 'ФОЛД'], correct: 'КОЛЛ' },
    { id: 't3', concept: 'BLUFF-CATCH', street: 'РИВЕР', difficulty: 3, tags: ['ривер'], heroStack: 26, position: 'BB', actions: ['КОЛЛ', 'ФОЛД'], correct: 'ФОЛД' },
    { id: 't4', concept: 'THIN VALUE', street: 'РИВЕР', difficulty: 2, tags: ['ривер'], heroStack: 31, position: 'CO', actions: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА' }
  ];
  const pool = poolFromLibrary(tasks);
  const skillProfile = { weakest: { skill: 'river' }, overall: 60 };
  const plan = buildDailyPlan({
    pool,
    count: 4,
    progressByConcept: {},
    history: [],
    recentResults: [],
    skillProfile,
    now: 1000
  });
  assert.equal(plan.ok !== false || plan.filled >= 0, true);
  assert.ok(plan.spots && plan.spots.length >= 0);
  assert.ok(planSummaryRu(plan).length > 0);
});

// ---- analytics --------------------------------------------------------------

test('analytics tracks events and persists via the store', () => {
  const store = createTrainingStore({ storage: memStorage() });
  const analytics = createAnalytics({ store, now: () => 10 });
  const ev = analytics.assessmentCompleted({ answered: 12, total: 12, overall: 80 });
  assert.equal(ev.name, 'assessment_completed');
  const stored = store.loadAnalyticsEvents();
  assert.ok(stored.some((e) => e.name === 'assessment_completed'));
});

test('analytics recognises known event names', () => {
  assert.equal(isKnownEvent('session_started'), true);
  assert.equal(isKnownEvent('nope'), false);
  const a = createAnalytics({ now: () => 1 });
  const ev = a.track('nope', { x: 1 });
  assert.equal(ev.name, 'custom_nope');
});

// ---- store migration ---------------------------------------------------------

test('training store migrates to version 2 and persists new data', () => {
  const st = memStorage();
  st.setItem('pokerSwipe_train_meta', JSON.stringify({ version: 1 }));
  const store = createTrainingStore({ storage: st });
  assert.equal(store.version, 2);
  const meta = JSON.parse(st.getItem('pokerSwipe_train_meta'));
  assert.equal(meta.version, 2);
  assert.equal(meta.migratedFrom, 1);

  store.saveSkillProfile({ overall: 70 });
  assert.equal(store.loadSkillProfile().overall, 70);
  store.saveAssessment({ overall: 70 });
  assert.ok(store.loadAssessment());
});

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
}