// Regression tests: Home recommendation routing + Range Battleship integration.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  classifyConceptBacking,
  isLaunchableConcept,
  resolveHomeRecommendation,
  BACKING
} from '../training-ui/homeRecommendation.js';
import { buildRangeModelFromMatrix } from '../ranges-ui/battleship/trainerRangeModel.js';
import { buildMissions, COURSE_MISSION_IDS } from '../ranges-ui/battleship/missions.js';
import { createProgressStore } from '../ranges-ui/battleship/progress.js';
import { scanBattleshipCoursesNode } from '../ranges-ui/battleship/courses.js';
import { resetTrainerCache, lookupTrainerSpot, listCharts } from '../trainer-knowledge/index.js';
import { buildTrainerMatrix } from '../trainer-knowledge/adapters/rangesAdapter.js';
import { MATCH_STATUS } from '../trainer-knowledge/status.js';
import { isOpen } from '../ranges-ui/battleship/trainerRangeModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function mockSwipe(concepts) {
  return concepts.map((concept, i) => ({ id: `t${i}`, concept }));
}

describe('home recommendation', () => {
  test('1. recommendation and launch target share same concept for thin value', () => {
    globalThis.SWIPE = mockSwipe(['thin value', 'thin value', 'sizing']);
    const rec = resolveHomeRecommendation({ concept: 'thin value', n: 5, r: 2 });
    assert.equal(rec.launchable, true);
    assert.equal(rec.target, 'swipe');
    assert.match(rec.displayConcept, /thin value/i);
  });

  test('2. unsupported weakness is not launchable', () => {
    globalThis.SWIPE = [];
    globalThis.newSwipeSession = undefined;
    const rec = resolveHomeRecommendation({ concept: 'totally.fake.concept.xyz', n: 5, r: 2 });
    assert.equal(rec.launchable, false);
    assert.equal(rec.backing, BACKING.UNSUPPORTED);
  });

  test('3. sizing routes to sizing miniapp not heal', () => {
    globalThis.document = { getElementById: (id) => (id === 'sizing' ? {} : null) };
    const route = classifyConceptBacking('turn sizing');
    assert.equal(route.backing, BACKING.EXISTING_MINIAPP);
    assert.equal(route.target, 'sizing');
  });

  test('home does not use heal target in poker_swipe_v39', () => {
    const src = readFileSync(join(ROOT, 'poker_swipe_v39.js'), 'utf8');
    assert.doesNotMatch(src, /v36Personal.*show\('heal'\)/);
    assert.match(src, /HomeRecommendation\.launchHomeRecommendation/);
  });
});

