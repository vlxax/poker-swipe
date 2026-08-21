// Phase 8: difficulty calibration regression tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getTaskPool } from '../src/training/taskLibraryBridge.js';
import { buildSkillProfile } from '../src/training/skillProfile.js';
import { createTrainingStore } from '../src/training/trainingStore.js';
import { buildProfileDailyPlan, recordTrainingResult } from '../src/training/personalizedTraining.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { selectSpots } from '../src/training/spotSelector.js';
import { getTargetDifficulty } from '../src/training/adaptiveDifficulty.js';
import {
  buildDifferentiationReport,
  buildPlayerStore,
  alignMasteryReviewsBeforePlan,
  DIFFERENTIATION_PLAN_COUNT,
  DIFFERENTIATION_PLAN_NOW
} from '../src/training/playerDifferentiationFixtures.js';
import {
  averageSelectedDifficulty,
  averageSpotTargetDifficulty,
  difficultyCalibrationBonus,
  difficultyProximityToTarget,
  libraryMaxDifficulty,
  pickFromCalibratedPool,
  reviewDifficultyProximity
} from '../src/training/difficultyCalibration.js';
import {
  applySkillMasteryTraining,
  buildSkillMasteryStates,
  DAY_MS
} from '../src/training/skillMastery.js';

const POOL = getTaskPool();
const POOL_MAX = libraryMaxDifficulty(POOL);
const rng = () => 0.37;

const REPORT = {
  A: null,
  B: null,
  C: null
};

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
}

