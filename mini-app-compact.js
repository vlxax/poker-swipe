/**
 * PokerSwipe — Compact Mini-App UX
 * Restructures training mini-apps: compact context, cards-first, timeline, less text.
 */
(function () {
  'use strict';
  window.__maCompactLayout = true;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function pc(c, small) {
    return `<span class="pc ${/[♥♦]/.test(c) ? 'suit-red' : ''}" style="${small ? 'width:42px;height:58px;font-size:17px' : ''}">${esc(c)}</span>`;
  }
  function handHtml(a) {
    return `<div class="cards holeCards">${(a || []).map((x) => pc(x)).join('')}</div>`;
  }
  function boardHtml(a) {
    return `<div class="dailyBoard cards">${(a || []).map((x) => pc(x, true)).join('')}</div>`;
  }

  function parsePosStack(raw) {
    const parts = String(raw || '').split('·').map((x) => x.trim()).filter(Boolean);
    return { pos: parts[0] || '—', stack: parts[1] || '' };
  }

  function ctxFromLegacy(c, spot) {
    if (!c) c = {};
    const hero = parsePosStack(c.hero || spot?.pos || '');
    const vill = parsePosStack(c.villain || '');
    return {
      tags: [c.event || 'MTT', c.stage, c.table, c.left].filter(Boolean),
      blinds: c.blinds || spot?.blinds || null,
      pot: spot?.pot != null ? `${spot.pot} ББ` : c.pot || null,
      eff: c.eff || (spot?.stack != null ? `${spot.stack} ББ` : null),
      heroPos: hero.pos,
      heroStack: hero.stack,
      villainPos: vill.pos,
      villainStack: vill.stack,
      villainType: c.opp || 'рег',
      note: c.note || '',
      field: c.field || '',
      history: spot?.history || spot?.line || spot?.nodes || null,
      concept: spot?.concept || null,
      extra: spot?.ctx || null,
      street: spot?.street || c.street || null
    };
  }

  function compactContextCard(ctx, id) {
    const tags = (ctx.tags || []).map((t) => `<span class="maCtxTag">${esc(t)}</span>`).join('');
    const rows = [
      ctx.blinds ? `<div><span>БЛАЙНДЫ</span><b>${esc(ctx.blinds)}</b></div>` : '',
      ctx.eff ? `<div><span>ЭФФ. СТЕК</span><b>${esc(ctx.eff)}</b></div>` : '',
      ctx.pot ? `<div><span>БАНК</span><b>${esc(ctx.pot)}</b></div>` : '',
      `<div><span>ТЫ</span><b>${esc(ctx.heroPos)}</b></div>`,
      `<div><span>СОПЕРНИК</span><b>${esc(ctx.villainPos)} · ${esc(ctx.villainType)}</b></div>`
    ].filter(Boolean).join('');

    return `<div class="maCtx" data-ma-ctx-id="${esc(id || 'ctx')}">
      <div class="maCtxTags">${tags}</div>
      <div class="maCtxGrid">${rows}</div>
      <button type="button" class="secondary maCtxFullBtn" data-ma-ctx-full="${esc(id || 'ctx')}">ВСЕ УСЛОВИЯ →</button>
    </div>`;
  }

  function fullContextModal(ctx) {
    const hist = Array.isArray(ctx.history)
      ? ctx.history.map((h) => {
          if (typeof h === 'string') return `<div class="ctxHist"><span class="ctxHistStreet">—</span><span class="ctxHistText">${esc(h)}</span></div>`;
          if (Array.isArray(h)) return `<div class="ctxHist"><span class="ctxHistStreet">${esc(h[0])}</span><span class="ctxHistText">${esc(h[1])}</span></div>`;
          return `<div class="ctxHist"><span class="ctxHistStreet">${esc(h.street || '')}</span><span class="ctxHistText">${esc(h.text || h)}</span></div>`;
        }).join('')
      : '';

    return `<div class="maCtxModal ctxModal"><div class="spot30 ctxFull">
      <div class="spot30Top"><span class="spot30Field">${esc(ctx.field || 'ВСЕ УСЛОВИЯ')}</span><span class="ey">ПАСПОРТ СПОТА</span></div>
      <div class="spot30Tags">${(ctx.tags || []).map((t) => `<span class="spot30Tag">${esc(t)}</span>`).join('')}</div>
      <div class="spot30Grid">
        ${ctx.blinds ? `<div><span>БЛАЙНДЫ</span><b>${esc(ctx.blinds)}</b></div>` : ''}
        ${ctx.eff ? `<div><span>ЭФФ. СТЕК</span><b>${esc(ctx.eff)}</b></div>` : ''}
        ${ctx.pot ? `<div><span>БАНК</span><b>${esc(ctx.pot)}</b></div>` : ''}
        <div><span>ТЫ</span><b>${esc(ctx.heroPos)}</b></div>
        <div><span>СОПЕРНИК</span><b>${esc(ctx.villainPos)} · ${esc(ctx.villainType)}</b></div>
      </div>
      ${ctx.extra ? `<div class="spot30Rule"><b>Контекст:</b> ${esc(ctx.extra)}</div>` : ''}
      ${ctx.concept ? `<div class="spot30Rule"><b>Концепция:</b> ${esc(ctx.concept)}</div>` : ''}
      ${ctx.note ? `<div class="spot30Rule"><b>Зачем:</b> ${esc(ctx.note)}</div>` : ''}
      ${hist ? `<div class="spot30Rule"><b>История:</b><div class="ctxHistList">${hist}</div></div>` : ''}
    </div><button type="button" class="primary ctxCloseBtn">ПОНЯТНО →</button></div>`;
  }

  const ctxStore = new Map();
  function registerCtx(id, ctx) { ctxStore.set(id, ctx); }

  function wireContextButtons(root) {
    if (!root) return;
    root.querySelectorAll('[data-ma-ctx-full]').forEach((btn) => {
      btn.onclick = () => {
        const ctx = ctxStore.get(btn.dataset.maCtxFull);
        if (!ctx || typeof window.openModal !== 'function') return;
        window.openModal(fullContextModal(ctx));
        setTimeout(() => {
          document.querySelector('.ctxCloseBtn')?.addEventListener('click', () => window.closeModal?.());
        }, 0);
      };
    });
  }

  function cardsBlock(boardCards, heroCards) {
    return `<div class="maCards">
      <div class="maCardsBoard"><span class="ey">БОРД</span>${boardCards?.length ? boardHtml(boardCards) : '<span class="mut">—</span>'}</div>
      <div class="maCardsHero"><span class="ey">ТВОЯ РУКА</span>${heroCards?.length ? handHtml(heroCards) : ''}</div>
    </div>`;
  }

  function tableVisual(boardCards, heroCards, potLabel) {
    return `<div class="maTable">
      ${potLabel ? `<div class="maTablePot">БАНК ${esc(potLabel)}</div>` : ''}
      <div class="maTableBoard">${boardCards?.length ? boardHtml(boardCards) : ''}</div>
      <div class="maTableHero">${heroCards?.length ? handHtml(heroCards) : ''}</div>
    </div>`;
  }

  function timelineRows(nodes, { pickable = false, selected = null } = {}) {
    return `<div class="maTimeline">${(nodes || []).map((n, i) => {
      const street = n[0] || n.street || '';
      const action = n[1] || n.text || '';
      const sel = selected === i || selected === 'node-' + i ? ' selected' : '';
      if (pickable) {
        return `<button type="button" class="maTimelineRow node${sel}" data-rn="${i}"><span class="maStreet">${esc(street)}</span><span class="maAction">${esc(action)}</span></button>`;
      }
      return `<div class="maTimelineRow"><span class="maStreet">${esc(street)}</span><span class="maAction">${esc(action)}</span></div>`;
    }).join('')}</div>`;
  }

  function linePreview(title, text) {
    if (!text) return '';
    return `<div class="maLinePreview"><span class="ey">${esc(title)}</span><p>${esc(text)}</p></div>`;
  }

  /* CTX30 lives in a later script block; the v32 getter can recurse — never touch window.CTX30. */
  const CTX30_SAFE = {
    swipe: [
      { event: 'MTT', stage: 'БАББЛ', table: '6-MAX', left: '19 LEFT', eff: '24 BB', hero: 'BTN · 27 BB', villain: 'BB · 24 BB', opp: 'АГРО-РЕГ' },
      { event: 'MTT', stage: 'СРЕДНЯЯ', table: '8-MAX', left: '54 LEFT', eff: '31 BB', hero: 'CO · 34 BB', villain: 'BTN · 31 BB', opp: 'РЕГ' },
      { event: 'MTT', stage: 'РАННЯЯ', table: '9-MAX', left: '146 LEFT', eff: '58 BB', hero: 'HJ · 62 BB', villain: 'BB · 58 BB', opp: 'ЛЮБИТЕЛЬ' },
      { event: 'PKO', stage: 'ITM', table: '6-MAX', left: '37 LEFT', eff: '18 BB', hero: 'BTN · 21 BB', villain: 'SB · 18 BB', opp: 'НИТ' }
    ],
    sizing: { event: 'MTT', stage: 'ITM', table: '6-MAX', left: '42 LEFT', eff: '32 BB', hero: 'BTN · 35 BB', villain: 'BB · 32 BB', opp: 'РЕГ' },
    daily: { event: 'MTT', stage: 'FINAL TABLE', table: '7 LEFT', left: '7 LEFT', eff: '21 BB', hero: 'CO · 26 BB', villain: 'BB · 21 BB', opp: 'РЕГ' },
    review: { event: 'MTT', stage: 'ПОЗДНЯЯ', table: '8-MAX', left: '28 LEFT', eff: '29 BB', hero: 'HJ · 35 BB', villain: 'BTN · 29 BB', opp: 'РЕГ' },
    heal: { event: 'MTT', stage: 'СРЕДНЯЯ', table: '6-MAX', left: '8 из 8', eff: '24 BB', hero: 'BTN · 24 BB', villain: 'BB · 22 BB', opp: 'РЕГ' },
    xray: { event: 'MTT', stage: 'СРЕДНЯЯ', table: '6-MAX', left: '—', eff: '40 BB', hero: 'IP · 40 BB', villain: 'OOP · 40 BB', opp: 'РЕГ' }
  };

  function ctx30For(name, spot) {
    if (name === 'swipe') {
      const list = CTX30_SAFE.swipe;
      const idx = typeof window.swIndex === 'number' ? window.swIndex : 0;
      return list[idx % list.length];
    }
    const base = CTX30_SAFE[name] || CTX30_SAFE.sizing;
    return base;
  }

  function getCtx30(name, spot) {
    return ctxFromLegacy(ctx30For(name, spot), spot);
  }

  function replaceRender(name, fn) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = fn;
    fn._maOrig = orig;
  }

  /* ── REVIEW ── */
  replaceRender('renderReview', function renderReviewCompact() {
    const R = window.REVIEWS[window.rv % window.REVIEWS.length];
    window.rvPick = null;
    const ctx = getCtx30('review', R);
    ctx.history = R.nodes;
    const id = 'review_' + R.id;
    registerCtx(id, ctx);

    const qb = typeof window.quickBanner === 'function' ? window.quickBanner('review') : '';
    const area = document.getElementById('reviewArea');
    area.innerHTML = `${qb}<div class="panel maShell">
      <div class="maHead"><span class="ey">РАЗБОР · LOSS MAP</span><h1 class="impact">ГДЕ ЛИНИЯ<br><span class="pink">СЛОМАЛАСЬ?</span></h1></div>
      ${compactContextCard(ctx, id)}
      ${cardsBlock(R.board, R.hero)}
      ${timelineRows(R.nodes, { pickable: true })}
      <button type="button" class="choice reviewNone" id="rvNone">НИГДЕ. ЛИНИЯ НОРМАЛЬНАЯ.</button>
      <div id="rvGo"></div>
    </div>`;

    area.querySelectorAll('[data-rn]').forEach((b) => {
      b.onclick = () => {
        area.querySelectorAll('[data-rn],#rvNone').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        window.rvPick = +b.dataset.rn;
        document.getElementById('rvGo').innerHTML = '<button class="primary" id="rvSure">Я УВЕРЕН →</button>';
        document.getElementById('rvSure').onclick = window.reviewReveal;
      };
    });
    document.getElementById('rvNone').onclick = () => {
      area.querySelectorAll('[data-rn],#rvNone').forEach((x) => x.classList.remove('selected'));
      document.getElementById('rvNone').classList.add('selected');
      window.rvPick = 'none';
      document.getElementById('rvGo').innerHTML = '<button class="primary" id="rvSure">Я УВЕРЕН →</button>';
      document.getElementById('rvSure').onclick = window.reviewReveal;
    };
    wireContextButtons(area);
  });

  /* ── SIZING ── */
  replaceRender('renderSizing', function renderSizingCompact() {
    const s = window.SIZING[window.sz % window.SIZING.length];
    const ctx = getCtx30('sizing', s);
    ctx.pot = `${s.pot} ББ`;
    ctx.extra = s.ctx;
    ctx.concept = s.concept;
    const id = 'sizing_' + s.id;
    registerCtx(id, ctx);

    const qb = typeof window.quickBanner === 'function' ? window.quickBanner('sizing') : '';
    const area = document.getElementById('sizingArea');
    area.innerHTML = `${qb}<div class="panel maShell">
      <div class="maHead"><span class="ey">${esc(s.street)} · САЙЗИНГ</span><h2 class="maQuestion">Какой сайз?</h2></div>
      ${compactContextCard(ctx, id)}
      ${tableVisual(s.board, s.hero, s.pot + ' ББ')}
      <div class="maSizingControls">
        <div class="sizeRead"><div><span class="ey">ТВОЁ РЕШЕНИЕ</span><b id="sizePct">50%</b></div><strong id="sizeBB">${(s.pot * 0.5).toFixed(1)} ББ</strong></div>
        <input class="range" id="sizeRange" type="range" min="0" max="150" value="50">
        <div class="scale"><span>CHECK</span><span>25</span><span>50</span><span>75</span><span>100</span><span>150</span></div>
        <div class="maSizePills">${[25, 33, 50, 75, 100, 125].map((v) => `<button type="button" class="choice maSizePill" data-size-pill="${v}">${v}%</button>`).join('')}<button type="button" class="choice maSizePill" data-size-pill="150">ALL-IN</button></div>
        <button class="primary" id="sizeLock">ПОСТАВИТЬ 50% →</button>
        <div id="sizeResult"></div>
      </div>
    </div>`;

    const r = document.getElementById('sizeRange');
    const upd = () => {
      const v = +r.value;
      document.getElementById('sizePct').textContent = v ? v + '%' : 'CHECK';
      document.getElementById('sizeBB').textContent = v ? (s.pot * v / 100).toFixed(1) + ' ББ' : '0 ББ';
      document.getElementById('sizeLock').textContent = v ? `ПОСТАВИТЬ ${v}% →` : 'CHECK →';
    };
    r.oninput = upd;
    area.querySelectorAll('[data-size-pill]').forEach((b) => { b.onclick = () => { r.value = b.dataset.sizePill; upd(); }; });
    upd();

    document.getElementById('sizeLock').onclick = () => {
      const v = +r.value;
      const action = v === 0 ? 'CHECK' : 'BET';
      const br = window.PokerBrain?.gradeDecision({ ...s, spotId: s.id }, action, v || null);
      const g = br?.grade || 'y';
      window.recordEvent({
        spotId: s.id, mode: 'sizing', concept: s.concept, conceptId: br?.concept, street: s.street,
        action, sizePct: v || null, grade: g, gradeAction: br?.actionGrade, gradeSize: br?.sizeGrade,
        why: br?.explanation || s.why, brainSource: br?.source, brainConfidence: br?.confidence, policyScore: br?.score
      });
      document.getElementById('sizeResult').innerHTML = `<div class="verdict"><div class="dualGrade"><div class="gradeBox ${br?.actionGrade || 'y'}"><span class="ey">ДЕЙСТВИЕ</span><b>${action}</b></div><div class="gradeBox ${br?.sizeGrade || br?.actionGrade || 'y'}"><span class="ey">РАЗМЕР</span><b>${v ? v + '%' : '—'}</b></div></div>${typeof window.brainPanel === 'function' && br ? window.brainPanel(br) : `<p>${esc(s.why)}</p>`}<button class="primary" id="sizeNext">${window.quick?.active ? 'ДАЛЬШЕ ПО СЕССИИ' : 'СЛЕДУЮЩИЙ СПОТ'} →</button></div>`;
      window.FreakLady?.react(document.getElementById('sizeResult')?.querySelector('.verdict'), g, 'sizing');
      document.getElementById('sizeNext').onclick = () => { window.quick?.active ? window.quickAdvance() : (window.sz++, window.renderSizing()); };
    };
    wireContextButtons(area);
  });

  /* ── SWIPE ── */
  replaceRender('renderSwipe', function renderSwipeCompact() {
    if (!window.swSession?.length || window.swIndex >= window.swSession.length) {
      if (typeof window.newSwipeSession === 'function') window.newSwipeSession();
      else return renderSwipeCompact._maOrig?.();
    }
    if (!window.swSession?.length || window.swIndex >= window.swSession.length) return;
    const s = window.swSession[window.swIndex];
    window.swLocked = false;
    window.swStart = window.now();
    clearTimeout(window.swTimer);
    document.getElementById('swipeVerdict')?.classList.add('hidden');
    const verdict = document.getElementById('swipeVerdict');
    if (verdict) verdict.innerHTML = '';

    const ctx = getCtx30('swipe', s);
    ctx.pot = `${s.pot} ББ`;
    ctx.eff = `${s.stack} ББ`;
    ctx.extra = s.ctx;
    ctx.concept = s.concept;
    const id = 'swipe_' + s.id;
    registerCtx(id, ctx);

    const mem = window.quick?.active && window.quick.flow[window.quick.index] === 'memory';
    const qb = typeof window.quickBanner === 'function' ? window.quickBanner('swipe') : '';
    document.getElementById('swipeCard').innerHTML = `${qb}<div class="swipeShell maShell"><div class="swipeTop"><span class="ey">${mem ? 'ПАМЯТЬ · ' : ''}${esc(s.street)} · ${esc(s.pos)}</span><span class="ey">${mem ? 'CONCEPT' : 'РУКА ' + (window.swIndex + 1) + '/10'}</span></div><div class="swipeProgress"><span style="width:${window.swIndex / 10 * 100}%"></span></div><div class="swipeCardV in" id="swipeVisual"><h2 class="maQuestion">Твоё решение?</h2>${compactContextCard(ctx, id)}${cardsBlock(s.board, s.hero)}</div></div>`;

    document.getElementById('swipeActions').innerHTML = s.actions.map((a) =>
      `<button class="action ${/ФОЛД/.test(a) ? 'fold' : /КОЛЛ|ЧЕК/.test(a) ? 'call' : 'raise'}" data-sa="${a}">${a}</button>`
    ).join('');
    document.querySelectorAll('[data-sa]').forEach((b) => { b.onclick = () => window.swipeTap(s, b.dataset.sa, b); });
    wireContextButtons(document.getElementById('swipeCard'));
  });

  /* ── DAILY intro (legacy path — captured by training-ui as legacyRenderDaily) ── */
  replaceRender('renderDaily', function renderDailyCompact() {
    const D = window.dailyToday();
    const done = window.S.dailyArchive.find((x) => x.date === window.today());
    const ctx = getCtx30('daily', D);
    ctx.pot = `${D.pot} ББ`;
    ctx.eff = `${D.stack} ББ`;
    ctx.history = D.line;
    const id = 'daily_' + D.id;
    registerCtx(id, ctx);

    document.getElementById('dailyArea').innerHTML = `<div class="panel dailyStage maShell">
      <div class="maHead"><span class="ey">РАЗБОР #${D.number} · ${esc(D.theme)}</span><h1 class="impact">РАЗБОР<br><span class="pink">РЕШЕНИЯ</span></h1></div>
      ${compactContextCard(ctx, id)}
      ${handHtml(D.hero)}
      <button class="primary" id="dStart">${done ? 'ПЕРЕСМОТРЕТЬ' : 'СЕСТЬ ЗА СТОЛ'} →</button>
    </div>`;
    document.getElementById('dStart').onclick = () => { window.dStreet = 0; window.dArgs = {}; window.dChoice = null; window.dSize = null; window.dStart = window.now(); window.dailyStreet(); };
    wireContextButtons(document.getElementById('dailyArea'));
  });

  /* ── DAILY street ── */
  replaceRender('dailyStreet', function dailyStreetCompact() {
    const D = window.dailyToday();
    const ctx = getCtx30('daily', D);
    const id = 'daily_st_' + D.id;
    registerCtx(id, ctx);
    const n = window.dStreet === 0 ? 0 : window.dStreet === 1 ? 3 : window.dStreet === 2 ? 4 : 5;
    const streets = ['PRE', 'FLOP', 'TURN', 'RIVER'];
    const potNow = window.dStreet === 3 ? D.pot : (D.pot * [.12, .28, .55, 1][window.dStreet]).toFixed(1);
    ctx.pot = potNow + ' ББ';

    const area = document.getElementById('dailyArea');
    area.innerHTML = `<div class="panel dailyStage maShell">
      <div class="maSplitTop">${compactContextCard(ctx, id)}${linePreview('ЛИНИЯ ДО РЕШЕНИЯ', D.line.slice(0, window.dStreet + 1).filter(Boolean).join(' → '))}</div>
      <div class="streetDots">${streets.map((x, i) => `<span class="${i < window.dStreet ? 'done' : i === window.dStreet ? 'on' : ''}">${x}</span>`).join('')}</div>
      ${n ? boardHtml(D.board.slice(0, n)) : ''}
      ${window.dStreet < 3 ? '<button class="primary" id="dNext">ПРОДОЛЖИТЬ →</button>' : `<div class="maDecision"><h2 class="maQuestion">Твой ход</h2><div class="grid2">${D.decision.map((x) => `<button class="choice" data-dchoice="${x}">${x}</button>`).join('')}</div><div id="dDecision"></div></div>`}
    </div>`;

    if (window.dStreet < 3) document.getElementById('dNext').onclick = () => { window.dStreet++; window.dailyStreet(); };
    else area.querySelectorAll('[data-dchoice]').forEach((b) => {
      b.onclick = () => {
        window.dChoice = b.dataset.dchoice;
        area.querySelectorAll('[data-dchoice]').forEach((x) => x.classList.toggle('selected', x === b));
        window.dChoice === 'СТАВКА' && D.zone ? window.dailySize() : window.dailyConfidence();
      };
    });
    wireContextButtons(area);
  });

  /* ── X-RAY intro ── */
  replaceRender('renderXray', function renderXrayCompact() {
    const area = document.getElementById('xrayArea');
    if (!window.S?.xray?.onboarded) {
      area.innerHTML = `<div class="xrStage maShell"><span class="ey">◎ РЕНТГЕН</span><h1 class="impact">СОБЕРИ<br><span class="pink">ДИАПАЗОН.</span></h1><button class="primary" id="xrOnboard">ПОПРОБОВАТЬ →</button></div>`;
      document.getElementById('xrOnboard').onclick = () => { window.S.xray.onboarded = true; window.save(); window.renderXray(); };
      return;
    }
    const s = window.XR[window.S.xray.runs % window.XR.length];
    const ctx = getCtx30('xray', { villain: s.villain, concept: s.title, history: s.line });
    const id = 'xray_i';
    registerCtx(id, ctx);
    area.innerHTML = `<div class="xrStage maShell"><span class="ey">◎ ${esc(s.title)}</span><h2 class="maQuestion">Сузь диапазон</h2>${compactContextCard(ctx, id)}<button class="primary" id="xrFull">РАЗОБРАТЬ →</button><button class="secondary" id="xrQuick">С ТЁРНА →</button></div>`;
    document.getElementById('xrFull').onclick = () => window.xrBegin(0);
    document.getElementById('xrQuick').onclick = () => window.xrBegin(2);
    wireContextButtons(area);
  });

  /* ── X-RAY stage ── */
  replaceRender('renderXrayStage', function renderXrayStageCompact() {
    const s = window.XR[window.xrI];
    const dead = window.xrDead(window.xrStage, false);
    const ref = new Set(s.ref[window.xrStage]);
    const live = window.comboCount(window.xrCurrent, dead);
    const streetNames = ['ПРЕФЛОП', 'ФЛОП', 'ТЁРН', 'РИВЕР'];
    const boardSlice = window.xrStage ? s.board.slice(0, window.xrStage === 1 ? 3 : window.xrStage === 2 ? 4 : 5) : [];
    const ctx = getCtx30('xray', { villain: s.villain, pot: ['3.5', '8', '18', '35'][window.xrStage] + ' ББ', history: s.line });
    const id = 'xray_st_' + window.xrStage;
    registerCtx(id, ctx);

    document.getElementById('xrayArea').innerHTML = `<div class="xrStage maShell maXrayPlay">
      <div class="maHead"><span class="ey">${streetNames[window.xrStage]}</span><h2 class="maQuestion">${esc(window.xrStreetQuestion(s, window.xrStage))}</h2></div>
      ${compactContextCard(ctx, id)}
      ${cardsBlock(boardSlice, s.hero)}
      <div class="dailyPot"><div><span class="ey">КОМБО</span><b id="xrLive">${live}</b></div></div>
      ${window.xrGrid()}
      <button class="primary" id="xrLock">ЗАФИКСИРОВАТЬ →</button>
    </div>`;

    document.querySelectorAll('[data-xc]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.xc;
        window.xrCurrent.has(k) ? window.xrCurrent.delete(k) : window.xrCurrent.add(k);
        b.classList.toggle('keep', window.xrCurrent.has(k));
        const el = document.getElementById('xrLive');
        if (el) el.textContent = window.comboCount(window.xrCurrent, dead);
      };
    });
    document.getElementById('xrLock').onclick = () => {
      const score = window.weightedScore(window.xrCurrent, ref, dead);
      if (window.xrStage === 0) window.xrScores.pre = score;
      else {
        window.xrScores.narrowSum = (window.xrScores.narrowSum || 0) + score;
        window.xrScores.narrowCount = (window.xrScores.narrowCount || 0) + 1;
        window.xrScores.narrow = Math.round(window.xrScores.narrowSum / window.xrScores.narrowCount);
      }
      window.xrFunnel[window.xrStage] = window.comboCount(window.xrCurrent, dead);
      window.xrReveal(score);
    };
    wireContextButtons(document.getElementById('xrayArea'));
  });

  /* Disable v30 prepend30 duplicate context */
  if (typeof window.prepend30 === 'function') {
    window.prepend30 = function () {};
  }
  if (typeof window.passport30 === 'function') {
    window.passport30 = function (c) {
      const ctx = ctxFromLegacy(c);
      const id = 'pp_' + Math.random().toString(36).slice(2, 7);
      registerCtx(id, ctx);
      return compactContextCard(ctx, id);
    };
  }

  window.MaCompact = { compactContextCard, cardsBlock, tableVisual, timelineRows };
})();
