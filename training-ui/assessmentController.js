// Assessment controller for the primary (12-question) diagnostic (requirement
// P0). Owns the per-question lifecycle (idle → answering → done), builds the
// question set, records answers, and on completion runs the assessment to
// produce a skill profile + leak profile which it persists to the store and
// surfaces through analytics. Pure state + store calls; DOM stays in the
// renderer. Deterministic given the same rng, so it is unit-testable.

import {
  buildAssessmentSet, runAssessment, createAnalytics, buildLeakProfile
} from '../solver/src/index.js';
import { seedSkillEvidenceFromAssessment, buildSkillProfile } from '../solver/src/training/skillProfile.js';
import { assessmentViewModel, assessmentSummaryViewModel } from './viewModel.js';

export class AssessmentController {
  constructor({ store = null, rng = Math.random, now = Date.now, count = 12, onStateChange = null } = {}) {
    this.store = store;
    this.rng = rng;
    this.now = now;
    this.count = count;
    this.onStateChange = onStateChange;

    this.state = 'idle'; // idle | answering | done
    this.set = [];
    this.answers = [];
    this.index = 0;
    this.result = null;
    this._pendingSummary = false;
  }

  _notify() {
    if (typeof this.onStateChange === 'function') this.onStateChange(this.state);
  }

  hasResult() {
    return !!(this.result && this.result.skillProfile);
  }

  shouldShowSummary() {
    return this._pendingSummary && this.state === 'done' && !!this.result;
  }

  // Leave the one-shot summary screen; later Daily visits show training home.
  acknowledgeCompletion() {
    this._pendingSummary = false;
    this.state = 'idle';
    this.set = [];
    this.answers = [];
    this.index = 0;
    this._notify();
  }

  // Start the diagnostic: build the question set and enter the answering state.
  begin() {
    const seed = this.store && typeof this.store.getOrCreatePersonalizationSeed === 'function'
      ? this.store.getOrCreatePersonalizationSeed()
      : null;
    this.set = buildAssessmentSet({ rng: this.rng, count: this.count, personalizationSeed: seed });
    this.answers = [];
    this.index = 0;
    this.result = null;
    this._pendingSummary = false;
    this.state = this.set.length ? 'answering' : 'done';
    if (this.set.length) {
      const analytics = createAnalytics({ store: this.store, now: this.now });
      analytics.assessmentStarted();
    }
    this._notify();
    return { started: this.set.length > 0, total: this.set.length };
  }

  current() {
    return this.set[this.index] || null;
  }

  progress() {
    return { index: this.set.length ? this.index + 1 : 0, total: this.set.length };
  }

  // Record a choice for the current question and advance. On the last question
  // the assessment is finalised automatically.
  answer(choice) {
    if (this.state !== 'answering') return null;
    const item = this.current();
    if (!item) return null;
    this.answers.push({ id: item.id, choice, confidence: null });
    this.index++;
    const done = this.index >= this.set.length;
    if (done) {
      this.finish();
      this._notify();
    }
    return { done, correct: choice === item.correct, answered: this.index };
  }

  // Finalise: run the assessment, persist the skill profile + assessment, record
  // the completion event, and move to 'done'. Best-effort persistence — never
  // throws into the caller.
  finish() {
    const res = runAssessment({ items: this.set, answers: this.answers, now: this.now() });
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

  // View model for the current phase: a question while answering, the result
  // summary once done.
  viewModel() {
    if (this.state === 'done' && this.result) {
      return { phase: 'summary', ...assessmentSummaryViewModel({ result: this.result }) };
    }
    return {
      phase: 'question',
      ...assessmentViewModel({ item: this.current(), index: this.index + 1, total: this.set.length })
    };
  }
}