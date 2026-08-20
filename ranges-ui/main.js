// Ranges section bridge — loads after index.html, adds #ranges screen and hooks entry points.

import { RangeController } from './controller.js';
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

const ctl = new RangeController({ pack: getPack(), storage });

const handlers = {
  setField(field, value) {
    const v = field === 'stack' ? Number(value) : value;
    ctl.setField(field, v);
    paint();
  },
  show() {
    ctl.showRange();
    paint();
  },
  back() {
    ctl.backToSelector();
    paint();
  },
  selectHand(hand) {
    ctl.selectHand(hand);
    paint();
  },
  help() {
    ctl.openHelp();
    paint();
  },
  close() {
    ctl.closeHelp();
    paint();
  },
  xray() {
    if (typeof window.show === 'function') window.show('xray');
  }
};

function paint() {
  const el = root();
  if (!el) return;
  ctl.pack = getPack();
  R.paint(el, ctl.viewModel(), handlers);
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
      paint();
    }
    return r;
  };
}

window.renderRanges = paint;
window.PokerSwipeRanges = { controller: ctl, paint, storage };

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

export { ctl, paint };
