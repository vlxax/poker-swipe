/**
 * PokerSwipe — Game Visual Rebuild V2
 * Wires Freak Lady 217-phrase engine + composition layouts into production renderers.
 */
(function () {
  'use strict';

  window.__psGameVisualV2 = true;
  document.documentElement.classList.add('psGameVisualV2');
  document.body?.classList.add('psGameVisualV2');

  function gradeFromSelected() {
    const btn = document.querySelector('[data-sa].selected');
    if (!btn) return 'y';
    if (btn.classList.contains('grade-g')) return 'g';
    if (btn.classList.contains('grade-r')) return 'r';
    return 'y';
  }

  function actionKey(action) {
    const a = String(action || '').toLowerCase();
    if (a.includes('fold')) return 'fold';
    if (a.includes('check')) return 'check';
    if (a.includes('call')) return 'call';
    if (a.includes('bet') || a.includes('raise') || a.includes('push')) return 'bet';
    return undefined;
  }

  function mountFreakLady(target, mood, context, opts) {
    if (!target || !window.FreakLady?.react) return null;
    return window.FreakLady.react(target, mood, context, {
      layout: 'scene',
      side: 'right',
      wide: true,
      ...opts
    });
  }

  function buildLossMapHTML(losses, nodes) {
    if (!Array.isArray(losses) || !losses.length) return '';
    const max = Math.max(...losses.map((x) => Number(x) || 0), 0.01);
    let problemIdx = 0;
    let maxLoss = -1;
    losses.forEach((x, i) => {
      const v = Number(x) || 0;
      if (v > maxLoss) { maxLoss = v; problemIdx = i; }
    });

    const rows = losses.map((x, i) => {
      const v = Number(x) || 0;
      const pct = Math.round((v / max) * 100);
      const street = (nodes?.[i]?.[0] || ['PRE', 'FLOP', 'TURN', 'RIVER'][i] || String(i)).toString().toUpperCase();
      const problem = i === problemIdx && v > 0;
      return `<div class="psLossMap__row${problem ? ' is-problem' : ''}">
        <span class="psLossMap__street">${street}</span>
        <div class="psLossMap__bar"><i style="width:${pct}%"></i></div>
        <span class="psLossMap__val">${v.toFixed(2)}</span>
      </div>`;
    }).join('');

    return `<div class="psLossMap"><span class="psLossMap__label">КАРТА ПОТЕРЬ · EV ПО УЛИЦАМ</span>${rows}</div>`;
  }

  function buildNarrativeFlow(s, a, size) {
    const grade = gradeFromSelected();
    const verdictLabel = grade === 'g' ? 'ЧИСТО' : grade === 'y' ? 'ЖИВЁТ' : 'ОШИБКА';
    const ctx = (s?.ctx && s.ctx.length > 0) ? s.ctx.substring(0, 80) : 'Контекст спота';
    const hand = s?.hero ? `${s.hero[0]} ${s.hero[1]}` : '—';
    const street = s?.street || '—';
    const concept = s?.concept || 'Концепция';
    const action = `${a || '—'}${size != null ? ` · ${size}%` : ''}`;

    const steps = [
      { n: '1', label: 'ЧТО БЫЛО', value: ctx },
      { n: '2', label: 'ГДЕ СЛОМАЛОСЬ', value: `${street}${s?.board?.length ? ` · ${s.board.length}-street` : ''}` },
      { n: '3', label: 'ПОЧЕМУ', value: `${hand} · ${concept}` },
      { n: '4', label: 'ЧТО ДАЛЬШЕ', value: `${action} → ${verdictLabel}`, verdict: true }
    ];

    return `<div class="psVerdictNarrative">${steps.map((step) => `
      <div class="psNarrativeStep${step.verdict ? ' is-verdict' : ''}">
        <span class="psNarrativeStep__marker">${step.n}</span>
        <div>
          <span class="psNarrativeStep__label">${step.label}</span>
          <strong class="psNarrativeStep__value">${step.value}</strong>
        </div>
      </div>`).join('')}</div>`;
  }

  function restructureSwipeVerdict(s, a, size) {
    const report = document.querySelector('.verdictReportV21');
    const scene = document.querySelector('.verdictScene');
    if (!report || !scene || report.dataset.psSceneV2) return null;

    const sceneContent = scene.querySelector('.sceneContent');
    if (!sceneContent) return null;

    report.classList.add('psVerdictReport');
    scene.classList.add('psVerdictScene');
    report.dataset.psSceneV2 = '1';

    const narrative = document.createElement('div');
    narrative.innerHTML = buildNarrativeFlow(s, a, size);
    const narrativeEl = narrative.firstElementChild;

    sceneContent.innerHTML = '';
    if (narrativeEl) sceneContent.appendChild(narrativeEl);

    let coachLayer = scene.querySelector('.psVerdictCoachLayer');
    if (!coachLayer) {
      coachLayer = document.createElement('div');
      coachLayer.className = 'psVerdictCoachLayer';
      scene.appendChild(coachLayer);
    }

    const legacyZone = document.querySelector('.verdictCharacterZone');
    if (legacyZone) {
      legacyZone.innerHTML = '';
      legacyZone.style.display = 'none';
    }

    return coachLayer;
  }

  /* ── SWIPE: scene character overlapping verdict analysis ── */
  function mountSwipeCharacter(s, a, size) {
    const g = gradeFromSelected();
    const coachLayer = restructureSwipeVerdict(s, a, size) || document.querySelector('.psVerdictCoachLayer, .verdictCharacterZone');
    if (!coachLayer || !window.FreakLady) return;

    coachLayer.innerHTML = '';
    window.FreakLady.react(coachLayer, g, 'swipe', {
      layout: 'scene',
      side: 'right',
      replace: true,
      concept: s?.concept,
      action: actionKey(a),
      confidence: s?.confidence
    });
  }

  function enhanceFinalizeSwipe() {
    const wrap = (orig) => {
      if (!orig || orig.__psVisualV2) return orig;
      const wrapped = function (s, a, size) {
        const out = orig.apply(this, arguments);
        requestAnimationFrame(() => {
          setTimeout(() => mountSwipeCharacter(s, a, size), 120);
        });
        return out;
      };
      wrapped.__psVisualV2 = true;
      return wrapped;
    };

    window.finalizeSwipe = wrap(window.finalizeSwipe);

    const obs = new MutationObserver(() => {
      const scene = document.querySelector('.verdictScene:not([data-ps-scene-v2])');
      const zone = document.querySelector('.verdictCharacterZone, .v31CharacterZone');
      if ((scene || zone) && window.FreakLady && !document.querySelector('.psVerdictCoachLayer .psCharCompose')) {
        const staticImg = zone?.querySelector('.charArtwork img, .v31Character img');
        if (staticImg || scene) {
          const s = window.swSession?.[window.swIndex];
          const btn = document.querySelector('[data-sa].selected');
          mountSwipeCharacter(s, btn?.dataset?.sa, btn?.dataset?.size);
        }
      }
    });
    const verdict = document.getElementById('swipeVerdict');
    if (verdict) obs.observe(verdict, { childList: true, subtree: true });
  }

  function paintReviewForensic() {
    const area = document.getElementById('reviewArea');
    const panel = area?.querySelector('.panel, .pgShell');
    if (!panel || !window.FreakLady) return false;
    if (!panel.querySelector('.brainPanel, .evidence, .brainExplain')) return false;

    const R = window.REVIEWS?.[window.rv % (window.REVIEWS?.length || 1)];
    const bm = window.PokerBrain?.reviewLine?.(R);
    if (!bm) return false;

    const pointOk = (bm.clean && window.rvPick === 'none') || (!bm.clean && window.rvPick === bm.culpritIndex);
    const grade = pointOk ? 'g' : 'r';

    panel.querySelectorAll('.psReviewForensic, .psReviewCoachHost').forEach((el) => el.remove());
    panel.querySelector('.freakCoachReaction')?.remove();

    const forensic = document.createElement('div');
    forensic.className = 'psReviewForensic';

    const sceneInner = document.createElement('div');
    sceneInner.className = 'psReviewForensic__scene';

    if (!bm.clean) {
      const losses = bm.losses?.length
        ? bm.losses
        : (R?.nodes || []).map((_, i) => (i === bm.culpritIndex ? 1 : 0.15));
      sceneInner.innerHTML = `
        <div class="psReviewForensic__title">ГДЕ<br><span>СЛОМАЛОСЬ?</span></div>
        <p class="psReviewForensic__sub">Найди улицу, где EV начал утекать.</p>
        ${buildLossMapHTML(losses, R?.nodes)}
      `;
    } else {
      sceneInner.innerHTML = `
        <div class="psReviewForensic__title">ЧИСТАЯ<br><span>ЛИНИЯ.</span></div>
        <p class="psReviewForensic__sub">EV не утекал — разбор для тренировки внимания.</p>
      `;
    }

    const coachHost = document.createElement('div');
    coachHost.className = 'psReviewCoachHost';
    sceneInner.appendChild(coachHost);
    forensic.appendChild(sceneInner);

    const anchor = panel.querySelector('h1.impact, .impact, .pgHud');
    if (anchor) anchor.insertAdjacentElement('afterend', forensic);
    else panel.insertAdjacentElement('afterbegin', forensic);

    panel.querySelector('.evidence')?.classList.add('psReviewEvidence--compact');
    panel.querySelector('.brainPanel')?.classList.add('psReviewBrain--hidden');

    const headline = pointOk
      ? 'НАШЛА.<br><span class="accent">УЗЕЛ.</span>'
      : 'СОФТ ВИДИТ<br><span class="accent">ДРУГОЙ УЗЕЛ.</span>';

    window.FreakLady.react(coachHost, grade, 'review', {
      layout: 'scene',
      side: 'right',
      headline,
      replace: true,
      concept: R?.concept
    });

    return true;
  }

  function scheduleReviewForensic(retry = 0) {
    if (paintReviewForensic()) return;
    if (retry < 24) setTimeout(() => scheduleReviewForensic(retry + 1), 120);
  }

  /* ── REVIEW: forensic investigation layout ── */
  function enhanceReviewReveal() {
    const orig = window.reviewReveal;
    if (!orig || orig.__psVisualV2) return;

    window.reviewReveal = function () {
      const out = orig.apply(this, arguments);
      scheduleReviewForensic();
      return out;
    };
    window.reviewReveal.__psVisualV2 = true;
  }

  /* ── SIZING: demon immediate + FreakLady on mistakes ── */
  function enhanceSizingResults() {
    const orig = window.renderSizing;
    if (!orig || orig.__psVisualSizing) return;

    const wrapped = function () {
      const result = orig.apply(this, arguments);
      setTimeout(() => {
        const lockBtn = document.getElementById('sizeLock');
        if (!lockBtn || lockBtn.__psVisualHook) return;
        const origClick = lockBtn.onclick;
        lockBtn.onclick = function (e) {
          const clickResult = origClick?.call(this, e);
          setTimeout(() => {
            const verdict = document.querySelector('#sizeResult .verdict, #sizeResult .pgVerdictCompact');
            if (!verdict) return;
            const gradeBox = verdict.querySelector('.gradeBox');
            let grade = 'y';
            if (gradeBox?.classList.contains('g')) grade = 'g';
            if (gradeBox?.classList.contains('r')) grade = 'r';

            if (window.PsCharacter?.reactVerdict) {
              let slot = verdict.querySelector('.pgDemonSlot');
              if (!slot) {
                slot = document.createElement('div');
                slot.className = 'pgDemonSlot';
                verdict.insertBefore(slot, verdict.firstChild);
              }
              window.PsCharacter.reactVerdict(slot, grade, 'sizing', { compact: true });
            }

            if (grade !== 'g' && window.FreakLady) {
              const host = document.createElement('div');
              host.className = 'psSizingCoachHost';
              const next = verdict.querySelector('.primary, .pgCta');
              if (next) verdict.insertBefore(host, next);
              else verdict.appendChild(host);
              window.FreakLady.react(host, grade, 'sizing', { layout: 'scene', side: 'right' });
            }
          }, 120);
          return clickResult;
        };
        lockBtn.__psVisualHook = true;
      }, 200);
      return result;
    };
    wrapped._maOrig = orig._maOrig || orig;
    wrapped.__psVisualSizing = true;
    window.renderSizing = wrapped;
  }

  /* ── DAILY: cinematic coach scene ── */
  function paintDailyCoach() {
    const panel = document.querySelector('#dailyArea .panel, #dailyArea .pgShell');
    if (!panel || !window.FreakLady) return false;
    if (!panel.querySelector('h1.impact, .impact')) return false;

    panel.querySelector('.psDailyCoachHost')?.remove();
    panel.querySelector('.freakCoachReaction')?.remove();
    panel.querySelectorAll('.dualGrade, .brainPanel').forEach((el) => el.classList.add('psDailyDash--hidden'));

    const gradeBox = panel.querySelector('.gradeBox.r, .gradeBox.g, .gradeBox.y');
    let grade = 'y';
    if (gradeBox?.classList.contains('g')) grade = 'g';
    if (gradeBox?.classList.contains('r')) grade = 'r';

    const host = document.createElement('div');
    host.className = 'psDailyCoachHost';
    const headline = panel.querySelector('h1.impact, .impact');
    if (headline) headline.insertAdjacentElement('afterend', host);
    else panel.appendChild(host);

    const demon = panel.querySelector('.psCharReaction:not(.psDemonPeek)');

    window.FreakLady.react(host, grade, 'daily', {
      layout: 'scene',
      side: 'right',
      wide: true,
      replace: true,
      confidence: window.dConf
    });

    if (demon) {
      demon.classList.add('psDemonPeek');
      host.appendChild(demon);
    }

    return true;
  }

  function scheduleDailyCoach(retry = 0) {
    if (paintDailyCoach()) return;
    if (retry < 20) setTimeout(() => scheduleDailyCoach(retry + 1), 120);
  }

  function enhanceDailyFlow() {
    const origReveal = window.dailyReveal;
    if (origReveal && !origReveal.__psVisualV2) {
      window.dailyReveal = function () {
        const out = origReveal.apply(this, arguments);
        scheduleDailyCoach();
        return out;
      };
      window.dailyReveal.__psVisualV2 = true;
    }
  }

  /* ── HOME: add character edge on leak card ── */
  function enhanceHome() {
    const orig = window.renderHome;
    if (!orig || orig.__psVisualHome) return;

    window.renderHome = function () {
      const out = orig.apply(this, arguments);
      setTimeout(() => {
        const leak = document.querySelector('.v30Leak, .v31Insight');
        if (!leak || leak.querySelector('.psHomeCoachHost')) return;
        const host = document.createElement('div');
        host.className = 'psHomeCoachHost';
        leak.appendChild(host);
        if (window.FreakLady) {
          window.FreakLady.react(host, 'thinking', 'session', {
            layout: 'edgePeek',
            side: 'right',
            text: 'Смотрю твои лики.'
          });
        }
      }, 50);
      return out;
    };
    window.renderHome.__psVisualHome = true;
  }

  /* ── Disable duplicate character-integration wrappers ── */
  function silenceDuplicateIntegration() {
    if (!window.CharacterIntegration) return;
    ['enhanceSwipeVerdicts', 'enhanceSizingResults', 'enhanceDailyResults', 'enhanceReviewResults'].forEach((fn) => {
      if (typeof window.CharacterIntegration[fn] === 'function') {
        window.CharacterIntegration[fn] = function () {};
      }
    });
  }

  function init() {
    const boot = () => {
      enhanceFinalizeSwipe();
      enhanceReviewReveal();
      enhanceSizingResults();
      enhanceDailyFlow();
      enhanceHome();
      silenceDuplicateIntegration();
      setTimeout(() => {
        if (window.finalizeSwipe && !window.finalizeSwipe.__psVisualV2) {
          enhanceFinalizeSwipe();
        }
      }, 500);
      console.log('[GameVisualV2] Premium game visual system active');
    };

    if (document.readyState === 'complete') boot();
    else window.addEventListener('load', boot, { once: true });
  }

  init();

  window.PsGameVisual = {
    mountFreakLady,
    buildLossMapHTML,
    buildNarrativeFlow,
    restructureSwipeVerdict
  };
})();
