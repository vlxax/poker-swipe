/**
 * PokerSwipe Character System Integration
 * Connects CharacterSystem to SWIPE, SIZING, DAILY, and other flows
 * Respects existing code; adds character reactions without modification
 */
(function() {
  'use strict';

  if (window.__psGameVisualV2) {
    console.log('[CharacterIntegration] Skipped — GameVisualV2 owns character wiring');
    return;
  }

  if (!window.CharacterSystem) {
    console.warn('[CharacterIntegration] CharacterSystem not loaded');
    return;
  }

  // ======================
  // SWIPE INTEGRATION
  // ======================

  /**
   * Enhance SWIPE verdicts with character reactions
   * Wraps the existing finalizeSwipe behavior
   */
  function enhanceSwipeVerdicts() {
    const originalFinalizeSwipe = window.finalizeSwipe;

    if (!originalFinalizeSwipe || originalFinalizeSwipe.__charEnhanced) return;

    window.finalizeSwipe = function(s, a, size) {
      // Call original logic
      const result = originalFinalizeSwipe.call(this, s, a, size);

      // Add character reaction after verdict renders
      setTimeout(() => {
        const swipeFlash = document.querySelector('#swipeFlash');
        if (swipeFlash) {
          // Get the grade from the selected action button (where grade classes are actually set)
          const selectedBtn = document.querySelector('[data-sa].selected');
          let grade = 'g'; // default
          if (selectedBtn) {
            if (selectedBtn.classList.contains('grade-g')) {
              grade = 'g';
            } else if (selectedBtn.classList.contains('grade-y')) {
              grade = 'y';
            } else if (selectedBtn.classList.contains('grade-r')) {
              grade = 'r';
            }
          }

          // Add sequenced character reaction
          CharacterSystem.sequencedReaction(
            swipeFlash,
            grade,
            'swipe',
            { characterDelay: 200 }
          );
        }
      }, 100);

      return result;
    };

    window.finalizeSwipe.__charEnhanced = true;
    console.log('[CharacterIntegration] SWIPE verdicts enhanced');
  }

  // ======================
  // SIZING INTEGRATION
  // ======================

  /**
   * Enhance SIZING results with character reactions
   * Wraps existing renderSizing behavior
   */
  function enhanceSizingResults() {
    const originalRenderSizing = window.renderSizing;

    if (!originalRenderSizing || originalRenderSizing.__charEnhanced) return;

    window.renderSizing = function() {
      const result = originalRenderSizing.call(this);

      // Hook into the size button to add character reaction
      setTimeout(() => {
        const sizeBtn = document.querySelector('#sizeLock');
        if (sizeBtn && !sizeBtn.__charHooked) {
          const originalClick = sizeBtn.onclick;
          sizeBtn.onclick = function(e) {
            const clickResult = originalClick.call(this, e);

            // Add character to sizing result
            setTimeout(() => {
              const sizeResult = document.querySelector('#sizeResult');
              if (sizeResult && sizeResult.querySelector('.verdict')) {
                const verdict = sizeResult.querySelector('.verdict');
                // Get grade from gradeBox classes
                const gradeBox = verdict.querySelector('.gradeBox');
                let grade = 'y';
                if (gradeBox?.classList.contains('g')) grade = 'g';
                if (gradeBox?.classList.contains('r')) grade = 'r';

                CharacterSystem.sequencedReaction(
                  verdict,
                  grade,
                  'sizing',
                  { characterDelay: 200 }
                );
              }
            }, 150);

            return clickResult;
          };
          sizeBtn.__charHooked = true;
        }
      }, 200);

      return result;
    };

    window.renderSizing.__charEnhanced = true;
    console.log('[CharacterIntegration] SIZING results enhanced');
  }

  // ======================
  // DAILY INTEGRATION
  // ======================

  /**
   * Enhance DAILY results with character reactions
   */
  function enhanceDailyResults() {
    const originalDailyReveal = window.dailyReveal;

    if (!originalDailyReveal || originalDailyReveal.__charEnhanced) return;

    window.dailyReveal = function() {
      const result = originalDailyReveal.call(this);

      // Add character reaction to daily result
      setTimeout(() => {
        const dailyArea = document.querySelector('#dailyArea');
        if (dailyArea) {
          const panel = dailyArea.querySelector('.panel');
          if (panel) {
            // Get grade from gradeBox
            const gradeBoxes = panel.querySelectorAll('.gradeBox');
            let grade = 'y';
            for (const box of gradeBoxes) {
              if (box.classList.contains('r')) {
                grade = 'r';
                break;
              }
              if (box.classList.contains('g') && grade !== 'r') grade = 'g';
            }

            CharacterSystem.sequencedReaction(
              panel,
              grade,
              'daily',
              { characterDelay: 300, wide: true }
            );
          }
        }
      }, 150);

      return result;
    };

    window.dailyReveal.__charEnhanced = true;
    console.log('[CharacterIntegration] DAILY results enhanced');
  }

  // ======================
  // REVIEW INTEGRATION
  // ======================

  /**
   * Enhance REVIEW results
   */
  function enhanceReviewResults() {
    const originalReviewReveal = window.reviewReveal;

    if (!originalReviewReveal || originalReviewReveal.__charEnhanced) return;

    window.reviewReveal = function() {
      const result = originalReviewReveal.call(this);

      setTimeout(() => {
        const reviewArea = document.querySelector('#reviewArea');
        if (reviewArea) {
          const panel = reviewArea.querySelector('.panel');
          if (panel) {
            // Determine grade from content
            let grade = 'y';
            if (panel.textContent.includes('ЧИСТО')) grade = 'g';
            if (panel.textContent.includes('ОШИБКА') || panel.textContent.includes('МИМО')) grade = 'r';

            CharacterSystem.sequencedReaction(
              panel,
              grade,
              'review',
              { characterDelay: 250 }
            );
          }
        }
      }, 150);

      return result;
    };

    window.reviewReveal.__charEnhanced = true;
    console.log('[CharacterIntegration] REVIEW results enhanced');
  }

  // ======================
  // SOLVER INTEGRATION (if exists)
  // ======================

  /**
   * Enhance solver mode character reactions
   */
  function enhanceSolverMode() {
    // Check if solver mode exists
    if (typeof window.solverGrade !== 'function') return;

    console.log('[CharacterIntegration] Solver mode detected');
    // Solver likely has its own character integration via existing FreakLady calls
  }

  // ======================
  // INITIALIZATION
  // ======================

  /**
   * Initialize all integrations
   */
  function initializeIntegrations() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeIntegrations);
      return;
    }

    // Apply all enhancements
    enhanceSwipeVerdicts();
    enhanceSizingResults();
    enhanceDailyResults();
    enhanceReviewResults();
    enhanceSolverMode();

    console.log('[CharacterIntegration] All integrations initialized');
  }

  // Start when CharacterSystem is ready
  if (window.CharacterSystem) {
    initializeIntegrations();
  } else {
    window.addEventListener('load', initializeIntegrations);
  }

  // Export for testing
  window.CharacterIntegration = {
    enhanceSwipeVerdicts,
    enhanceSizingResults,
    enhanceDailyResults,
    enhanceReviewResults,
    enhanceSolverMode
  };

  console.log('[CharacterIntegration] Loaded and ready');
})();
