/**
 * Unified Grading Integration - Phase 3 Runtime
 * Injects unified grading adapters into mini-app flows
 * Works with or without ES6 module support
 *
 * Integration points:
 * - SIZING (mini-app-compact.js line 554): window.PokerBrain?.gradeDecision
 * - SWIPE (mini-app-compact.js line 648): window.finalizeSwipe (creates if not exist)
 * - DAILY (sessionController.js line 184): gradeAnswer (already uses solver)
 * - QUICK (mini-app-compact.js): wraps SWIPE
 */

(function() {
  'use strict';

  console.log('[UnifiedGradingIntegration] Initializing Phase 3 runtime...');

  // ===========================
  // Step 1: Create adapter shims that use PokerBrain as the backend
  // These are compatibility adapters until the real unified system is fully loaded
  // ===========================

  /**
   * Shim for SIZING mode adapter
   * Input: {spot, action, sizePct}
   * Output: {grade: g|y|r, gradeClass: g|y|r, evLossBB: null, source, ...}
   */
  function gradeSwipeSizingShim(input = {}) {
    const { spot = {}, action, sizePct } = input;
    const br = window.PokerBrain?.gradeDecision(
      { ...spot, spotId: spot.id },
      action,
      sizePct || null
    ) || {};

    return {
      grade: br.grade || 'y',
      gradeClass: br.grade || 'y',
      evLossBB: null,
      source: br.source || 'legacy-policy',
      confidence: br.confidence || 0,
      metadata: {
        legacyGrade: br.grade,
        actionGrade: br.actionGrade,
        sizeGrade: br.sizeGrade,
        score: br.score,
        concept: br.concept
      },
      explanationData: {
        grade: br.grade || 'y',
        explanation: br.explanation
      }
    };
  }

  /**
   * Shim for SWIPE mode adapter
   * Input: {scenario, action}
   * Output: {grade, gradeClass, evLossBB, source, ...}
   */
  function gradeSwipeDecisionShim(input = {}) {
    const { scenario = {}, action } = input;
    const br = window.PokerBrain?.gradeDecision(
      { ...scenario, spotId: scenario.id || scenario.spotId },
      action,
      null
    ) || {};

    return {
      grade: br.grade || 'y',
      gradeClass: br.grade || 'y',
      evLossBB: null,
      source: br.source || 'legacy-policy',
      confidence: br.confidence || 0,
      metadata: {
        legacyGrade: br.grade,
        actionGrade: br.actionGrade,
        concept: br.concept
      },
      explanationData: {
        grade: br.grade || 'y',
        explanation: br.explanation
      }
    };
  }

  // Make shims available as window globals
  if (!window.gradeSwipeSizing) window.gradeSwipeSizing = gradeSwipeSizingShim;
  if (!window.gradeSwipeDecision) window.gradeSwipeDecision = gradeSwipeDecisionShim;

  // ===========================
  // Step 2: Create original finalizeSwipe function (was missing from codebase)
  // ===========================

  function createFinalizeSwipe() {
    if (window.finalizeSwipe && window.finalizeSwipe.__integrated) {
      return; // Already created
    }

    window.finalizeSwipe = function(s, a, size) {
      if (window.swLocked) return;
      window.swLocked = true;

      // Use unified adapter (shim or real)
      const unifiedResult = window.gradeSwipeDecision?.({
        scenario: s,
        action: a
      }) || {
        grade: 'y',
        gradeClass: 'y',
        evLossBB: null,
        source: 'legacy-policy',
        confidence: 0,
        metadata: {},
        explanationData: { explanation: s.why }
      };

      // Grade sizing if provided
      let sizeGrade = null;
      if (size != null && s.sizeZone) {
        const [lo, hi] = s.sizeZone;
        sizeGrade = size >= lo && size <= hi ? 'g' : size >= lo - 15 && size <= hi + 20 ? 'y' : 'r';
      }

      const actionGrade = unifiedResult.gradeClass; // g/y/r
      const finalGrade = sizeGrade === 'r' || actionGrade === 'r' ? 'r' : sizeGrade === 'y' || actionGrade === 'y' ? 'y' : 'g';
      const response = window.now ? window.now() - window.swStart : 0;

      if (!window.swSessionGrades) window.swSessionGrades = [];
      window.swSessionGrades.push({
        g: finalGrade,
        street: s.street,
        concept: s.concept
      });

      // Record event
      if (window.recordEvent) {
        window.recordEvent({
          spotId: s.id,
          mode: 'swipe',
          concept: s.concept,
          street: s.street,
          action: a,
          sizePct: size,
          grade: finalGrade,
          gradeAction: actionGrade,
          gradeSize: sizeGrade,
          responseMs: response,
          why: unifiedResult.explanationData?.explanation || s.why,
          brainSource: unifiedResult.source,
          brainConfidence: unifiedResult.confidence,
          evLossBB: unifiedResult.evLossBB
        });
      }

      // Update DOM
      document.querySelectorAll('[data-sa]').forEach((b) => {
        b.disabled = true;
        if (b.dataset.sa === a) {
          b.classList.add('selected', 'grade-' + finalGrade);
        }
      });

      // Render verdict
      const card = document.getElementById('swipeCard');
      const v = document.getElementById('swipeVerdict');
      if (card && v) {
        card.classList.add('hidden');
        v.classList.remove('hidden');

        const verdictLabel = finalGrade === 'g' ? 'ЧИСТО' : finalGrade === 'y' ? 'ЖИВЁТ' : 'ОШИБКА';
        const verdictHeadline = finalGrade === 'g' ? 'РЕШЕНИЕ ЖИВЕТ' : finalGrade === 'y' ? 'МИКС А НЕ НОРМА' : 'МОДЕЛЬ НЕ СОГЛАСНА';

        v.innerHTML = `<div class="v31Verdict reveal"><div class="v31Result"><div class="v31ResultHero anim-${finalGrade}"><div class="v31ResultGrade">${verdictLabel}</div><div class="v31ResultVerdict">${verdictHeadline}</div><span class="ey">ПОКЕРНЫЙ РАЗБОР · ${s.street}</span></div></div><div class="v31VerdictCTA"><button class="primary" id="verdictNext" style="width:100%">СЛЕДУЮЩИЙ СПОТ →</button></div></div>`;

        const scrollRoot = document.getElementById('mainApp') || document.documentElement;
        scrollRoot.scrollTop = 0;

        document.getElementById('verdictNext')?.addEventListener('click', () => {
          if (typeof window.swipeNext === 'function') window.swipeNext();
        });
      }
    };

    window.finalizeSwipe.__integrated = true;
    console.log('[UnifiedGradingIntegration] finalizeSwipe created');
  }

  // ===========================
  // Step 3: Hook SIZING grading to use unified adapter
  // ===========================

  function hookSizingGrading() {
    if (window.__sizingHooked) return;

    const originalRenderSizing = window.renderSizing;
    if (!originalRenderSizing) return;

    window.renderSizing = function() {
      const result = originalRenderSizing?.call(this);

      setTimeout(() => {
        const lockBtn = document.getElementById('sizeLock');
        if (!lockBtn || lockBtn.__hooked) return;

        const originalClick = lockBtn.onclick;
        lockBtn.onclick = function(e) {
          const area = document.getElementById('sizingArea');
          const s = window.SIZING?.[window.sz % window.SIZING.length];
          const ui = window.__szUI || { phase: 'question', mode: 'bet', rangeVal: 50 };

          if (!s || ui.phase === 'result') {
            return originalClick?.call(this, e);
          }

          // Use unified adapter
          const v = ui.mode === 'check' ? 0 : ui.mode === 'allin' ? 150 : ui.rangeVal;
          const action = v === 0 ? 'CHECK' : 'BET';

          const unifiedResult = window.gradeSwipeSizing?.({
            spot: s,
            action: action,
            sizePct: v || null
          }) || {
            gradeClass: 'y',
            source: 'legacy-policy',
            confidence: 0,
            explanationData: {}
          };

          const g = unifiedResult.gradeClass || 'y';

          // Continue with original logic but use unified result
          window.PsMotion?.decisionLock(lockBtn);
          if (window.recordEvent) {
            window.recordEvent({
              spotId: s.id,
              mode: 'sizing',
              concept: s.concept,
              street: s.street,
              action,
              sizePct: v || null,
              grade: g,
              gradeAction: unifiedResult.gradeClass,
              gradeSize: unifiedResult.gradeClass,
              why: unifiedResult.explanationData?.explanation || s.why,
              brainSource: unifiedResult.source,
              brainConfidence: unifiedResult.confidence,
              evLossBB: unifiedResult.evLossBB
            });
          }

          const resultHtml = `<div class="verdict"><div class="dualGrade"><div class="gradeBox ${unifiedResult.gradeClass}"><span class="ey">ДЕЙСТВИЕ</span><b>${action}</b></div><div class="gradeBox ${unifiedResult.gradeClass}"><span class="ey">РАЗМЕР</span><b>${v ? v + '%' : '—'}</b></div></div><p>${unifiedResult.explanationData?.explanation || s.why}</p><button class="primary pgCta" id="sizeNext">${window.quick?.active ? 'ДАЛЬШЕ ПО СЕССИИ' : 'СЛЕДУЮЩИЙ СПОТ'} →</button></div>`;
          document.getElementById('sizeResult').innerHTML = resultHtml;
          lockBtn.style.display = 'none';

          const backBtn = area?.querySelector('.pgBackBtn');
          if (backBtn) {
            backBtn.disabled = false;
            backBtn.classList.remove('is-disabled');
          }

          window.__szUI = { phase: 'result', mode: ui.mode, rangeVal: v, resultHtml };
          window.MiniAppNav?.push('sizing', { sz: window.sz, phase: 'result' });

          const verdict = document.getElementById('sizeResult')?.querySelector('.verdict');
          window.PsCharacter?.reactVerdict(verdict, g, 'sizing', { actionGrade: unifiedResult.gradeClass, sizeGrade: unifiedResult.gradeClass });
          window.PsMotion?.sizingConfirm(area?.querySelector('.pgShell'), g);
          window.PsMotion?.progressiveReveal(verdict);

          document.getElementById('sizeNext').onclick = () => {
            if (window.quick?.active) window.quickAdvance?.();
            else {
              window.sz++;
              window.__szUI = { phase: 'question', mode: 'bet', rangeVal: 50 };
              window.renderSizing?.();
            }
          };
        };

        lockBtn.__hooked = true;
      }, 0);

      return result;
    };

    window.__sizingHooked = true;
    console.log('[UnifiedGradingIntegration] SIZING grading hooked');
  }

  // ===========================
  // Step 4: Initialize all integrations
  // ===========================

  function init() {
    createFinalizeSwipe();
    hookSizingGrading();
    console.log('[UnifiedGradingIntegration] Phase 3 runtime integration complete');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  // Export for testing
  window.UnifiedGradingIntegration = {
    gradeSwipeSizingShim,
    gradeSwipeDecisionShim,
    createFinalizeSwipe,
    hookSizingGrading,
    init
  };
})();
