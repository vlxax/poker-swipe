/**
 * PokerSwipe — Game Feel / Motion System
 * Touch-first press feedback, screen transitions, stagger, answer confirm.
 * Animation layer is separate from business logic. No double-fire of game actions.
 * Hooks ready for future haptics/sound without rewrite.
 */
(function () {
  'use strict';

  const BUILD = 'ps-game-motion-v1';
  const PRESS_SELECTOR = [
    '.v36Tile', '.v36Daily', '.v36Quick', '.v36Stat', '.v36SwipeMain',
    '.v36Personal button', '.v36Hand',
    '.action', '.choice', '.primary', '.secondary', '.ghost', '.pgCta',
    '.p40Primary', '.v35Start',
    '.nav button', '[data-sa]', '[data-nav]',
    '.chip', '.pspChip', '.pspTab',
    '.gf-pressable'
  ].join(',');

  const BACK_IDS = new Set(['home', 'profile']);
  const SCREEN_MS = 200;
  const reduced = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lastShowId = null;
  let transitioning = false;
  let pressTarget = null;

  /* ── Haptics / sound hooks (no-op for now) ── */
  const Feel = {
    press() { /* future: navigator.vibrate?.(8) */ },
    release() {},
    success() {},
    error() {},
    screenChange() {}
  };
  window.PsGameFeel = Feel;

  function addPressed(el) {
    if (!el || el.disabled || el.classList.contains('gf-pressed')) return;
    el.classList.add('gf-pressed');
    Feel.press();
  }
  function removePressed(el) {
    if (!el) return;
    el.classList.remove('gf-pressed');
    Feel.release();
  }

  /* ── Global pointer press (touch-first, no hover reliance) ── */
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (transitioning) return;
    const el = e.target.closest?.(PRESS_SELECTOR);
    if (!el || el.disabled) return;
    if (el.closest('input, textarea, select, [contenteditable]')) return;
    pressTarget = el;
    addPressed(el);
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch (_) { /* ignore */ }
  }

  function onPointerUp() {
    if (pressTarget) {
      removePressed(pressTarget);
      pressTarget = null;
    }
  }

  function onPointerCancel() {
    if (pressTarget) {
      removePressed(pressTarget);
      pressTarget = null;
    }
  }

  /* ── Screen transition wrapper around show() ── */
  function directionFor(fromId, toId) {
    if (!fromId) return 'forward';
    if (BACK_IDS.has(toId) && fromId !== toId) return 'back';
    if (toId === 'home') return 'back';
    return 'forward';
  }

  function clearMotionClasses(el) {
    if (!el) return;
    el.classList.remove(
      'gf-exit-forward', 'gf-enter-forward',
      'gf-exit-back', 'gf-enter-back'
    );
  }

  function patchShow() {
    const orig = window.show;
    if (!orig || orig.__psGameMotionPatch) return;

    window.show = function psGameMotionShow(id) {
      const toId = id || 'home';
      const fromEl = document.querySelector('.screen.active');
      const fromId = fromEl ? fromEl.id : lastShowId;
      const toEl = document.getElementById(toId);

      // Same screen or reduced motion: pass through, still stagger
      if (reduced() || !fromEl || !toEl || fromId === toId) {
        const result = orig.apply(this, arguments);
        lastShowId = toId;
        requestAnimationFrame(function () { staggerActive(toId); });
        return result;
      }

      // During transition still run logic (never drop navigation)
      if (transitioning) {
        return orig.apply(this, arguments);
      }

      const dir = directionFor(fromId, toId);
      const exitClass = dir === 'back' ? 'gf-exit-back' : 'gf-exit-forward';
      const enterClass = dir === 'back' ? 'gf-enter-back' : 'gf-enter-forward';

      transitioning = true;
      document.documentElement.classList.add('gf-transitioning');
      Feel.screenChange();

      // Keep leaving screen painted for exit anim (.gf-leaving overrides display:none)
      clearMotionClasses(fromEl);
      fromEl.classList.add('gf-leaving', exitClass);

      // Business logic runs immediately — no delayed show()
      const result = orig.apply(this, arguments);
      lastShowId = toId;

      const active = document.getElementById(toId);
      if (active) {
        clearMotionClasses(active);
        active.classList.add(enterClass);
        requestAnimationFrame(function () { staggerActive(toId); });
      }

      window.setTimeout(function () {
        fromEl.classList.remove('gf-leaving', exitClass);
        clearMotionClasses(fromEl);
        if (active) clearMotionClasses(active);
        transitioning = false;
        document.documentElement.classList.remove('gf-transitioning');
      }, SCREEN_MS + 20);

      return result;
    };

    window.show.__psGameMotionPatch = true;
  }

  /* ── Stagger reveal ── */
  function staggerActive(id) {
    if (reduced()) return;
    const screen = document.getElementById(id);
    if (!screen) return;

    const homeRoot = screen.querySelector('.psPremiumHome, .v36Home');
    if (homeRoot) {
      homeRoot.classList.remove('gf-stagger');
      void homeRoot.offsetWidth;
      homeRoot.classList.add('gf-stagger');
      return;
    }

    const candidates = screen.querySelectorAll(
      '.swipeShell, .v36Home, .panel, .pgShell, .rbShell, .rnShell'
    );
    const root = candidates[0];
    if (root) {
      root.classList.remove('gf-stagger');
      void root.offsetWidth;
      root.classList.add('gf-stagger');
    }

    const card = screen.querySelector('.swipeCardV');
    if (card) {
      card.classList.remove('gf-card-in');
      void card.offsetWidth;
      card.classList.add('gf-card-in');
    }
  }

  /* ── Answer selection feedback (does not change logic) ── */
  function onActionClick(e) {
    const btn = e.target.closest && e.target.closest('.action, [data-sa], .choice');
    if (!btn || btn.disabled) return;
    btn.classList.add('gf-selected');
    window.setTimeout(function () {
      if (btn.classList.contains('grade-g') || btn.classList.contains('selected')) {
        btn.classList.add('gf-confirm');
        if (btn.classList.contains('grade-g')) Feel.success();
        else if (btn.classList.contains('grade-r')) Feel.error();
      }
    }, 30);
  }

  /* ── Observe swipe card re-renders for enter anim ── */
  function watchSwipeCard() {
    const host = document.getElementById('swipeCard');
    if (!host || host.__gfObserved) return;
    host.__gfObserved = true;
    const mo = new MutationObserver(function () {
      if (reduced()) return;
      const card = host.querySelector('.swipeCardV');
      if (card && !card.classList.contains('gf-card-in')) {
        requestAnimationFrame(function () {
          card.classList.add('gf-card-in');
        });
      }
    });
    mo.observe(host, { childList: true, subtree: true });
  }

  /* ── Init ── */
  function init() {
    document.documentElement.dataset.psGameMotion = BUILD;

    document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
    document.addEventListener('pointerup', onPointerUp, { passive: true, capture: true });
    document.addEventListener('pointercancel', onPointerCancel, { passive: true, capture: true });
    document.addEventListener('lostpointercapture', onPointerCancel, { passive: true, capture: true });
    window.addEventListener('blur', function () {
      if (pressTarget) removePressed(pressTarget);
      pressTarget = null;
    });

    document.addEventListener('click', onActionClick, true);

    patchShow();
    window.addEventListener('load', function () {
      patchShow();
      watchSwipeCard();
      const active = document.querySelector('.screen.active');
      if (active) {
        lastShowId = active.id;
        staggerActive(active.id);
      }
    }, { once: true });

    // Many layers overwrite show() — re-patch briefly after boot
    let tries = 0;
    const rePatch = window.setInterval(function () {
      patchShow();
      tries += 1;
      if (tries > 25) window.clearInterval(rePatch);
    }, 400);

    watchSwipeCard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
