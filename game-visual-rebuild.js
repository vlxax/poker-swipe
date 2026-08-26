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
      layout: 'coach',
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

  function buildInsightGrid(losses, nodes, culpritIndex) {
    if (!Array.isArray(nodes) || !nodes.length) return '';
    const streets = nodes.map((n, i) => ({
      street: (n[0] || ['PRE', 'FLOP', 'TURN', 'RIVER'][i] || '').toString().toUpperCase(),
      idx: i
    }));

    return `<div class="psInsightGrid">${streets.map(({ street, idx }) => {
      const isProblem = idx === culpritIndex;
      const status = isProblem ? 'ПРОБЛЕМА' : (idx < culpritIndex ? 'СИГНАЛ' : 'СЛЕДСТВИЕ');
      return `<div class="psInsightCard${isProblem ? ' is-problem' : ''}">
        <span class="psInsightCard__street">${street}</span>
        <strong class="psInsightCard__status">${status}</strong>
      </div>`;
    }).join('')}</div>`;
  }

  /* ── SWIPE: replace static sprite with FreakLady composition ── */
  function mountSwipeCharacter(s, a) {
    const zone = document.querySelector('.verdictCharacterZone, .v31CharacterZone');
    const g = gradeFromSelected();
    if (!zone || !window.FreakLady) return;

    zone.innerHTML = '';
    zone.className = (zone.className.split(' ').filter((c) => !c.startsWith('char')).join(' ') + ' verdictCharacterZone psCharZoneResult').trim();
    window.FreakLady.react(zone, g, 'swipe', {
      layout: 'result',
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
          setTimeout(() => mountSwipeCharacter(s, a), 120);
        });
        return out;
      };
      wrapped.__psVisualV2 = true;
      return wrapped;
    };

    window.finalizeSwipe = wrap(window.finalizeSwipe);

    const obs = new MutationObserver(() => {
      const zone = document.querySelector('.verdictCharacterZone, .v31CharacterZone');
      if (zone && window.FreakLady && !zone.querySelector('.psCharCompose')) {
        const staticImg = zone.querySelector('.charArtwork img, .v31Character img');
        if (staticImg) {
          const s = window.swSession?.[window.swIndex];
          const btn = document.querySelector('[data-sa].selected');
          mountSwipeCharacter(s, btn?.dataset?.sa);
        }
      }
    });
    const verdict = document.getElementById('swipeVerdict');
    if (verdict) obs.observe(verdict, { childList: true, subtree: true });
  }

  /* ── REVIEW: forensic investigation layout ── */
  function enhanceReviewReveal() {
    const orig = window.reviewReveal;
    if (!orig || orig.__psVisualV2) return;

    window.reviewReveal = function () {
      const out = orig.apply(this, arguments);
      setTimeout(() => {
        const area = document.getElementById('reviewArea');
        const panel = area?.querySelector('.panel, .pgShell');
        if (!panel || !window.FreakLady) return;

        const R = window.REVIEWS?.[window.rv % (window.REVIEWS?.length || 1)];
        const bm = window.PokerBrain?.reviewLine?.(R);
        if (!bm) return;

        const pointOk = (bm.clean && window.rvPick === 'none') || (!bm.clean && window.rvPick === bm.culpritIndex);
        const grade = pointOk ? 'g' : 'r';

        if (!bm.clean && bm.losses?.length) {
          const forensic = document.createElement('div');
          forensic.className = 'psReviewForensic';
          forensic.innerHTML = `
            <div class="psReviewForensic__title">ГДЕ<br><span>СЛОМАЛОСЬ?</span></div>
            <p class="psReviewForensic__sub">Найди улицу, где EV начал утекать.</p>
            ${buildLossMapHTML(bm.losses, R?.nodes)}
            ${buildInsightGrid(bm.losses, R?.nodes, bm.culpritIndex)}
          `;

          const brainPanel = panel.querySelector('.brainPanel');
          if (brainPanel) brainPanel.insertAdjacentElement('beforebegin', forensic);
          else panel.insertAdjacentElement('afterbegin', forensic);
        }

        const coachHost = document.createElement('div');
        coachHost.className = 'psReviewCoachHost';
        const cta = panel.querySelector('.primary, .pgCta, #rvNext, #rvGo');
        if (cta) cta.parentElement?.insertBefore(coachHost, cta);
        else panel.appendChild(coachHost);

        const headline = pointOk
          ? 'НАШЛА.<br><span class="accent">УЗЕЛ.</span>'
          : 'СОФТ ВИДИТ<br><span class="accent">ДРУГОЙ УЗЕЛ.</span>';

        window.FreakLady.react(coachHost, grade, 'review', {
          layout: 'analysis',
          side: 'left',
          headline,
          concept: R?.concept
        });
      }, 80);
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
              window.FreakLady.react(host, grade, 'sizing', { layout: 'coach', side: 'right' });
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

  /* ── DAILY: cinematic intro thinking state ── */
  function enhanceDailyFlow() {
    const origReveal = window.dailyReveal;
    if (origReveal && !origReveal.__psVisualV2) {
      window.dailyReveal = function () {
        const out = origReveal.apply(this, arguments);
        setTimeout(() => {
          const panel = document.querySelector('#dailyArea .panel, #dailyArea .pgShell');
          if (!panel || !window.FreakLady) return;
          const gradeBox = panel.querySelector('.gradeBox.r, .gradeBox.g, .gradeBox.y');
          let grade = 'y';
          if (gradeBox?.classList.contains('g')) grade = 'g';
          if (gradeBox?.classList.contains('r')) grade = 'r';

          const host = document.createElement('div');
          host.className = 'psDailyCoachHost';
          const cta = panel.querySelector('.primary, .pgCta, #dHome');
          if (cta) cta.parentElement?.insertBefore(host, cta);
          else panel.appendChild(host);

          window.FreakLady.react(host, grade, 'daily', {
            layout: 'hero',
            wide: true,
            confidence: window.dConf
          });
        }, 100);
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
    buildInsightGrid
  };
})();
