// Mission quality audit — all trainer-backed courses, zero pre-reveal, zero trivial.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetTrainerCache, lookupTrainerSpot, listCharts } from '../trainer-knowledge/index.js';
import { buildTrainerMatrix } from '../trainer-knowledge/adapters/rangesAdapter.js';
import { scanBattleshipCoursesNode } from '../ranges-ui/battleship/courses.js';
import { buildRangeModelFromMatrix } from '../ranges-ui/battleship/trainerRangeModel.js';
import { buildMissions, auditMission } from '../ranges-ui/battleship/missions.js';
import { isOpen } from '../ranges-ui/battleship/trainerRangeModel.js';

describe('battleship mission audit', () => {
  test('38 courses: no trivial missions, no target mismatch', async () => {
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
    assert.ok(catalog.length >= 38, `expected 38 courses, got ${catalog.length}`);

    let trivialMissions = 0;
    let mismatches = 0;
    let coursesWithFinal = 0;

    for (const entry of catalog) {
      const matrix = await buildTrainerMatrix(lookup, entry.selection);
      const model = buildRangeModelFromMatrix(matrix);
      const missions = buildMissions(model);
      assert.ok(missions.length >= 5, `${entry.courseId}: too few missions (${missions.length})`);
      assert.ok(missions.length <= 8, `${entry.courseId}: too many missions`);

      const final = missions[missions.length - 1];
      if (final?.type === 'RANGE_REBUILD') coursesWithFinal++;

      for (const mission of missions) {
        const audit = auditMission(mission, model);
        if (!audit.meaningfulDecision) trivialMissions++;
        for (const hand of mission.getTargetHands()) {
          if (!model.openSet.has(hand)) mismatches++;
        }
      }
    }

    assert.equal(trivialMissions, 0, `trivial missions: ${trivialMissions}`);
    assert.equal(mismatches, 0, `target mismatches: ${mismatches}`);
    assert.equal(coursesWithFinal, catalog.length);
  });
});
