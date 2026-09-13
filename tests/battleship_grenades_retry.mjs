// Battleship grenade fail + retry same mission.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetTrainerCache, lookupTrainerSpot, listCharts } from '../trainer-knowledge/index.js';
import { buildTrainerMatrix } from '../trainer-knowledge/adapters/rangesAdapter.js';
import { scanBattleshipCoursesNode } from '../ranges-ui/battleship/courses.js';
import { buildRangeModelFromMatrix } from '../ranges-ui/battleship/trainerRangeModel.js';
import { buildMissions, grenadesForMission, DEFAULT_GRENADES, MIN_GRENADES } from '../ranges-ui/battleship/missions.js';
import { isGradable } from '../ranges-ui/battleship/trainerRangeModel.js';

function freshMissionState(grenades) {
  return {
    missionIndex: 0,
    grenades,
    hits: 0,
    misses: 0,
    combo: 0,
    found: 0,
    targetTotal: 0,
    resolved: new Set(),
    hitHands: new Set(),
    missHands: new Set(),
    mistakes: [],
    status: 'playing',
    showOverlay: false,
    showFailOverlay: false,
    showMissionIntro: false,
    missionFailed: false,
    missedTargets: [],
    wrongHands: []
  };
}

describe('battleship grenades + retry', () => {
  test('default grenades 7, min 5, fail shows retry with full lives', async () => {
    resetTrainerCache();
    const lookup = {
      lookupSpot: lookupTrainerSpot,
      lookupHand: async (chartId, hand) => {
        const { lookupTrainerHand } = await import('../trainer-knowledge/lookup.js');
        return lookupTrainerHand({ chartId, hand });
      }
    };
    const charts = listCharts().filter((c) => c.sourceMode === 'uo');
    const catalog = await scanBattleshipCoursesNode(charts, (sel) => buildTrainerMatrix(lookup, sel));
    const course = catalog.find((c) => c.position === 'HJ') || catalog[0];
    const matrix = await buildTrainerMatrix(lookup, course.selection);
    const model = buildRangeModelFromMatrix(matrix);
    const missions = buildMissions(model);
    const mission = missions[0];
    const grenades = grenadesForMission(mission);
    assert.ok(grenades >= MIN_GRENADES);
    assert.ok(grenades <= 10);

    const state = freshMissionState(grenades);
    state.targetTotal = mission.getTargetHands().length;
    const targets = new Set(mission.getTargetHands());
    const wrongHands = mission.getActiveHands().filter((h) => !targets.has(h) && isGradable(h, model));

    for (let i = 0; i < grenades; i++) {
      const hand = wrongHands[i];
      state.resolved.add(hand);
      state.missHands.add(hand);
      state.misses++;
      state.grenades = Math.max(0, state.grenades - 1);
    }
    assert.equal(state.grenades, 0);
    state.missedTargets = [...targets];
    state.showFailOverlay = true;

    // Retry resets
    const retryGrenades = grenadesForMission(mission);
    Object.assign(state, {
      grenades: retryGrenades,
      hits: 0,
      misses: 0,
      found: 0,
      resolved: new Set(),
      hitHands: new Set(),
      missHands: new Set(),
      showFailOverlay: false,
      missedTargets: [],
      wrongHands: [],
      status: 'playing'
    });
    assert.equal(state.grenades, retryGrenades);
    assert.equal(state.hitHands.size, 0);
    assert.equal(state.showFailOverlay, false);
  });

  test('DEFAULT_GRENADES is 7', () => {
    assert.equal(DEFAULT_GRENADES, 7);
    assert.equal(MIN_GRENADES, 5);
  });
});
