// Trainer-backed range narrowing controller — visual before/after + interactive exercises.

import { getNarrowingCatalog, loadLesson, findLesson } from './lessons.js';
import { buildExercises, gradeExercise, lessonCounts } from './exercises.js';
import { createNarrowingStore } from './storage.js';
import { isOpen } from '../battleship/trainerRangeModel.js';
import { attemptsFromNarrowingGrade } from '../../range-learning/attemptAdapter.js';
import { PersistentLearnerMemory } from '../../range-learning/persistence.js';

function freshState() {
  return {
    phase: 'catalog',
    lesson: null,
    model: null,
    exercises: [],
    exerciseIndex: 0,
    revealed: false,
    revealAnimating: false,
    feedback: null,
    speech: '',
    flashHand: null,
    scores: [],
    errorMessage: null
  };
}

export class NarrowingController {
  constructor({ storage, learnerMemory } = {}) {
    this.storage = storage;
    this.store = createNarrowingStore(storage);
    this.learnerMemory = learnerMemory || new PersistentLearnerMemory({ storage });
    this.learnerMemory.load();
    this.catalog = [];
    this.state = freshState();
    this._answerSeq = 0;
  }

  async init() {
    this.catalog = await getNarrowingCatalog();
    return this.catalog;
  }

  viewModel() {
    const counts = this.state.model ? lessonCounts(this.state.model) : { before: 0, after: 0, excluded: 0 };
    const exercise = this.state.exercises[this.state.exerciseIndex] || null;
    return {
      phase: this.state.phase,
      catalog: this.catalog,
      lesson: this.state.lesson,
      model: this.state.model,
      counts,
      revealed: this.state.revealed,
      revealAnimating: this.state.revealAnimating,
      exercise,
      exerciseIndex: this.state.exerciseIndex,
      exerciseTotal: this.state.exercises.length,
      feedback: this.state.feedback,
      speech: this.state.speech,
      flashHand: this.state.flashHand,
      showOnboarding: this.state.phase === 'onboarding',
      onboardingDone: this.store.loadOnboardingDone(),
      lastLessonId: this.store.getLastLesson(),
      scores: this.state.scores
    };
  }

  openCatalog() {
    this.state = freshState();
    this.state.phase = 'catalog';
    return this.viewModel();
  }

  backToHub() {
    this.state.phase = 'hub';
    return this.viewModel();
  }

  async startLesson(lessonId) {
    const entry = findLesson(this.catalog, lessonId);
    if (!entry) throw new Error(`Unknown narrowing lesson: ${lessonId}`);
    const lesson = await loadLesson(entry);
    if (!lesson) {
      this.state.phase = 'error';
      this.state.errorMessage = 'Нет точных тренерских данных для этого спота.';
      return this.viewModel();
    }
    this.state = freshState();
    this.state.lesson = lesson;
    this.state.model = lesson.model;
    this.state.exercises = buildExercises(lesson.model);
    this.state.phase = this.store.loadOnboardingDone() ? 'preview' : 'onboarding';
    return this.viewModel();
  }

  dismissOnboarding() {
    this.store.saveOnboardingDone();
    this.state.phase = 'preview';
    return this.viewModel();
  }

  revealRange() {
    if (this.state.revealed) return this.viewModel();
    this.state.revealAnimating = true;
    this.state.revealed = true;
    this.state.speech = 'После открытия большая часть мусора исчезает из диапазона.';
    setTimeout(() => {
      this.state.revealAnimating = false;
    }, 600);
    return this.viewModel();
  }

  continueAfterReveal() {
    if (!this.state.revealed) return this.viewModel();
    this.state.phase = 'exercise';
    this.state.exerciseIndex = 0;
    this.state.feedback = null;
    this.state.speech = '';
    return this.viewModel();
  }

  answerMc(choice) {
    const exercise = this.state.exercises[this.state.exerciseIndex];
    if (!exercise || exercise.type !== 'mc') return this.viewModel();
    const grade = gradeExercise(exercise, choice);
    this._recordNarrowingAttempt(exercise, choice, grade);
    this._applyGrade(grade, choice);
    return this.viewModel();
  }

