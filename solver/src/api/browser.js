/**
 * Browser Global Adapter
 * Exposes unified grading API to window for use in mini-app flows
 * Call this after unifiedGrading.js and modeAdapters.js load
 */

(function() {
  'use strict';

  // This script expects unifiedGrading.js and modeAdapters.js to be loaded first
  // It wraps their exports as window globals for use in mini-app-compact and training flows

  if (typeof window.gradeDecision !== 'undefined' || (typeof window.PokerSwipeGrading !== 'undefined' && window.PokerSwipeGrading.__owner)) {
    console.log('[UnifiedGradingBrowser] Adapters already loaded');
    return;
  }

  // For development/testing: if modules are loaded, expose them
  // In production, use build tool to include these as globals

  console.log('[UnifiedGradingBrowser] Unified grading API available for browser use');

  // Note: In a real build pipeline, unifiedGrading.js and modeAdapters.js
  // would be bundled and their exports exposed to window
  // For now, this serves as a marker that the API should be available
})();