describe('range battleship', () => {
  test('4. no hardcoded BTN25_RANGE in production battleship modules', () => {
    const files = [
      'ranges-ui/battleship/controller.js',
      'ranges-ui/battleship/missions.js',
      'ranges-ui/battleship/trainerRangeModel.js',
      'ranges-ui/main.js'
    ];
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      assert.doesNotMatch(src, /BTN25_RANGE/);
    }
  });

  test('5. selected chart builds matrix from Trainer Knowledge', async () => {
    resetTrainerCache();
    const lookup = {
      lookupSpot: lookupTrainerSpot,
      lookupHand: async (chartId, hand) => {
        const { lookupTrainerHand } = await import('../trainer-knowledge/lookup.js');
        return lookupTrainerHand({ chartId, hand });
      }
    };
    const sel = { dataSource: 'trainer', position: 'BTN', stackBand: '2-4', trainerSourceMode: 'uo', situation: 'uo_open' };
    const matrix = await buildTrainerMatrix(lookup, sel);
    assert.equal(matrix.matchStatus, MATCH_STATUS.EXACT_TRAINER_MATCH);
    const model = buildRangeModelFromMatrix(matrix);
    assert.equal(model.supported, true);
    assert.equal(model.chartId, 'UO_2-4_BTN');
    assert.ok(model.openSet.size > 0);
  });

  test('6. blocked semantics are not treated as pure open/fold gradable', async () => {
    resetTrainerCache();
    const lookup = {
      lookupSpot: lookupTrainerSpot,
      lookupHand: async (chartId, hand) => {
        const { lookupTrainerHand } = await import('../trainer-knowledge/lookup.js');
        return lookupTrainerHand({ chartId, hand });
      }
    };
    const sel = { dataSource: 'trainer', position: 'BTN', stackBand: '12-15', trainerSourceMode: 'uo', situation: 'uo_open' };
    const matrix = await buildTrainerMatrix(lookup, sel);
    const model = buildRangeModelFromMatrix(matrix);
    for (const hand of model.blockedHands) {
      assert.equal(isOpen(hand, model), null);
    }
  });

  test('7. mission targets match trainer cells for BTN 2-4', async () => {
    resetTrainerCache();
    const lookup = {
      lookupSpot: lookupTrainerSpot,
      lookupHand: async (chartId, hand) => {
        const { lookupTrainerHand } = await import('../trainer-knowledge/lookup.js');
        return lookupTrainerHand({ chartId, hand });
      }
    };
    const sel = { dataSource: 'trainer', position: 'BTN', stackBand: '2-4', trainerSourceMode: 'uo', situation: 'uo_open' };
    const matrix = await buildTrainerMatrix(lookup, sel);
    const model = buildRangeModelFromMatrix(matrix);
    const missions = buildMissions(model);
    let mismatches = 0;
    for (const mission of missions) {
      if (!mission.getTargetHands) continue;
      for (const hand of mission.getTargetHands()) {
        if (!model.openSet.has(hand)) mismatches++;
      }
    }
    assert.equal(mismatches, 0);
  });

  test('8. progress is namespaced and persists', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k)
    };
    const ps = createProgressStore(storage);
    assert.equal(ps.STORAGE_KEY, 'pokerSwipe_rangeBattle_v1');
    ps.saveMissionResult('UO_2-4_BTN', 'UO_2-4_BTN', 'pocket-pairs', { accuracy: 80 }, COURSE_MISSION_IDS);
    const loaded = ps.load();
    assert.ok(loaded.courses['UO_2-4_BTN']);
    assert.equal(loaded.courses['UO_2-4_BTN'].missions[0].accuracy, 80);
  });

  test('9. reset battleship progress does not clear unrelated storage', () => {
    const mem = new Map();
    mem.set('pokerSwipe_train_meta', '{"version":2}');
    mem.set('pokerSwipe_rangeBattle_v1', '{"courses":{}}');
    const storage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k)
    };
    const ps = createProgressStore(storage);
    ps.resetAllBattleshipProgress();
    assert.equal(mem.has('pokerSwipe_train_meta'), true);
    assert.equal(mem.has('pokerSwipe_rangeBattle_v1'), false);
  });

  test('10. weak-mission repeat selects actual weakest mission', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k)
    };
    const ps = createProgressStore(storage);
    const cid = 'UO_2-4_BTN';
    ps.saveMissionResult(cid, cid, 'pocket-pairs', { accuracy: 90, mistakes: [], missedOpens: [] }, COURSE_MISSION_IDS);
    ps.saveMissionResult(cid, cid, 'suited-ax', { accuracy: 40, mistakes: [{ a: 1 }], missedOpens: [{ b: 1 }] }, COURSE_MISSION_IDS);
    ps.saveMissionResult(cid, cid, 'broadway', { accuracy: 40, mistakes: [], missedOpens: [] }, COURSE_MISSION_IDS);
    const worst = ps.getWeakestMission(cid, COURSE_MISSION_IDS);
    assert.equal(worst.missionId, 'suited-ax');
  });

  test('11. ranges main opens hub with battleship not xray', () => {
    const src = readFileSync(join(ROOT, 'ranges-ui/main.js'), 'utf8');
    assert.match(src, /BattleshipController/);
    assert.match(src, /renderBattleshipHub/);
    assert.doesNotMatch(src, /show\('xray'\)/);
  });

  test('12. old xray is not primary ranges route', () => {
    const src = readFileSync(join(ROOT, 'ranges-ui/main.js'), 'utf8');
    assert.match(src, /v36Xray/);
    assert.match(src, /show\('ranges'\)|show\(\"ranges\"\)/);
  });

  test('13. trainer catalog has battleship-eligible courses', async () => {
    resetTrainerCache();
    const charts = listCharts().filter((c) => c.sourceMode === 'uo');
    const lookup = {
      lookupSpot: lookupTrainerSpot,
      lookupHand: async (chartId, hand) => {
        const { lookupTrainerHand } = await import('../trainer-knowledge/lookup.js');
        return lookupTrainerHand({ chartId, hand });
      }
    };
    const catalog = await scanBattleshipCoursesNode(charts, (sel) => buildTrainerMatrix(lookup, sel));
    assert.ok(catalog.length >= 5);
    for (const c of catalog.slice(0, 5)) {
      assert.ok(c.chartId);
      assert.equal(c.sourceMode, 'uo');
      assert.ok(c.gradable >= 140);
    }
  });

  test('14. RANGE DATA MISMATCH = 0 for 5 sample courses', async () => {
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
    let totalMismatch = 0;
    for (const course of catalog.slice(0, 5)) {
      const matrix = await buildTrainerMatrix(lookup, course.selection);
      const model = buildRangeModelFromMatrix(matrix);
      const missions = buildMissions(model);
      for (const mission of missions) {
        if (!mission.getTargetHands) continue;
        for (const hand of mission.getTargetHands()) {
          if (!model.openSet.has(hand)) totalMismatch++;
        }
      }
    }
    assert.equal(totalMismatch, 0);
  });
});
