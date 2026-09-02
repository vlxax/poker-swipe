/**
 * PokerSwipe — Game Motion System
 * Modern tactile press, screen enter, stagger, answer feedback.
 * No color/font/layout changes. Animation layer only.
 */
(function () {
  'use strict';

  var BUBBLE_SEL = [
    '.primary', '.choice', '.action', '.pgCta', '.tile',
    '.pgPathNode.node', '.rangesCell[data-rhand]', '.metric', '.pgSizeBtn',
    '.v36Mini', '.v36Quick', '.v36Tile', '.v36Daily', '.v36Stat',
    '.v36SwipeMain', '.v36Personal button', '.v36Hand', '.v35Start',
    '.p40Primary', '.secondary', '.ghost', '.chip', '.pspChip', '.pspTab',
    '.gf-pressable'
  ].join(', ');

  function reduced() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }

  function ms(name, fallback) {
    if (reduced()) return 0;
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v.endsWith('ms') ? parseFloat(v) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function wait(duration) {
    return new Promise(function (r) { setTimeout(r, duration); });
  }

  function gradePulse(grade) {
    if (grade === 'g' || grade === 'EXCELLENT' || grade === 'GOOD') return 'good';
    if (grade === 'r' || grade === 'MISTAKE' || grade === 'BLUNDER') return 'bad';
    return 'warn';
  }

  function pulseTarget(root, grade, selector) {
    var el = root && root.querySelector(selector || '.pgVerdictCompact, .verdict, #swipeVerdict .swipeFlash');
    if (!el) return;
    var kind = gradePulse(grade);
    el.classList.remove('ps-pulse-good', 'ps-pulse-bad', 'ps-pulse-warn');
    void el.offsetWidth;
    el.classList.add('ps-pulse-' + kind);
    setTimeout(function () {
      el.classList.remove('ps-pulse-' + kind);
    }, 560);
  }

  function bindBubblePress() {
    if (document.documentElement.dataset.psBubbleBound) return;
    document.documentElement.dataset.psBubbleBound = '1';
    var active = null;

    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest(BUBBLE_SEL);
      if (!el || el.disabled || el.classList.contains('isDisabled')) return;
      active = el;
      el.classList.remove('ps-release-pop');
      el.classList.add('ps-pressed');
      try {
        if (window.PsGameFeel && window.PsGameFeel.press) window.PsGameFeel.press();
      } catch (_) {}
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }, { passive: true });

    function release() {
      if (!active) return;
      var el = active;
      el.classList.remove('ps-pressed');
      if (!reduced()) {
        el.classList.add('ps-release-pop');
        setTimeout(function () {
          el.classList.remove('ps-release-pop');
        }, 300);
      }
      active = null;
    }

    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', function () {
      if (active) active.classList.remove('ps-pressed');
      active = null;
    }, { passive: true });
  }

  function bindNavIndicator() {
    var nav = document.querySelector('.bottomNav, .nav');
    if (!nav || nav.querySelector('.ps-nav-indicator')) return;
    var ind = document.createElement('i');
    ind.className = 'ps-nav-indicator';
    ind.setAttribute('aria-hidden', 'true');
    nav.prepend(ind);
    nav.classList.add('ps-nav-ready');
    syncNavIndicator();
  }

  function syncNavIndicator() {
    var nav = document.querySelector('.bottomNav, .nav');
    if (!nav) return;
    var ind = nav.querySelector('.ps-nav-indicator');
    var on = nav.querySelector('[data-nav].on');
    if (!ind || !on) return;
    var nr = nav.getBoundingClientRect();
    var br = on.getBoundingClientRect();
    var w = Math.max(24, br.width * 0.4);
    ind.style.width = w + 'px';
    ind.style.left = (br.left - nr.left + (br.width - w) / 2) + 'px';
  }

  function wrapShow() {
    if (!window.show) return false;
    var orig = window.show;
    if (orig._psMotionWrap) return true;

    function psShow(id) {
      if (!document.getElementById(id)) id = 'home';
      orig(id);
      syncNavIndicator();
      queueMicrotask(function () {
        afterScreen(id);
      });
    }
    psShow._psMotionWrap = true;
    window.show = psShow;
    return true;
  }

  function afterScreen(id) {
    var root = document.getElementById(id);
    if (!root) return;
    staggerHome(root);
    enterScreen(root);
  }

  function staggerHome(root) {
    if (reduced() || !root) return;
    var home = root.querySelector('.psPremiumHome, .v36Home');
    if (!home) return;
    home.classList.remove('gf-stagger');
    void home.offsetWidth;
    home.classList.add('gf-stagger');
  }

  function enterScreen(root) {
    if (reduced() || !root) return;
    root.classList.remove('gf-screen-enter');
    void root.offsetWidth;
    root.classList.add('gf-screen-enter');
    setTimeout(function () {
      root.classList.remove('gf-screen-enter');
    }, ms('--motion-screen', 280) + 40);
  }

  function progressiveReveal(container, opts) {
    if (!container) return;
    opts = opts || {};
    var blocks = container.querySelectorAll(
      '.dualGrade, .gradeBox, .verdict, .brainPanel, p, .regReport, button.primary, .pgCta, .freakCoachReaction'
    );
    var items = blocks.length ? blocks : [container];
    var delay = opts.delay != null ? opts.delay : 50;
    items.forEach(function (el, i) {
      el.classList.add('ps-reveal-stage');
      setTimeout(function () {
        el.classList.add('ps-reveal-show');
      }, delay + i * (reduced() ? 0 : 70));
    });
  }

  function wrapFinalizeSwipe() {
    if (!window.finalizeSwipe || window.__psSwipeWrapped) return;
    var orig = window.finalizeSwipe;
    window.finalizeSwipe = function (s, a, size) {
      orig(s, a, size);
      var btn = document.querySelector('[data-sa].selected');
      var g = 'g';
      if (btn) {
        if (btn.classList.contains('grade-r')) g = 'r';
        else if (btn.classList.contains('grade-y')) g = 'y';
      }
      pulseTarget(document.getElementById('swipeCard'), g, '#swipeVerdict .swipeFlash, #swipeVerdict .verdict');
      progressiveReveal(document.getElementById('swipeVerdict'));
    };
    window.__psSwipeWrapped = true;
  }

  function observeShells() {
    ['dailyArea', 'reviewArea', 'sizingArea', 'swipeCard', 'xrayArea', 'rangesArea'].forEach(function (id) {
      var area = document.getElementById(id);
      if (!area || area.dataset.psObserved) return;
      area.dataset.psObserved = '1';
      var obs = new MutationObserver(function () {
        var shell = area.querySelector('.pgShell, .swipeShell');
        if (shell && !shell.dataset.psMotionBound) {
          shell.dataset.psMotionBound = '1';
          bindBubblePress();
        }
      });
      obs.observe(area, { childList: true, subtree: true });
    });
  }

  function init() {
    bindBubblePress();
    bindNavIndicator();
    wrapShow();
    wrapFinalizeSwipe();
    observeShells();
    [80, 300, 900].forEach(function (d) {
      setTimeout(wrapShow, d);
      setTimeout(wrapFinalizeSwipe, d);
      setTimeout(syncNavIndicator, d);
    });

    document.addEventListener('pointerdown', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) nav.classList.add('ps-pressed');
    }, { passive: true });
    document.addEventListener('pointerup', function () {
      document.querySelectorAll('[data-nav].ps-pressed').forEach(function (n) {
        n.classList.remove('ps-pressed');
      });
    }, { passive: true });

    window.addEventListener('resize', syncNavIndicator);
  }

  window.PsGameFeel = {
    press: function () {},
    release: function () {},
    success: function () {},
    error: function () {},
    screenChange: function () {}
  };

  window.PsMotion = {
    init: init,
    bindBubblePress: bindBubblePress,
    pulseTarget: pulseTarget,
    staggerHome: staggerHome,
    enterScreen: enterScreen,
    progressiveReveal: progressiveReveal,
    syncNavIndicator: syncNavIndicator,
    reduced: reduced,
    wait: wait,
    ms: ms
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