  answerYesNo(answer) {
    const exercise = this.state.exercises[this.state.exerciseIndex];
    if (!exercise || exercise.type !== 'yesno') return this.viewModel();
    const grade = gradeExercise(exercise, answer);
    this._recordNarrowingAttempt(exercise, answer, grade);
    this._applyGrade(grade, answer);
    return this.viewModel();
  }

  tapHand(hand) {
    const exercise = this.state.exercises[this.state.exerciseIndex];
    if (!exercise || exercise.type !== 'tap' || this.state.phase !== 'exercise') return this.viewModel();
    const grade = gradeExercise(exercise, hand);
    this._recordNarrowingAttempt(exercise, hand, grade);
    this.state.flashHand = hand;
    if (grade.correct) {
      this.state.feedback = { type: 'ok', text: 'Верно' };
      this.state.speech = `${hand} — ушла из диапазона.`;
    } else {
      this.state.feedback = { type: 'bad', text: 'Нет' };
      this.state.speech = exercise.wrongMessage || 'Попробуй другую клетку.';
    }
    if (grade.correct) this._advanceExercise(grade);
    return this.viewModel();
  }

  _recordNarrowingAttempt(exercise, answer, grade) {
    try {
      const rangeId = this.state.model?.chartId;
      if (!rangeId || !exercise) return;
      this._answerSeq += 1;
      const timestamp = Date.now();
      let hand = null;
      let playerSaidInRange = null;
      if (exercise.type === 'mc') {
        hand = answer;
        playerSaidInRange = exercise.id === 'pick-stays';
        if (exercise.id === 'pick-not-in') playerSaidInRange = false;
      } else if (exercise.type === 'yesno') {
        hand = exercise.hand;
        playerSaidInRange = answer === 'yes';
      } else if (exercise.type === 'tap') {
        hand = answer;
        playerSaidInRange = exercise.mode !== 'gone';
      }
      if (!hand || playerSaidInRange == null) return;
      const built = attemptsFromNarrowingGrade({
        rangeId,
        source: 'trainer',
        hand,
        inRangeTruth: isOpen(hand, this.state.model) === true,
        playerSaidInRange,
        timestamp,
        producer: 'narrowing',
        sequence: this._answerSeq
      });
      if (built.ok) this.learnerMemory.recordAttempts([built.attempt]);
    } catch (_) { /* never break gameplay */ }
  }

  _applyGrade(grade, answer) {
    const exercise = this.state.exercises[this.state.exerciseIndex];
    if (grade.correct) {
      this.state.feedback = { type: 'ok', text: 'Верно' };
      this.state.speech = exercise.type === 'yesno'
        ? (answer === 'yes' ? 'Да — рука остаётся.' : 'Нет — рука ушла.')
        : `${exercise.correct} — правильный ответ.`;
    } else {
      this.state.feedback = { type: 'bad', text: 'Нет' };
      this.state.speech = `Правильно: ${exercise.correct === 'yes' ? 'ДА' : exercise.correct === 'no' ? 'НЕТ' : exercise.correct}`;
    }
    if (grade.correct) this._advanceExercise(grade);
  }

  _advanceExercise(grade) {
    this.state.scores.push(grade.accuracy);
    if (this.state.exerciseIndex >= this.state.exercises.length - 1) {
      const avg = this.state.scores.length
        ? Math.round(this.state.scores.reduce((a, b) => a + b, 0) / this.state.scores.length)
        : 0;
      this.store.saveLessonComplete(this.state.lesson.lessonId, avg);
      this.state.phase = 'complete';
      return;
    }
    this.state.exerciseIndex += 1;
    this.state.feedback = null;
    this.state.flashHand = null;
    this.state.speech = '';
  }

  nextLesson() {
    return this.openCatalog();
  }

  back() {
    if (this.state.phase === 'complete' || this.state.phase === 'exercise' || this.state.phase === 'preview' || this.state.phase === 'revealed') {
      return { navExit: false, reopenCatalog: true };
    }
    if (this.state.phase === 'onboarding') {
      return { navExit: false, reopenCatalog: true };
    }
    if (this.state.phase === 'catalog') {
      return { navExit: true };
    }
    return { navExit: true };
  }
}
