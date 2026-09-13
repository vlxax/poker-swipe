import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sessionScoreFromResults,
  buildMistakeReviewItems,
  enrichSummaryViewModel,
  mistakeReviewScreenViewModel,
  isMistakeResult,
  historyEntriesViewModel
} from '../../training-ui/sessionReview.js';
import { summaryViewModel } from '../../training-ui/viewModel.js';

function drill(i) {
  return {
    drillId: `d${i}`,
    concept: 'bb_defense',
    street: 'preflop',
    options: [{ id: 'fold', labelRu: 'ФОЛД' }, { id: 'call', labelRu: 'КОЛЛ' }],
    explanation: { conceptLabelRu: 'Защита BB', promptRu: '?' },
    solution: { recommendedAction: { type: 'call' }, recommendedFrequency: 1 }
  };
}

function result(grade, extra = {}) {
  return {
    grade,
    nearOptimal: grade === 'EXCELLENT' || grade === 'GOOD',
    chosenRecommended: grade === 'EXCELLENT',
    feedbackRu: {
      verdict: 'test',
      chosenLabelRu: 'ФОЛД',
      correctLine: 'КОЛЛ',
      why: 'Потому что.',
      concept: 'BB'
    },
    ...extra
  };
}

test('summary correct count', () => {
  const results = [result('EXCELLENT'), result('MISTAKE', { nearOptimal: false, chosenRecommended: false })];
  const score = sessionScoreFromResults(results);
  assert.equal(score.correct, 1);
  assert.equal(score.mistakes, 1);
});

test('summary mistake count via enrich', () => {
  const base = summaryViewModel({ session: { plan: { total: 3 } }, results: [] });
  const results = [result('GOOD'), result('BIG MISTAKE', { nearOptimal: false, grade: 'BIG MISTAKE' })];
  const vm = enrichSummaryViewModel(base, { results, drills: [drill(0), drill(1)], taskStates: {} });
  assert.equal(vm.mistakeCount, 1);
  assert.equal(vm.correctCount, 1);
  assert.equal(vm.percentCorrect, 50);
});

test('review contains only incorrect answers', () => {
  const results = [result('EXCELLENT'), result('MISTAKE', { nearOptimal: false, chosenRecommended: false })];
  const items = buildMistakeReviewItems({ results, drills: [drill(0), drill(1)], taskStates: { 1: { optionId: 'fold' } } });
  assert.equal(items.length, 1);
  assert.equal(items[0].chosenAction, 'ФОЛД');
});

test('correct action from existing feedback', () => {
  const results = [result('MISTAKE', { nearOptimal: false })];
  const items = buildMistakeReviewItems({ results, drills: [drill(0)], taskStates: {} });
  assert.equal(items[0].correctAction, 'КОЛЛ');
});

test('next mistake screen model', () => {
  const items = [{ title: 'a' }, { title: 'b' }];
  const vm = mistakeReviewScreenViewModel({ items, index: 0 });
  assert.equal(vm.isLast, false);
  assert.equal(vm.current.title, 'a');
  const vm2 = mistakeReviewScreenViewModel({ items, index: 1 });
  assert.equal(vm2.isLast, true);
});

test('last mistake marks isLast', () => {
  const items = [{ title: 'only' }];
  const vm = mistakeReviewScreenViewModel({ items, index: 0 });
  assert.equal(vm.isLast, true);
});

test('no mistakes state', () => {
  const results = [result('EXCELLENT'), result('GOOD')];
  const items = buildMistakeReviewItems({ results, drills: [drill(0), drill(1)], taskStates: {} });
  assert.equal(items.length, 0);
  const base = summaryViewModel({ results });
  const vm = enrichSummaryViewModel(base, { results, drills: [], taskStates: {} });
  assert.equal(vm.canReviewMistakes, false);
});

test('empty metadata still builds title', () => {
  const results = [result('MISTAKE', { nearOptimal: false })];
  const items = buildMistakeReviewItems({
    results,
    drills: [{ drillId: 'x', options: [] }],
    taskStates: {}
  });
  assert.ok(items[0].title.includes('Раздача'));
});

test('history entries without review data', () => {
  const rows = historyEntriesViewModel([{ concept: 'bluff', grade: 'MISTAKE', at: Date.now() - 60000 }]);
  assert.equal(rows[0].canOpenReview, false);
  assert.equal(rows[0].isMistake, true);
});

test('start new does not inherit old review items', () => {
  const old = buildMistakeReviewItems({
    results: [result('MISTAKE', { nearOptimal: false })],
    drills: [drill(0)],
    taskStates: {}
  });
  const fresh = buildMistakeReviewItems({ results: [], drills: [], taskStates: {} });
  assert.equal(old.length, 1);
  assert.equal(fresh.length, 0);
});

test('isMistakeResult respects nearOptimal', () => {
  assert.equal(isMistakeResult({ grade: 'INACCURACY', nearOptimal: true }), false);
  assert.equal(isMistakeResult({ grade: 'MISTAKE', nearOptimal: false }), true);
});
