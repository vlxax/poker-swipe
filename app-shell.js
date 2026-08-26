/**
 * PokerSwipe — Mobile App Shell
 * Viewport height sync + accidental zoom prevention (iOS Safari compatible)
 */
(function () {
  'use strict';

  const BUILD = 'ps-app-shell-v2';

  const HOME_MODE_ROUTES = {
    v36Swipe: 'swipe',
    v36Quick: 'swipe',
    v36Sizing: 'sizing',
    v36Review: 'review',
    v36Daily: 'daily',
    v36Xray: 'ranges',
    v36Exploit: 'exploit',
    homeSwipe: 'swipe',
    homePlay30: 'swipe',
    homeSwipe30: 'swipe',
    homeSizing: 'sizing',
    homeReview: 'review',
    homeDaily: 'daily',
    homeXray: 'xray'
  };

  function syncAppHeight() {
    const h = window.visualViewport?.height || window.innerHeight || 0;
    if (h > 0) {
      document.documentElement.style.setProperty('--ps-app-height', `${h}px`);
      document.documentElement.style.setProperty('--ps-viewport-h', `${h}px`);
    }
  }

  function resetAppScroll() {
    const root = document.getElementById('mainApp') || document.scrollingElement || document.documentElement;
    if (root) root.scrollTop = 0;
    try { window.scrollTo(0, 0); } catch (_) { /* ignore */ }
  }

  function preventPinchZoom(e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }

  function preventGestureZoom(e) {
    e.preventDefault();
  }

  function patchShow() {
    const orig = window.show;
    if (!orig || orig.__psAppShellPatch) return;
    window.show = function psAppShellShow(id) {
      const result = orig.apply(this, arguments);
      resetAppScroll();
      return result;
    };
    window.show.__psAppShellPatch = true;
  }

  let lastHomeRouteAt = 0;
  function openHomeModeRoute(id) {
    const route = HOME_MODE_ROUTES[id];
    if (!route || typeof window.show !== 'function') return false;
    const now = Date.now();
    if (now - lastHomeRouteAt < 350) return true;
    lastHomeRouteAt = now;
    if (route === 'swipe') {
      try { window.swSession = []; } catch (_) { /* ignore */ }
    }
    window.show(route);
    return true;
  }

  /* Reliable iOS fallback: pointerup on home mode tiles (click can be suppressed by Safari). */
  function onHomeModePointerUp(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const home = document.getElementById('home');
    if (!home?.classList.contains('active')) return;
    const tile = e.target.closest?.(
      '#v36Swipe,#v36Quick,#v36Sizing,#v36Review,#v36Daily,#v36Xray,#v36Exploit,' +
      '#homeSwipe,#homePlay30,#homeSwipe30,#homeSizing,#homeReview,#homeDaily,#homeXray'
    );
    if (!tile?.id) return;
    if (!HOME_MODE_ROUTES[tile.id]) return;
    openHomeModeRoute(tile.id);
  }

  function init() {
    document.documentElement.classList.add('psAppShell');
    document.body.classList.add('psAppShell');
    document.documentElement.dataset.psAppShell = BUILD;

    syncAppHeight();
    window.addEventListener('resize', syncAppHeight, { passive: true });
    window.addEventListener('orientationchange', syncAppScroll, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncAppHeight, { passive: true });
    }

    /* Pinch + gesture only — never preventDefault on touchend (breaks iOS click synthesis). */
    document.addEventListener('touchmove', preventPinchZoom, { passive: false });
    document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
    document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
    document.addEventListener('gestureend', preventGestureZoom, { passive: false });

    document.addEventListener('pointerup', onHomeModePointerUp, true);
    patchShow();
    if (document.readyState === 'complete') patchShow();
    else window.addEventListener('load', patchShow, { once: true });
  }

  function syncAppScroll() {
    syncAppHeight();
    resetAppScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.PsAppShell = { BUILD, syncAppHeight, resetAppScroll, openHomeModeRoute };
})();
