/**
 * PokerSwipe — Mobile App Shell
 * Viewport height sync + accidental zoom prevention (iOS Safari compatible)
 */
(function () {
  'use strict';

  const BUILD = 'ps-app-shell-v3-nav-tap-guard';

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

  const HOME_TILE_SELECTOR =
    '#v36Swipe,#v36Quick,#v36Sizing,#v36Review,#v36Daily,#v36Xray,#v36Exploit,' +
    '#homeSwipe,#homePlay30,#homeSwipe30,#homeSizing,#homeReview,#homeDaily,#homeXray';

  const TAP_SLOP_PX = 12;
  const NAV_DEDUPE_MS = 400;
  let pendingHomeTap = null;
  let lastNavAt = 0;
  let lastNavRoute = null;

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

  function openHomeModeRoute(id) {
    const route = HOME_MODE_ROUTES[id];
    if (!route || typeof window.show !== 'function') return false;
    const now = Date.now();
    if (now - lastNavAt < NAV_DEDUPE_MS && lastNavRoute === route) return true;
    lastNavAt = now;
    lastNavRoute = route;
    if (route === 'swipe') {
      try { window.swSession = []; } catch (_) { /* ignore */ }
    }
    window.show(route);
    return true;
  }

  function onHomeModePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const home = document.getElementById('home');
    if (!home?.classList.contains('active')) return;
    const tile = e.target.closest?.(HOME_TILE_SELECTOR);
    if (!tile?.id || !HOME_MODE_ROUTES[tile.id]) return;
    pendingHomeTap = { id: tile.id, x: e.clientX, y: e.clientY };
  }

  function onHomeModePointerUp(e) {
    if (!pendingHomeTap) return;
    const tap = pendingHomeTap;
    pendingHomeTap = null;
    const home = document.getElementById('home');
    if (!home?.classList.contains('active')) return;
    if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP_PX) return;
    const tile = e.target.closest?.(HOME_TILE_SELECTOR);
    if (!tile || tile.id !== tap.id) return;
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

    document.addEventListener('pointerdown', onHomeModePointerDown, true);
    document.addEventListener('pointerup', onHomeModePointerUp, true);
    document.addEventListener('pointercancel', () => { pendingHomeTap = null; }, true);
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
