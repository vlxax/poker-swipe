// Phase 5: per-skill adaptive difficulty.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getTargetDifficulty,
  getSpotTargetDifficulty,
  scoreToBaseDifficulty,
  pickRelevantSkillForSpot,
  spotDifficultyScore
} from '../src/training/adaptiveDifficulty.js';
import { normalizeSpot, selectSpots } from '../src/training/spotSelector.js';
import { poolFromLibrary } from '../src/training/planner.js';

function skillProfile(skills) {
  const entries = {};
  let total = 0;
  let count = 0;
  for (const [skill, score] of Object.entries(skills)) {
    entries[skill] = {
      skill,
      score,
      confidence: score >= 80 ? 0.75 : score <= 40 ? 0.25 : 0.5,
      sampleSize: score >= 80 ? 12 : score <= 40 ? 4 : 8
    };
    total += score;
    count++;
  }
  return {
    skills: entries,
    overall: Math.round(total / count),
    confidence: 0.5,
    sampleSize: count * 8
  };
}

function recentForSkill(skill, grades) {
  return grades.map((grade) => ({ grade, skillTags: [skill], nearOptimal: grade === 'EXCELLENT' || grade === 'GOOD' }));
}

const REPORT = {
  profileA: null,
  profileB: null,
  progression: null
};

test('scoreToBaseDifficulty maps skill scores to 1..5 bands', () => {
  assert.ok(scoreToBaseDifficulty(85) >= 4.3);
  assert.ok(scoreToBaseDifficulty(45) >= 2.5 && scoreToBaseDifficulty(45) <= 3.2);
  assert.ok(scoreToBaseDifficulty(25) >= 1.8 && scoreToBaseDifficulty(25) <= 2.2);
  assert.ok(scoreToBaseDifficulty(90) >= 4.5);
});

test('getTargetDifficulty uses confidence to widen the band', () => {
  const tight = getTargetDifficulty(skillProfile({ river: 80 }), 'river');
  const wide = getTargetDifficulty({
    skills: { river: { skill: 'river', score: 80, confidence: 0.1, sampleSize: 2 } }
  }, 'river');
  assert.ok(tight.max - tight.min < wide.max - wide.min, 'low confidence should widen range');
  assert.ok(tight.confidence > wide.confidence || tight.sampleSize > wide.sampleSize);
});

test('persona A: strong preflop, weak ICM', () => {
  const profile = skillProfile({ preflop: 90, icm: 30 });
  const preflop = getTargetDifficulty(profile, 'preflop');
  const icm = getTargetDifficulty(profile, 'icm');
  REPORT.profileA = { preflop, icm };

  assert.ok(preflop.target >= 4, `preflop target ${preflop.target}`);
  assert.ok(icm.target <= 2.5, `icm target ${icm.target}`);
  assert.ok(preflop.target > icm.target + 1.5);
});

test('persona B: weak preflop, strong ICM', () => {
  const profile = skillProfile({ preflop: 35, icm: 80 });
  const preflop = getTargetDifficulty(profile, 'preflop');
  const icm = getTargetDifficulty(profile, 'icm');
  REPORT.profileB = { preflop, icm };

  assert.ok(preflop.target <= 2.8, `preflop target ${preflop.target}`);
  assert.ok(icm.target >= 4, `icm target ${icm.target}`);
  assert.ok(icm.target > preflop.target + 1);
});

test('progression: 10 good answers raise target, 8 poor answers lower gradually', () => {
  const profile = skillProfile({ postflop: 40 });
  const start = getTargetDifficulty(profile, 'postflop');
  assert.ok(start.target >= 2.2 && start.target <= 3.2, `start target ${start.target}`);

  const afterGood = getTargetDifficulty(profile, 'postflop', {
    recentResults: recentForSkill('postflop', Array(10).fill('EXCELLENT'))
  });
  assert.ok(afterGood.target > start.target, `good ${afterGood.target} vs start ${start.target}`);

  const afterBad = getTargetDifficulty(profile, 'postflop', {
    recentResults: [
      ...recentForSkill('postflop', Array(10).fill('EXCELLENT')),
      ...recentForSkill('postflop', Array(8).fill('MISTAKE'))
    ]
  });
  assert.ok(afterBad.target < afterGood.target, `bad ${afterBad.target} vs good ${afterGood.target}`);
  assert.ok(afterBad.target >= start.target - 0.6, 'bad streak should reduce gradually, not collapse');

  REPORT.progression = { start: start.target, afterGood: afterGood.target, afterBad: afterBad.target };
});

test('single answer does not swing target difficulty', () => {
  const profile = skillProfile({ river: 50 });
  const base = getTargetDifficulty(profile, 'river').target;
  const oneGood = getTargetDifficulty(profile, 'river', {
    recentResults: recentForSkill('river', ['EXCELLENT'])
  }).target;
  const oneBad = getTargetDifficulty(profile, 'river', {
    recentResults: recentForSkill('river', ['MISTAKE'])
  }).target;
  assert.equal(oneGood, base);
  assert.equal(oneBad, base);
});

