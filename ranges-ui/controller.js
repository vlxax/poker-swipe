// Range narrowing trainer controller.

import { loadProgress, saveProgress, markHintSeen, completeOnboarding } from './storage.js';
import { pickScenario, getScenarioById } from './narrowingScenarios.js';
import {
  introViewModel,
  playViewModel,
  summaryViewModel,
  helpViewModel
} from './viewModel.js';
import {
  startingSelection,
  toggleHand,
  scoreStep,
  stepFeedback,
  summaryFeedback
} from './narrowingEngine.js';
import { lookupReferenceRange } from './referenceRanges.js';
import { attemptsFromNarrowingGrade } from '../range-learning/attemptAdapter.js';
import { PersistentLearnerMemory } from '../range-learning/persistence.js';

export class RangeController {
  constructor({ pack, storage = null, learnerMemory = null } = {}) {
    this.pack = pack;
    this.storage = storage;
    this.learnerMemory = learnerMemory || new PersistentLearnerMemory({ storage });
    this.learnerMemory.load();
    this.phase = 'intro';
    this.scenario = null;
    this.stepIndex = 0;
    this.userSelection = new Set();
    this.answers = [];
    this.scores = [];
    this.showHelp = false;
    this.progress = loadProgress(storage);
    this._attemptSeq = 0;
  }

  _freshScenario(excludeId = null) {
    this.scenario = pickScenario({ storage: this.storage, excludeId });
    this.stepIndex = 0;
    this.answers = [];
    this.scores = [];
    this._initStepSelection();
  }

  _currentStep() {
    return this.scenario?.steps?.[this.stepIndex] || null;
  }

  _candidateHands(step) {
    if (!step) return new Set();
    if (step.dependsOnStep != null && this.answers[step.dependsOnStep]) {
      return new Set(this.answers[step.dependsOnStep]);
    }
    return new Set(step.candidateHands || []);
  }

  _initStepSelection() {
    const step = this._currentStep();
    if (!step) {
      this.userSelection = new Set();
      return;
    }
    const candidates = this._candidateHands(step);
    this.userSelection = startingSelection(candidates);
  }

  viewModel() {
    if (this.showHelp) {
      return { ...helpViewModel(), phase: 'help', overlay: true };
    }

    if (!this.scenario) {
      this._freshScenario();
    }

    if (this.phase === 'intro') {
      return introViewModel({
        scenario: this.scenario,
        progress: this.progress,
        showHelp: false
      });
    }

    if (this.phase === 'play') {
      return playViewModel({
        scenario: this.scenario,
        stepIndex: this.stepIndex,
        userSelection: this.userSelection,
        answers: this.answers,
        progress: this.progress,
        showHelp: false
      });
    }

    if (this.phase === 'summary') {
      return summaryViewModel({
        scenario: this.scenario,
        answers: this.answers,
        scores: this.scores,
        progress: this.progress,
        showHelp: false
      });
    }

    return introViewModel({ scenario: this.scenario, progress: this.progress });
  }

  startScenario(id = null) {
    if (id) this.scenario = getScenarioById(id);
    else this._freshScenario(this.scenario?.id);
    this.phase = 'intro';
    this.stepIndex = 0;
    this.answers = [];
    this.scores = [];
    this.showHelp = false;
    return this.viewModel();
  }

  beginPlay() {
    if (!this.scenario) this._freshScenario();
    this.phase = 'play';
    this.stepIndex = 0;
    this.answers = [];
    this.scores = [];
    this._initStepSelection();
    if (!this.progress.completed && !this.progress.hintsSeen.includes('start')) {
      this.progress = markHintSeen(this.storage, 'start');
    }
    return this.viewModel();
  }

  toggleHand(hand) {
    const step = this._currentStep();
    if (!step || this.phase !== 'play') return this.viewModel();
    const candidates = this._candidateHands(step);
    this.userSelection = toggleHand(this.userSelection, hand, candidates);
    if (!this.progress.hintsSeen.includes('toggle')) {
      this.progress = markHintSeen(this.storage, 'toggle');
    }
    return this.viewModel();
  }

