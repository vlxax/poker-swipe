// Personalised training UI bridge (ESM module). Loaded once as a module script
// from index.html; runs after all classic inline scripts, so the core bridge
// (renderDaily / show / localStorage / solver) already exists. It:
//   • creates the persistent training store (same prefix as the solver layer),
//   • installs the My Hands candidate-recording hook,
//   • replaces renderDaily so the #daily screen shows personalised training
//     when a leak profile exists and falls back to the validated legacy Daily
//     flow otherwise,
//   • exposes window.PersonalizedTrainingUi for diagnostics/tests.

import {
  createTrainingStore, recordCandidate, normalizeCandidate, handContentKey
} from '../solver/src/index.js';
import { getTaskById } from '../solver/src/training/taskLibraryBridge.js';
import { SessionController } from './sessionController.js';
import { AssessmentController } from './assessmentController.js';
import { installMiniAppHooks } from './miniAppHooks.js';
import { installOnboardingHooks } from './onboardingHooks.js';
import { installHomeRecommendation } from './homeRecommendation.js';
import { loadTrainerCandidateIndex } from '../solver/src/training/trainerCandidatePool.js';
import { buildCanonicalSpot } from '../task-context/canonicalSpot.js';
import { solve, SOLVE_OPTS } from './solveBridge.js';
import { drillViewModel } from './viewModel.js';
import * as R from './renderer.js';
import { installGradingGateway } from './gradingGateway.js';

if (typeof window !== 'undefined') installGradingGateway(window);

const storage = (() => {
  try {
    const s = window.localStorage;
    s.setItem('__ps_tr_probe__', '1');
    s.removeItem('__ps_tr_probe__');
    return s;
  } catch (e) { return null; }
})();

const store = createTrainingStore({ storage });
if (typeof window !== 'undefined') {
  window.TaskContextCanonical = { buildCanonicalSpot };
}
loadTrainerCandidateIndex().catch(() => {});
const miniApps = installMiniAppHooks(store, { appWindow: typeof window !== 'undefined' ? window : undefined });
installHomeRecommendation(typeof window !== 'undefined' ? window : undefined);

if (typeof window !== 'undefined' && document.getElementById('home')?.classList.contains('active')) {
  try { window.renderHome?.(); } catch (e) { /* ignore */ }
}

const SESSION_CONFIG = {
  count: 7,
  maxAttempts: 5,
  timeBudgetMs: 45000,
  trendMinSamples: 5
};

// ---- My Hands candidate-recording hook ---------------------------------------
// Called from the classic solver review render once a trainingCandidate exists.
// Recording is best-effort and must never interrupt the review UI.
window.__recordTrainingCandidate = function (model, hand) {
  if (!model || !model.trainingCandidate) return;
  try {
    const sourceHandId = hand && (hand.id || hand.handId)
      ? (hand.id || hand.handId)
      : (hand ? handContentKey(hand) : 'my-hands');
    const candidate = normalizeCandidate({ reviewModel: model, sourceHandId, sourceCandidateId: sourceHandId });
    recordCandidate(store, candidate);
  } catch (e) { /* never interrupt the review */ }
};

// ---- Legacy fallback ----------------------------------------------------------
const legacyRenderDaily = (typeof window.renderDaily === 'function') ? window.renderDaily : null;

const root = () => document.querySelector('#dailyArea');

const ctl = new SessionController({
  store,
  solve,
  solveOpts: SOLVE_OPTS,
  config: SESSION_CONFIG,
  onStateChange: () => paint()
});

// Primary 12-question diagnostic (P0). Run before the first personalised session
// so the personal CTA (homeViewModel 'training' type) has a skill profile to
// drive off. Optional: falling back to the leak-driven training flow is safe.
const assessment = new AssessmentController({
  store,
  onStateChange: () => paint()
});

  const onboarding = installOnboardingHooks({ store, assessment, appWindow: typeof window !== 'undefined' ? window : undefined });

const goHome = () => {
  if (typeof window.show === 'function') window.show('home');
  else if (legacyRenderDaily) legacyRenderDaily();
};

function legacyFallback() {
  if (typeof window.__legacyDailyIntro === 'function') window.__legacyDailyIntro();
  else if (legacyRenderDaily) legacyRenderDaily();
}

function previewScenarioFromPlan(preparedDaily) {
  const ref = preparedDaily?.plan?.spots?.[0] || preparedDaily?.plan?.drills?.[0];
  if (!ref) return null;
  const spot = ref.hero ? ref : getTaskById(ref.id || ref.spotId);
  if (!spot) return null;
  return {
    heroCards: spot.hero,
    board: spot.board || [],
    heroPosition: spot.position,
    villainPosition: spot.villain,
    potBb: spot.pot,
    effectiveStackBb: spot.heroStack != null ? spot.heroStack : spot.effStack,
    street: spot.street,
    format: spot.format,
    stage: spot.stage,
    table: spot.table
  };
}