test('multi-skill spot uses weakest relevant skill evidence', () => {
  const profile = skillProfile({ preflop: 90, icm: 25 });
  const spot = normalizeSpot({
    id: 'x',
    concept: 'bubble steal',
    difficulty: 3,
    skillTags: ['preflop', 'icm', 'shortStack']
  });
  const skill = pickRelevantSkillForSpot(spot, profile);
  assert.equal(skill, 'icm');
  const target = getSpotTargetDifficulty(spot, profile);
  assert.ok(target <= 2.5, `spot target ${target}`);
});

test('selector prefers per-skill difficulty bands', () => {
  const profile = skillProfile({ preflop: 90, icm: 30 });
  const tasks = [
    { id: 'p5', concept: 'RFI BTN', street: 'ПРЕФЛОП', difficulty: 5, tags: ['префлоп'], heroStack: 30, position: 'BTN', options: ['РЕЙЗ', 'ФОЛД'], correct: 'РЕЙЗ' },
    { id: 'p2', concept: 'RFI BTN', street: 'ПРЕФЛОП', difficulty: 2, tags: ['префлоп'], heroStack: 30, position: 'BTN', options: ['РЕЙЗ', 'ФОЛД'], correct: 'РЕЙЗ' },
    { id: 'i1', concept: 'bubble icm', street: 'ПРЕФЛОП', difficulty: 1, tags: ['icm', 'баббл'], heroStack: 8, position: 'BTN', stage: 'БАББЛ', options: ['РЕЙЗ', 'ФОЛД'], correct: 'РЕЙЗ' },
    { id: 'i4', concept: 'bubble icm', street: 'ПРЕФЛОП', difficulty: 4, tags: ['icm', 'баббл'], heroStack: 8, position: 'BTN', stage: 'БАББЛ', options: ['РЕЙЗ', 'ФОЛД'], correct: 'РЕЙЗ' },
    { id: 'm1', concept: 'BB DEF', street: 'ПРЕФЛОП', difficulty: 3, tags: ['префлоп'], heroStack: 40, position: 'BB', options: ['КОЛЛ', 'ФОЛД'], correct: 'КОЛЛ' },
    { id: 'm2', concept: 'THIN VALUE', street: 'РИВЕР', difficulty: 3, tags: ['ривер'], heroStack: 30, position: 'CO', options: ['ЧЕК', 'СТАВКА'], correct: 'СТАВКА' }
  ];
  const pool = poolFromLibrary(tasks);
  const preflopHard = pool.find((s) => s.id === 'p5');
  const icmEasy = pool.find((s) => s.id === 'i1');
  const icmHard = pool.find((s) => s.id === 'i4');
  const preflopFit = spotDifficultyScore(preflopHard, profile, []);
  const icmEasyFit = spotDifficultyScore(icmEasy, profile, []);
  const icmHardFit = spotDifficultyScore(icmHard, profile, []);
  assert.ok(preflopFit >= 0.5, `preflop hard fit ${preflopFit}`);
  assert.ok(icmEasyFit >= icmHardFit, `icm easy ${icmEasyFit} vs hard ${icmHardFit}`);

  const res = selectSpots({
    pool,
    skillProfile: profile,
    recentResults: [],
    count: 4,
    rng: () => 0.1
  });
  assert.equal(res.ok, true);
  const selected = res.selected.map((id) => pool.find((s) => s.id === id));
  const preflopPicks = selected.filter((s) => (s.skillTags || []).includes('preflop') && !s.skillTags.includes('icm'));
  const icmPicks = selected.filter((s) => (s.skillTags || []).includes('icm'));
  if (preflopPicks.length) {
    const avgPref = preflopPicks.reduce((s, x) => s + x.difficulty, 0) / preflopPicks.length;
    assert.ok(avgPref >= 3.5, `avg preflop diff ${avgPref}`);
  }
  if (icmPicks.length) {
    const avgIcm = icmPicks.reduce((s, x) => s + x.difficulty, 0) / icmPicks.length;
    assert.ok(avgIcm <= 2.5, `avg icm diff ${avgIcm}`);
  }
});

test('weak skill prefers include occasional harder challenge', () => {
  const profile = skillProfile({ icm: 25 });
  const info = getTargetDifficulty(profile, 'icm');
  assert.ok(info.prefers.primary.some((d) => d <= 2));
  assert.ok(info.prefers.challenge.some((d) => d >= info.prefers.primary[info.prefers.primary.length - 1]));
});

test('strong skill prefers include maintenance difficulty', () => {
  const profile = skillProfile({ preflop: 92 });
  const info = getTargetDifficulty(profile, 'preflop');
  assert.ok(info.prefers.primary.some((d) => d >= 4));
  assert.ok(info.prefers.maintenance.some((d) => d < info.prefers.primary[0]));
});

test('report: adaptive difficulty summary', () => {
  assert.ok(REPORT.profileA && REPORT.profileB && REPORT.progression);
  console.log('\nPROFILE A preflop target:', REPORT.profileA.preflop.target);
  console.log('PROFILE A ICM target:', REPORT.profileA.icm.target);
  console.log('PROFILE B preflop target:', REPORT.profileB.preflop.target);
  console.log('PROFILE B ICM target:', REPORT.profileB.icm.target);
  console.log('AFTER 10 GOOD target before:', REPORT.progression.start, 'after:', REPORT.progression.afterGood);
  console.log('AFTER 8 BAD target before:', REPORT.progression.afterGood, 'after:', REPORT.progression.afterBad);
});
