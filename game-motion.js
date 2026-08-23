/**
 * PokerSwipe — Game Motion System (layout-stable)
 * Single source of truth. No page-level transform, no scroll jumps.
 */
(function () {
  'use strict';

  const BUBBLE_SEL = '.primary, .choice, .action, .pgCta, .tile, .pgPathNode.node, .rangesCell[data-rhand], .metric, .pgSizeBtn, .v36Mini, .v36Quick';

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

  /* ── Bubble press (buttons only — NOT nav) ── */
  function bindBubblePress() {
    if (document.documentElement.dataset.psBubbleBound) return;
    document.documentElement.dataset.psBubbleBound = '1';

    let active = null;

    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(BUBBLE_SEL);
      if (!el || el.disabled || el.classList.contains('isDisabled')) return;
      active = el;
      el.classList.add('ps-pressed');
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

  /* ── Bottom nav indicator (no transform on nav buttons) ── */
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

  /* ── show() wrap: instant swap, block document scroll reset ── */
  function scrollRoot() {
    return document.getElementById('mainApp') || document.documentElement;
  }

  function callShow(orig, id) {
    const root = scrollRoot();
    const prevId = document.querySelector('.screen.active')?.id;
    const preserve = prevId === id;
    const scrollY = preserve ? (root.scrollTop || 0) : 0;
    const origScrollTo = window.scrollTo.bind(window);
    window.scrollTo = function (x, y) {
      if (arguments.length >= 2 && x === 0 && y === 0) return;
      if (arguments.length === 1 && typeof x === 'object') {
        if (x && typeof x.top === 'number' && x.top === 0 && (x.left == null || x.left === 0)) return;
        return origScrollTo(x);
      }
      return origScrollTo(x, y);
    };
    try {
      orig(id);
    } finally {
      window.scrollTo = origScrollTo;
      root.scrollTop = scrollY;
      origScrollTo(0, 0);
    }
  }

  /* Block legacy scrollIntoView on feedback slots (causes viewport jump) */
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
        else if (i === culpritIndex) n.classList.add('ps-step-critical');
        else n.classList.add('ps-step-good');
      }, 80 + i * 100);
    });
  }

  function wrapReviewReveal() {
    const tryWrap = () => {
      if (!window.reviewReveal || window.__psReviewWrapped) return !!window.__psReviewWrapped;
      const orig = window.reviewReveal;
      window.reviewReveal = function () {
        const area = document.getElementById('reviewArea');
        const R = window.REVIEWS?.[window.rv % window.REVIEWS.length];
        let bm = { clean: true, culpritIndex: -1 };
        try { bm = window.PokerBrain.reviewLine(R); } catch (_) {}

        const pick = window.rvPick;
        const culIdx = bm.culpritIndex;
        const ok = (bm.clean && pick === 'none') || (!bm.clean && pick === culIdx);

        if (!reduced()) {
          reviewTimelineReveal(area, culIdx, bm.clean);
          wait(Math.min(480, 80 + (bm.clean ? 4 : culIdx + 1) * 100 + 80)).then(() => {
            orig();
            progressiveReveal(area?.querySelector('.panel, .pgShell'));
            pulseTarget(area, ok ? 'g' : 'r', '.pgVerdictCompact, .verdict, .brainPanel');
          });
        } else {
          orig();
          progressiveReveal(area?.querySelector('.panel, .pgShell'));
          pulseTarget(area, ok ? 'g' : 'r', '.pgVerdictCompact, .verdict, .brainPanel');
        }
      };
      window.__psReviewWrapped = true;
      return true;
    };
    if (!tryWrap()) {
      const t = setInterval(() => { if (tryWrap()) clearInterval(t); }, 50);
      setTimeout(() => clearInterval(t), 8000);
    }
  }

  function rangesCellFlash(cell) {
    if (!cell) return;
    cell.classList.add('ps-cell-press');
    setTimeout(() => cell.classList.remove('ps-cell-press'), ms('--motion-tap', 160));
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

  /* Observe shells — NO auto card-deal on every DOM swap (prevents re-trigger jitter) */
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

    /* Nav: opacity feedback only — no transform (prevents nav jump) */
    document.addEventListener('pointerdown', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) nav.classList.add('ps-pressed');
    }, { passive: true });
    document.addEventListener('pointerup', () => {
      document.querySelectorAll('[data-nav].ps-pressed').forEach((n) => n.classList.remove('ps-pressed'));
    }, { passive: true });

    window.addEventListener('resize', syncNavIndicator);
  }

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
