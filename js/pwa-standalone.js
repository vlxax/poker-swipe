/**
 * PokerSwipe PWA - Standalone Detection
 * Определяет, запущено ли приложение как PWA
 */

(function() {
  'use strict';

  function isStandalone() {
    if (window.navigator.standalone === true) {
      return true;
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    return false;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  window.PokerPWA = {
    isStandalone: isStandalone,
    isIOS: isIOS,
    isSafari: isSafari,

    shouldShowInstall: function() {
      if (this.isStandalone()) return false;
      if (!this.isIOS()) return false;
      if (!this.isSafari()) return false;
      return true;
    }
  };

  if (isStandalone()) {
    document.documentElement.classList.add('pwa-standalone');
  } else {
    document.documentElement.classList.add('pwa-browser');
  }

  console.log('[PokerPWA] Mode:', isStandalone() ? 'STANDALONE' : 'BROWSER');

})();