function skillProfileWithScores(scores, now = 1000) {
  const leakProfiles = Object.entries(scores).map(([skill, score]) => {
    const evLoss = score < 50 ? 0.6 : score < 70 ? 0.3 : 0.05;
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

function recentForSkill(skill, grades) {
  return grades.map((grade) => ({
    grade,
    skillTags: [skill],
    nearOptimal: grade === 'EXCELLENT' || grade === 'GOOD'
  }));
}

function planMetrics(store, count = 20, now = DIFFERENTIATION_PLAN_NOW) {
  alignMasteryReviewsBeforePlan(store, now);
  const plan = buildProfileDailyPlan({ store, count, now });
  const profile = store.loadSkillProfile();
  const spots = plan.spots || [];
  const recent = (store.loadHistory() || []).map((h) => ({
    grade: h.grade,
    skillTags: h.skillTags || []
  }));
  return {
    plan,
    profile,
    spots,
    avgSelected: averageSelectedDifficulty(spots),
    avgTarget: averageSpotTargetDifficulty(spots, profile, recent, { poolMax: POOL_MAX }),
    overallTarget: getTargetDifficulty(profile, profile.weakest?.skill || 'preflop', { recentResults: recent }).target
  };
}

function weakSkillShare(spots, profile) {
  const scored = Object.values(profile.skills || {}).filter((s) => s.score != null);
  const sorted = scored.map((s) => s.score).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 50;
  let weak = 0;
  for (const spot of spots) {
    const tagScores = (spot.skillTags || [])
      .map((t) => profile.skills[t]?.score)
      .filter((x) => x != null);
    if (!tagScores.length) continue;
    if (Math.min(...tagScores) <= median) weak += 1;
  }
  return weak / Math.max(1, spots.length);
}

test('library ceiling maps high targets to hardest available tasks', () => {
  const info = getTargetDifficulty(skillProfileWithScores({ preflop: 95 }), 'preflop');
  assert.ok(info.target >= 4.5);
  const hard = { difficulty: 3 };
  const easy = { difficulty: 1 };
  assert.ok(
    difficultyProximityToTarget(hard, info, { poolMax: 3 })
      > difficultyProximityToTarget(easy, info, { poolMax: 3 })
  );
});

test('weak beginner prefers easier tasks within weak-skill relevance', () => {
  const profile = skillProfileWithScores({ icm: 28, preflop: 35, postflop: 40 });
  const res = selectSpots({ pool: POOL, skillProfile: profile, count: 15, rng });
  const selected = res.selected.map((id) => POOL.find((s) => s.id === id));
  const avg = averageSelectedDifficulty(selected);
  const target = getTargetDifficulty(profile, profile.weakest.skill).target;
  assert.ok(avg <= target + 1.2, `beginner avg ${avg} vs target ${target}`);
  assert.ok(avg <= 2.2, `beginner avg too high: ${avg}`);
});

test('strong player prefers harder tasks than weak profiles', () => {
  const weak = buildDifferentiationReport('A');
  const strong = buildDifferentiationReport('C');
  REPORT.A = {
    target: averageSpotTargetDifficulty(weak.plan.spots, weak.skillProfile, [], { poolMax: POOL_MAX }),
    selected: averageSelectedDifficulty(weak.plan.spots)
  };
  REPORT.C = {
    target: averageSpotTargetDifficulty(strong.plan.spots, strong.skillProfile, [], { poolMax: POOL_MAX }),
    selected: averageSelectedDifficulty(strong.plan.spots)
  };

  assert.ok(REPORT.C.selected > REPORT.A.selected + 0.1,
    `strong ${REPORT.C.selected} should exceed weak ${REPORT.A.selected}`);
  assert.ok(REPORT.C.selected >= 1.8, `strong avg ${REPORT.C.selected} (library max difficulty is ${POOL_MAX})`);
});

test('mixed-skill player tracks intermediate target', () => {
  const profile = skillProfileWithScores({ preflop: 55, postflop: 58, icm: 52, river: 54 });
  const res = selectSpots({ pool: POOL, skillProfile: profile, count: 15, rng });
  const selected = res.selected.map((id) => POOL.find((s) => s.id === id));
  const avg = averageSelectedDifficulty(selected);
  const target = averageSpotTargetDifficulty(selected, profile, [], { poolMax: POOL_MAX });
  assert.ok(avg >= 1.5 && avg <= 2.8, `mixed avg ${avg}`);
  assert.ok(Math.abs(avg - target) <= 1.1, `mixed gap ${avg} vs ${target}`);
});

test('improving player nudges selection upward without sudden jumps', () => {
  const profile = skillProfileWithScores({ postflop: 42 });
  const before = selectSpots({
    pool: POOL,
    skillProfile: profile,
    recentResults: recentForSkill('postflop', Array(2).fill('GOOD')),
    count: 12,
    rng
  });
  const after = selectSpots({
    pool: POOL,
    skillProfile: profile,
    recentResults: recentForSkill('postflop', Array(10).fill('EXCELLENT')),
    count: 12,
    rng: () => 0.42
  });
  const beforeAvg = averageSelectedDifficulty(before.selected.map((id) => POOL.find((s) => s.id === id)));
  const afterAvg = averageSelectedDifficulty(after.selected.map((id) => POOL.find((s) => s.id === id)));
  assert.ok(afterAvg >= beforeAvg, `improving ${afterAvg} vs before ${beforeAvg}`);
  assert.ok(afterAvg - beforeAvg <= 0.8, `jump too large ${afterAvg - beforeAvg}`);
});

test('struggling player keeps easier tasks while weak skills dominate topics', () => {
  const store = buildPlayerStore('B');
  const metrics = planMetrics(store);
  assert.ok(metrics.avgSelected <= metrics.avgTarget + 0.8,
    `struggling selected ${metrics.avgSelected} vs target ${metrics.avgTarget}`);
  assert.ok(weakSkillShare(metrics.spots, metrics.profile) >= 0.55,
    'weak skills should still dominate topic selection');
});

test('weak skills still dominate topic selection after calibration', () => {
  const weakA = buildDifferentiationReport('A');
  const weakB = buildDifferentiationReport('B');
  assert.ok(weakA.distribution.icmPush > weakB.distribution.icmPush);
  assert.ok(weakB.distribution.postRiver > weakA.distribution.postRiver);
  assert.ok(weakSkillShare(weakA.plan.spots, weakA.skillProfile) >= 0.5);
  assert.ok(weakSkillShare(weakB.plan.spots, weakB.skillProfile) >= 0.5);
});

test('review scheduling still surfaces due skills with easier review tasks allowed', () => {
  const storage = memoryStorage();
  const store = createTrainingStore({ storage, prefix: 'diff_cal_review_' });
  const profile = skillProfileWithScores({ river: 88, preflop: 85, postflop: 84 });
  store.saveSkillProfile(profile);
  store.savePersonalizationSeed('diff-cal-review');

  let mastery = {};
  const trained = applySkillMasteryTraining({
    masteryStore: mastery,
    skill: 'river',
    entry: profile.skills.river,
    recentResults: recentForSkill('river', Array(10).fill('EXCELLENT')),
    grade: 'EXCELLENT',
    now: DIFFERENTIATION_PLAN_NOW
  });
  mastery = trained.store;
  mastery.river.state = 'MASTERED';
  mastery.river.nextReviewAt = DIFFERENTIATION_PLAN_NOW - DAY_MS;
  store.saveSkillMastery(mastery);

  const states = buildSkillMasteryStates({
    skillProfile: profile,
    masteryStore: store.loadSkillMastery(),
    recentResults: recentForSkill('river', Array(10).fill('EXCELLENT')),
    now: DIFFERENTIATION_PLAN_NOW + 1
  });
  assert.equal(states.river.state, 'REVIEW_DUE');

  const riverTasks = POOL.filter((t) => (t.skillTags || []).includes('river'));
  const easy = riverTasks.find((t) => t.difficulty === 1) || { difficulty: 1 };
  const hard = riverTasks.find((t) => t.difficulty === 3) || { difficulty: 3 };
  const info = getTargetDifficulty(profile, 'river');
  assert.ok(reviewDifficultyProximity(easy, info, { poolMax: POOL_MAX })
    >= reviewDifficultyProximity(hard, info, { poolMax: POOL_MAX }));

  const plan = buildProfileDailyPlan({ store, count: 15, now: DIFFERENTIATION_PLAN_NOW + 2 });
  const riverHits = (plan.spots || []).filter((s) => (s.skillTags || []).includes('river')).length;
  assert.ok(riverHits >= 1, `expected review river hits, got ${riverHits}`);
});

test('pickFromCalibratedPool prefers closer difficulty within relevance band', () => {
  const profile = skillProfileWithScores({ preflop: 92 });
  const ctx = { skillProfile: profile, recentResults: [], skillMasteryStates: {}, poolMax: 3 };
  const hard = POOL.find((s) => s.difficulty === 3 && (s.skillTags || []).includes('preflop'));
  const easy = POOL.find((s) => s.difficulty === 1 && (s.skillTags || []).includes('preflop'));
  assert.ok(hard && easy);
  const pool = [
    {
      spot: easy,
      relevanceScore: 6,
      diffBonus: difficultyCalibrationBonus(easy, profile, [], { poolMax: 3 }),
      ctx,
      slotKind: 'primary_weakness'
    },
    {
      spot: hard,
      relevanceScore: 5.8,
      diffBonus: difficultyCalibrationBonus(hard, profile, [], { poolMax: 3 }),
      ctx,
      slotKind: 'primary_weakness'
    }
  ];
  const picks = Array.from({ length: 20 }, (_, i) => pickFromCalibratedPool(pool, () => (i + 1) / 21, 3).spot.id);
  const hardCount = picks.filter((id) => id === hard.id).length;
  assert.ok(hardCount >= 12, `expected hard preference, got ${hardCount}/20`);
});

test('anti-repeat and personalization remain intact with calibration', () => {
  const store = buildPlayerStore('A');
  const first = buildProfileDailyPlan({ store, count: DIFFERENTIATION_PLAN_COUNT, now: DIFFERENTIATION_PLAN_NOW });
  let now = DIFFERENTIATION_PLAN_NOW;
  for (const id of first.spotIds.slice(0, 8)) {
    const task = POOL.find((s) => s.id === id);
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'GOOD', evLossBb: 0.05, now });
    now += 1;
  }
  const second = buildProfileDailyPlan({ store, count: DIFFERENTIATION_PLAN_COUNT, now: now + 1000 });
  const overlap = first.spotIds.slice(0, 8).filter((id) => second.spotIds.includes(id)).length;
  assert.ok(overlap <= 2, `anti-repeat overlap ${overlap}`);
  assert.equal(second.personalized, true);
});

test('report: profile target vs selected average', () => {
  const B = buildDifferentiationReport('B');
  REPORT.B = {
    target: averageSpotTargetDifficulty(B.plan.spots, B.skillProfile, [], { poolMax: POOL_MAX }),
    selected: averageSelectedDifficulty(B.plan.spots)
  };
  assert.ok(REPORT.A && REPORT.B && REPORT.C);
  console.log('\nPROFILE A target:', REPORT.A.target, 'selected avg:', REPORT.A.selected);
  console.log('PROFILE B target:', REPORT.B.target, 'selected avg:', REPORT.B.selected);
  console.log('PROFILE C target:', REPORT.C.target, 'selected avg:', REPORT.C.selected);
});
