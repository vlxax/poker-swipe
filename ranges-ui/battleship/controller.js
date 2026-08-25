// Range Battleship game controller — trainer-backed missions, no hardcoded ranges.

import { findCourse, getBattleshipCatalog } from './courses.js';
import { loadRangeModel, isOpen, courseLabel } from './trainerRangeModel.js';
import { buildMissions, COURSE_MISSION_IDS } from './missions.js';
import { createProgressStore } from './progress.js';
import { getHandCategory } from './matrixUtils.js';

function freshState() {
  return {
    missionIndex: 0,
    shots: 12,
    maxShots: 12,
    hits: 0,
    misses: 0,
    combo: 0,
    bestCombo: 0,
    used: new Set(),
    hitHands: new Set(),
    missHands: new Set(),
    mistakes: [],
    missedOpens: [],
    status: 'idle',
    choiceMade: false,
    selectedChoice: null,
    edgeAnswered: false,
    decisionIndex: 0,
    decisionResults: [],
    returnToFinal: false,
    submitted: false,
    finalBattleHands: [],
    showOnboarding: false,
    showOverlay: false,
    showFinal: false,
    speech: '',
    phase: 'idle'
  };
}

export class BattleshipController {
  constructor({ storage } = {}) {
    this.storage = storage;
    this.progress = createProgressStore(storage);
    this.catalog = [];
    this.course = null;
    this.model = null;
    this.missions = [];
    this.state = freshState();
    this._handlers = {};
  }

  async init() {
    this.catalog = await getBattleshipCatalog();
    return this.catalog;
  }

  viewModel() {
    const mission = this.missions[this.state.missionIndex];
    return {
      phase: this.state.phase,
      catalog: this.catalog,
      course: this.course,
      model: this.model,
      missions: this.missions,
      mission,
      state: this.state,
      courseLabel: this.model ? courseLabel(this.model) : '',
      progress: this.progress,
      lastCourse: this.progress.getLastCourse(),
      missionIds: COURSE_MISSION_IDS
    };
  }

  setHandlers(h) {
    this._handlers = h || {};
  }

  async startCourse(courseId) {
    const entry = findCourse(this.catalog, courseId);
    if (!entry) throw new Error(`Unknown battleship course: ${courseId}`);
    this.course = entry;
    this.model = await loadRangeModel(entry.selection);
    if (!this.model.supported) {
      this.state.phase = 'error';
      this.state.errorMessage = 'Нет точных тренерских данных для этого диапазона.';
      return this.viewModel();
    }
    this.missions = buildMissions(this.model);
    this.state = freshState();
    this.state.phase = 'play';
    this.state.showOnboarding = !this.progress.loadOnboarding();
    if (!this.state.showOnboarding) this._loadMission(0);
    return this.viewModel();
  }

  startGame() {
    this.state.showOnboarding = false;
    this.progress.saveOnboarding();
    this._loadMission(0);
    return this.viewModel();
  }

  backToCatalog() {
    this.state.phase = 'catalog';
    this.missions = [];
    this.model = null;
    this.course = null;
    return this.viewModel();
  }

  backToHub() {
    this.state.phase = 'hub';
    return this.viewModel();
  }

  _inRange(hand) {
    return isOpen(hand, this.model) === true;
  }

  _loadMission(index) {
    const mission = this.missions[index];
    if (!mission) {
      this._showFinalComplete();
      return this.viewModel();
    }
    if (mission.id === 'final-battle') mission._cachedHands = null;
    Object.assign(this.state, {
      missionIndex: index,
      maxShots: mission.shots || 0,
      shots: mission.shots || 0,
      hits: 0,
      misses: 0,
      combo: 0,
      bestCombo: 0,
      used: new Set(),
      hitHands: new Set(),
      missHands: new Set(),
      mistakes: [],
      missedOpens: [],
      status: 'playing',
      choiceMade: false,
      selectedChoice: null,
      edgeAnswered: false,
      decisionIndex: 0,
      decisionResults: [],
      submitted: false,
      finalBattleHands: [],
      showOverlay: false,
      showFinal: false
    });
    this.state.phase = 'play';
    return this.viewModel();
  }

