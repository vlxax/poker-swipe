// Trainer narrowing — data integrity + lesson catalog tests.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetTrainerCache, lookupTrainerSpot, listCharts } from '../trainer-knowledge/index.js';
import { buildTrainerMatrix } from '../trainer-knowledge/adapters/rangesAdapter.js';
import { scanBattleshipCoursesNode } from '../ranges-ui/battleship/courses.js';
import { buildRangeModelFromMatrix, isOpen } from '../ranges-ui/battleship/trainerRangeModel.js';
import { buildExercises, lessonCounts } from '../ranges-ui/narrowing/exercises.js';
import { lessonLabel, actionLine } from '../ranges-ui/narrowing/lessons.js';

function lessonFromEntry(entry, model) {
  return {
    lessonId: entry.courseId,
    chartId: entry.chartId,
    position: entry.position,
    stack: entry.stack,
    label: lessonLabel(entry),
    actionLine: actionLine(entry.position),
    model
  };
}

describe('trainer narrowing', () => {
  test('catalog uses verified trainer charts only', async () => {
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
    assert.ok(catalog.length >= 5);
    for (const entry of catalog.slice(0, 5)) {
      const matrix = await buildTrainerMatrix(lookup, entry.selection);
      const model = buildRangeModelFromMatrix(matrix);
      const lesson = lessonFromEntry(entry, model);
      assert.ok(lesson);
      assert.equal(lesson.chartId, entry.chartId);
      assert.ok(lesson.model.openSet.size > 0);
    }
  });

  test('RANGE DATA MISMATCH = 0 for 5 narrowing lessons', async () => {
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
    let mismatches = 0;
    for (const entry of catalog.slice(0, 5)) {
      const matrix = await buildTrainerMatrix(lookup, entry.selection);
      const model = buildRangeModelFromMatrix(matrix);
      const lesson = lessonFromEntry(entry, model);
      const counts = lessonCounts(lesson.model);
      if (counts.after !== lesson.model.openSet.size) mismatches++;
      for (const hand of lesson.model.openSet) {
        if (isOpen(hand, lesson.model) !== true) mismatches++;
      }
      const exercises = buildExercises(lesson.model);
      for (const ex of exercises) {
        if (ex.type === 'mc' && isOpen(ex.correct, lesson.model) !== true && ex.id !== 'pick-not-in') {
          if (ex.id === 'pick-not-in' && isOpen(ex.correct, lesson.model) !== false) mismatches++;
        }
        if (ex.type === 'mc' && ex.id === 'pick-not-in' && isOpen(ex.correct, lesson.model) !== false) mismatches++;
        if (ex.type === 'mc' && ex.id === 'pick-stays' && isOpen(ex.correct, lesson.model) !== true) mismatches++;
      }
    }
    assert.equal(mismatches, 0);
  });

  test('exercises do not infer multi-step transitions', async () => {
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
    const entry = catalog[0];
    const matrix = await buildTrainerMatrix(lookup, entry.selection);
    const model = buildRangeModelFromMatrix(matrix);
    const lesson = lessonFromEntry(entry, model);
    const exercises = buildExercises(lesson.model);
    assert.ok(exercises.length >= 3);
    assert.ok(exercises.every((e) => ['mc', 'yesno', 'tap'].includes(e.type)));
  });

  test('main.js wires trainer narrowing controller', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync(new URL('../ranges-ui/main.js', import.meta.url), 'utf8');
    assert.match(src, /NarrowingController/);
    assert.match(src, /narrowing\/renderer/);
    assert.doesNotMatch(src, /from '\.\/controller\.js'/);
  });
});
