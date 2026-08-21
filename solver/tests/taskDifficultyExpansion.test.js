// Phase 9: task library difficulty expansion (levels 4–5).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildLibrary } from '../../task-context/library.js';
import { ADVANCED_TASKS } from '../../task-context/advancedTasks.js';
import { validateLibrary } from '../../task-context/validator.js';
import { DIFFICULTIES } from '../../task-context/schema.js';
import { contentFingerprint } from '../src/training/sessionDiversity.js';
import { deriveSkillTags } from '../src/training/planner.js';
import {
  resetTaskLibraryCache,
  getTaskPool,
  auditTaskMetadata
} from '../src/training/taskLibraryBridge.js';
import { selectSpots } from '../src/training/spotSelector.js';
import { buildSkillProfile } from '../src/training/skillProfile.js';
import { getTargetDifficulty } from '../src/training/adaptiveDifficulty.js';

const REPORT = {
  byDifficulty: null,
  skillCoverage: null,
  strongVsWeak: null
};

function skillProfileWithScores(scores, now = 1000) {
  const leakProfiles = Object.entries(scores).map(([skill, score]) => {
    const evLoss = score < 50 ? 0.6 : score < 70 ? 0.3 : 0.05;
    const concept = skill === 'icm' ? 'icm_pressure'
      : skill === 'bluffCatch' ? 'bluff_catch'
      : skill === 'preflop' ? 'open_range'
      : skill === 'river' ? 'value_bet'
      : 'cbet_frequency';
    const attempts = Array(6).fill(null).map((_, i) => ({
      evLossBb: evLoss,
      confidenceScore: 0.8,
      at: now + i
    }));
    return { concept, attempts };
  });
  return buildSkillProfile({ leakProfiles, now });
}

function averageDifficulty(spots = []) {
  if (!spots.length) return 0;
  return Math.round((spots.reduce((s, x) => s + (x.difficulty || 1), 0) / spots.length) * 100) / 100;
}

test('schema supports difficulty levels 1 through 5', () => {
  assert.deepEqual(DIFFICULTIES, [1, 2, 3, 4, 5]);
});

test('advanced task pack validates cleanly', () => {
  const res = validateLibrary(ADVANCED_TASKS);
  assert.equal(res.ok, true, res.errors.join('\n'));
  assert.equal(res.count, 24);
  assert.ok(ADVANCED_TASKS.filter((t) => t.difficulty === 4).length >= 10);
  assert.ok(ADVANCED_TASKS.filter((t) => t.difficulty === 5).length >= 10);
});

test('full library preserves existing tasks and adds levels 4–5', () => {
  resetTaskLibraryCache();
  const lib = buildLibrary();
  const res = validateLibrary(lib);
  assert.equal(res.ok, true, res.errors.join('\n'));
  assert.equal(lib.length, 131);
  assert.ok(lib.some((t) => t.id === 'PRE_RFI_BTN_A8S'), 'existing task preserved');
  assert.ok(lib.some((t) => t.id === 'ADV5_RIVER_BLOCKER_BLUFF'), 'advanced task included');

  const byDifficulty = {};
  for (const t of lib) byDifficulty[t.difficulty] = (byDifficulty[t.difficulty] || 0) + 1;
  REPORT.byDifficulty = byDifficulty;

  assert.ok(byDifficulty[4] >= 10, `level 4 count ${byDifficulty[4]}`);
  assert.ok(byDifficulty[5] >= 10, `level 5 count ${byDifficulty[5]}`);
  assert.equal(
    Object.values(byDifficulty).reduce((a, b) => a + b, 0),
    lib.length
  );
});

test('levels 4–5 cover multiple skills', () => {
  resetTaskLibraryCache();
  const lib = buildLibrary();
  const advanced = lib.filter((t) => t.difficulty >= 4);
  const skills = new Set();
  const streets = new Set();
  for (const task of advanced) {
    for (const tag of deriveSkillTags(task)) skills.add(tag);
    streets.add(task.street);
  }
  REPORT.skillCoverage = {
    skills: [...skills].sort(),
    streets: [...streets].sort(),
    count: advanced.length
  };

  assert.ok(skills.has('icm'), `skills: ${[...skills]}`);
  assert.ok(skills.has('river') || skills.has('bluffCatch'));
  assert.ok(skills.has('postflop') || skills.has('preflop'));
  assert.ok(skills.has('betSizing') || skills.has('bluffing'));
  assert.ok(streets.has('ПРЕФЛОП') && streets.has('РИВЕР'));
  assert.ok(advanced.length >= 20);
});

test('no duplicate ids or content fingerprints', () => {
  resetTaskLibraryCache();
  const lib = buildLibrary();
  const ids = new Set();
  const fps = new Map();
  for (const task of lib) {
    assert.ok(!ids.has(task.id), `duplicate id ${task.id}`);
    ids.add(task.id);
    const fp = contentFingerprint(task);
    assert.ok(!fps.has(fp), `fingerprint collision ${task.id} vs ${fps.get(fp)}`);
    fps.set(fp, task.id);
  }
});

