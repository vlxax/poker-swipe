/**
 * PokerSwipe — Game Motion System (JS)
 * Screen transitions, bubble physics, card deal, decision feedback, analysis reveal.
 * Does not modify poker logic — presentation layer only.
 */
(function () {
  'use strict';

  const DEPTH = {
    home: 0, swipe: 1, sizing: 1, review: 1, daily: 1, xray: 1, heal: 1,
    myhands: 1, profile: 1, polyana: 1, tournaments: 1
  };

  const BUBBLE_SEL = '.primary, .choice, .action, .pgCta, .tile, [data-nav], .pgPathNode.node, .rangesCell[data-rhand], .metric, .pgSizeBtn';

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

  function pulseArena(root, grade) {
    const arena = root?.querySelector('.pgArena, .pgFelt');
    if (!arena) return;
    const kind = gradePulse(grade);
    arena.classList.remove('ps-pulse-good', 'ps-pulse-bad', 'ps-pulse-warn');
    void arena.offsetWidth;
    arena.classList.add('ps-pulse-' + kind);
    setTimeout(() => arena.classList.remove('ps-pulse-' + kind), 520);
  }

  /* ── Bubble press (delegated) ── */
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

    document.addEventListener('pointerup', (e) => {
      if (!active) return;
      active.classList.remove('ps-pressed');
      active = null;
    }, { passive: true });

    document.addEventListener('pointercancel', () => {
      if (active) active.classList.remove('ps-pressed');
      active = null;
    }, { passive: true });
  }

  /* ── Bottom nav indicator ── */
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

  /* ── Screen transition wrap ── */
  function wrapShow() {
    if (!window.show) return false;
    const orig = window.show;
    if (orig._psMotionWrap) return true;

    function psShow(id) {
      if (!document.getElementById(id)) id = 'home';
      const prev = document.querySelector('.screen.active');
      if (!prev || prev.id === id || reduced()) {
        orig(id);
        syncNavIndicator();
        queueMicrotask(() => afterScreen(id));
        return;
      }

      const back = (DEPTH[id] ?? 1) < (DEPTH[prev.id] ?? 1);
      document.body.classList.add('ps-transitioning');
      if (id !== 'home') document.body.classList.add('ps-bg-recede');

      prev.classList.add(back ? 'ps-screen-back-out' : 'ps-screen-out');

      const delay = ms('--motion-tap', 120);
      setTimeout(() => {
        orig(id);
        const next = document.querySelector('.screen.active');
        if (next) next.classList.add(back ? 'ps-screen-back-in' : 'ps-screen-in');
        document.body.classList.remove('ps-bg-recede');
        syncNavIndicator();

        const screenDur = ms('--motion-screen', 280);
        setTimeout(() => {
          prev.classList.remove('ps-screen-out', 'ps-screen-back-out');
          next?.classList.remove('ps-screen-in', 'ps-screen-back-in');
          document.body.classList.remove('ps-transitioning');
        }, screenDur);

        afterScreen(id);
      }, delay);
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
    if (shell) afterShell(shell, { mode: 'enter' });
  }

  /* ── Home tile entry arm ── */
  function bindHomeTiles() {
    document.addEventListener('click', (e) => {
      const tile = e.target.closest('.tile[id^="home"], .v35Tool, .v30Mode');
      if (!tile) return;
      tile.classList.add('ps-tile-armed');
      setTimeout(() => tile.classList.remove('ps-tile-armed'), ms('--motion-tap', 120));
    }, true);
  }

  /* ── After shell render ── */
  function afterShell(shell, opts = {}) {
    if (!shell) return;
    shell.classList.remove('ps-hand-starting', 'ps-dim-surround');
    bindBubblePress();

    const dealWrap = shell.querySelector('.pgArenaWrap, .pgDealIn');
    if (dealWrap) runCardDeal(dealWrap, opts);

    if (opts.mode === 'hand-start') {
      shell.classList.add('ps-hand-starting', 'ps-dim-surround');
      setTimeout(() => shell.classList.remove('ps-hand-starting', 'ps-dim-surround'), ms('--motion-hand', 520));
    }

    if (opts.mode === 'enter' && !reduced()) {
      shell.classList.add('pgEnter');
      setTimeout(() => shell.classList.remove('pgEnter'), ms('--motion-screen', 280));
    }

    shell.querySelectorAll('input.range').forEach((r) => {
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

  function runCardDeal(wrap, opts = {}) {
    if (reduced()) return;
    wrap.classList.remove('ps-deal-run', 'ps-deal-flop', 'ps-deal-turn', 'ps-deal-river');
    void wrap.offsetWidth;
    wrap.classList.add('ps-deal-run');
    const boardCount = wrap.querySelectorAll('.pgBoardZone .pc').length;
    if (boardCount >= 3) wrap.classList.add('ps-deal-flop');
    if (boardCount >= 4) wrap.classList.add('ps-deal-turn');
    if (boardCount >= 5) wrap.classList.add('ps-deal-river');
    if (opts.street === 'turn') wrap.classList.add('ps-deal-turn');
    if (opts.street === 'river') wrap.classList.add('ps-deal-river');
  }

  /* ── Decision lock ── */
  function decisionLock(btn, opts = {}) {
    if (!btn) return;
    btn.classList.add('ps-decision-locked', 'ps-pressed');
    const grid = btn.closest('.pgDecisionGrid, .grid2, .pgActionRow, #swipeActions, .actions');
    grid?.querySelectorAll('button').forEach((b) => { if (b !== btn) b.disabled = true; });

    const shell = btn.closest('.pgShell, .swipeShell, #swipeCard');
    if (opts.grade != null) {
      setTimeout(() => pulseArena(shell, opts.grade), ms('--motion-tap', 120));
    }
  }

  /* ── Start hand sequence (Daily START etc.) ── */
  function startHand(root, runFn) {
    if (!root) { runFn?.(); return; }
    const shell = root.querySelector('.pgShell') || root;
    shell.classList.add('ps-dim-surround');
    if (!reduced()) {
      shell.classList.add('ps-hand-starting');
      wait(ms('--motion-tap', 120)).then(() => {
        runFn?.();
        afterShell(shell.querySelector('.pgShell') || shell, { mode: 'hand-start' });
      });
    } else {
      runFn?.();
    }
  }

  /* ── Sizing confirm ── */
  function sizingConfirm(area, grade) {
    pulseArena(area, grade);
    area?.querySelector('.pgPot, .pgPotLabel')?.classList.add('ps-bet-to-pot');
    setTimeout(() => area?.querySelector('.pgPot, .pgPotLabel')?.classList.remove('ps-bet-to-pot'), 450);
    progressiveReveal(area?.querySelector('#sizeResult .verdict'), { delay: 80 });
  }

  /* ── Progressive reveal ── */
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

  /* ── Review timeline reveal ── */
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
      }, 80 + i * 120);
    });
  }

  /* ── Wrap reviewReveal for analysis sequence ── */
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
        pulseArena(area, (bm.clean && pick === 'none') || (!bm.clean && pick === culIdx) ? 'g' : 'r');

        if (!reduced()) {
          reviewTimelineReveal(area, culIdx, bm.clean);
          wait(Math.min(520, 80 + (bm.clean ? 4 : culIdx + 1) * 120 + 100)).then(() => {
            orig();
            progressiveReveal(area?.querySelector('.panel, .pgShell'));
          });
        } else {
          orig();
          progressiveReveal(area?.querySelector('.panel, .pgShell'));
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

  /* ── Ranges cell flash ── */
  function rangesCellFlash(cell) {
    if (!cell) return;
    cell.classList.add('ps-cell-press');
    setTimeout(() => cell.classList.remove('ps-cell-press'), ms('--motion-tap', 120));
    cell.classList.remove('ps-cell-flash');
    void cell.offsetWidth;
    cell.classList.add('ps-cell-flash');
  }

  /* ── Swipe verdict pulse + reveal ── */
  function wrapFinalizeSwipe() {
    const tryWrap = () => {
      if (!window.finalizeSwipe || window.__psSwipeWrapped) return !!window.__psSwipeWrapped;
      const orig = window.finalizeSwipe;
      window.finalizeSwipe = function (s, a, size) {
        orig(s, a, size);
        const btn = document.querySelector('[data-sa].selected');
        const g = btn?.classList.contains('grade-r') ? 'r' : btn?.classList.contains('grade-y') ? 'y' : 'g';
        pulseArena(document.getElementById('swipeCard'), g);
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

  /* ── Observe DOM for new shells (training-ui paint, mini-apps, etc.) ── */
  function observeShellAreas() {
    const ids = ['dailyArea', 'reviewArea', 'sizingArea', 'swipeCard', 'xrayArea', 'rangesArea'];
    ids.forEach((id) => {
      const area = document.getElementById(id);
      if (!area || area.dataset.psObserved) return;
      area.dataset.psObserved = '1';
      const obs = new MutationObserver(() => {
        const shell = area.querySelector('.pgShell, .swipeShell');
        if (shell && !shell.dataset.psMotionDone) {
          shell.dataset.psMotionDone = '1';
          const mode = shell.classList.contains('pgDailyDrill') ? 'hand-start'
            : shell.classList.contains('pgDailyLobby') ? 'enter' : 'enter';
          afterShell(shell, { mode });
          setTimeout(() => delete shell.dataset.psMotionDone, 600);
        }
      });
      obs.observe(area, { childList: true, subtree: true });
    });
  }

  function observeDaily() {
    observeShellAreas();
  }

  function init() {
    bindBubblePress();
    bindHomeTiles();
    bindNavIndicator();
    wrapShow();
    scheduleRewrap();
    wrapReviewReveal();
    wrapFinalizeSwipe();
    observeShellAreas();

    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        nav.classList.add('ps-nav-tap');
        setTimeout(() => nav.classList.remove('ps-nav-tap'), ms('--motion-tap', 120));
      }
    }, true);

    window.addEventListener('resize', syncNavIndicator);
  }

  window.PsMotion = {
    init,
    afterShell,
    afterScreen,
    startHand,
    decisionLock,
    pulseArena,
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
