// Placement skill attribution — street-based tags, primary skill, scoring calibration.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveSkillTags } from '../src/training/planner.js';
import {
  derivePrimarySkill,
  assessmentSkillWeights,
  assessmentEvLossBb,
  assessmentOverallScore,
  compressSkillScore
} from '../src/training/placementSkillAttribution.js';
import { libraryTaskToPlacementItem } from '../src/training/placementTaskAdapter.js';
import { getValidatedMttTasks } from '../src/training/placementTestV2.js';

test('preflop street tasks are not tagged postflop via substring bleed', () => {
  const tags = deriveSkillTags({
    street: 'ПРЕФЛОП',
    concept: 'open_range',
    tags: ['rfi', 'btn'],
    format: 'MTT',
    heroStack: 30
  });
  assert.ok(tags.includes('preflop'));
  assert.ok(!tags.includes('postflop'), `preflop task must not get postflop tag: ${tags.join(',')}`);
});

test('flop tasks do not inherit preflop from 3-bet concept text', () => {
  const pool = getValidatedMttTasks();
  const flop3bet = pool.find((t) => t.street === 'ФЛОП' && /3-bet|3-бет/i.test(`${t.concept} ${(t.tags || []).join(' ')}`));
  assert.ok(flop3bet, 'expected a flop 3-bet scenario in MTT pool');
  const tags = deriveSkillTags(flop3bet);
  assert.ok(tags.includes('postflop'));
  assert.ok(!tags.includes('preflop'), `flop task must not carry preflop tag: ${tags.join(',')}`);
  assert.equal(derivePrimarySkill(flop3bet), 'postflop');
});

test('primary skill weights favor one main skill per task', () => {
  const pool = getValidatedMttTasks();
  const riverTask = pool.find((t) => t.street === 'РИВЕР');
  assert.ok(riverTask);
  const item = libraryTaskToPlacementItem(riverTask);
  const weights = assessmentSkillWeights(item);
  assert.equal(weights[0].weight, 1);
  assert.ok(weights[0].skill === item.primarySkill);
  if (weights.length > 1) assert.ok(weights.slice(1).every((w) => w.weight <= 0.25));
});

test('assessment scoring separates tiers and avoids hard 100 saturation', () => {
  const easyWrong = assessmentEvLossBb({ correct: false, tier: 1 });
  const hardWrong = assessmentEvLossBb({ correct: false, tier: 5 });
  assert.ok(easyWrong > hardWrong, 'easy misses should cost more EV than advanced misses');

  const allCorrect = assessmentOverallScore([
    { correct: true, tier: 1 },
    { correct: true, tier: 5 }
  ]);
  assert.ok(allCorrect < 100);
  assert.ok(allCorrect >= 90);

  const mostlyWrong = assessmentOverallScore([
    { correct: false, tier: 4 },
    { correct: false, tier: 5 },
    { correct: true, tier: 1 }
  ]);
  assert.ok(mostlyWrong < allCorrect - 15);
  assert.equal(compressSkillScore(100), 92);
});
