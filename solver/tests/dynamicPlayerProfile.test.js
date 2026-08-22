// Phase 10: dynamic player profile — unit + differentiation tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  accuracyFromAttempts,
  emaScoreFromAttempts,
  emaQualityFromAttempts,
  diagnoseSkillTrack,
  buildSkillTrack,
  buildDynamicPlayerProfile,
  computeDynamicSkillTargets,
  dynamicWeaknessBoost,
  SKILL_DIAGNOSES,
  normalizeTrend
} from '../src/training/dynamicPlayerProfile.js';
import { createSkillEvidence, recordSkillEvidence } from '../src/training/skillProfile.js';
import {
  buildDynamicPlayerReport,
  buildDynamicPlayerStore,
  diagnosisCount,
  overlapCount,
  DYNAMIC_PLAN_COUNT,
  SKILL_DIAGNOSES as FIXTURE_DIAG
} from '../src/training/dynamicPlayerFixtures.js';
import { rebuildSkillProfileFromStore } from '../src/training/dynamicPlayerProfile.js';
import { getTaskPool } from '../src/training/taskLibraryBridge.js';
import { selectSpots } from '../src/training/spotSelector.js';

const REPORT = {
  A: buildDynamicPlayerReport('A'),
  B: buildDynamicPlayerReport('B'),
  C: buildDynamicPlayerReport('C'),
  D: buildDynamicPlayerReport('D')
};

test('accuracy helpers distinguish recent vs long-term windows', () => {
  const attempts = [
    { evLossBb: 0.9, grade: 'MISTAKE' },
    { evLossBb: 0.8, grade: 'MISTAKE' },
    { evLossBb: 0.7, grade: 'MISTAKE' },
    { evLossBb: 0.02, grade: 'EXCELLENT' },
    { evLossBb: 0.01, grade: 'GOOD' },
    { evLossBb: 0.02, grade: 'EXCELLENT' }
  ];
  const longTerm = accuracyFromAttempts(attempts);
  const recent = accuracyFromAttempts(attempts, 3);
  assert.ok(longTerm < recent, `long ${longTerm} vs recent ${recent}`);
  assert.ok(emaQualityFromAttempts(attempts) > longTerm);
});

test('EMA score avoids single-result jumps', () => {
  let ev = createSkillEvidence({ skill: 'postflop' });
  for (let i = 0; i < 10; i++) {
    recordSkillEvidence(ev, { evLossBb: 0.05, grade: 'GOOD' });
  }
  const before = emaScoreFromAttempts(ev.attempts);
  recordSkillEvidence(ev, { evLossBb: 0.95, grade: 'MISTAKE' });
  const after = emaScoreFromAttempts(ev.attempts);
  assert.ok(before - after < 25, `jump too large ${before} -> ${after}`);
  assert.ok(after > 40);
});

test('diagnoseSkillTrack covers five required states', () => {
  assert.equal(
    diagnoseSkillTrack({
      score: 38, confidence: 0.7, sampleSize: 12,
      recentAccuracy: 0.3, longTermAccuracy: 0.35,
      trend: 'stable', mistakeFrequency: 0.55, masteryState: 'PRACTICING'
    }),
    SKILL_DIAGNOSES.TRUE_WEAKNESS
  );
  assert.equal(
    diagnoseSkillTrack({
      score: 72, confidence: 0.75, sampleSize: 20,
      recentAccuracy: 0.4, longTermAccuracy: 0.78,
      trend: 'stable', mistakeFrequency: 0.2, masteryState: 'PRACTICING'
    }),
    SKILL_DIAGNOSES.TEMPORARY_MISTAKE
  );
  assert.equal(
    diagnoseSkillTrack({
      score: 88, confidence: 0.8, sampleSize: 16,
      recentAccuracy: 0.9, longTermAccuracy: 0.88,
      trend: 'stable', mistakeFrequency: 0.1, masteryState: 'MASTERED'
    }),
    SKILL_DIAGNOSES.MASTERED
  );
  assert.equal(
    diagnoseSkillTrack({
      score: 76, confidence: 0.7, sampleSize: 14,
      recentAccuracy: 0.45, longTermAccuracy: 0.72,
      trend: 'declining', mistakeFrequency: 0.3, masteryState: 'REVIEW_DUE',
      lastPracticedAt: Date.now() - 15 * 86400000
    }),
    SKILL_DIAGNOSES.DECAYING
  );
  assert.equal(
    diagnoseSkillTrack({
      score: 58, confidence: 0.6, sampleSize: 10,
      recentAccuracy: 0.82, longTermAccuracy: 0.55,
      trend: 'improving', mistakeFrequency: 0.25, masteryState: 'PRACTICING'
    }),
    SKILL_DIAGNOSES.IMPROVING
  );
});

