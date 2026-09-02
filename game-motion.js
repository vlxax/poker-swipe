/**
 * PokerSwipe — Game Motion System (layout-stable)
 * Single source of truth. No page-level transform, no scroll jumps.
 */
(function () {
  'use strict';

  const BUBBLE_SEL = '.primary, .choice, .action, .pgCta, .tile, .pgPathNode.node, .rangesCell[data-rhand], .metric, .pgSizeBtn, .v36Mini, .v36Quick, .v36Tile, .v36Daily, .v36Stat, .v36SwipeMain, .v36Personal button, .v36Hand, .v35Start, .p40Primary, .secondary, .ghost, .chip, .pspChip, .pspTab, .gf-pressable';

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  }

  function ms(name, fallback) {
    if (reduced()) return 0;
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v.endsWith('ms') ? parseFloat(v) : fallback;
    } catch (_) { return fallback; }
  }

  function wait(duration) {
    return new Promise((r) => setTimeout(r, duration));
  }

  function gradePulse(grade) {
    if (grade === 'g' || grade === 'EXCELLENT' || grade === 'GOOD') return 'good';
    if (grade === 'r' || grade === 'MISTAKE' || grade === 'BLUNDER') return 'bad';
    return 'warn';
  }

  function pulseTarget(root, grade, selector) {
    const el = root && root.querySelector(selector || '.pgVerdictCompact, .verdict, #swipeVerdict .swipeFlash');
    if (!el) return;
    const kind = gradePulse(grade);
    el.classList.remove('ps-pulse-good', 'ps-pulse-bad', 'ps-pulse-warn');
    void el.offsetWidth;
    el.classList.add('ps-pulse-' + kind);
    setTimeout(function () { el.classList.remove('ps-pulse-' + kind); }, 560);
  }

  function bindBubblePress() {
    if (document.documentElement.dataset.psBubbleBound) return;
    document.documentElement.dataset.psBubbleBound = '1';
    var active = null;
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest(BUBBLE_SEL);
      if (!el || el.disabled || el.classList.contains('isDisabled')) return;
      active = el;
      el.classList.add('ps-pressed');
      try { window.PsGameFeel && window.PsGameFeel.press && window.PsGameFeel.press(); } catch (_) {}
      if (el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch (_) {}
    }, { passive: true });
    document.addEventListener('pointerup', function () {
      if (!active) return;
      active.classList.remove('ps-pressed');
      active = null;
    }, { passive: true });
    document.addEventListener('pointercancel', function () {
      if (active) active.classList.remove('ps-pressed');
      active = null;
    }, { passive: true });
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
    setTimeout(function () { root.classList.remove('gf-screen-enter'); }, ms('--motion-screen', 330) + 40);
  }

  function wrapShow() {
    if (!window.show) return false;
    var orig = window.show;
    if (orig._psMotionWrap) return true;
    function psShow(id) {
      if (!document.getElementById(id)) id = 'home';
      orig(id);
      queueMicrotask(function () {
        var root = document.getElementById(id);
        if (!root) return;
        staggerHome(root);
        enterScreen(root);
      });
    }
    psShow._psMotionWrap = true;
    window.show = psShow;
    return true;
  }

  function wrapFinalizeSwipe() {
    if (!window.finalizeSwipe || window.__psSwipeWrapped) return;
    var orig = window.finalizeSwipe;
    window.finalizeSwipe = function (s, a, size) {
      orig(s, a, size);
      var btn = document.querySelector('[data-sa].selected');
      var g = btn && btn.classList.contains('grade-r') ? 'r' : (btn && btn.classList.contains('grade-y') ? 'y' : 'g');
      pulseTarget(document.getElementById('swipeCard'), g, '#swipeVerdict .swipeFlash, #swipeVerdict .verdict');
    };
    window.__psSwipeWrapped = true;
  }

  function init() {
    bindBubblePress();
    wrapShow();
    wrapFinalizeSwipe();
    [0, 100, 400, 1000].forEach(function (d) { setTimeout(wrapShow, d); setTimeout(wrapFinalizeSwipe, d); });
    document.addEventListener('pointerdown', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) nav.classList.add('ps-pressed');
    }, { passive: true });
    document.addEventListener('pointerup', function () {
      document.querySelectorAll('[data-nav].ps-pressed').forEach(function (n) { n.classList.remove('ps-pressed'); });
    }, { passive: true });
  }

  window.PsGameFeel = { press: function () {}, release: function () {}, success: function () {}, error: function () {}, screenChange: function () {} };
  window.PsMotion = { init: init, bindBubblePress: bindBubblePress, pulseTarget: pulseTarget, staggerHome: staggerHome, enterScreen: enterScreen, reduced: reduced, wait: wait, ms: ms };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