  handleChoice(choice) {
    const mission = this.missions[this.state.missionIndex];
    if (!mission || this.state.choiceMade) return this.viewModel();
    const correct = mission.getCorrectChoice();
    this.state.choiceMade = true;
    this.state.selectedChoice = choice;
    this.state.shots--;
    if (choice === correct) {
      this.state.hits++;
      this.state.combo++;
      this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
      this.state.speech = `✅ Правильно! ${choice} входит в open.`;
    } else {
      this.state.misses++;
      this.state.combo = 0;
      this.state.mistakes.push({ hand: choice, category: mission.id, expected: correct, selected: choice, errorType: 'WRONG_CHOICE' });
      this.state.speech = `❌ Неправильно. Правильный ответ: ${correct}.`;
    }
    this._finishMission();
    return this.viewModel();
  }

  handleDecision(decision) {
    const mission = this.missions[this.state.missionIndex];
    if (!mission) return this.viewModel();
    const hands = mission.type === 'FINAL_BATTLE'
      ? (this.state.finalBattleHands.length ? this.state.finalBattleHands : mission.getActiveHands())
      : mission.getDecisions();
    if (!this.state.finalBattleHands.length && mission.type === 'FINAL_BATTLE') {
      this.state.finalBattleHands = hands;
    }
    if (this.state.decisionIndex >= hands.length) return this.viewModel();

    const hand = hands[this.state.decisionIndex];
    const open = this._inRange(hand);
    const correct = open ? 'OPEN' : 'FOLD';
    const isCorrect = decision === correct;
    this.state.shots--;
    this.state.decisionIndex++;
    this.state.decisionResults.push({ hand, decision, correct, isCorrect });
    if (isCorrect) {
      this.state.hits++;
      this.state.combo++;
      this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
    } else {
      this.state.misses++;
      this.state.combo = 0;
      this.state.mistakes.push({ hand, category: getHandCategory(hand), expected: correct, selected: decision, errorType: 'WRONG_DECISION' });
    }
    this.state.speech = `${hand} — ${correct === 'OPEN' ? '✅ OPEN' : '❌ FOLD'}`;
    if (this.state.shots <= 0 || this.state.decisionIndex >= hands.length) this._finishMission();
    return this.viewModel();
  }

  toggleHand(hand) {
    const mission = this.missions[this.state.missionIndex];
    if (!mission?.usesSubmit || this.state.submitted) return this.viewModel();
    if (this.state.used.has(hand)) this.state.used.delete(hand);
    else this.state.used.add(hand);
    return this.viewModel();
  }

  handleEdgeClick(hand) {
    const mission = this.missions[this.state.missionIndex];
    if (!mission || this.state.edgeAnswered || this.state.shots <= 0) return this.viewModel();
    this.state.edgeAnswered = true;
    this.state.used.add(hand);
    this.state.shots--;
    const boundary = mission.getBoundary();
    const continuous = mission.edgeMode ? mission.edgeMode() : boundary.continuous;
    if (continuous && hand === boundary.lastOpen) {
      this.state.hits++;
      this.state.combo++;
      this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
      this.state.hitHands.add(hand);
      this.state.speech = `✅ Правильно! ${hand} — последняя OPEN рука.`;
    } else if (!continuous) {
      const ok = this._inRange(hand) === (this.state.used.has(hand));
      if (this._inRange(hand)) {
        this.state.hits++;
        this.state.hitHands.add(hand);
        this.state.speech = `✅ ${hand} — OPEN`;
      } else {
        this.state.misses++;
        this.state.mistakes.push({ hand, category: mission.id, expected: 'OPEN', selected: hand, errorType: 'WRONG_EDGE' });
        this.state.speech = `❌ ${hand} — FOLD`;
      }
    } else {
      this.state.misses++;
      this.state.missHands.add(hand);
      this.state.mistakes.push({ hand, category: mission.id, expected: boundary.lastOpen, selected: hand, errorType: 'WRONG_EDGE' });
      this.state.speech = `❌ Неправильно. Правильный ответ: ${boundary.lastOpen}.`;
    }
    this._finishMission();
    return this.viewModel();
  }