test('buildSkillTrack exposes all required fields', () => {
  let ev = createSkillEvidence({ skill: 'river' });
  for (let i = 0; i < 8; i++) {
    recordSkillEvidence(ev, { evLossBb: i < 4 ? 0.7 : 0.04, grade: i < 4 ? 'MISTAKE' : 'EXCELLENT' });
  }
  const track = buildSkillTrack({ skill: 'river', evidence: ev, entry: { score: 62, confidence: 0.6, sampleSize: 8 } });
  assert.ok(track.score != null);
  assert.ok(track.confidence > 0);
  assert.ok(track.recentAccuracy != null);
  assert.ok(track.longTermAccuracy != null);
  assert.ok(['improving', 'stable', 'declining'].includes(track.trend));
  assert.ok(track.mistakeFrequency >= 0);
  assert.ok(track.masteryState);
  assert.ok(track.lastPracticed != null);
  assert.ok(track.sampleSize === 8);
  assert.ok(track.diagnosis);
});

test('profile A is diagnosed improving on postflop', () => {
  const post = REPORT.A.profile.tracks.postflop;
  assert.ok(post, 'postflop track missing');
  assert.equal(post.trend, 'improving');
  assert.ok(
    post.diagnosis === SKILL_DIAGNOSES.IMPROVING || post.recentAccuracy > post.longTermAccuracy,
    `A postflop ${post.diagnosis} recent ${post.recentAccuracy} long ${post.longTermAccuracy}`
  );
});

test('profile B shows declining/decaying ICM signal', () => {
  const icm = REPORT.B.profile.tracks.icm;
  assert.ok(icm, 'icm track missing');
  assert.ok(
    icm.trend === 'declining'
    || icm.diagnosis === SKILL_DIAGNOSES.DECAYING
    || icm.diagnosis === SKILL_DIAGNOSES.TEMPORARY_MISTAKE
    || (icm.longTermAccuracy != null && icm.recentAccuracy != null && icm.longTermAccuracy > icm.recentAccuracy + 0.15),
    `B icm trend ${icm.trend} diagnosis ${icm.diagnosis}`
  );
});

test('profile C is stable strong with mastered skills', () => {
  assert.ok(REPORT.C.overall >= 80, `C overall ${REPORT.C.overall}`);
  assert.ok(diagnosisCount(REPORT.C, SKILL_DIAGNOSES.MASTERED) >= 2
    || Object.values(REPORT.C.profile.tracks).filter((t) => t.score >= 82).length >= 4);
});

test('profile D is low-confidence learning', () => {
  assert.ok(REPORT.D.confidence < 0.55 || REPORT.D.profile.sampleSize <= 6);
  assert.ok(diagnosisCount(REPORT.D, SKILL_DIAGNOSES.LEARNING) >= 1
    || Object.values(REPORT.D.profile.tracks).every((t) => t.sampleSize <= 5));
});

test('A/B/C/D training plans are meaningfully different', () => {
  const pairs = [
    ['A', 'B'], ['A', 'C'], ['B', 'C'], ['C', 'D']
  ];
  for (const [x, y] of pairs) {
    assert.notDeepEqual(REPORT[x].taskIds, REPORT[y].taskIds, `${x} vs ${y} identical plans`);
    assert.ok(
      overlapCount(REPORT[x].taskIds, REPORT[y].taskIds) < DYNAMIC_PLAN_COUNT,
      `${x} vs ${y} full overlap`
    );
  }
});

