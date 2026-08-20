// Session controller for the personalised training flow. Owns the async session
// lifecycle (LOADING / READY / LIMITED / ERROR / CANCELLED + fallback) and guards
// against duplicate START taps, stale async results and double answer submits.
// Pure state + solver calls; DOM rendering stays in renderer.js.

import {
  buildPersonalizedSessionAsync, gradeAnswer, recordTrainingResult,
  getTopLeaks, getDailyPersonalizedTraining
} from '../solver/src/index.js';
import { homeViewModel, summaryViewModel } from './viewModel.js';

export class SessionController {
  constructor({ store, solve, solveOpts = {}, config = {}, onStateChange = null, now = Date.now } = {}) {
    this.store = store;
    this.solve = solve;
    this.solveOpts = solveOpts;
    this.config = config;
    this.onStateChange = onStateChange;
    this.now = now;

    this.state = 'idle'; // idle | loading | ready | limited | error | cancelled | done | fallback
    this.session = null;
    this.drills = [];
    this.index = 0;
    this.results = [];
    this.baselineLossByConcept = {};
    this.abort = null;
    this.genToken = 0;
    this.answering = false;
  }

  // ---- Home -----------------------------------------------------------------

  home() {
    const leaks = getTopLeaks(this.store, { now: this.now() });
    const plan = getDailyPersonalizedTraining({ store: this.store, count: this.config.count || 7, now: this.now() });
    const skillProfile = typeof this.store.loadSkillProfile === 'function'
      ? this.store.loadSkillProfile()
      : null;
    return homeViewModel({ leaks, plan, skillProfile });
  }

  hasProfile() {
    const skillProfile = typeof this.store.loadSkillProfile === 'function'
      ? this.store.loadSkillProfile()
      : null;
    if (skillProfile && skillProfile.overall != null) return true;
    return (getTopLeaks(this.store, { now: this.now() }) || []).length > 0;
  }

  _notify() {
    if (typeof this.onStateChange === 'function') this.onStateChange(this.state);
  }

  // ---- Start ----------------------------------------------------------------

  // Starts drill generation. Duplicate taps while a generation is already in
  // flight are ignored (no concurrent jobs). A loaded, unfinished session is
  // reused instead of regenerated.
  start() {
    if (this.state === 'loading') return { started: false, reason: 'busy' };

    if (this.session && this.drills && this.drills.length) {
      if (this.state === 'done' || this.state === 'fallback' || this.state === 'cancelled') this._resetRun();
      else return { started: true, cached: true, session: this.session };
    }

    if (!this.hasProfile()) {
      this.state = 'fallback';
      this._notify();
      return { started: false, reason: 'no_profile', fallback: true };
    }

    const token = ++this.genToken;
    const ctrl = new AbortController();
    this.abort = ctrl;
    this.state = 'loading';
    this._notify();

    buildPersonalizedSessionAsync({
      store: this.store,
      count: this.config.count || 7,
      solve: this.solve,
      solveOpts: this.solveOpts,
      config: this.config,
      signal: ctrl.signal,
      now: this.now()
    }).then(
      (session) => this._onGenerated(token, session),
      (err) => this._onError(token, err)
    );

    return { started: true, cached: false };
  }

  _onGenerated(token, session) {
    if (token !== this.genToken) return; // stale async result must not overwrite a newer session
    const drills = (session && session.drills) || [];
    if (!drills.length) {
      this.state = 'fallback';
      this._notify();
      return;
    }
    this.session = session;
    this.drills = drills;
    this.index = 0;
    this.results = [];
    this._captureBaseline();
    const total = session && session.plan ? session.plan.total : drills.length;
    this.state = drills.length < total ? 'limited' : 'ready';
    this._notify();
  }

  _onError(token) {
    if (token !== this.genToken) return;
    this.state = 'error';
    this._notify();
  }

  cancel() {
    if (this.abort) { try { this.abort.abort(); } catch (e) { /* ignore */ } }
    this.state = 'cancelled';
    this._notify();
  }

  _resetRun() {
    this.session = null;
    this.drills = [];
    this.index = 0;
    this.results = [];
    this.baselineLossByConcept = {};
    this.state = 'idle';
  }

  _captureBaseline() {
    this.baselineLossByConcept = {};
    const primary = this.session && this.session.primaryConcept;
    if (!primary) return;
    const losses = (this.store.loadHistory() || [])
      .filter((h) => h && h.concept === primary)
      .map((h) => h.evLossBb);
    this.baselineLossByConcept[primary] = losses;
  }

  // ---- Drill interaction ----------------------------------------------------

  current() {
    return this.drills[this.index] || null;
  }

  progress() {
    return { index: this.drills.length ? this.index + 1 : 0, total: this.drills.length };
  }

  answer(optionId) {
    if (this.state !== 'ready' && this.state !== 'limited') return null;
    if (this.answering) return null; // prevent double submission
    const drill = this.current();
    if (!drill) return null;

    this.answering = true;
    let result = null;
    try {
      result = gradeAnswer({ drill, chosenId: optionId });
      recordTrainingResult(this.store, {
        drill, grade: result.grade, evLossBb: result.evLossBb, now: this.now()
      });
      this.results.push({ ...result, concept: drill.concept });
    } finally {
      this.answering = false;
    }
    return result;
  }

  next() {
    if (this.state !== 'ready' && this.state !== 'limited') return { done: false };
    if (this.index < this.drills.length - 1) {
      this.index++;
      this._notify();
      return { done: false };
    }
    this.state = 'done';
    this._notify();
    return { done: true };
  }

  summary() {
    const primary = this.session && this.session.primaryConcept;
    return summaryViewModel({
      session: this.session,
      results: this.results,
      baselineLosses: primary ? this.baselineLossByConcept[primary] || [] : [],
      minSamples: this.config.trendMinSamples || 5
    });
  }
}