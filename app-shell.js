/**
 * PokerSwipe — Mobile App Shell
 * Viewport height sync + accidental zoom prevention (iOS Safari compatible)
 */
(function () {
  'use strict';

  const BUILD = 'ps-app-shell-v1';

  function isInteractive(el) {
    if (!el || el === document.documentElement) return false;
    return !!el.closest(
      'input, textarea, select, button, a, [role="button"], [role="slider"], ' +
      'label, .xrGrid, .xrCell, [data-battleship], .bs-grid, .bs-cell, ' +
      'input[type="range"], [contenteditable="true"]'
    );
  }

  function syncAppHeight() {
    const h = window.visualViewport?.height || window.innerHeight || 0;
    if (h > 0) {
      document.documentElement.style.setProperty('--ps-app-height', `${h}px`);
      document.documentElement.style.setProperty('--ps-viewport-h', `${h}px`);
    }
  }

  function preventPinchZoom(e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }

  function preventGestureZoom(e) {
    e.preventDefault();
  }

  let lastTouchEnd = 0;
  function preventDoubleTapZoom(e) {
    const now = Date.now();
    if (now - lastTouchEnd < 320 && !isInteractive(e.target)) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }

  function init() {
    document.documentElement.classList.add('psAppShell');
    document.body.classList.add('psAppShell');
    document.documentElement.dataset.psAppShell = BUILD;

    syncAppHeight();
    window.addEventListener('resize', syncAppHeight, { passive: true });
    window.addEventListener('orientationchange', syncAppHeight, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncAppHeight, { passive: true });
    }

    document.addEventListener('touchmove', preventPinchZoom, { passive: false });
    document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
    document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
    document.addEventListener('gestureend', preventGestureZoom, { passive: false });
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.PsAppShell = { BUILD, syncAppHeight };
})();