const handlers = {
  start() {
    const r = ctl.start();
    if (r.reason === 'no_profile') { legacyFallback(); return; }
    if (r.started) {
      window.MiniAppNav?.reset('daily');
      pushDailyNav({ phase: 'lobby' });
      if (ctl.state === 'ready' || ctl.state === 'limited') {
        pushDailyNav({ phase: 'drill', index: 0 });
      }
    }
    paint();
  },
  answer(optionId) {
    const res = ctl.answer(optionId);
    if (res) {
      pushDailyNav({ phase: 'feedback', index: ctl.index });
      paint();
    }
  },
  next() {
    const prevIndex = ctl.index;
    ctl.next();
    if (!ctl.showingFeedback && ctl.state !== 'done' && ctl.index !== prevIndex) {
      pushDailyNav({ phase: 'drill', index: ctl.index });
    }
    paint();
  },
  back() {
    if (ctl.state === 'idle') {
      goHome();
      return;
    }
    const result = ctl.back();
    const nav = window.MiniAppNav;
    if (nav && result && result.action !== 'noop') {
      nav.pop('daily');
    }
    paint();
  },
  more() { moreSpots(); }
};

const assessmentHandlers = {
  begin() { assessment.begin(); paint(); },
  answer(choice) { const res = assessment.answer(choice); if (res && res.done) paint(); },
  finish() { assessment.finish(); paint(); },
  back() { goHome(); }
};

function moreSpots() {
  ctl._resetRun();
  ctl.config = { ...ctl.config, count: 5 };
  const r = ctl.start();
  if (r.reason === 'no_profile') { legacyFallback(); return; }
  paint();
}

function drillVM() {
  const drill = ctl.current();
  const prog = ctl.progress();
  const snap = ctl.taskStates[ctl.index];
  const vm = drillViewModel({ drill, index: prog.index, total: prog.total });
  if (snap && snap.optionId) vm.selectedOptionId = snap.optionId;
  return vm;
}

function syncDailyNav() {
  const nav = window.MiniAppNav;
  if (!nav || assessment.state === 'answering') return;
  const st = ctl.state;
  if (st === 'idle' && nav.depth('daily') === 0) {
    nav.reset('daily');
    nav.push('daily', { phase: 'lobby' });
  }
}

function pushDailyNav(snap) {
  window.MiniAppNav?.push('daily', snap);
}

function paint() {
  const el = root();
  if (!el) return;

  if (assessment.state === 'answering') {
    R.renderAssessment(el, assessment.viewModel(), assessmentHandlers);
    return;
  }

  if (assessment.shouldShowSummary()) {
    const vm = assessment.viewModel();
    R.renderAssessmentSummary(el, vm, {
      back: () => {
        assessment.acknowledgeCompletion();
        ctl.start();
        paint();
      }
    });
    return;
  }

  const st = ctl.state;

  if (st === 'ready' || st === 'limited') {
    if (ctl.showingFeedback && ctl.lastAnswer) {
      R.renderFeedback(el, ctl.feedbackVM(), handlers);
    } else {
      R.renderDrill(el, drillVM(), handlers);
    }
  } else if (st === 'done') {
    R.renderSummary(el, ctl.summary(), { ...handlers, back: goHome });
  } else if (st === 'loading') {
    R.renderLoading(el, { cancel: () => { ctl.cancel(); paint(); } });
  } else if (st === 'error') {
    R.renderError(el, { retry: () => { ctl._resetRun(); handlers.start(); } });
  } else if (st === 'cancelled') {
    R.renderCancelled(el, { back: goHome });
  } else {
    // idle / fallback → show home; if not personalised, use legacy validated daily.
    syncDailyNav();
    const vm = ctl.home();
    if (vm.type === 'training') {
      vm.previewScenario = previewScenarioFromPlan(ctl.preparedDaily);
      R.renderHome(el, vm, { start: handlers.start });
    } else {
      // No leak or skill profile yet → offer the primary diagnostic as the entry
      // to personalised training, keeping the validated legacy daily available.
      R.renderAssessmentIntro(el, { copy: null }, {
        begin: assessmentHandlers.begin,
        legacy: legacyFallback
      });
    }
  }
}

// Replace renderDaily (via the exposeV32 live accessor) so show('daily') hits us.
window.renderDaily = function () { paint(); };

// Entry point for the UI shell: run the primary diagnostic (first-run), or jump
// straight to training when a skill profile already exists.
window.PersonalizedTrainingUi = {
  store,
  controller: ctl,
  assessment,
  onboarding,
  paint,
  beginAssessment: () => { assessment.begin(); paint(); },
  miniApps
};

export { store, ctl, paint, assessment };