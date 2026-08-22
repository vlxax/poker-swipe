// Profile → spot selection from the task library (personalization layer tests).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getTaskPool, auditTaskMetadata } from '../src/training/taskLibraryBridge.js';
import { buildDailyPlan } from '../src/training/planner.js';
import { selectSpots } from '../src/training/spotSelector.js';
import { spotMatchesLeakConcept } from '../src/training/leakSpotMapping.js';
import { buildLeakProfile } from '../src/training/leakProfile.js';
import { buildSkillProfile } from '../src/training/skillProfile.js';
import {
  getDailyPersonalizedTraining, buildProfileDailyPlan, hasUsablePlayerProfile
} from '../src/training/personalizedTraining.js';
import { createTrainingStore } from '../src/training/trainingStore.js';

const POOL = getTaskPool();
const rng = () => 0.37;

function icmSpotCount(plan) {
  const spots = plan.spots || [];
  return spots.filter((s) => (s.icmPressure || 0) > 0.3 || (s.skillTags || []).includes('icm')).length;
}

function bluffCatchSpotCount(plan) {
  return (plan.spots || []).filter((s) => spotMatchesLeakConcept(s, 'bluff_catch')).length;
}

function skillProfileWithScores(scores, now = 1000) {
  const leakProfiles = Object.entries(scores).map(([skill, score]) => {
    const evLoss = score >= 85 ? 0.02
      : score >= 80 ? 0.08
      : score >= 75 ? 0.15
      : score < 50 ? 0.6
      : score < 70 ? 0.3
      : 0.05;
    const concept = skill === 'icm' ? 'icm_pressure'
      : skill === 'bluffCatch' ? 'bluff_catch'
      : skill === 'preflop' ? 'open_range'
      : skill === 'river' ? 'value_bet'
      : 'cbet_frequency';
    const attempts = Array(5).fill(null).map((_, i) => ({
      evLossBb: evLoss,
      confidenceScore: 0.8,
      at: now + i
    }));
    return { concept, attempts };
  });
  return buildSkillProfile({ leakProfiles, now });
}

test('metadata audit: most library tasks have usable personalization fields', () => {
  const audit = auditTaskMetadata();
  assert.equal(audit.total, 180);
  assert.ok(audit.fullyUsable >= 173, `expected >=173 fully usable, got ${audit.fullyUsable}`);
  assert.ok(audit.withSkillTags >= 100);
});

test('1: weak ICM player gets more ICM spots than strong ICM player', () => {
  const weakIcm = skillProfileWithScores({ icm: 38, preflop: 72, postflop: 70 });
  const strongIcm = skillProfileWithScores({ icm: 88, preflop: 72, postflop: 70 });

  const planWeak = buildDailyPlan({
    pool: POOL, skillProfile: weakIcm, count: 7, rng, history: [], progressByConcept: {}
  });
  const planStrong = buildDailyPlan({
    pool: POOL, skillProfile: strongIcm, count: 7, rng, history: [], progressByConcept: {}
  });

  const weakCount = icmSpotCount(planWeak);
  const strongCount = icmSpotCount(planStrong);
  assert.ok(weakCount > strongCount, `weak ICM ${weakCount} should exceed strong ${strongCount}`);
});

test('2: river bluff-catch leak prioritizes river defense spots', () => {
  const leak = buildLeakProfile({
    concept: 'bluff_catch',
    events: [0, 1, 2, 3, 4, 5].map((i) => ({
      concept: 'bluff_catch', evLossBb: 1.2, at: i * 1000, confidenceScore: 0.9
    }))
  });
  const skillProfile = buildSkillProfile({
    leakProfiles: [{ concept: 'bluff_catch', attempts: leak.attempts }],
    now: 5000
  });

  const plan = buildDailyPlan({
    pool: POOL,
    skillProfile,
    leakProfiles: [leak],
    count: 7,
    rng,
    history: [],
    progressByConcept: {}
  });

  assert.ok(bluffCatchSpotCount(plan) >= 2, `expected >=2 bluff-catch spots, got ${bluffCatchSpotCount(plan)}`);
  assert.ok(
    plan.sessionPlan.primaryTargets.some((t) => /bluff|price|fold|catch|блеф|кетч|цена|фолд|ривер/i.test(t)),
    'primary targets should mention river defense'
  );
});

