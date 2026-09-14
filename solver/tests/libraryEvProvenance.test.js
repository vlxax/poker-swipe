import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';

const sampleTask = {
  id: 'TEST_LIB_EV',
  street: 'ФЛОП',
  correct: 'ФОЛД',
  alsoOk: [],
  options: ['ФОЛД', 'КОЛЛ', 'РЕЙЗ'],
  question: 'Test?',
  explain: 'Фолд.',
  position: 'BB',
  villain: 'BTN',
  hero: ['7s', '2d'],
  board: ['As', 'Kd', 'Qc']
};

test('library drill marks evAvailable false', () => {
  const { drill } = drillFromLibraryTask(sampleTask);
  assert.equal(drill.solution.evAvailable, false);
  assert.equal(drill.solution.evSource, 'library_quiz_score');
});

test('wrong library answer does not fabricate BB ev loss', () => {
  const { drill } = drillFromLibraryTask(sampleTask);
  const wrong = drill.options.find((o) => o.labelRu === 'РЕЙЗ');
  const res = gradeAnswer({ drill, chosenId: wrong.id });
  assert.equal(res.evLossBb, null);
  assert.equal(res.evAvailable, false);
  assert.equal(res.grade, 'MISTAKE');
  assert.ok(!/Потеря EV:\s*[\d.]+\s*BB/i.test(res.feedbackRu?.summary || ''), 'summary should not show fake BB EV loss');
});

test('alsoOk does not fabricate BB ev', () => {
  const task = { ...sampleTask, alsoOk: ['КОЛЛ'] };
  const { drill } = drillFromLibraryTask(task);
  const alt = drill.options.find((o) => o.labelRu === 'КОЛЛ');
  const res = gradeAnswer({ drill, chosenId: alt.id });
  assert.equal(res.evLossBb, null);
  assert.equal(res.grade, 'GOOD');
});
