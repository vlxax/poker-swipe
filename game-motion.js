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

  function bindNavIndicator() {
    const nav = document.querySelector('.bottomNav, .nav');
    if (!nav || nav.querySelector('.ps-nav-indicator')) return;
    const ind = document.createElement('i');
    ind.className = 'ps-nav-indicator';
    ind.setAttribute('aria-hidden', 'true');
    nav.prepend(ind);
    nav.classList.add('ps-nav-ready');
    syncNavIndicator();
  }

  function syncNavIndicator() {
    const nav = document.querySelector('.bottomNav, .nav');
    if (!nav) return;
    const ind = nav.querySelector('.ps-nav-indicator');
    const on = nav.querySelector('[data-nav].on');
    if (!ind || !on) return;
    const nr = nav.getBoundingClientRect();
    const br = on.getBoundingClientRect();
    ind.style.width = Math.max(28, br.width * 0.55) + 'px';
    ind.style.left = (br.left - nr.left + (br.width - parseFloat(ind.style.width)) / 2) + 'px';
  }

  function scrollRoot() {
    return document.getElementById('mainApp') || document.documentElement;
  }

  function callShow(orig, id) {
    const root = scrollRoot();
    const y = root && root.scrollTop;
    const origScrollTo = window.scrollTo.bind(window);
    window.scrollTo = function (x, y2) {
      if (typeof x === 'object') {
        if (x.top === 0 || x.top === 0) return;
      } else if (y2 === 0 && x === 0) return;
      return origScrollTo.apply(window, arguments);
    };
    try {
      orig(id);
    } finally {
      window.scrollTo = origScrollTo;
      if (root && typeof y === 'number') root.scrollTop = y;
    }
  }

  function blockFeedbackScrollIntoView() {
    if (Element.prototype.scrollIntoView._psBlocked) return;
    const blocked = new Set(['sizeResult', 'swipeVerdict']);
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (this.id && blocked.has(this.id)) return;
      if (this.closest?.('#sizeResult, #swipeVerdict')) return;
      return orig.apply(this, args);
    };
    Element.prototype.scrollIntoView._psBlocked = true;
  }

  function wrapShow() {
    if (!window.show) return false;
    const orig = window.show;
    if (orig._psMotionWrap) return true;
    function psShow(id) {
      if (!document.getElementById(id)) id = 'home';
      callShow(orig, id);
      syncNavIndicator();
      queueMicrotask(() => afterScreen(id));
    }
    psShow._psMotionWrap = true;
    window.show = psShow;
    window.__psShowWrapped = true;
    return true;
  }

  function scheduleRewrap() {
    [0, 80, 300, 900].forEach((d) => setTimeout(wrapShow, d));
  }

  function afterScreen(id) {
    const root = document.getElementById(id);
    if (!root) return;
    const shell = root.querySelector('.pgShell, .swipeShell');
    if (shell) afterShell(shell, {});
    staggerHome(root);
    enterScreen(root);
  }

  function staggerHome(root) {
    if (reduced()) return;
    const home = root.querySelector('.psPremiumHome, .v36Home');
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
    setTimeout(() => root.classList.remove('gf-screen-enter'), ms('--motion-screen', 330) + 40);
  }

  function afterShell(shell, opts = {}) {
    if (!shell) return;
    shell.classList.remove('ps-hand-starting', 'ps-dim-surround', 'pgEnter');
    bindBubblePress();
    if (opts.deal === true) {
      const dealWrap = shell.querySelector('.pgArenaWrap, .pgDealIn');
      if (dealWrap) runCardDeal(dealWrap, opts);
    }
    if (opts.mode === 'hand-start') {
      shell.classList.add('ps-hand-starting');
      if (opts.dim) shell.classList.add('ps-dim-surround');
      setTimeout(() => shell.classList.remove('ps-hand-starting', 'ps-dim-surround'), ms('--motion-hand', 480));
    }
    shell.querySelectorAll('input.range').forEach((r) => {
      if (r.dataset.psSliderBound) return;
      r.dataset.psSliderBound = '1';
      r.addEventListener('input', () => {
        r.classList.add('ps-slider-active');
        const readout = shell.querySelector('.pgDecisionReadout');
        readout?.classList.remove('ps-size-tick');
        void readout?.offsetWidth;
        readout?.classList.add('ps-size-tick');
        clearTimeout(r._psTick);
        r._psTick = setTimeout(() => r.classList.remove('ps-slider-active'), 180);
      }, { passive: true });
    });
  }

  function runCardDeal(wrap) {
    if (reduced()) return;
    wrap.classList.remove('ps-deal-run', 'ps-deal-flop', 'ps-deal-turn', 'ps-deal-river');
    void wrap.offsetWidth;
    wrap.classList.add('ps-deal-run');
    const boardCount = wrap.querySelectorAll('.pgBoardZone .pc').length;
    if (boardCount >= 3) wrap.classList.add('ps-deal-flop');
    if (boardCount >= 4) wrap.classList.add('ps-deal-turn');
    if (boardCount >= 5) wrap.classList.add('ps-deal-river');
  }

  function decisionLock(btn) {
    if (!btn) return;
    btn.classList.add('ps-decision-locked');
    const grid = btn.closest('.pgDecisionGrid, .grid2, .pgActionRow, #swipeActions, .actions');
    grid?.querySelectorAll('button').forEach((b) => { if (b !== btn) b.disabled = true; });
  }

  function startHand(root, runFn) {
    if (!root) { runFn?.(); return; }
    const shell = root.querySelector('.pgShell') || root;
    if (!reduced()) {
      shell.classList.add('ps-dim-surround');
      wait(ms('--motion-tap', 160)).then(() => {
        runFn?.();
        afterShell(shell.querySelector('.pgShell') || shell, { mode: 'hand-start', dim: false, deal: true });
      });
    } else {
      runFn?.();
    }
  }

  function sizingConfirm(area, grade) {
    pulseTarget(area, grade, '#sizeResult .verdict, .pgVerdictCompact');
    area?.querySelector('.pgPot, .pgPotLabel')?.classList.add('ps-bet-to-pot');
    setTimeout(() => area?.querySelector('.pgPot, .pgPotLabel')?.classList.remove('ps-bet-to-pot'), 400);
    progressiveReveal(area?.querySelector('#sizeResult .verdict'), { delay: 100 });
    const root = scrollRoot();
    if (root) root.scrollTop = 0;
  }

  function progressiveReveal(container, opts = {}) {
    if (!container) return;
    const blocks = container.querySelectorAll('.dualGrade, .gradeBox, .verdict, .brainPanel, p, .regReport, button.primary, .pgCta, .freakCoachReaction');
    const items = blocks.length ? blocks : [container];
    const delay = opts.delay ?? 60;
    items.forEach((el, i) => {
      el.classList.add('ps-reveal-stage');
      setTimeout(() => el.classList.add('ps-reveal-show'), delay + i * (reduced() ? 0 : 90));
    });
  }

  function reviewTimelineReveal(area, culpritIndex, clean) {
    const path = area?.querySelector('.pgPath');
    if (!path || reduced()) return;
    path.classList.add('ps-timeline-run');
    const nodes = [...path.querySelectorAll('.pgPathNode')];
    nodes.forEach((n, i) => {
      setTimeout(() => {
        n.classList.add('ps-step-lit');
        if (clean) n.classList.add('ps-step-good');
      }, i * 70);
    });
  }

  function rangesCellFlash(cell, kind) {
    if (!cell) return;
    cell.classList.add(kind === 'bad' ? 'ps-pulse-bad' : 'ps-pulse-good');
    setTimeout(() => cell.classList.remove('ps-pulse-good', 'ps-pulse-bad'), 400);
  }

  function wrapReviewReveal() {
    /* optional hooks for review screens */
  }

  function wrapFinalizeSwipe() {
    const tryWrap = () => {
      if (!window.finalizeSwipe || window.__psSwipeWrapped) return !!window.__psSwipeWrapped;
      const orig = window.finalizeSwipe;
      window.finalizeSwipe = function (s, a, size) {
        orig(s, a, size);
        const btn = document.querySelector('[data-sa].selected');
        const g = btn?.classList.contains('grade-r') ? 'r' : btn?.classList.contains('grade-y') ? 'y' : 'g';
        pulseTarget(document.getElementById('swipeCard'), g, '#swipeVerdict .swipeFlash, #swipeVerdict .verdict');
        progressiveReveal(document.getElementById('swipeVerdict'));
      };
      window.__psSwipeWrapped = true;
      return true;
    };
    if (!tryWrap()) {
      const t = setInterval(() => { if (tryWrap()) clearInterval(t); }, 50);
      setTimeout(() => clearInterval(t), 8000);
    }
  }

  function observeShellAreas() {
    const ids = ['dailyArea', 'reviewArea', 'sizingArea', 'swipeCard', 'xrayArea', 'rangesArea'];
    ids.forEach((id) => {
      const area = document.getElementById(id);
      if (!area || area.dataset.psObserved) return;
      area.dataset.psObserved = '1';
      const obs = new MutationObserver(() => {
        const shell = area.querySelector('.pgShell, .swipeShell');
        if (shell && !shell.dataset.psMotionBound) {
          shell.dataset.psMotionBound = '1';
          afterShell(shell, {});
        }
      });
      obs.observe(area, { childList: true, subtree: true });
    });
  }

  function init() {
    blockFeedbackScrollIntoView();
    bindBubblePress();
    bindNavIndicator();
    wrapShow();
    scheduleRewrap();
    wrapReviewReveal();
    wrapFinalizeSwipe();
    observeShellAreas();
    document.addEventListener('pointerdown', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) nav.classList.add('ps-pressed');
    }, { passive: true });
    document.addEventListener('pointerup', () => {
      document.querySelectorAll('[data-nav].ps-pressed').forEach((n) => n.classList.remove('ps-pressed'));
    }, { passive: true });
    window.addEventListener('resize', syncNavIndicator);
  }

  window.PsGameFeel = {
    press() {},
    release() {},
    success() {},
    error() {},
    screenChange() {}
  };

  window.PsMotion = {
    init,
    afterShell,
    afterScreen,
    startHand,
    decisionLock,
    pulseArena,
    pulseTarget,
    sizingConfirm,
    progressiveReveal,
    reviewTimelineReveal,
    runCardDeal,
    rangesCellFlash,
    staggerHome,
    enterScreen,
    reduced,
    wait,
    ms
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
