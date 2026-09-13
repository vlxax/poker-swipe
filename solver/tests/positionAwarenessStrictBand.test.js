// P0: strict adaptive band — must not pick d=1 when unused strict in-band exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectSpots, normalizeSpot } from '../src/training/spotSelector.js';
import { getTaskPool } from '../src/training/taskLibraryBridge.js';
import {
  weaknessSlotAllowedDifficulties,
  weaknessSlotDifficultyMatches,
  resolvePrimaryWeaknessChain
} from '../src/training/weaknessTargeting.js';
import { buildSkillTiers } from '../src/training/skillTiers.js';
import { SKILL_DIAGNOSES } from '../src/training/skillDiagnoses.js';

const POOL = getTaskPool().map(normalizeSpot);

function profileWithPositionAwarenessWeak() {
  const tracks = {
    positionAwareness: {
      skill: 'positionAwareness',
      score: 38,
      confidence: 0.55,
      sampleSize: 12,
      diagnosis: SKILL_DIAGNOSES.TRUE_WEAKNESS,
      recentAccuracy: 0.82,
      longTermAccuracy: 0.78
    },
    preflop: {
      skill: 'preflop',
      score: 72,
      confidence: 0.7,
      sampleSize: 14,
      diagnosis: SKILL_DIAGNOSES.STABLE
    }
  };
  const skills = Object.fromEntries(
    Object.values(tracks).map((t) => [t.skill, {
      skill: t.skill,
      score: t.score,
      confidence: t.confidence,
      sampleSize: t.sampleSize
    }])
  );
  const dynamic = { tracks, skills: tracks };
  return {
    overall: 58,
    skills,
    weakest: { skill: 'positionAwareness', score: 38 },
    dynamic
  };
}

test('PRE_RFI_CO_KTS d=1 not selected when unused positionAwareness d=4/5 in band', () => {
  const skillProfile = profileWithPositionAwarenessWeak();
  const recentResults = Array.from({ length: 8 }, () => ({
    grade: 'EXCELLENT',
    skillTags: ['positionAwareness'],
    nearOptimal: true
  }));
  const ctx = {
    skillProfile,
    recentResults,
    dynamicProfile: skillProfile.dynamic,
    tiers: buildSkillTiers(skillProfile),
    count: 15
  };
  const chain = resolvePrimaryWeaknessChain(ctx);
  assert.equal(chain.primary, 'positionAwareness');
  const { allowed } = weaknessSlotAllowedDifficulties(ctx, 'positionAwareness');
  assert.ok(allowed.includes(4) || allowed.includes(5), `band ${allowed}`);

  const strictUnused = POOL.filter((t) => (t.skillTags || []).includes('positionAwareness')
    && allowed.includes(t.difficulty));
  assert.ok(strictUnused.length >= 3, 'library has strict in-band positionAwareness tasks');

  const result = selectSpots({
    pool: POOL,
    skillProfile,
    dynamicProfile: skillProfile.dynamic,
    recentResults,
    count: 15,
    rng: () => 0.33
  });
  assert.equal(result.ok, true);

  const used = new Set();
  for (let i = 0; i < result.selected.length; i++) {
    const slot = result.slotKinds[i];
    if (slot !== 'primary_weakness') {
      used.add(result.selected[i].id);
      continue;
    }
    const spot = result.selected[i];
    assert.ok(
      weaknessSlotDifficultyMatches(spot, ctx, {
        slotKind: 'primary_weakness',
        taskPool: getTaskPool(),
        usedIds: used
      }),
      `primary ${spot.id} d=${spot.difficulty} violates band`
    );
    if (spot.id === 'PRE_RFI_CO_KTS' || spot.id === 'PRE_RFI_BTN_A8S') {
      const stillStrict = POOL.some((t) => (t.skillTags || []).includes('positionAwareness')
        && allowed.includes(t.difficulty)
        && !used.has(t.id));
      assert.ok(!stillStrict, `${spot.id} chosen while strict in-band unused`);
    }
    used.add(spot.id);
  }
});
