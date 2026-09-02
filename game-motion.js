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
    const el = root?.querySelector(selector || '.pgVerdictCompact, .verdict, #swipeVerdict .swipeFlash');
    if (!el) return;
    const kind = gradePulse(grade);
    el.classList.remove('ps-pulse-good', 'ps-pulse-bad', 'ps-pulse-warn');
    void el.offsetWidth;
    el.classList.add('ps-pulse-' + kind);
    setTimeout(() => el.classList.remove('ps-pulse-' + kind), 560);
  }

  function pulseArena(root, grade) {
    pulseTarget(root, grade, '.pgVerdictCompact, .verdict');
  }

  function bindBubblePress() {
    if (document.documentElement.dataset.psBubbleBound) return;
    document.documentElement.dataset.psBubbleBound = '1';
    let active = null;
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(BUBBLE_SEL);
      if (!el || el.disabled || el.classList.contains('isDisabled')) return;
      active = el;
      el.classList.add('ps-pressed');
      try { window.PsGameFeel?.press?.(); } catch(_){}
      el.setPointerCapture?.(e.pointerId);
    }, { passive: true });
    document.addEventListener('pointerup', () => {
      if (!active) return;
      active.classList.remove('ps-pressed');
      active = null;
    }, { passive: true });
    document.addEventListener('pointercancel', () => {
      if (active) active.classList.remove('ps-pressed');
      active = null;
    }, { passive: true });
  }

  window.PsGameFeel = { press() {}, release() {}, success() {}, error() {}, screenChange() {} };
  window.PsMotion = { init: function(){ bindBubblePress(); }, bindBubblePress, pulseTarget, pulseArena, reduced, wait, ms };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ bindBubblePress(); });
  } else {
    bindBubblePress();
  }
})();
