// Exercise generators — trainer truth only, fail closed.

import { isOpen, isGradable } from '../battleship/trainerRangeModel.js';
import { allHands } from '../battleship/matrixUtils.js';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gradableList(model) {
  return allHands().filter((h) => isGradable(h, model));
}

function openList(model) {
  return gradableList(model).filter((h) => isOpen(h, model) === true);
}

function excludedList(model) {
  return gradableList(model).filter((h) => isOpen(h, model) === false);
}

function pickChoices(correct, wrongPool, count = 2) {
  const wrong = shuffle(wrongPool.filter((h) => h !== correct)).slice(0, count);
  return shuffle([correct, ...wrong]);
}

export function buildExercises(model, { anchorHand = null } = {}) {
  if (!model?.supported) return [];
  const open = openList(model);
  const excluded = excludedList(model);
  if (!open.length || !excluded.length) return [];

  const exercises = [];

  const notIn = excluded[0];
  exercises.push({
    id: 'pick-not-in',
    type: 'mc',
    prompt: 'Какая рука точно НЕ входит?',
    choices: pickChoices(notIn, open),
    correct: notIn
  });

  const stays = open[Math.min(open.length - 1, Math.floor(open.length / 2))];
  exercises.push({
    id: 'pick-stays',
    type: 'mc',
    prompt: 'Какая рука осталась в диапазоне?',
    choices: pickChoices(stays, excluded),
    correct: stays
  });

  let example = anchorHand;
  if (example && !isGradable(example, model)) example = null;
  if (!example) {
    example = open.find((h) => h === 'KTo') || open.find((h) => h.length === 3 && h.endsWith('o')) || open[0];
  }
  if (example) {
    exercises.push({
      id: 'yes-no',
      type: 'yesno',
      prompt: 'Эта рука ещё в диапазоне?',
      hand: example,
      correct: isOpen(example, model) === true ? 'yes' : 'no'
    });
  }

  const junk = excluded.find((h) => /^[2-9]/.test(h) && h.endsWith('o')) || excluded[0];
  exercises.push({
    id: 'tap-gone',
    type: 'tap',
    mode: 'gone',
    prompt: 'Жми на руку, которая точно ушла из диапазона.',
    correctHands: new Set([junk]),
    wrongMessage: 'Эта рука ещё может быть в open-диапазоне.'
  });

  return exercises;
}

export function gradeExercise(exercise, answer) {
  if (!exercise) return { correct: false, accuracy: 0 };
  if (exercise.type === 'mc') {
    const correct = answer === exercise.correct;
    return { correct, accuracy: correct ? 100 : 0 };
  }
  if (exercise.type === 'yesno') {
    const correct = answer === exercise.correct;
    return { correct, accuracy: correct ? 100 : 0 };
  }
  if (exercise.type === 'tap') {
    const correct = exercise.correctHands?.has(answer);
    return { correct: !!correct, accuracy: correct ? 100 : 0 };
  }
  return { correct: false, accuracy: 0 };
}

export function lessonCounts(model) {
  const before = gradableList(model).length;
  const after = openList(model).length;
  return { before, after, excluded: before - after };
}
