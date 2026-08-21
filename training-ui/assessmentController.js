// Assessment controller for the adaptive initial diagnostic (requirement P0).
// Uses dedicated diagnosticSessionSeed — NOT training personalizationSeed.

import {
  createDiagnosticSession,
  createDiagnosticSessionSeed,
  selectNextDiagnosticItem,
  submitDiagnosticAnswer,
  gradeAssessmentItem,
  runAssessment,
  createAnalytics,
  buildLeakProfile,
  DIAGNOSTIC_COUNT_DEFAULT
} from '../solver/src/index.js';
import { seedSkillEvidenceFromAssessment, buildSkillProfile } from '../solver/src/training/skillProfile.js';
import { assessmentViewModel, assessmentSummaryViewModel } from './viewModel.js';

export class AssessmentController {
  constructor({
    store = null,
    rng = Math.random,
    now = Date.now,
    count = DIAGNOSTIC_COUNT_DEFAULT,
    onStateChange = null
  } = {}) {
    this.store = store;
    this.rng = rng;
    this.now = now;
    this.count = count;
    this.onStateChange = onStateChange;

    this.state = 'idle';
    this.session = null;
    this.set = [];
    this.answers = [];
    this.index = 0;
    this.result = null;
    this._pendingSummary = false;
  }

  _notify() {
    if (typeof this.onStateChange === 'function') this.onStateChange(this.state);
  }

  _sessionSeed() {
    if (this.store && typeof this.store.loadDiagnosticSessionSeed === 'function') {
      const stored = this.store.loadDiagnosticSessionSeed();
      if (stored) return stored;
    }
    const seed = createDiagnosticSessionSeed();
    if (this.store && typeof this.store.saveDiagnosticSessionSeed === 'function') {
      this.store.saveDiagnosticSessionSeed(seed);
    }
    return seed;
  }

  hasResult() {
    return !!(this.result && this.result.skillProfile);
  }

  shouldShowSummary() {
    return this._pendingSummary && this.state === 'done' && !!this.result;
  }

  acknowledgeCompletion() {
    this._pendingSummary = false;
    this.state = 'idle';
    this.session = null;
    this.set = [];
    this.answers = [];
    this.index = 0;
    this._notify();
  }

  begin() {
    const sessionSeed = this._sessionSeed();
    this.session = createDiagnosticSession({
      sessionSeed,
      targetCount: this.count
    });
    this.set = [];
    this.answers = [];
    this.index = 0;
    this.result = null;
    this._pendingSummary = false;

    const first = selectNextDiagnosticItem(this.session);
    if (!first) {
      this.state = 'done';
      this._notify();
      return { started: false, total: 0 };
    }

    this.state = 'answering';
    const analytics = createAnalytics({ store: this.store, now: this.now });
    analytics.assessmentStarted();
    this._notify();
    return { started: true, total: this.session.targetCount };
  }

  current() {
    return this.session?._currentItem || null;
  }

  progress() {
    const total = this.session?.targetCount || this.count;
    return { index: this.session ? this.session.index + 1 : 0, total };
  }

  answer(choice) {
    if (this.state !== 'answering' || !this.session) return null;
    const item = this.current();
    if (!item) return null;

    const grade = gradeAssessmentItem(item, choice);
    submitDiagnosticAnswer(this.session, choice, grade);
    this.answers.push({ id: item.id, choice, confidence: null });
    this.set.push(item);
    this.index = this.session.index;

    const done = this.session.done;
    if (done) {
      this.finish();
    } else {
      selectNextDiagnosticItem(this.session);
    }
    this._notify();
    return { done, correct: grade.correct, answered: this.index };
  }

  finish() {
    const res = runAssessment({
      items: this.set,
      answers: this.answers,
      session: this.session,
      now: this.now()
    });
    this.result = res;
    this.state = 'done';
    this._pendingSummary = true;
    if (this.store) {
      try {
        this.store.saveAssessment(res);
        seedSkillEvidenceFromAssessment(this.store, res, this.now());
        if (res.skillProfile) {
          const stored = this.store.loadSkillEvidence ? this.store.loadSkillEvidence() : null;
          const profile = stored && Object.keys(stored).length
            ? buildSkillProfile({ storedEvidence: stored, now: this.now() })
            : res.skillProfile;
          this.store.saveSkillProfile(profile);
        }
        for (const [concept, prof] of Object.entries(res.leakProfiles || {})) {
          const events = (prof && prof.attempts) || [];
          if (!events.length) continue;
          const profile = buildLeakProfile({ concept, events, now: this.now() });
          this.store.saveProfile(profile);
        }
        const analytics = createAnalytics({ store: this.store, now: this.now });
        analytics.assessmentCompleted({
          answered: res.answered,
          total: res.total,
          overall: res.overall,
          weakestSkill: res.weakestSkill
        });
        if (res.skillProfile) analytics.profileUpdated(res.skillProfile);
      } catch (_) { /* non-fatal */ }
    }
    this._notify();
    return res;
  }

  viewModel() {
    if (this.state === 'done' && this.result) {
      return { phase: 'summary', ...assessmentSummaryViewModel({ result: this.result }) };
    }
    return {
      phase: 'question',
      ...assessmentViewModel({
        item: this.current(),
        index: this.progress().index,
        total: this.progress().total
      })
    };
  }
}
