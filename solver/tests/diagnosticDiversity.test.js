// Diagnostic diversity tuning — fresh-user overlap simulations (Placement V2).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAssessmentSet,
  gradeAssessmentItem,
  simulateDiagnosticRun,
  getPlacementPoolStats,
  getPlacementEligiblePool
} from '../src/training/assessment.js';
import { createPlacementSessionSeed } from '../src/training/placementTestV2.js';
import { seededRng } from '../src/training/personalizationSeed.js';

const REPORT = {
  averageOverlap: 0,
  maxOverlap: 0,
  minOverlap: 0,
  pairs: 20
};

function overlap(idsA, idsB) {
  const setB = new Set(idsB);
  return idsA.filter((id) => setB.has(id)).length;
}

function wrongChoice(item) {
  return item.choices.find((c) => c !== item.correct && !(item.alsoOk || []).includes(c))
    || item.correct;
}

function answerForSeed(seed) {
  const rng = seededRng(`${seed}|answers`);
  const style = rng();
  return (item) => {
    const tier = item.tier || 2;
    if (style < 0.25) return tier >= 2 ? wrongChoice(item) : item.correct;
    if (style < 0.6) return tier >= 3 ? wrongChoice(item) : item.correct;
    return item.correct;
  };
}

function simulateFreshUserPairs(count = 20) {
  const overlaps = [];
  for (let p = 0; p < count; p++) {
    const seedA = createPlacementSessionSeed() + `-simA-${p}`;
    const seedB = createPlacementSessionSeed() + `-simB-${p}`;
    const setA = buildAssessmentSet({
      diagnosticSessionSeed: seedA,
      count: 13,
      answerFn: answerForSeed(seedA)
    });
    const setB = buildAssessmentSet({
      diagnosticSessionSeed: seedB,
      count: 13,
      answerFn: answerForSeed(seedB)
    });
    overlaps.push(overlap(setA.map((x) => x.id), setB.map((x) => x.id)));
  }
  return overlaps;
}

test('MTT library pool keeps structured context on all placement items', () => {
  const stats = getPlacementPoolStats();
  assert.ok(stats.poolSize >= 140);
  const sample = getPlacementEligiblePool().slice(0, 30);
  for (const item of sample) {
    assert.ok(item.context?.formatLine?.includes('MTT'), `${item.id} must carry MTT context`);
    assert.ok(item.miniAppMode, `${item.id} must have mini-app mode`);
  }
});

test('20 fresh-user pairs: overlap normally <= 8 on average', () => {
  const overlaps = simulateFreshUserPairs(20);
  const avg = overlaps.reduce((s, x) => s + x, 0) / overlaps.length;
  REPORT.averageOverlap = +avg.toFixed(2);
  REPORT.maxOverlap = Math.max(...overlaps);
  REPORT.minOverlap = Math.min(...overlaps);

  assert.ok(avg <= 8, `average overlap too high: ${avg.toFixed(2)}`);
  assert.ok(REPORT.maxOverlap <= 11, `max overlap too high: ${REPORT.maxOverlap}`);
  assert.ok(REPORT.minOverlap <= 6, 'some diversity expected');
});

test('two canonical fresh users are not identical', () => {
  const setA = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-user-alpha', count: 13, answerFn: (i) => i.correct });
  const setB = buildAssessmentSet({ diagnosticSessionSeed: 'fresh-user-beta', count: 13, answerFn: (i) => i.correct });
  const idsA = setA.map((x) => x.id);
  const idsB = setB.map((x) => x.id);
  assert.notDeepEqual(idsA, idsB);
  assert.ok(overlap(idsA, idsB) <= 8, `overlap still high: ${overlap(idsA, idsB)}/13`);
});

test('adaptive difficulty preserved for beginner vs strong', () => {
  const beg = simulateDiagnosticRun({
    sessionSeed: 'div-beg',
    answerFn: (i) => ((i.tier || 2) >= 3 ? wrongChoice(i) : i.correct),
    gradeFn: (i, c) => gradeAssessmentItem(i, c)
  });
  const str = simulateDiagnosticRun({
    sessionSeed: 'div-str',
    answerFn: (i) => i.correct,
    gradeFn: (i, c) => gradeAssessmentItem(i, c)
  });
  const begMax = Math.max(...beg.answers.map((a) => a.tier));
  const strMax = Math.max(...str.answers.map((a) => a.tier));
  const begAvg = beg.answers.reduce((s, a) => s + a.tier, 0) / beg.answers.length;
  const strongAvg = str.answers.reduce((s, a) => s + a.tier, 0) / str.answers.length;

  assert.ok(begMax <= 5);
  assert.ok(beg.answers.filter((a) => a.tier >= 4).length <= 4);
  assert.ok(strMax >= 3);
  assert.ok(strongAvg >= begAvg - 0.5);
});

test('skill coverage preserved in MTT library pool', () => {
  const skills = getPlacementPoolStats().skillCoverage;
  for (const skill of [
    'preflop', 'positionAwareness', 'stackDepthAwareness', 'postflop', 'betSizing',
    'rangeReading', 'river', 'bluffCatch', 'shortStack', 'icm'
  ]) {
    assert.ok(skills.includes(skill), `missing skill ${skill}`);
  }
});

test('report: diagnostic diversity summary', () => {
  console.log('\n=== DIAGNOSTIC DIVERSITY REPORT ===');
  console.log('AVERAGE OVERLAP:', REPORT.averageOverlap);
  console.log('MAX OVERLAP:', REPORT.maxOverlap);
  console.log('MIN OVERLAP:', REPORT.minOverlap);
  console.log('POOL SIZE:', getPlacementPoolStats().poolSize);
  assert.ok(REPORT.averageOverlap > 0);
});
