// P0: primary weakness + adaptive difficulty band alignment.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPlayerStore } from '../src/training/playerDifferentiationFixtures.js';
import { buildProfileDailyPlan, recordTrainingResult } from '../src/training/personalizedTraining.js';
import { rebuildSkillProfileFromStore } from '../src/training/dynamicPlayerProfile.js';
import { getTaskPool, getTaskById } from '../src/training/taskLibraryBridge.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import {
  resolvePrimaryWeaknessChain,
  spotMatchesSkillId,
  weaknessSlotDifficultyMatches
} from '../src/training/weaknessTargeting.js';
import { buildSkillTiers } from '../src/training/skillTiers.js';
import { seededRng } from '../src/training/personalizationSeed.js';
import { runTrainingQualityAudit } from '../scripts/audit100Sessions.mjs';

const NOW = 1_760_000_200_000;
const POOL = getTaskPool();

function planForStore(store, sessionIndex = 0) {
  const seed = store.loadPersonalizationSeed()?.seed || 'test';
  return buildProfileDailyPlan({
    store,
    count: 15,
    now: NOW + sessionIndex * 60_000,
    rng: seededRng(`${seed}|p0|${sessionIndex}`)
  });
}

function primarySlots(plan) {
  const spots = plan.spots || [];
  const kinds = plan.slotKinds || [];
  return spots.map((spot, i) => ({ spot, slot: kinds[i] }))
    .filter((x) => x.slot === 'primary_weakness');
}

test('Test A — profile evolution shifts primary weakness target', () => {
  const store = buildPlayerStore('A');
  const plan0 = planForStore(store, 0);
  const profile0 = rebuildSkillProfileFromStore(store, { now: NOW, history: store.loadHistory() });
  const chain0 = resolvePrimaryWeaknessChain({
    skillProfile: profile0,
    dynamicProfile: profile0.dynamic,
    tiers: buildSkillTiers(profile0),
    count: 15
  });

  const icmTasks = POOL.filter((t) => (t.skillTags || []).includes('icm')).slice(0, 12);
  let t = NOW + 1000;
  for (const task of icmTasks) {
    const gen = drillFromLibraryTask(task);
    if (!gen.ok) continue;
    recordTrainingResult(store, { drill: gen.drill, grade: 'MISTAKE', evLossBb: 0.95, now: t });
    t += 1000;
  }

  const profile1 = rebuildSkillProfileFromStore(store, { now: t, history: store.loadHistory() });
  const chain1 = resolvePrimaryWeaknessChain({
    skillProfile: profile1,
    dynamicProfile: profile1.dynamic,
    tiers: buildSkillTiers(profile1),
    count: 15
  });
  const plan1 = planForStore(store, 1);

  assert.ok(chain0.primary, 'initial primary weakness');
  assert.ok(chain1.primary, 'evolved primary weakness');

  for (const row of primarySlots(plan1)) {
    const chain = resolvePrimaryWeaknessChain({
      skillProfile: profile1,
      dynamicProfile: profile1.dynamic,
      tiers: buildSkillTiers(profile1),
      count: 15
    });
    const ok = spotMatchesSkillId(row.spot, chain.primary)
      || chain.fallbacks.some((s) => spotMatchesSkillId(row.spot, s));
    assert.ok(ok, `primary slot must match ${chain.primary} or fallback, got ${row.spot.id}`);
  }
});

