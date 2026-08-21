// Phase 11: player profile UI — dynamic profile exposed to training home.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTrainingStore, recordTrainingResult } from '../src/index.js';
import { rebuildSkillProfileFromStore } from '../src/training/dynamicPlayerProfile.js';
import {
  buildDynamicPlayerStore, DYNAMIC_PLAN_NOW
} from '../src/training/dynamicPlayerFixtures.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { getTaskPool } from '../src/training/taskLibraryBridge.js';
import { deriveSkillTags } from '../src/training/planner.js';
import { homeViewModel, playerProfileViewModel } from '../../training-ui/viewModel.js';
import { whyTextFromDynamicProfile, focusTracksFromProfile } from '../../training-ui/playerProfileCopy.js';
import { focusItemsFromProfile } from '../../training-ui/trainingHomeCopy.js';

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

function icmTask() {
  const pool = getTaskPool();
  return pool.find((t) => deriveSkillTags(t).includes('icm'));
}

test('playerProfileViewModel exposes tracks from dynamic profile', () => {
  const store = buildDynamicPlayerStore('B');
  const profile = rebuildSkillProfileFromStore(store, { now: DYNAMIC_PLAN_NOW });
  const vm = playerProfileViewModel(profile);

  assert.ok(vm, 'profile VM should exist');
  assert.ok(vm.strongest?.label, 'strongest skill label');
  assert.ok(vm.weakest?.label, 'weakest skill label');
  assert.ok(vm.tracks.length >= 3, 'multiple skill tracks');
  const icm = vm.tracks.find((t) => t.skill === 'icm');
  assert.ok(icm, 'ICM track present for player B');
  assert.ok(icm.masteryState, 'mastery state in Russian');
  assert.ok(icm.trend, 'trend in Russian');
  assert.match(icm.mistakeFrequency, /%$/, 'mistake frequency as percent');
});

test('homeViewModel includes playerProfile and diagnosis-based why text', () => {
  const store = buildDynamicPlayerStore('B');
  const profile = rebuildSkillProfileFromStore(store, { now: DYNAMIC_PLAN_NOW });
  const vm = homeViewModel({
    leaks: [],
    plan: { total: 7, personalized: true, sessionPlan: { primaryTargets: ['icm bubble'], exploration: [] } },
    skillProfile: profile
  });

  assert.equal(vm.type, 'training');
  assert.ok(vm.playerProfile, 'player profile section');
  assert.ok(vm.playerProfile.weakest, 'weakest in profile');
  assert.ok(vm.whyText, 'why explanation');
  assert.ok(
    vm.whyText.includes('слаб') || vm.whyText.includes('зон') || vm.whyText.includes('рост'),
    `why text should reference weaknesses: ${vm.whyText}`
  );
});

test('profile changes after training answers', () => {
  const store = createTrainingStore({ storage: memoryStorage(), prefix: 'ppui_' });
  const task = icmTask();
  assert.ok(task, 'ICM task available');
  const gen = drillFromLibraryTask(task);
  assert.equal(gen.ok, true, gen.reason);

  const before = rebuildSkillProfileFromStore(store, { now: DYNAMIC_PLAN_NOW });
  const beforeVm = playerProfileViewModel(before);
  assert.equal(beforeVm, null, 'empty store has no profile');

  recordTrainingResult(store, {
    drill: gen.drill,
    grade: 'MISTAKE',
    evLossBb: 0.9,
    now: DYNAMIC_PLAN_NOW
  });

  const after = rebuildSkillProfileFromStore(store, { now: DYNAMIC_PLAN_NOW + 1000 });
  const afterVm = playerProfileViewModel(after);
  assert.ok(afterVm, 'profile appears after answer');
  assert.ok(afterVm.tracks.length >= 1, 'tracks populated');
  const icm = afterVm.tracks.find((t) => t.skill === 'icm');
  if (icm) {
    assert.ok(icm.score != null, 'ICM score computed');
    assert.ok(icm.diagnosis, 'ICM diagnosis assigned');
  }
});

test('profile persists after store reload', () => {
  const storage = memoryStorage();
  const prefix = 'ppui_persist_';
  const store1 = createTrainingStore({ storage, prefix });
  const task = icmTask();
  const gen = drillFromLibraryTask(task);
  recordTrainingResult(store1, {
    drill: gen.drill,
    grade: 'GOOD',
    evLossBb: 0.02,
    now: DYNAMIC_PLAN_NOW
  });
  const saved = rebuildSkillProfileFromStore(store1, { now: DYNAMIC_PLAN_NOW });
  store1.saveSkillProfile(saved);

  const store2 = createTrainingStore({ storage, prefix });
  const reloaded = rebuildSkillProfileFromStore(store2, { now: DYNAMIC_PLAN_NOW });
  const vm1 = playerProfileViewModel(saved);
  const vm2 = playerProfileViewModel(reloaded);

  assert.ok(vm2, 'reloaded profile exists');
  assert.equal(vm2.weakest?.label, vm1.weakest?.label);
  assert.equal(vm2.strongest?.label, vm1.strongest?.label);
  assert.equal(vm2.tracks.length, vm1.tracks.length);
});

test('different players produce different profile output', () => {
  const profileA = rebuildSkillProfileFromStore(buildDynamicPlayerStore('A'), { now: DYNAMIC_PLAN_NOW });
  const profileB = rebuildSkillProfileFromStore(buildDynamicPlayerStore('B'), { now: DYNAMIC_PLAN_NOW });
  const vmA = playerProfileViewModel(profileA);
  const vmB = playerProfileViewModel(profileB);

  assert.notDeepEqual(
    vmA.tracks.map((t) => ({ s: t.skill, score: t.score, d: t.diagnosisKey })),
    vmB.tracks.map((t) => ({ s: t.skill, score: t.score, d: t.diagnosisKey })),
    'A and B should differ'
  );
  assert.notEqual(vmA.weakest?.skill, vmB.weakest?.skill);
});

test('recommendations match actual weaknesses from dynamic profile', () => {
  const profile = rebuildSkillProfileFromStore(buildDynamicPlayerStore('B'), { now: DYNAMIC_PLAN_NOW });
  const focusTracks = focusTracksFromProfile(profile, 2);
  const focusItems = focusItemsFromProfile({ skillProfile: profile, leaks: [], plan: null, limit: 2 });
  const why = whyTextFromDynamicProfile(profile);

  assert.ok(focusTracks.length >= 1, 'focus tracks from weaknesses');
  const weakestSkill = profile.weakest?.skill;
  assert.ok(
    focusTracks.some((t) => t.skill === weakestSkill)
      || focusItems.some((f) => f.toLowerCase().includes(profile.weakest.labelRu.toLowerCase().slice(0, 4))),
    'focus should align with weakest skill'
  );
  assert.ok(why, 'dynamic why text');
  assert.ok(
    why.toLowerCase().includes(profile.weakest.labelRu.toLowerCase().slice(0, 4))
      || why.includes('слаб')
      || why.includes('зон'),
    `why should reference weakness: ${why}`
  );
});