  submitRangeHunt() {
    const mission = this.missions[this.state.missionIndex];
    if (!mission?.usesSubmit || this.state.submitted) return this.viewModel();
    this.state.submitted = true;
    const challengeHands = mission.getChallengeHands();
    const targetSet = new Set(mission.getTargetHands());
    for (const hand of challengeHands) {
      const expectedOpen = targetSet.has(hand);
      const selectedOpen = this.state.used.has(hand);
      if (expectedOpen && selectedOpen) {
        this.state.hitHands.add(hand);
        this.state.hits++;
        this.state.combo++;
        this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
      } else if (!expectedOpen && !selectedOpen) {
        /* correct fold */
      } else if (expectedOpen && !selectedOpen) {
        this.state.missedOpens.push({ hand, category: getHandCategory(hand), errorType: 'MISSED_OPEN', expected: 'OPEN', selected: 'NOT_SELECTED' });
      } else {
        this.state.misses++;
        this.state.combo = 0;
        this.state.mistakes.push({ hand, category: getHandCategory(hand), expected: 'FOLD', selected: 'OPEN', errorType: 'FALSE_POSITIVE' });
      }
    }
    this._finishMission();
    return this.viewModel();
  }

  _finishMission() {
    this.state.status = 'finished';
    const mission = this.missions[this.state.missionIndex];
    let score = 0;
    if (mission.type === 'FULL_SECTOR_CONFIRM') {
      score = this.state.selectedChoice === mission.getCorrectChoice() ? 100 : 0;
    } else if (mission.type === 'FIND_THE_EDGE') {
      const b = mission.getBoundary();
      score = this.state.hitHands.has(b.lastOpen) ? 100 : (this.state.hits > 0 ? 50 : 0);
    } else if (mission.type === 'RANGE_HUNT') {
      const challenge = mission.getChallengeHands();
      const targetSet = new Set(mission.getTargetHands());
      let correct = 0;
      for (const hand of challenge) {
        const expected = targetSet.has(hand);
        const selected = this.state.used.has(hand);
        if ((expected && selected) || (!expected && !selected)) correct++;
      }
      score = challenge.length ? Math.round(correct / challenge.length * 100) : 0;
    } else {
      const results = this.state.decisionResults;
      const correct = results.filter((r) => r.isCorrect).length;
      score = results.length ? Math.round(correct / results.length * 100) : 0;
    }
    this.state.missionScore = score;
    this.progress.saveMissionResult(
      this.course.courseId,
      this.course.chartId,
      mission.id,
      {
        type: mission.type,
        accuracy: score,
        hits: this.state.hits,
        misses: this.state.misses,
        bestCombo: this.state.bestCombo,
        mistakes: this.state.mistakes,
        missedOpens: this.state.missedOpens
      },
      COURSE_MISSION_IDS
    );
    this.state.showOverlay = true;
    return this.viewModel();
  }

  nextMission() {
    this.state.showOverlay = false;
    if (this.state.missionIndex >= this.missions.length - 1) return this._showFinalComplete();
    return this._loadMission(this.state.missionIndex + 1);
  }

  retryMission() {
    this.state.showOverlay = false;
    return this._loadMission(this.state.missionIndex);
  }

  _showFinalComplete() {
    this.state.showOverlay = false;
    this.state.showFinal = true;
    this.state.phase = 'complete';
    return this.viewModel();
  }

  repeatWeakMission() {
    const worst = this.progress.getWeakestMission(this.course.courseId, COURSE_MISSION_IDS);
    if (!worst) return this.viewModel();
    const index = this.missions.findIndex((m) => m.id === worst.missionId);
    if (index === -1) return this.viewModel();
    this.state.returnToFinal = true;
    this.state.showFinal = false;
    return this._loadMission(index);
  }

  restartCourse() {
    this.progress.clearCourseProgress(this.course.courseId, COURSE_MISSION_IDS);
    this.state.showFinal = false;
    this.state.returnToFinal = false;
    return this._loadMission(0);
  }

  resetMissionProgress() {
    if (this.course) this.progress.clearCourseProgress(this.course.courseId, COURSE_MISSION_IDS);
    return this.viewModel();
  }
}
