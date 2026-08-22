// Phase 4: player differentiation — prove profiles produce different training plans.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getTaskById } from '../src/training/taskLibraryBridge.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { recordTrainingResult, buildProfileDailyPlan } from '../src/training/personalizedTraining.js';
import { DEFAULT_SHOWN_COOLDOWN } from '../src/training/spotSelector.js';
import {
  buildPlayerStore,
  buildDifferentiationReport,
  generateDifferentiationPlan,
  overlapCount,
  uniqueSkillCount,
  DIFFERENTIATION_PLAN_COUNT,
  DIFFERENTIATION_PLAN_NOW
} from '../src/training/playerDifferentiationFixtures.js';

const REPORT = {
  A: buildDifferentiationReport('A'),
  B: buildDifferentiationReport('B'),
  C: buildDifferentiationReport('C')
};

test('profiles A/B/C have expected weakness signatures', () => {
  const weakA = REPORT.A.weaknesses.map((w) => w.skill);
  const weakB = REPORT.B.weaknesses.map((w) => w.skill);
  assert.ok(weakA.includes('icm') || weakA.includes('shortStack'), `A weaknesses: ${weakA.join(', ')}`);
  assert.ok(
    weakB.includes('bluffCatch') || weakB.includes('river') || weakB.includes('postflop'),
    `B weaknesses: ${weakB.join(', ')}`
  );
  const spreadC = REPORT.C.weaknesses.filter((w) => w.score >= 90).length;
  assert.ok(spreadC >= 3, 'C should have multiple high-scoring skills');
});

test('production buildProfileDailyPlan returns 20 tasks per profile', () => {
  for (const id of ['A', 'B', 'C']) {
    const { plan } = REPORT[id];
    assert.equal(plan.filled, DIFFERENTIATION_PLAN_COUNT, `${id} plan not full`);
    assert.equal(plan.spotIds.length, DIFFERENTIATION_PLAN_COUNT);
    assert.equal(plan.personalized, true, `${id} plan not personalized`);
  }
});

test('A receives more ICM/push-fold than B', () => {
  const a = REPORT.A.distribution.icmPush;
  const b = REPORT.B.distribution.icmPush;
  assert.ok(a - b >= 4, `A icmPush ${a} vs B ${b}`);
});

test('B receives more postflop/bluff-catch/river than A', () => {
  const a = REPORT.A.distribution.postRiver;
  const b = REPORT.B.distribution.postRiver;
  assert.ok(b - a >= 3, `B postRiver ${b} vs A ${a}`);
});

test('C receives broader mixed plan than weak-skill profiles', () => {
  const skillsC = uniqueSkillCount(REPORT.C.plan.spots);
  const skillsA = uniqueSkillCount(REPORT.A.plan.spots);
  const bucketBreadth = (dist) => Object.values(dist).filter((v) => v > 0).length;
  assert.ok(
    bucketBreadth(REPORT.C.distribution) >= bucketBreadth(REPORT.A.distribution),
    'C should cover at least as many training buckets as A'
  );
  assert.ok(skillsC >= skillsA - 1, `C skill breadth ${skillsC} vs A ${skillsA}`);
});

test('three 20-task sequences are not identical', () => {
  assert.notDeepEqual(REPORT.A.taskIds, REPORT.B.taskIds);
  assert.notDeepEqual(REPORT.A.taskIds, REPORT.C.taskIds);
  assert.notDeepEqual(REPORT.B.taskIds, REPORT.C.taskIds);
  assert.ok(overlapCount(REPORT.A.taskIds, REPORT.B.taskIds) < DIFFERENTIATION_PLAN_COUNT);
});

function planWeakVsStrongHits(spots, skillProfile) {
  const scored = Object.values(skillProfile.skills || {}).filter((s) => s.score != null);
  const sorted = scored.map((s) => s.score).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 50;
  let weak = 0;
  let strong = 0;
  for (const spot of spots) {
    const tagScores = (spot.skillTags || [])
      .map((t) => skillProfile.skills[t]?.score)
      .filter((x) => x != null);
    if (!tagScores.length) continue;
    const minTag = Math.min(...tagScores);
    if (minTag <= median) weak += 1;
    else strong += 1;
  }
  return { weak, strong };
}

test('weak skills increase task priority in the plan', () => {
  for (const id of ['A', 'B']) {
    const { plan, skillProfile } = REPORT[id];
    const { weak, strong } = planWeakVsStrongHits(plan.spots, skillProfile);
    assert.ok(weak > strong, `${id}: weak-priority spots ${weak} <= strong-priority ${strong}`);
  }
});

test('anti-repeat suppresses recently shown tasks', () => {
  const store = buildPlayerStore('A');
  const history = store.loadHistory() || [];
  const recentIds = history.slice(-DEFAULT_SHOWN_COOLDOWN).map((h) => h.spotId).filter(Boolean);
  assert.ok(recentIds.length >= 10, 'profile history should exist before anti-repeat check');

  let now = DIFFERENTIATION_PLAN_NOW - 50_000;
  for (const id of recentIds) {
    const task = getTaskById(id);
    if (!task) continue;
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'GOOD', evLossBb: 0.05, now });
    now += 1;
  }

  const plan = buildProfileDailyPlan({ store, count: DIFFERENTIATION_PLAN_COUNT, now: DIFFERENTIATION_PLAN_NOW });
  const overlap = overlapCount(plan.spotIds, recentIds);
  assert.equal(overlap, 0, `anti-repeat failed: ${overlap} recent tasks repeated`);
});

test('selector reads shared skillProfile and history from store', () => {
  for (const id of ['A', 'B', 'C']) {
    const store = buildPlayerStore(id);
    const profile = store.loadSkillProfile();
    const history = store.loadHistory();
    assert.ok(profile && profile.skills, `${id} missing skillProfile`);
    assert.ok(history.length > 20, `${id} missing simulated history`);
    const plan = generateDifferentiationPlan(store);
    assert.equal(plan.filled, DIFFERENTIATION_PLAN_COUNT);
    assert.ok(profile.weakest, `${id} weakest not set`);
  }
});

test('report: player differentiation summary', () => {
  const lines = [];
  for (const id of ['A', 'B', 'C']) {
    const r = REPORT[id];
    lines.push(`PROFILE ${id}:`);
    lines.push(`top weaknesses: ${r.weaknesses.map((w) => `${w.skill}(${w.score})`).join(', ')}`);
    lines.push(`task distribution: icmPush=${r.distribution.icmPush} postRiver=${r.distribution.postRiver} other=${r.distribution.other}`);
    lines.push(`20 selected task IDs: ${r.taskIds.join(', ')}`);
    lines.push('');
  }
  lines.push(`A vs B overlap: ${overlapCount(REPORT.A.taskIds, REPORT.B.taskIds)}`);
  lines.push(`A vs C overlap: ${overlapCount(REPORT.A.taskIds, REPORT.C.taskIds)}`);
  lines.push(`B vs C overlap: ${overlapCount(REPORT.B.taskIds, REPORT.C.taskIds)}`);
  console.log('\n' + lines.join('\n'));
  assert.ok(true);
});