  confirmStep() {
    const step = this._currentStep();
    if (!step || this.phase !== 'play') return this.viewModel();

    const candidates = this._candidateHands(step);
    const answer = new Set([...this.userSelection].filter((h) => candidates.has(h)));
    const score = scoreStep(answer, step.truth, candidates);
    const feedback = stepFeedback(step, score);
    this._recordReferenceAttempts(step, answer, candidates);

    this.answers[this.stepIndex] = answer;
    this.scores[this.stepIndex] = { ...score, feedback };

    if (this.stepIndex < this.scenario.steps.length - 1) {
      this.stepIndex += 1;
      this._initStepSelection();
      if (!this.progress.hintsSeen.includes('step')) {
        this.progress = markHintSeen(this.storage, 'step');
      }
      return this.viewModel();
    }

    this.phase = 'summary';
    const summary = summaryFeedback(this.scenario, this.scores);
    this.scores.summary = summary;
    this.progress = saveProgress(this.storage, {
      completed: this.progress.completed,
      hintsSeen: this.progress.hintsSeen,
      runs: (this.progress.runs || 0) + 1,
      lastScenarioId: this.scenario.id,
      lastAccuracy: summary.avgAccuracy
    });
    if (!this.progress.completed) {
      this.progress = completeOnboarding(this.storage);
    }
    return this.viewModel();
  }

  _recordReferenceAttempts(step, answer, candidates) {
    try {
      const rangeObj = lookupReferenceRange(step.truthSel || {});
      const rangeId = rangeObj?.id;
      if (!rangeId) return;
      const truthHands = step.truth?.hands instanceof Set ? step.truth.hands : new Set(step.truth?.hands || []);
      const attempts = [];
      const ts = Date.now();
      for (const hand of candidates) {
        this._attemptSeq += 1;
        const built = attemptsFromNarrowingGrade({
          rangeId,
          source: 'reference',
          hand,
          inRangeTruth: truthHands.has(hand),
          playerSaidInRange: answer.has(hand),
          timestamp: ts,
          producer: 'reference-narrowing',
          sequence: this._attemptSeq
        });
        if (built.ok) attempts.push(built.attempt);
      }
      if (attempts.length) this.learnerMemory.recordAttempts(attempts);
    } catch (_) { /* never break gameplay */ }
  }

  nextScenario() {
    this._freshScenario(this.scenario?.id);
    this.phase = 'intro';
    this.showHelp = false;
    return this.viewModel();
  }

  openHelp() {
    this.showHelp = true;
    return this.viewModel();
  }

  closeHelp() {
    this.showHelp = false;
    return this.viewModel();
  }

  resetOnboardingForTest() {
    this.progress = { completed: false, hintsSeen: [], runs: 0 };
    saveProgress(this.storage, this.progress);
  }

  get selection() {
    return { dataSource: 'reference', format: '6max' };
  }

  setField() {
    return this.viewModel();
  }

  showRange() {
    return this.beginPlay();
  }

  backToSelector() {
    return this.startScenario();
  }

  selectHand(hand) {
    return this.toggleHand(hand);
  }

  dismissOnboarding() {
    this.progress = completeOnboarding(this.storage);
    return this.viewModel();
  }

  /** Internal task history — preserves answers/selection without rescoring. */
  back() {
    if (this.showHelp) {
      this.showHelp = false;
      return { vm: this.viewModel(), popped: false };
    }
    if (this.phase === 'summary') {
      this.phase = 'play';
      this.stepIndex = Math.max(0, (this.scenario?.steps?.length || 1) - 1);
      const prev = this.answers[this.stepIndex];
      if (prev) this.userSelection = new Set(prev);
      else this._initStepSelection();
      return { vm: this.viewModel(), popped: true };
    }
    if (this.phase === 'play') {
      if (this.stepIndex > 0) {
        this.stepIndex -= 1;
        const prev = this.answers[this.stepIndex];
        if (prev) this.userSelection = new Set(prev);
        else this._initStepSelection();
        return { vm: this.viewModel(), popped: true };
      }
      this.phase = 'intro';
      return { vm: this.viewModel(), popped: true };
    }
    return { vm: this.viewModel(), navExit: true, popped: true };
  }
}