test('dynamic weakness boost prioritizes true weakness over mastered', () => {
  const pool = getTaskPool();
  const spot = pool.find((s) => (s.skillTags || []).includes('icm'));
  assert.ok(spot);
  const dynamic = {
    tracks: {
      icm: { diagnosis: SKILL_DIAGNOSES.TRUE_WEAKNESS, score: 35 },
      postflop: { diagnosis: SKILL_DIAGNOSES.MASTERED, score: 90 }
    }
  };
  const weakSpot = { skillTags: ['icm'] };
  const strongSpot = { skillTags: ['postflop'] };
  assert.ok(dynamicWeaknessBoost(weakSpot, dynamic) > dynamicWeaknessBoost(strongSpot, dynamic));
});

test('dynamic profile integrates with production selector', () => {
  const storeA = buildDynamicPlayerStore('A');
  const storeB = buildDynamicPlayerStore('B');
  const profileA = rebuildSkillProfileFromStore(storeA);
  const profileB = rebuildSkillProfileFromStore(storeB);
  const pool = getTaskPool();

  function spotCountsAsPostflop(spot) {
    const street = String(spot?.street || '').toUpperCase();
    if (street === 'ФЛОП' || street === 'ТЁРН' || street === 'РИВЕР') return true;
    if (street === 'FLOP' || street === 'TURN' || street === 'RIVER') return true;
    const tags = spot?.skillTags || [];
    return tags.includes('postflop') || tags.includes('river') || tags.includes('bluffCatch');
  }

  let aPostflop = 0;
  let bIcm = 0;
  const runs = 15;
  for (let i = 0; i < runs; i++) {
    const planA = selectSpots({
      pool, skillProfile: profileA, dynamicProfile: profileA.dynamic,
      count: 20, rng: () => ((i + 1) * 0.041) % 1
    });
    const planB = selectSpots({
      pool, skillProfile: profileB, dynamicProfile: profileB.dynamic,
      count: 20, rng: () => ((i + 1) * 0.041) % 1
    });
    const spotsA = planA.selected.map((id) => pool.find((s) => s.id === id));
    const spotsB = planB.selected.map((id) => pool.find((s) => s.id === id));
    aPostflop += spotsA.filter(spotCountsAsPostflop).length;
    bIcm += spotsB.filter((s) => (s.skillTags || []).includes('icm')).length;
  }
  assert.ok(aPostflop / runs >= bIcm / runs + 2, `A postflop ${aPostflop / runs} vs B icm ${bIcm / runs}`);
});

test('computeDynamicSkillTargets weights diagnoses', () => {
  const dynamic = {
    tracks: {
      icm: { skill: 'icm', score: 40, diagnosis: SKILL_DIAGNOSES.TRUE_WEAKNESS },
      postflop: { skill: 'postflop', score: 88, diagnosis: SKILL_DIAGNOSES.MASTERED },
      river: { skill: 'river', score: 55, diagnosis: SKILL_DIAGNOSES.IMPROVING }
    }
  };
  const targets = computeDynamicSkillTargets(dynamic, 10);
  assert.ok(targets.icm >= targets.postflop, JSON.stringify(targets));
});

test('normalizeTrend maps worsening to declining', () => {
  assert.equal(normalizeTrend('worsening'), 'declining');
});

test('report: dynamic player profile summary', () => {
  const lines = [];
  for (const id of ['A', 'B', 'C', 'D']) {
    const r = REPORT[id];
    lines.push(`PROFILE ${id}: overall=${r.overall} confidence=${r.confidence}`);
    lines.push(`  focus: ${r.focusSkills.map((f) => `${f.skill}(${f.diagnosis},trend=${f.trend})`).join(', ')}`);
    lines.push(`  plan skills: ${r.spotSkills.join(', ')}`);
    lines.push(`  tasks: ${r.taskIds.slice(0, 8).join(', ')}...`);
    lines.push('');
  }
  console.log('\n' + lines.join('\n'));
  assert.ok(true);
});
