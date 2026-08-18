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
import { SessionController } from './sessionController.js';
import { drillViewModel } from './viewModel.js';
import { solve, SOLVE_OPTS } from './solveBridge.js';
import * as R from './renderer.js';

const storage = (() => {
  try {
    const s = window.localStorage;
    s.setItem('__ps_tr_probe__', '1');
    s.removeItem('__ps_tr_probe__');
    return s;
  } catch (e) { return null; }
})();

const store = createTrainingStore({ storage });

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

const goHome = () => {
  if (typeof window.show === 'function') window.show('home');
  else if (legacyRenderDaily) legacyRenderDaily();
};

function legacyFallback() { if (legacyRenderDaily) legacyRenderDaily(); }

const handlers = {
  start() {
    const r = ctl.start();
    if (r.reason === 'no_profile') { legacyFallback(); return; }
    if (r.started) paint();
  },
  answer(optionId) {
    const res = ctl.answer(optionId);
    if (res) paint();
  },
  next() { ctl.next(); paint(); },
  more() { moreSpots(); },
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
  return drillViewModel({ drill, index: prog.index, total: prog.total });
}

function paint() {
  const el = root();
  if (!el) return;
  const st = ctl.state;

  if (st === 'ready' || st === 'limited') {
    R.renderDrill(el, drillVM(), handlers);
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
    const vm = ctl.home();
    if (vm.type === 'personalized') R.renderHome(el, vm, { start: handlers.start });
    else legacyFallback();
  }
}

// Replace renderDaily (via the exposeV32 live accessor) so show('daily') hits us.
window.renderDaily = function () { paint(); };

window.PersonalizedTrainingUi = { store, controller: ctl, paint };

export { store, ctl, paint };