test('Test B — weakness slots respect adaptive difficulty band', () => {
  const store = buildPlayerStore('B');
  const profile = rebuildSkillProfileFromStore(store, { now: NOW, history: store.loadHistory() });
  const plan = planForStore(store, 0);
  const recentResults = (store.loadHistory() || []).map((h) => ({
    grade: h.grade,
    skillTags: h.skillTags || [],
    nearOptimal: h.grade === 'EXCELLENT' || h.grade === 'GOOD'
  }));

  const usedIds = new Set();
  const ctx = { skillProfile: profile, recentResults, dynamicProfile: profile.dynamic, tiers: buildSkillTiers(profile), count: 15 };
  for (let i = 0; i < (plan.spots || []).length; i++) {
    const slot = plan.slotKinds[i];
    if (slot !== 'primary_weakness' && slot !== 'secondary_weakness') {
      usedIds.add(plan.spots[i].id);
      continue;
    }
    const spot = plan.spots[i];
    assert.ok(
      weaknessSlotDifficultyMatches(spot, ctx, { slotKind: slot, taskPool: POOL, usedIds }),
      `weakness slot task ${spot.id} diff ${spot.difficulty} outside band`
    );
    usedIds.add(spot.id);
  }
});

test('Test D — primary weakness unavailable falls back along chain, not unrelated difficulty', () => {
  const store = buildPlayerStore('B');
  const profile = rebuildSkillProfileFromStore(store, { now: NOW, history: store.loadHistory() });
  const chain = resolvePrimaryWeaknessChain({
    skillProfile: profile,
    dynamicProfile: profile.dynamic,
    tiers: buildSkillTiers(profile),
    count: 15
  });
  const plan = planForStore(store, 0);
  const allowedSkills = [chain.primary, ...chain.fallbacks].filter(Boolean);
  for (let i = 0; i < (plan.spots || []).length; i++) {
    const slot = plan.slotKinds[i];
    if (slot !== 'primary_weakness') continue;
    const spot = plan.spots[i];
    const matched = allowedSkills.some((s) => spotMatchesSkillId(spot, s));
    assert.ok(matched, `primary slot must match weakness chain, got ${spot.id} tags ${spot.skillTags}`);
  }
});

test('Test C — primary weakness with in-band candidates matches skill', () => {
  const store = buildPlayerStore('A');
  const profile = rebuildSkillProfileFromStore(store, { now: NOW, history: store.loadHistory() });
  const chain = resolvePrimaryWeaknessChain({
    skillProfile: profile,
    dynamicProfile: profile.dynamic,
    tiers: buildSkillTiers(profile),
    count: 15
  });
  const skill = chain.primary;
  assert.ok(skill, 'primary skill');

  const ctx = { skillProfile: profile, recentResults: [], dynamicProfile: profile.dynamic, tiers: buildSkillTiers(profile), count: 15 };
  const inPool = POOL.filter((t) => {
    const spot = { id: t.id, skillTags: t.skillTags || [], difficulty: t.difficulty };
    return (t.skillTags || []).includes(skill)
      && weaknessSlotDifficultyMatches(spot, ctx, { slotKind: 'primary_weakness', taskPool: POOL, usedIds: new Set() });
  });
  assert.ok(inPool.length >= 3, 'pool has in-band tasks for primary weakness');

  const plan = planForStore(store, 0);
  const primaries = (plan.spots || []).filter((_, i) => plan.slotKinds[i] === 'primary_weakness');
  assert.ok(primaries.length >= 1);
  const hit = primaries.filter((s) => spotMatchesSkillId(s, skill)
    || chain.fallbacks.some((fb) => spotMatchesSkillId(s, fb))).length;
  assert.ok(hit / primaries.length >= 0.8, `primary slots should match weakness ${skill}`);
});

test('Test E — Phase 13 audit regression thresholds', () => {
  const report = runTrainingQualityAudit({
    sessionsPerProfile: 12,
    profiles: ['A', 'B', 'C'],
    tasksPerSession: 15,
    baseNow: NOW,
    simulateAnswersBetweenSessions: 3
  });
  assert.equal(report.metrics.duplicateRate, 0);
  assert.equal(report.metrics.invalidSpotCount, 0);
  assert.ok(report.metrics.profileMismatchRate < 5, `profile mismatch ${report.metrics.profileMismatchRate}%`);
  assert.ok(report.metrics.diffMismatchRate < 10, `diff mismatch ${report.metrics.diffMismatchRate}%`);
});
