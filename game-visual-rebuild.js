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

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const coachSceneOpts = { hideCoachLabel: true, hideHeadline: true };

  function fitCoachAboveNav(host, opts = {}) {
    if (!host?.isConnected) return;
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const navTop = nav.getBoundingClientRect().top;
    const hostTop = host.getBoundingClientRect().top;
    const minH = opts.minHeight || 196;
    const maxCap = opts.maxHeight || 420;
    const maxH = Math.max(minH, Math.min(maxCap, Math.floor(navTop - hostTop - (opts.gap || 14))));
    host.style.minHeight = `${maxH}px`;
    if (opts.lockHeight !== false) host.style.maxHeight = `${maxH}px`;
    const scene = host.querySelector('.psCharCompose--scene');
    const art = host.querySelector('.psCharCompose__art');
    const av = host.querySelector('.freakCoachAvatar');
    [scene, art].forEach((el) => {
      if (!el) return;
      el.style.minHeight = `${maxH}px`;
      el.style.maxHeight = `${maxH}px`;
      if (el === art) {
        el.style.height = `${maxH}px`;
      }
    });
    if (av) {
      av.style.height = `${maxH}px`;
      av.style.maxHeight = `${maxH}px`;
    }
  }

  function scheduleCoachFit(host, opts) {
    const run = () => fitCoachAboveNav(host, opts);
    requestAnimationFrame(() => {
      run();
      setTimeout(run, 120);
    });
  }

  function buildLossMapHTML(losses, nodes, why) {
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

    const whyHtml = why
      ? `<p class="psLossMap__why">${escHtml(why)}</p>`
      : '';

    return `<div class="psLossMap">
      <span class="psLossMap__label">КАРТА ПОТЕРЬ</span>
      ${rows}
      ${whyHtml}
    </div>`;
  }

  function buildReviewInsights(R, culpritIndex) {
    const reasons = R?.reasons || [];
    if (!reasons.length) return '';
    return `<div class="psReviewInsights">${reasons.slice(0, 2).map((reason, i) => `
      <div class="psReviewInsight${i === 0 ? ' is-key' : ''}">
        <span class="psReviewInsight__ey">${i === 0 ? 'ГЛАВНЫЙ УЗЕЛ' : 'СЛЕДСТВИЕ'}</span>
        <p>${escHtml(reason)}</p>
      </div>`).join('')}</div>`;
  }

  function formatDailyAction(action) {
    const map = { BET: 'СТАВКА', CHECK: 'ЧЕК', CALL: 'КОЛЛ', FOLD: 'ФОЛД', RAISE: 'РЕЙЗ' };
    const key = String(action || '').toUpperCase();
    return map[key] || action || '—';
  }

  function formatDailySizeLogic() {
    const D = typeof window.dailyToday === 'function' ? window.dailyToday() : null;
    const total = D?.args?.length || 0;
    let argGood = 0;
    if (D && window.dArgs) {
      D.args.forEach((a, i) => {
        const expected = a[1] === 'bet' ? 'bet' : a[1] === 'check' ? 'check' : a[1];
        if (window.dArgs[i] === expected) argGood++;
      });
    }
    let logicPart = 'Логика на месте';
    if (total > 0) {
      if (argGood === 0) logicPart = 'Логика не собрана';
      else if (argGood < total - 1) logicPart = 'Логика частично собрана';
      else if (argGood < total) logicPart = 'Логика почти собрана';
    }
    if (window.dSize) return `${window.dSize}% · ${logicPart}`;
    return logicPart;
  }

  function buildDailyScene(panel, grade) {
    const boxes = panel.querySelectorAll('.gradeBox');
    const rawAction = boxes[0]?.querySelector('b')?.textContent?.trim() || window.dChoice || '—';
    const action = formatDailyAction(rawAction.split('·')[0].trim());
    const sizeLogic = formatDailySizeLogic();
    const status = grade === 'g' ? 'ЛИНИЯ ЖИВЁТ' : grade === 'r' ? 'ЕСТЬ РЫЧАГ ДЛЯ РОСТА' : 'НУЖНА ДОВОДКА';
    const hint = grade === 'g'
      ? 'Собрала картину — можно усиливать давление на похожих спотах.'
      : grade === 'r'
        ? 'Тут линия бьёт по EV. Сфокусируйся на одном рычаге за раз.'
        : 'Живёт, но без чёткой причины это уже не стратегия.';

    return `<div class="psDailyScene">
      <div class="psDailyStatus is-${grade}">
        <span class="psDailyStatus__ey">СТАТУС РАЗБОРА</span>
        <strong>${status}</strong>
        <p>${hint}</p>
      </div>
      <div class="psDailyInsights">
        <div class="psDailyInsight"><span>ДЕЙСТВИЕ</span><b>${escHtml(action)}</b></div>
        <div class="psDailyInsight"><span>СТАВКА И ЛОГИКА</span><b>${escHtml(sizeLogic)}</b></div>
      </div>
    </div>`;
  }

  function buildNarrativeFlow(s, a, size) {
    const grade = gradeFromSelected();
    const verdictLabel = grade === 'g' ? 'ЧИСТО' : grade === 'y' ? 'ЖИВЁТ' : 'ОШИБКА';
    const hand = s?.hero ? `${s.hero[0]} ${s.hero[1]}` : '—';
    const concept = s?.concept || 'Концепция';
    const action = `${a || '—'}${size != null ? ` · ${size}%` : ''}`;
    const recap = `${hand} · ${concept}`;

    return `<div class="psVerdictNarrative">
      <p class="psVerdictRecap">${escHtml(recap)}</p>
      <div class="psNarrativeStep is-verdict">
        <span class="psNarrativeStep__marker">✓</span>
        <div>
          <span class="psNarrativeStep__label">ВЕРДИКТ</span>
          <strong class="psNarrativeStep__value">${escHtml(action)} → ${verdictLabel}</strong>
        </div>
      </div>
    </div>`;
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
      coachLayer.className = 'psVerdictCoachLayer psMobileSafeCoach';
      scene.appendChild(coachLayer);
    } else {
      coachLayer.classList.add('psMobileSafeCoach');
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
      confidence: s?.confidence,
      ...coachSceneOpts
    });
    scheduleCoachFit(coachLayer, { minHeight: 240, maxHeight: 460, gap: 18 });
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
    if (panel.querySelector('.psReviewForensic')) return true;
    if (!panel.querySelector('.brainPanel, .evidence, .brainExplain, h1.impact, .impact')) return false;

    const R = window.REVIEWS?.[window.rv % (window.REVIEWS?.length || 1)];
    const bm = window.PokerBrain?.reviewLine?.(R);
    if (!bm) return false;

    const pointOk = (bm.clean && window.rvPick === 'none') || (!bm.clean && window.rvPick === bm.culpritIndex);
    const grade = pointOk ? 'g' : 'r';

    panel.querySelectorAll('.psReviewForensic, .psReviewCoachHost').forEach((el) => el.remove());
    panel.querySelector('.freakCoachReaction')?.remove();
    panel.classList.add('psReviewForensicPanel');
    panel.querySelectorAll('h1.impact, .pgHud, .brainPanel, .evidence, .pgHudTitle').forEach((el) => {
      el.classList.add('psReviewLegacy--hidden');
    });
    panel.querySelectorAll(':scope > .ey, .pgHud .ey').forEach((el) => el.classList.add('psReviewLegacy--hidden'));

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
        <p class="psReviewForensic__sub">Смотри, где EV начал утекать по улицам.</p>
        ${buildLossMapHTML(losses, R?.nodes, bm.why)}
        ${buildReviewInsights(R, bm.culpritIndex)}
      `;
    } else {
      sceneInner.innerHTML = `
        <div class="psReviewForensic__title">ЧИСТАЯ<br><span>ЛИНИЯ.</span></div>
        <p class="psReviewForensic__sub">${escHtml(bm.why || 'EV не утекал — разбор для тренировки внимания.')}</p>
      `;
    }

    const coachHost = document.createElement('div');
    coachHost.className = 'psReviewCoachHost psMobileSafeCoach';
    sceneInner.appendChild(coachHost);
    forensic.appendChild(sceneInner);

    const mount = panel.querySelector('h1.impact, .impact, .pgHud') || panel;
    mount.insertAdjacentElement('afterend', forensic);

    window.FreakLady.react(coachHost, grade, 'review', {
      layout: 'scene',
      side: 'right',
      replace: true,
      concept: R?.concept,
      ...coachSceneOpts
    });

    requestAnimationFrame(() => {
      scheduleCoachFit(coachHost, { minHeight: 196, maxHeight: 320 });
    });

    return true;
  }

  function scheduleReviewForensic(retry = 0) {
    if (paintReviewForensic()) return;
    if (retry < 36) setTimeout(() => scheduleReviewForensic(retry + 1), 120);
  }

  function watchReviewForensic() {
    const area = document.getElementById('reviewArea');
    if (!area || area.dataset.psReviewWatch) return;
    area.dataset.psReviewWatch = '1';
    const obs = new MutationObserver(() => {
      if (!document.getElementById('review')?.classList.contains('active')) return;
      if (area.querySelector('.brainPanel, .evidence, .brainExplain') && !area.querySelector('.psReviewForensic')) {
        paintReviewForensic();
      }
    });
    obs.observe(area, { childList: true, subtree: true });
  }

  /* ── REVIEW: forensic investigation layout ── */
  function enhanceReviewReveal() {
    watchReviewForensic();
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
    panel.querySelector('.psDailyScene')?.remove();
    panel.querySelector('.freakCoachReaction')?.remove();
    panel.querySelectorAll('.dualGrade, .brainPanel').forEach((el) => el.classList.add('psDailyDash--hidden'));
    panel.querySelectorAll(':scope > .ey').forEach((el) => el.classList.add('psDailyDash--hidden'));

    const gradeBox = panel.querySelector('.gradeBox.r, .gradeBox.g, .gradeBox.y');
    let grade = 'y';
    if (gradeBox?.classList.contains('g')) grade = 'g';
    if (gradeBox?.classList.contains('r')) grade = 'r';

    const headline = panel.querySelector('h1.impact, .impact');
    const scene = document.createElement('div');
    scene.innerHTML = buildDailyScene(panel, grade);
    const sceneEl = scene.firstElementChild;
    if (headline) headline.insertAdjacentElement('afterend', sceneEl);
    else panel.insertAdjacentElement('afterbegin', sceneEl);

    const host = document.createElement('div');
    host.className = 'psDailyCoachHost psMobileSafeCoach';
    sceneEl.insertAdjacentElement('afterend', host);

    const homeBtn = panel.querySelector('#dHome, .primary');
    if (homeBtn) {
      homeBtn.classList.add('psDailyHomeCta');
      host.insertAdjacentElement('beforebegin', homeBtn);
    }

    const demon = panel.querySelector('.psCharReaction:not(.psDemonPeek)');

    window.FreakLady.react(host, grade, 'daily', {
      layout: 'scene',
      side: 'right',
      wide: true,
      replace: true,
      confidence: window.dConf,
      ...coachSceneOpts
    });

    if (demon) {
      demon.classList.add('psDemonPeek');
      host.appendChild(demon);
    }

    scheduleCoachFit(host, { minHeight: 280, maxHeight: 460, gap: 12 });

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