test('3: strong skills still receive maintenance spots', () => {
  const skillProfile = skillProfileWithScores({ preflop: 86, postflop: 84, icm: 80, river: 78 });
  const plan = buildDailyPlan({
    pool: POOL, skillProfile, count: 7, rng, history: [], progressByConcept: {}
  });
  const maintBuckets = (plan.buckets || []).filter((b) => b === 'maintenance').length;
  assert.ok(maintBuckets >= 1 || (plan.sessionPlan.maintenance || []).length >= 1);
});

test('4: exploration spots are present in the session plan', () => {
  const skillProfile = skillProfileWithScores({ preflop: 55, postflop: 58, icm: 52 });
  const plan = buildDailyPlan({
    pool: POOL, skillProfile, count: 7, rng, history: [], progressByConcept: {}
  });
  const exploreBuckets = (plan.buckets || []).filter((b) => b === 'exploration' || b === 'challenge').length;
  assert.ok(
    exploreBuckets >= 1 || (plan.sessionPlan.exploration || []).length >= 1,
    'session should include exploration or challenge spots'
  );
});

test('5: recently shown spot IDs are avoided when alternatives exist', () => {
  const skillProfile = skillProfileWithScores({ preflop: 50, postflop: 50 });
  const recentIds = POOL.slice(0, 5).map((s) => s.id);
  const history = recentIds.map((id, i) => ({
    spotId: id,
    concept: POOL[i].concept,
    at: 1000 - i
  }));

  const plan = buildDailyPlan({
    pool: POOL, skillProfile, count: 7, rng, history, progressByConcept: {}
  });

  const overlap = (plan.spotIds || []).filter((id) => recentIds.includes(id));
  assert.ok(overlap.length <= 1, `should avoid recent spots, overlap=${overlap.length}`);
});

test('6: two materially different profiles produce different plans', () => {
  const profileA = skillProfileWithScores({ icm: 35, preflop: 80 });
  const profileB = skillProfileWithScores({ river: 35, bluffCatch: 32, preflop: 85 });

  const planA = buildDailyPlan({ pool: POOL, skillProfile: profileA, count: 7, rng, history: [], progressByConcept: {} });
  const planB = buildDailyPlan({ pool: POOL, skillProfile: profileB, count: 7, rng, history: [], progressByConcept: {} });

  const idsA = (planA.spotIds || []).join(',');
  const idsB = (planB.spotIds || []).join(',');
  assert.notEqual(idsA, idsB);

  const icmDiff = icmSpotCount(planA) - icmSpotCount(planB);
  const bcDiff = bluffCatchSpotCount(planB) - bluffCatchSpotCount(planA);
  assert.ok(icmDiff > 0 || bcDiff > 0, 'plans should differ in focus composition');
});

test('7: no-profile user gets valid fallback plan', () => {
  const store = createTrainingStore();
  assert.equal(hasUsablePlayerProfile(store), false);

  const daily = getDailyPersonalizedTraining({ store, count: 7 });
  assert.ok(daily.plan);
  assert.equal(daily.source, 'leak_queue');
  assert.ok(daily.plan.total === 7);
  assert.ok(Array.isArray(daily.plan.drills));
});

test('8: selection never returns invalid or undefined task IDs', () => {
  const skillProfile = skillProfileWithScores({ icm: 40, preflop: 60, river: 45 });
  const plan = buildDailyPlan({
    pool: POOL, skillProfile, count: 7, rng, history: [], progressByConcept: {}
  });

  for (const id of plan.spotIds || []) {
    assert.ok(id, 'spot id must be truthy');
    assert.ok(POOL.some((s) => s.id === id), `unknown spot id ${id}`);
  }

  const res = selectSpots({ pool: POOL, skillProfile, count: 7, rng });
  assert.equal(res.ok, true);
  for (const id of res.selected) {
    assert.ok(POOL.some((s) => s.id === id));
  }
});

test('buildProfileDailyPlan returns null without profile', () => {
  const store = createTrainingStore();
  assert.equal(buildProfileDailyPlan({ store }), null);
});

test('store with skill profile uses library plan path', () => {
  const store = createTrainingStore();
  store.saveSkillProfile(skillProfileWithScores({ icm: 42, preflop: 70 }));
  const daily = getDailyPersonalizedTraining({ store, count: 7, rng });
  assert.equal(daily.source, 'library');
  assert.ok(daily.plan.filled > 0);
  assert.ok(daily.plan.sessionPlan);
});
