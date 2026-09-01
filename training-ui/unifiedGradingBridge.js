/**
 * Unified Grading Runtime Integration Bridge
 * Connects REAL training mode flows (SWIPE, SIZING, DAILY, QUICK) to unified grading adapters
 * Phase 3: Complete runtime integration without changing UI/CSS
 */

/**
 * SUPERSEDED by training-ui/gradingGateway.js.
 * Do not load this file in production. Guarded against dual monkey-patching.
 */
(function() {
  'use strict';

  if (typeof window !== 'undefined' && window.PokerSwipeGrading && window.PokerSwipeGrading.__owner) {
    return;
  }

  if (typeof window.gradeSwipeDecision === 'undefined' ||
      typeof window.gradeSwipeSizing === 'undefined') {
    console.warn('[UnifiedGradingBridge] Adapters not loaded yet, will retry');
    return;
  }

  console.log('[UnifiedGradingBridge] Starting Phase 3 runtime integration');

  /**
   * Hooks into existing finalizeSwipe to use unified grading adapter
   * Replaces direct PokerBrain calls with gradeSwipeDecision()
   */
  function bridgeSwipeGrading() {
    const original = window.finalizeSwipe;
    if (!original || original.__bridged) return;

    window.finalizeSwipe = function(s, a, size) {
      if (window.swLocked) return;
      window.swLocked = true;

      // Use unified adapter instead of PokerBrain.gradeDecision
      const unifiedResult = window.gradeSwipeDecision({
        scenario: s,
        action: a
      });

      // For sizing evaluation (when size is provided)
      let sizeGrade = null;
      if (size != null && s.sizeZone) {
        const [lo, hi] = s.sizeZone;
        sizeGrade = size >= lo && size <= hi ? 'g' : size >= lo - 15 && size <= hi + 20 ? 'y' : 'r';
      }

      // Combine action and size grades (same logic as original)
      const actionGrade = unifiedResult.gradeClass; // g/y/r
      const finalGrade = sizeGrade === 'r' || actionGrade === 'r' ? 'r' : sizeGrade === 'y' || actionGrade === 'y' ? 'y' : 'g';
      const response = window.now ? window.now() - window.swStart : 0;

      // Record to session grades (for report)
      if (!window.swSessionGrades) window.swSessionGrades = [];
      window.swSessionGrades.push({
        g: finalGrade,
        street: s.street,
        concept: s.concept
      });

      // Record event with unified data
      const ev = window.recordEvent?.({
        spotId: s.id,
        mode: 'swipe',
        concept: s.concept,
        conceptId: unifiedResult.metadata?.concept,
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
        policyScore: unifiedResult.metadata?.score,
        evLossBB: unifiedResult.evLossBB
      }) || {};

      // Update DOM: set grade classes on selected button
      document.querySelectorAll('[data-sa]').forEach((b) => {
        b.disabled = true;
        if (b.dataset.sa === a) {
          b.classList.add('selected', 'grade-' + finalGrade);
        }
      });

      // Render verdict (reuse original verdict HTML structure)
      const card = document.getElementById('swipeCard');
      const v = document.getElementById('swipeVerdict');
      if (!card || !v) return;

      card.classList.add('hidden');
      v.classList.remove('hidden');

      const verdictLabel = finalGrade === 'g' ? 'ЧИСТО' : finalGrade === 'y' ? 'ЖИВЁТ' : 'ОШИБКА';
      const verdictHeadline = finalGrade === 'g' ? 'РЕШЕНИЕ ЖИВЕТ' : finalGrade === 'y' ? 'МИКС А НЕ НОРМА' : 'МОДЕЛЬ НЕ СОГЛАСНА';
      const charImg = finalGrade === 'g' ? 'assets/freak-lady/correct/sprite.png' : finalGrade === 'y' ? 'assets/freak-lady/thinking/sprite.png' : 'assets/freak-lady/wrong/sprite.png';
      const charReactionText = finalGrade === 'g' ? 'ОДОБРЕНИЕ' : finalGrade === 'y' ? 'СОМНЕНИЕ' : 'ОТКАЗ';
      const charReactionMsg = finalGrade === 'g' ? 'Даже придраться неприятно.' : finalGrade === 'y' ? 'Живёт, но тонко.' : 'Модель предпочитает другое.';

      v.innerHTML = `<div class="v31Verdict reveal"><div class="v31Result"><div class="v31ResultHero anim-${finalGrade}"><div class="v31ResultGrade">${verdictLabel}</div><div class="v31ResultVerdict">${verdictHeadline}</div><span class="ey">ПОКЕРНЫЙ РАЗБОР · ${s.street}</span></div></div><div class="v31VerdictContent"><div class="v31CharacterZone"><div class="v31Character anim-${finalGrade}"><img src="${charImg}" alt="Фриковая Дама" loading="lazy"/></div><div class="v31Reaction"><span class="ey">${charReactionText}</span><strong>${charReactionMsg}</strong></div></div></div><div class="v31VerdictCTA"><button class="primary" id="verdictNext" style="width:100%">СЛЕДУЮЩИЙ СПОТ →</button></div></div>`;

      const scrollRoot = document.getElementById('mainApp') || document.documentElement;
      scrollRoot.scrollTop = 0;

      document.getElementById('verdictNext').onclick = () => {
        if (typeof window.swipeNext === 'function') window.swipeNext();
      };

      requestAnimationFrame(() => {
        v.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      });

      const delay = finalGrade === 'g' ? 2800 : finalGrade === 'y' ? 3800 : 5200;
      setTimeout(() => {
        document.getElementById('verdictNext')?.focus();
      }, delay);
    };

    window.finalizeSwipe.__bridged = true;
    console.log('[UnifiedGradingBridge] SWIPE grading bridged to unified adapter');
  }

  /**
   * Hooks into SIZING mode to use unified grading adapter
   * Replaces PokerBrain?.gradeDecision() calls in renderSizing
   */
  function bridgeSizingGrading() {
    // This is trickier because the grading happens inside renderSizing's onclick handler
    // We'll wrap the click handler at rendering time
    const originalRenderSizing = window.renderSizing;
    if (!originalRenderSizing || originalRenderSizing.__sizingBridged) return;

    window.renderSizing = function() {
      // Call original to set up DOM
      const result = originalRenderSizing?.call(this);

      // Now wrap the size lock button onclick
      setTimeout(() => {
        const lockBtn = document.getElementById('sizeLock');
        if (!lockBtn || lockBtn.__sizeGradingHooked) return;

        const originalOnclick = lockBtn.onclick;
        lockBtn.onclick = function(e) {
          const area = document.getElementById('sizingArea');
          const shell = area?.querySelector('.pgShell');
          const s = window.SIZING?.[window.sz % window.SIZING.length];
          if (!s) return originalOnclick?.call(this, e);

          // Get the current mode and size from UI
          const ui = window.__szUI || { phase: 'question', mode: 'bet', rangeVal: 50 };
          const v = ui.mode === 'check' ? 0 : ui.mode === 'allin' ? 150 : ui.rangeVal;
          const action = v === 0 ? 'CHECK' : 'BET';

          // Use unified adapter instead of PokerBrain?.gradeDecision
          const unifiedResult = window.gradeSwipeSizing({
            spot: s,
            action: action,
            sizePct: v || null
          });

          const g = unifiedResult.gradeClass || 'y'; // g/y/r

          // Set selected state
          window.PsMotion?.decisionLock(lockBtn);
          window.recordEvent?.({
            spotId: s.id,
            mode: 'sizing',
            concept: s.concept,
            conceptId: unifiedResult.metadata?.concept,
            street: s.street,
            action,
            sizePct: v || null,
            grade: g,
            gradeAction: unifiedResult.gradeClass,
            gradeSize: unifiedResult.gradeClass,
            why: unifiedResult.explanationData?.explanation || s.why,
            brainSource: unifiedResult.source,
            brainConfidence: unifiedResult.confidence,
            policyScore: unifiedResult.metadata?.score,
            evLossBB: unifiedResult.evLossBB
          });

          const resultHtml = `<div class="verdict"><div class="dualGrade"><div class="gradeBox ${unifiedResult.gradeClass}"><span class="ey">ДЕЙСТВИЕ</span><b>${action}</b></div><div class="gradeBox ${unifiedResult.gradeClass}"><span class="ey">РАЗМЕР</span><b>${v ? v + '%' : '—'}</b></div></div><p>${unifiedResult.explanationData?.explanation || s.why}</p><button class="primary pgCta" id="sizeNext">${window.quick?.active ? 'ДАЛЬШЕ ПО СЕССИИ' : 'СЛЕДУЮЩИЙ СПОТ'} →</button></div>`;
          document.getElementById('sizeResult').innerHTML = resultHtml;
          lockBtn.style.display = 'none';

          const backBtn = shell?.querySelector('.pgBackBtn');
          if (backBtn) {
            backBtn.disabled = false;
            backBtn.classList.remove('is-disabled');
          }

          window.__szUI = { phase: 'result', mode: ui.mode, rangeVal: v, resultHtml };
          window.MiniAppNav?.push('sizing', { sz: window.sz, phase: 'result' });

          const verdict = document.getElementById('sizeResult')?.querySelector('.verdict');
          window.PsCharacter?.reactVerdict(verdict, g, 'sizing', { actionGrade: unifiedResult.gradeClass, sizeGrade: unifiedResult.gradeClass });
          window.PsMotion?.sizingConfirm(shell, g);
          window.PsMotion?.progressiveReveal(verdict);

          document.getElementById('sizeNext').onclick = () => {
            if (window.quick?.active) {
              window.quickAdvance?.();
            } else {
              window.sz++;
              window.__szUI = { phase: 'question', mode: 'bet', rangeVal: 50 };
              window.renderSizing?.();
            }
          };
        };

        lockBtn.__sizeGradingHooked = true;
      }, 0);

      return result;
    };

    window.renderSizing.__sizingBridged = true;
    console.log('[UnifiedGradingBridge] SIZING grading bridged to unified adapter');
  }

  /**
   * Hooks DAILY mode grading to ensure it uses solver-based unified adapter
   */
  function bridgeDailyGrading() {
    // DAILY typically uses sessionController.js which calls gradeAnswer
    // We need to ensure it uses gradeDailyDrill adapter
    const originalGradeAnswer = window.gradeAnswer;
    if (!originalGradeAnswer || originalGradeAnswer.__dailyBridged) return;

    window.gradeAnswer = function(input = {}) {
      // Try unified adapter first if drill and solution available
      if (input.drill && typeof window.gradeDailyDrill === 'function') {
        const unifiedResult = window.gradeDailyDrill({
          drill: input.drill,
          chosenActionId: input.chosenId,
          chosenAction: input.chosenAction,
          solution: input.solution
        });

        if (unifiedResult && unifiedResult.grade) {
          console.log('[UnifiedGradingBridge] DAILY using unified adapter, grade:', unifiedResult.grade);
          return unifiedResult;
        }
      }

      // Fallback to original gradeAnswer
      return originalGradeAnswer?.call(this, input);
    };

    window.gradeAnswer.__dailyBridged = true;
    console.log('[UnifiedGradingBridge] DAILY grading bridged to unified adapter');
  }

  /**
   * Initialize all bridges after a delay to ensure adapters are loaded
   */
  function initBridges() {
    const checkAndInit = () => {
      if (typeof window.gradeSwipeDecision === 'undefined') {
        // Adapters not loaded yet, retry
        setTimeout(checkAndInit, 100);
        return;
      }

      bridgeSwipeGrading();
      bridgeSizingGrading();
      bridgeDailyGrading();

      console.log('[UnifiedGradingBridge] Phase 3 runtime integration complete');
    };

    // Start checking after a short delay to let other scripts load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAndInit);
    } else {
      setTimeout(checkAndInit, 100);
    }
  }

  initBridges();

  window.UnifiedGradingBridge = {
    bridgeSwipeGrading,
    bridgeSizingGrading,
    bridgeDailyGrading
  };
})();
