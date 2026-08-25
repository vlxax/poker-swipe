// Ranges section bridge — trainer browser + narrowing trainer.

import { RangeController } from './controller.js';
import { TrainerBrowserController } from './trainerBrowserController.js';
import * as R from './renderer.js';

const storage = (() => {
  try {
    const s = window.localStorage;
    s.setItem('__ps_rng_probe__', '1');
    s.removeItem('__ps_rng_probe__');
    return s;
  } catch (e) { return null; }
})();

function getPack() {
  return window.POKER_BRAIN_PACK || null;
}

function ensureScreen() {
  if (document.getElementById('ranges')) return document.querySelector('#rangesArea');
  const main = document.querySelector('#mainApp main') || document.querySelector('main');
  if (!main) return null;
  main.insertAdjacentHTML('beforeend', '<section id="ranges" class="screen"><div id="rangesArea"></div></section>');
  if (!document.querySelector('link[data-ranges-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'ranges-ui/ranges.css';
    link.dataset.rangesCss = '1';
    document.head.appendChild(link);
  }
  return document.querySelector('#rangesArea');
}

const root = () => ensureScreen() || document.querySelector('#rangesArea');

const narrowCtl = new RangeController({ pack: getPack(), storage });
const trainerCtl = new TrainerBrowserController({ pack: getPack(), storage });

let mode = 'hub'; // hub | trainer | narrowing

function hubVm() {
  return {
    phase: 'hub',
    title: 'РЕНДЖИ',
    subtitle: 'Тренерская база + сужение диапазона'
  };
}

function currentVm() {
  if (mode === 'hub') return hubVm();
  if (mode === 'trainer') return trainerCtl.viewModel();
  return narrowCtl.viewModel();
}

const handlers = {
  openTrainer() {
    mode = 'trainer';
    trainerCtl.init().then(() => paint());
  },
  openNarrowing() {
    mode = 'narrowing';
    narrowCtl.startScenario();
    window.MiniAppNav?.reset('ranges');
    window.MiniAppNav?.push('ranges', { phase: 'intro', mode: 'narrowing' });
    paint();
  },
  setField(field, value) {
    trainerCtl.setField(field, value);
    paint();
  },
  async showRange() {
    await trainerCtl.showRange();
    paint();
  },
  async selectHand(hand) {
    await trainerCtl.selectHand(hand);
    const vm = trainerCtl.viewModel();
    if (vm.phase === 'matrix') {
      vm.handDetail = trainerCtl.handDetail;
      vm.selectedHand = hand;
    }
    paint();
  },
  back() {
    if (mode === 'trainer') {
      const r = trainerCtl.back();
      if (r.navExit) {
        mode = 'hub';
      }
      paint();
      return;
    }
    if (mode === 'narrowing') {
      const result = narrowCtl.back();
      if (result.navExit) {
        mode = 'hub';
        paint();
        return;
      }
      if (result.popped) window.MiniAppNav?.pop('ranges');
      paint();
      return;
    }
    if (typeof window.show === 'function') window.show('home');
  },
  begin() {
    narrowCtl.beginPlay();
    window.MiniAppNav?.push('ranges', { phase: 'play', mode: 'narrowing' });
    paint();
  },
  toggle(hand) {
    narrowCtl.toggleHand(hand);
    paint();
  },
  confirm() {
    const beforeStep = narrowCtl.stepIndex;
    narrowCtl.confirmStep();
    const nav = window.MiniAppNav;
    if (nav) {
      if (narrowCtl.phase === 'summary') nav.push('ranges', { phase: 'summary' });
      else if (narrowCtl.phase === 'play' && narrowCtl.stepIndex > beforeStep) {
        nav.push('ranges', { phase: 'play', stepIndex: narrowCtl.stepIndex });
      }
    }
    paint();
  },
  next() {
    narrowCtl.nextScenario();
    window.MiniAppNav?.reset('ranges');
    window.MiniAppNav?.push('ranges', { phase: 'intro', mode: 'narrowing' });
    paint();
  },
  help() {
    narrowCtl.openHelp();
    paint();
  },
  close() {
    narrowCtl.closeHelp();
    paint();
  }
};

function paint() {
  const el = root();
  if (!el) return;
  narrowCtl.pack = getPack();
  const vm = currentVm();
  if (mode === 'trainer' && vm.phase === 'matrix' && trainerCtl.handDetail) {
    vm.handDetail = trainerCtl.handDetail;
    vm.selectedHand = trainerCtl.selectedHand;
  }
  R.paint(el, vm, handlers);
}

function bindEntryPoints() {
  const go = () => {
    if (typeof window.show === 'function') window.show('ranges');
    else paint();
  };
  ['homeXray', 'v36Xray', 'homeXray30', 'v31Xray'].forEach((id) => {
    const b = document.getElementById(id);
    if (b && !b.dataset.rangesBound) {
      b.dataset.rangesBound = '1';
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        go();
      }, true);
    }
  });
}

const origShow = window.show;
if (typeof origShow === 'function') {
  window.show = function (id) {
    const r = origShow.apply(this, arguments);
    if (id === 'ranges') {
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
      mode = 'hub';
      window.MiniAppNav?.reset('ranges');
      window.MiniAppNav?.push('ranges', { phase: 'hub' });
      paint();
    }
    return r;
  };
}

window.renderRanges = paint;
window.PokerSwipeRanges = { narrowController: narrowCtl, trainerController: trainerCtl, paint, storage };

function boot() {
  ensureScreen();
  bindEntryPoints();
  const obs = new MutationObserver(() => bindEntryPoints());
  const home = document.getElementById('home');
  if (home) obs.observe(home, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { narrowCtl, trainerCtl, paint };