test('strong profile target ~5 receives harder tasks than weak profile target ~2', () => {
  resetTaskLibraryCache();
  const pool = getTaskPool();

  const strong = skillProfileWithScores({
    preflop: 92, postflop: 90, icm: 88, river: 91, bluffCatch: 89, betSizing: 90
  });
  const weak = skillProfileWithScores({
    icm: 28, preflop: 35, postflop: 40, river: 38, bluffCatch: 32
  });

  const strongTarget = getTargetDifficulty(strong, 'preflop').target;
  const weakTarget = getTargetDifficulty(weak, 'icm').target;
  assert.ok(strongTarget >= 4.3, `strong target ${strongTarget}`);
  assert.ok(weakTarget <= 2.5, `weak target ${weakTarget}`);

  let strongAvgSum = 0;
  let weakAvgSum = 0;
  let strongHardSum = 0;
  let weakHardSum = 0;
  const runs = 25;
  for (let i = 0; i < runs; i++) {
    const rng = () => ((i + 1) * 0.041) % 1;
    const strongPlan = selectSpots({ pool, skillProfile: strong, count: 20, rng });
    const weakPlan = selectSpots({ pool, skillProfile: weak, count: 20, rng: () => 1 - rng() });
    const strongSpots = strongPlan.selected.map((id) => pool.find((s) => s.id === id));
    const weakSpots = weakPlan.selected.map((id) => pool.find((s) => s.id === id));
    strongAvgSum += averageDifficulty(strongSpots);
    weakAvgSum += averageDifficulty(weakSpots);
    strongHardSum += strongSpots.filter((s) => s.difficulty >= 4).length;
    weakHardSum += weakSpots.filter((s) => s.difficulty >= 4).length;
  }

  const strongAvg = Math.round((strongAvgSum / runs) * 100) / 100;
  const weakAvg = Math.round((weakAvgSum / runs) * 100) / 100;
  const strongHard = Math.round((strongHardSum / runs) * 10) / 10;
  const weakHard = Math.round((weakHardSum / runs) * 10) / 10;

  REPORT.strongVsWeak = {
    strongTarget,
    weakTarget,
    strongAvg,
    weakAvg,
    strongHard,
    weakHard
  };

  assert.ok(strongHard > weakHard + 2, `hard tasks strong ${strongHard} vs weak ${weakHard}`);
  assert.ok(strongAvg >= weakAvg + 0.4, `strong avg ${strongAvg} vs weak ${weakAvg}`);
});

test('production selector: weak / average / strong difficulty separation', () => {
  resetTaskLibraryCache();
  const pool = getTaskPool();

  function directProfile(scores) {
    const entries = {};
    let total = 0;
    let count = 0;
    for (const [skill, score] of Object.entries(scores)) {
      entries[skill] = {
        skill,
        score,
        confidence: score >= 80 ? 0.75 : 0.5,
        sampleSize: score >= 80 ? 12 : 8
      };
      total += score;
      count++;
    }
    const ranked = Object.values(entries).sort((a, b) => a.score - b.score);
    return {
      skills: entries,
      overall: Math.round(total / count),
      confidence: 0.75,
      sampleSize: count * 10,
      weakest: ranked[0]
    };
  }

  const profiles = {
    weak: directProfile({ icm: 28, preflop: 35, postflop: 40, river: 38, bluffCatch: 32 }),
    average: directProfile({ icm: 55, preflop: 58, postflop: 52, river: 54, bluffCatch: 50 }),
    strong: directProfile({ preflop: 92, postflop: 90, icm: 88, river: 91, bluffCatch: 89, betSizing: 90 })
  };

  const report = {};
  for (const [name, prof] of Object.entries(profiles)) {
    let avgSum = 0;
    let hardSum = 0;
    const runs = 20;
    for (let i = 0; i < runs; i++) {
      const plan = selectSpots({ pool, skillProfile: prof, count: 20, rng: () => ((i + 1) * 0.043) % 1 });
      const spots = plan.selected.map((id) => pool.find((s) => s.id === id));
      avgSum += averageDifficulty(spots);
      hardSum += spots.filter((s) => s.difficulty >= 4).length;
    }
    report[name] = {
      target: getTargetDifficulty(prof, prof.weakest.skill).target,
      avg: Math.round((avgSum / runs) * 100) / 100,
      hardRate: Math.round((hardSum / runs) * 10) / 10
    };
  }

  REPORT.productionSelector = report;
  assert.ok(report.strong.avg >= report.weak.avg + 0.4, `strong ${report.strong.avg} vs weak ${report.weak.avg}`);
  assert.ok(report.strong.hardRate >= report.weak.hardRate + 2, `strong hard ${report.strong.hardRate} vs weak ${report.weak.hardRate}`);
  assert.ok(report.strong.hardRate >= 6, `strong hard rate ${report.strong.hardRate}`);
});

test('metadata audit reflects expanded library', () => {
  resetTaskLibraryCache();
  const audit = auditTaskMetadata();
  assert.equal(audit.total, 131);
  assert.ok(audit.fullyUsable >= 124);
});

test('report: task difficulty expansion summary', () => {
  assert.ok(REPORT.byDifficulty && REPORT.skillCoverage && REPORT.strongVsWeak);
  console.log('\nTASKS BY DIFFICULTY:', JSON.stringify(REPORT.byDifficulty));
  console.log('LEVEL 4–5 SKILL COVERAGE:', REPORT.skillCoverage.skills.join(', '));
  console.log('STRONG vs WEAK:', JSON.stringify(REPORT.strongVsWeak));
  if (REPORT.productionSelector) {
    console.log('PRODUCTION SELECTOR:', JSON.stringify(REPORT.productionSelector));
  }
});
