// Range Battleship game controller — matrix-tap gameplay, trainer-backed only.

import { findCourse, getBattleshipCatalog } from './courses.js';
import { loadRangeModel, isOpen, courseLabel } from './trainerRangeModel.js';
import { buildMissions, grenadesForMission, DEFAULT_GRENADES, missionRangeLabel } from './missions.js';
import { createProgressStore } from './progress.js';
import { getHandCategory } from './matrixUtils.js';
import { isGradable } from './trainerRangeModel.js';

function freshState() {
  return {
    missionIndex: 0,
    grenades: DEFAULT_GRENADES,
    hits: 0,
    misses: 0,
    combo: 0,
    bestCombo: 0,
    found: 0,
    targetTotal: 0,
    resolved: new Set(),
    hitHands: new Set(),
    missHands: new Set(),
    mistakes: [],
    status: 'idle',
    showMissionIntro: true,
    showOverlay: false,
    showFinal: false,
    speech: '',
    feedback: null,
    flashHand: null,
    phase: 'idle',
    tutorialPhase: null,
    tutorialHand: null,
    missionScore: 0,
    weakSector: null,
    showFailOverlay: false,
    missionFailed: false,
    missedTargets: [],
    wrongHands: []
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
      rangeLabel: this.model ? missionRangeLabel(this.model) : '',
      progress: this.progress,
      lastCourse: this.progress.getLastCourse(),
      missionIds: this.missions.map((m) => m.id),
      courseProgressList: this.progress.getCourseProgressList(this.catalog)
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
    this.state.showMissionIntro = true;
    this.progress.saveLastCourse(courseId, entry.chartId);
    return this.viewModel();
  }

  beginMission() {
    this.state.showMissionIntro = false;
    this._loadMission(this.state.missionIndex);
    return this.viewModel();
  }

  backToCatalog() {
    this.state.phase = 'catalog';
    this.missions = [];
    this.model = null;
    this.course = null;
    this.state = freshState();
    return this.viewModel();
  }

  backToHub() {
    this.state.phase = 'hub';
    return this.viewModel();
  }

  _inRange(hand) {
    return isOpen(hand, this.model) === true;
  }

  _setupTutorial(mission) {
    if (this.progress.loadTutorialCompleted()) return;
    const targets = mission.getTargetHands();
    if (!targets.length) return;
    this.state.tutorialPhase = 'pulse';
    this.state.tutorialHand = targets[0];
  }

  _loadMission(index) {
    const mission = this.missions[index];
    if (!mission) {
      this._showFinalComplete();
      return this.viewModel();
    }
    const targets = mission.getTargetHands();
    Object.assign(this.state, {
      missionIndex: index,
      grenades: grenadesForMission(mission),
      hits: 0,
      misses: 0,
      combo: 0,
      found: 0,
      targetTotal: targets.length,
      resolved: new Set(),
      hitHands: new Set(),
      missHands: new Set(),
      mistakes: [],
      status: 'playing',
      showOverlay: false,
      showFinal: false,
      speech: '',
      feedback: null,
      flashHand: null,
      tutorialPhase: null,
      tutorialHand: null,
      showFailOverlay: false,
      missionFailed: false,
      missedTargets: [],
      wrongHands: []
    });
    this.state.phase = 'play';
    if (index === 0 && !this.progress.loadTutorialCompleted()) {
      this._setupTutorial(mission);
    }
    return this.viewModel();
  }

  handleCellTap(hand) {
    const mission = this.missions[this.state.missionIndex];
    if (!mission || this.state.status !== 'playing' || this.state.showMissionIntro) {
      return this.viewModel();
    }
    if (this.state.resolved.has(hand)) return this.viewModel();
    if (!isGradable(hand, this.model)) return this.viewModel();

    const targetSet = new Set(mission.getTargetHands());
    const isTarget = targetSet.has(hand);

    if (this.state.tutorialPhase === 'pulse') {
      if (hand !== this.state.tutorialHand) return this.viewModel();
      this._applyHit(hand, mission);
      this.state.tutorialPhase = 'confirm';
      this.state.speech = 'Да. Попал.';
      this.state.feedback = { type: 'hit', hand, text: 'ПОПАЛ' };
      return this.viewModel();
    }
    if (this.state.tutorialPhase === 'confirm') return this.viewModel();

    this.state.resolved.add(hand);
    if (isTarget) this._applyHit(hand, mission);
    else this._applyMiss(hand, mission);

    if (this.state.tutorialPhase === null && !this.progress.loadTutorialCompleted() && this.state.missionIndex === 0) {
      this.progress.saveTutorialCompleted();
    }

    if (this.state.found >= this.state.targetTotal) this._finishMission(true);
    else if (this.state.grenades <= 0) this._finishMission(false);
    return this.viewModel();
  }

  dismissTutorial() {
    if (this.state.tutorialPhase === 'confirm') {
      this.state.tutorialPhase = null;
      this.state.tutorialHand = null;
      this.state.speech = 'Теперь попробуй сам.';
      this.progress.saveTutorialCompleted();
    }
    return this.viewModel();
  }

  _applyHit(hand, mission) {
    if (!this.state.resolved.has(hand)) this.state.resolved.add(hand);
    this.state.hitHands.add(hand);
    this.state.hits++;
    this.state.found++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
    this.state.flashHand = hand;
    this.state.feedback = { type: 'hit', hand, text: 'ПОПАЛ' };
    this.state.speech = `ПОПАЛ · ${hand}`;
  }

  _applyMiss(hand, mission) {
    this.state.missHands.add(hand);
    this.state.misses++;
    this.state.combo = 0;
    this.state.grenades = Math.max(0, this.state.grenades - 1);
    this.state.flashHand = hand;
    this.state.feedback = { type: 'miss', hand, text: 'МИМО' };
    this.state.speech = `МИМО · ${hand}`;
    this.state.mistakes.push({
      hand,
      category: getHandCategory(hand),
      expected: 'FOLD',
      selected: hand,
      errorType: 'FALSE_POSITIVE'
    });
  }

  _finishMission(success) {
    this.state.status = 'finished';
    const mission = this.missions[this.state.missionIndex];
    const score = Math.round((this.state.hits / Math.max(this.state.targetTotal, 1)) * 100);
    const capped = Math.min(100, score);
    this.state.missionScore = capped;

    if (!success) {
      const targets = new Set(mission.getTargetHands());
      this.state.missionFailed = true;
      this.state.missedTargets = [...targets].filter((h) => !this.state.hitHands.has(h));
      this.state.wrongHands = [...this.state.missHands];
      this.state.showFailOverlay = true;
      this.state.showOverlay = false;
      return this.viewModel();
    }

    const catCounts = {};
    for (const m of this.state.mistakes) {
      const cat = m.category || 'other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    const weak = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    this.state.weakSector = weak ? weak[0] : null;

    this.progress.saveMissionResult(
      this.course.courseId,
      this.course.chartId,
      mission.id,
      {
        type: mission.type,
        accuracy: capped,
        hits: this.state.hits,
        misses: this.state.misses,
        bestCombo: this.state.bestCombo,
        mistakes: this.state.mistakes,
        missedOpens: []
      },
      this.missions.map((m) => m.id)
    );
    this.state.showOverlay = true;
    this.state.showFailOverlay = false;
    return this.viewModel();
  }

  nextMission() {
    this.state.showOverlay = false;
    if (this.state.missionIndex >= this.missions.length - 1) return this._showFinalComplete();
    this.state.missionIndex++;
    this.state.showMissionIntro = true;
    this.state.phase = 'play';
    return this.viewModel();
  }

  retryMission() {
    this.state.showOverlay = false;
    this.state.showFailOverlay = false;
    this.state.showMissionIntro = false;
    return this._loadMission(this.state.missionIndex);
  }

  _showFinalComplete() {
    this.state.showOverlay = false;
    this.state.showFinal = true;
    this.state.phase = 'complete';
    return this.viewModel();
  }

  repeatWeakMission() {
    const missionIds = this.missions.map((m) => m.id);
    const worst = this.progress.getWeakestMission(this.course.courseId, missionIds);
    if (!worst) return this.viewModel();
    const index = this.missions.findIndex((m) => m.id === worst.missionId);
    if (index === -1) return this.viewModel();
    this.state.showFinal = false;
    this.state.showMissionIntro = false;
    return this._loadMission(index);
  }

  restartCourse() {
    this.progress.clearCourseProgress(this.course.courseId, this.missions.map((m) => m.id));
    this.state.showFinal = false;
    this.state.missionIndex = 0;
    this.state.showMissionIntro = true;
    return this.viewModel();
  }

  resetMissionProgress() {
    if (this.course) this.progress.clearCourseProgress(this.course.courseId, this.missions.map((m) => m.id));
    return this.viewModel();
  }
}
