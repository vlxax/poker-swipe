// Ranges section bridge — trainer browser + narrowing trainer + Range Battleship.

import { TrainerBrowserController } from './trainerBrowserController.js';
import { BattleshipController } from './battleship/controller.js';
import { NarrowingController } from './narrowing/controller.js';
import * as TR from './renderer.js';
import * as BR from './battleship/renderer.js';
import * as NR from './narrowing/renderer.js';

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
  if (!document.querySelector('link[data-battleship-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'ranges-ui/battleship/battleship.css';
    link.dataset.battleshipCss = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[data-narrowing-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'ranges-ui/narrowing/narrowing.css';
    link.dataset.narrowingCss = '1';
    document.head.appendChild(link);
  }
  return document.querySelector('#rangesArea');
}

const root = () => ensureScreen() || document.querySelector('#rangesArea');

const narrowCtl = new NarrowingController({ storage });
const trainerCtl = new TrainerBrowserController({ pack: getPack(), storage });
const battleCtl = new BattleshipController({ storage });

let mode = 'hub'; // hub | battleship-catalog | battleship-play | narrowing | trainer
let pickerPos = null;
let pickerStack = null;
let narrowPickerPos = null;
let narrowPickerStack = null;

function hubVm() {
  return {
    phase: 'hub',
    title: 'РЕНДЖИ',
    subtitle: 'Морской бой + сужение диапазона'
  };
}

const handlers = {
  openBattleshipCatalog() {
    mode = 'battleship-catalog';
    battleCtl.state.phase = 'catalog';
    battleCtl.init().then(() => paint());
  },
  setPicker(pos, stack) {
    if (pos) pickerPos = pos;
    if (stack) pickerStack = stack;
    else if (pos) pickerStack = null;
  },
  setNarrowPicker(pos, stack) {
    if (pos) narrowPickerPos = pos;
    if (stack) narrowPickerStack = stack;
    else if (pos) narrowPickerStack = null;
  },
  async selectBattleshipCourse(courseId) {
    mode = 'battleship-play';
    await battleCtl.startCourse(courseId);
    paint();
  },
  beginMission() {
    battleCtl.beginMission();
    paint();
  },
  handleCellTap(hand) {
    battleCtl.handleCellTap(hand);
    paint();
  },
  dismissTutorial() {
    battleCtl.dismissTutorial();
    paint();
  },
  nextMission() {
    battleCtl.nextMission();
    paint();
  },
  retryMission() {
    battleCtl.retryMission();
    paint();
  },
  repeatWeakMission() {
    battleCtl.repeatWeakMission();
    paint();
  },
  restartCourse() {
    battleCtl.restartCourse();
    paint();
  },
  openTrainer() {
    mode = 'trainer';
    trainerCtl.init().then(() => paint());
  },
  openNarrowing() {
    mode = 'narrowing';
    narrowCtl.openCatalog();
    narrowCtl.init().then(() => paint());
    window.MiniAppNav?.reset('ranges');
    window.MiniAppNav?.push('ranges', { phase: 'catalog', mode: 'narrowing' });
  },
  async startNarrowingLesson(lessonId) {
    mode = 'narrowing';
    await narrowCtl.startLesson(lessonId);
    paint();
  },
  dismissNarrowingOnboard() {
    narrowCtl.dismissOnboarding();
    paint();
  },
  revealNarrowing() {
    narrowCtl.revealRange();
    paint();
    setTimeout(() => {
      narrowCtl.state.revealAnimating = false;
      paint();
    }, 650);
  },
  continueNarrowing() {
    narrowCtl.continueAfterReveal();
    paint();
  },
  answerNarrowingMc(choice) {
    narrowCtl.answerMc(choice);
    paint();
  },
  answerNarrowingYn(answer) {
    narrowCtl.answerYesNo(answer);
    paint();
  },
  tapNarrowingHand(hand) {
    narrowCtl.tapHand(hand);
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
    if (mode === 'battleship-play') {
      if (battleCtl.state.phase === 'complete') {
        mode = 'battleship-catalog';
        battleCtl.backToCatalog();
        paint();
        return;
      }
      mode = 'battleship-catalog';
      battleCtl.backToCatalog();
      paint();
      return;
    }
    if (mode === 'battleship-catalog') {
      mode = 'hub';
      battleCtl.backToHub();
      paint();
      return;
    }
    if (mode === 'trainer') {
      const r = trainerCtl.back();
      if (r.navExit) mode = 'hub';
      paint();
      return;
    }
    if (mode === 'narrowing') {
      const result = narrowCtl.back();
      if (result.reopenCatalog) {
        narrowCtl.openCatalog();
        paint();
        return;
      }
      if (result.navExit) {
        mode = 'hub';
        paint();
        return;
      }
      paint();
      return;
    }
    if (typeof window.show === 'function') window.show('home');
  }
};

function paint() {
  const el = root();
  if (!el) return;

  if (mode === 'battleship-catalog') {
    const vm = battleCtl.viewModel();
    vm.phase = 'catalog';
    vm.pickerPos = pickerPos;
    vm.pickerStack = pickerStack;
    BR.renderBattleshipCatalog(el, vm, handlers);
    return;
  }
  if (mode === 'battleship-play') {
    const vm = battleCtl.viewModel();
    if (vm.state?.phase === 'error') {
      BR.renderBattleshipError(el, vm, handlers);
      return;
    }
    BR.renderBattleshipGame(el, vm, handlers);
    BR.wireFinalOverlay(el, handlers);
    return;
  }
  if (mode === 'narrowing') {
    const vm = narrowCtl.viewModel();
    vm.pickerPos = narrowPickerPos;
    vm.pickerStack = narrowPickerStack;
    if (vm.phase === 'catalog') {
      NR.renderNarrowingCatalog(el, vm, handlers);
      return;
    }
    if (vm.phase === 'error') {
      NR.renderNarrowingError(el, { errorMessage: narrowCtl.state.errorMessage }, handlers);
      return;
    }
    NR.renderNarrowingLesson(el, vm, handlers);
    return;
  }

  if (mode === 'trainer') {
    const vm = trainerCtl.viewModel();
    if (vm.phase === 'matrix' && trainerCtl.handDetail) {
      vm.handDetail = trainerCtl.handDetail;
      vm.selectedHand = trainerCtl.selectedHand;
    }
    TR.paint(el, vm, handlers);
    return;
  }

  if (mode === 'hub') {
    const vm = hubVm();
    battleCtl.init().then(() => {
      BR.renderBattleshipHub(el, {
        ...vm,
        lastCourse: battleCtl.progress.getLastCourse(),
        courseProgressList: battleCtl.progress.getCourseProgressList(battleCtl.catalog)
      }, handlers);
    });
  }
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
      battleCtl.init().then(() => paint());
    }
    return r;
  };
}

window.renderRanges = paint;
window.PokerSwipeRanges = {
  narrowController: narrowCtl,
  trainerController: trainerCtl,
  battleshipController: battleCtl,
  paint,
  storage,
  openBattleship: () => handlers.openBattleshipCatalog(),
  selectBattleshipCourse: (courseId) => handlers.selectBattleshipCourse(courseId),
  beginMission: () => handlers.beginMission(),
  handleCellTap: (hand) => handlers.handleCellTap(hand),
  openNarrowing: () => handlers.openNarrowing(),
  startNarrowingLesson: (id) => handlers.startNarrowingLesson(id)
};

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

export { narrowCtl, trainerCtl, battleCtl, paint };
