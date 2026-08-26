/**
 * PokerSwipe — Game Interface Mini-Apps
 * The poker hand IS the screen: HUD + arena + controls.
 */
(function () {
  'use strict';
  window.__maCompactLayout = true;
  window.__maGameLayout = true;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function pc(c, zone) {
    const cls = zone === 'hero' ? 'pgHeroCard' : 'pgBoardCard';
    return `<span class="pc ${cls} ${/[♥♦]/.test(c) ? 'suit-red' : ''}">${esc(c)}</span>`;
  }

  function parsePosStack(raw) {
    const parts = String(raw || '').split('·').map((x) => x.trim()).filter(Boolean);
    return { pos: parts[0] || '—', stack: parts[1] || '' };
  }

  function trainerBackedSpot(spot) {
    if (!spot) return false;
    if (spot._canonical) return true;
    if (spot._library || spot._trainerNative) return true;
    return String(spot.id || '').startsWith('TRAINER_');
  }

  function applyCanonicalToCtx(ctx, spot) {
    const out = ctx || {};
    const c = spot?._canonical;
    const heroPos = c?.position || spot?.position || spot?.heroPosition || out.heroPos || 'BTN';
    const villainPos = c?.villain || spot?.villain || spot?.villainPosition || out.villainPos || 'BB';
    const stackBb = c?.heroStack ?? c?.effStack ?? spot?.stack ?? spot?.heroStack ?? spot?.effStack;
    out.heroPos = heroPos;
    out.villainPos = villainPos;
    if (stackBb != null) {
      out.heroStack = `${stackBb} ББ`;
      out.eff = `${stackBb} ББ`;
    }
    if (c?.history?.length) out.history = c.history;
    if (c?.pot != null && out.pot == null) out.pot = `${c.pot} ББ`;
    return out;
  }

  function ctxFromCanonical(spot) {
    const c = spot._canonical || null;
    const hasHero = c?.position || spot?.position || spot?.heroPosition;
    const hasVill = c?.villain || spot?.villain || spot?.villainPosition;
    if (!hasHero && !hasVill) return null;
    const heroPos = c.position || spot.position || spot.heroPosition || 'BTN';
    const villainPos = c.villain || spot.villain || spot.villainPosition || 'BB';
    const oppName = c.opp && typeof c.opp === 'object'
      ? (c.opp.name || 'РЕГ')
      : (typeof c.opp === 'string' ? c.opp : (spot.opp || 'рег'));
    const blindsLabel = Array.isArray(c.blinds) && c.blinds.length === 2
      ? `${c.blinds[0]}/${c.blinds[1]}${c.ante ? ` (${c.ante})` : ''}`
      : null;
    const stackBb = c.effStack ?? c.heroStack ?? spot.stack ?? spot.effStack;
    return {
      tags: [c.format || spot.format || 'MTT', c.stage || spot.stage, c.table || spot.table, c.left || spot.left].filter(Boolean),
      blinds: blindsLabel,
      pot: c.pot != null ? `${c.pot} ББ` : (spot.pot != null ? `${spot.pot} ББ` : null),
      eff: stackBb != null ? `${stackBb} ББ` : null,
      heroPos,
      heroStack: c.heroStack != null ? `${c.heroStack} ББ` : (stackBb != null ? `${stackBb} ББ` : ''),
      villainPos,
      villainStack: c.villainStack != null ? `${c.villainStack} ББ` : '',
      villainType: oppName || 'рег',
      note: (c.opp && c.opp.note) || '',
      field: c.id || spot.id || 'SPOT',
      history: c.history || spot.history || spot.actionHistory || null,
      concept: c.concept || spot.concept || null,
      extra: c.descriptionLine || spot.ctx || spot.extra || null,
      street: c.street || spot.street || null
    };
  }

  function attachCanonical(spot) {
    if (!spot) return spot;
    if (spot._canonical) return spot;
    const canon = window.TaskContextCanonical;
    if (canon && typeof canon.buildCanonicalSpot === 'function') {
      const built = canon.buildCanonicalSpot({ ...spot, _legacy: !spot._library });
      if (built) return { ...spot, _canonical: built };
    }
    const position = spot.position || spot.heroPosition;
    const villain = spot.villain || spot.villainPosition;
    if (!position && !villain) return spot;
    const history = spot.history || (Array.isArray(spot.actionHistory)
      ? spot.actionHistory.map((line) => {
          const m = String(line).match(/^([^:]+):\s*(.*)$/);
          return m ? { street: m[1].trim(), text: m[2].trim() } : { street: spot.street || 'ПРЕФЛОП', text: String(line) };
        })
      : []);
    return {
      ...spot,
      _canonical: {
        id: spot.id || '',
        position,
        villain,
        heroStack: spot.stack ?? spot.effStack ?? spot.heroStack,
        effStack: spot.effStack ?? spot.stack ?? spot.heroStack,
        pot: spot.pot,
        history,
        street: spot.street || 'ПРЕФЛОП',
        format: spot.format || 'MTT',
        stage: spot.stage || '',
        table: spot.table || '6-MAX',
        concept: spot.concept || '',
        descriptionLine: spot.ctx || spot.preflopLine || ''
      }
    };
  }

  function ctxFromLegacy(c, spot) {
    const fromCanon = ctxFromCanonical(spot);
    if (fromCanon) return fromCanon;
    if (!c) c = {};
    const hero = parsePosStack(c.hero || spot?.pos || '');
    const vill = parsePosStack(c.villain || '');
    return {
      tags: [c.event || 'MTT', c.stage, c.table, c.left].filter(Boolean),
      blinds: c.blinds || spot?.blinds || null,
      pot: spot?.pot != null ? `${spot.pot} ББ` : c.pot || null,
      eff: c.eff || (spot?.stack != null ? `${spot.stack} ББ` : null),
      heroPos: hero.pos || (spot?.pos ? String(spot.pos).split(/\s+/)[0] : 'BTN'),
      heroStack: hero.stack,
      villainPos: vill.pos || 'BB',
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
    if (name === 'swipe' && trainerBackedSpot(spot)) return null;
    if (name === 'swipe') {
      const list = CTX30_SAFE.swipe;
      const idx = typeof window.swIndex === 'number' ? window.swIndex : 0;
      return list[idx % list.length];
    }
    return CTX30_SAFE[name] || CTX30_SAFE.sizing;
  }

  function getCtx30(name, spot) {
    const enriched = attachCanonical(spot);
    const fromCanon = ctxFromCanonical(enriched);
    if (fromCanon) return applyCanonicalToCtx(fromCanon, enriched);
    const legacyCtx = ctx30For(name, enriched);
    if (legacyCtx) return applyCanonicalToCtx(ctxFromLegacy(legacyCtx, enriched), enriched);
    return applyCanonicalToCtx(ctxFromLegacy(null, enriched), enriched);
  }

  const ctxStore = new Map();
  function registerCtx(id, ctx) { ctxStore.set(id, ctx); }

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

  /** Compact HUD strip — chips + stat counters, not a text card */
  function hudBody(ctx, id, { title, subtitle } = {}) {
    const tags = (ctx.tags || []).map((t) => `<span class="pgChip">${esc(t)}</span>`).join('');
    const stats = [
      ctx.blinds ? `<div class="pgStat"><span>БЛАЙНДЫ</span><b>${esc(ctx.blinds)}</b></div>` : '',
      ctx.eff ? `<div class="pgStat"><span>ЭФФ.</span><b>${esc(ctx.eff)}</b></div>` : '',
      ctx.pot ? `<div class="pgStat"><span>БАНК</span><b>${esc(ctx.pot)}</b></div>` : '',
      `<div class="pgStat"><span>ТЫ</span><b>${esc(ctx.heroPos)}</b></div>`,
      `<div class="pgStat"><span>VILL</span><b>${esc(ctx.villainPos)} · ${esc(ctx.villainType)}</b></div>`
    ].filter(Boolean).join('');
    const titleHtml = title ? `<div class="pgHudTitle">${title}${subtitle ? `<span class="ey">${esc(subtitle)}</span>` : ''}</div>` : '';
    return `${titleHtml}${tags}${stats}<button type="button" class="secondary pgHudMore" data-ma-ctx-full="${esc(id || 'ctx')}">ВСЕ УСЛОВИЯ →</button>`;
  }

  function hudStrip(ctx, id, opts = {}) {
    return `<div class="pgHud" data-ma-ctx-id="${esc(id || 'ctx')}">${hudBody(ctx, id, opts)}</div>`;
  }

  function hudWithBack(ctx, id, opts, app, canBack) {
    const nav = window.MiniAppNav;
    if (!nav) return hudStrip(ctx, id, opts);
    const disabled = canBack === false ? true : !nav.canBack(app);
    const body = hudBody(ctx, id, opts);
    return `<div class="pgHud" data-ma-ctx-id="${esc(id || 'ctx')}">${nav.headRow(app, body, { disabled })}</div>`;
  }

  function navGoHome() {
    if (typeof window.show === 'function') window.show('home');
  }

  function initMiniAppNavOnShow() {
    if (window.show && window.show._maNavHook) return;
    const orig = window.show;
    window.show = function maNavShow(id) {
      const nav = window.MiniAppNav;
      if (nav) {
        if (id === 'sizing') {
          nav.reset('sizing');
          window.__szTaskStates = Object.create(null);
          window.__szUI = { phase: 'question', mode: 'bet', rangeVal: 50 };
          nav.push('sizing', { sz: window.sz || 0, phase: 'question' });
        }
        if (id === 'review') {
          nav.reset('review');
          window.__rvTaskStates = Object.create(null);
          window.__rvUI = { phase: 'pick', rvPick: null };
          nav.push('review', { rv: window.rv || 0, phase: 'pick' });
        }
      }
      return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
    };
    window.show._maNavHook = true;
  }

  function saveSizingState() {
    const ui = window.__szUI || { phase: 'question', mode: 'bet', rangeVal: 50 };
    window.__szTaskStates[window.sz] = { ...ui };
    return ui;
  }

  function sizingBack() {
    const nav = window.MiniAppNav;
    const ui = window.__szUI || { phase: 'question' };
    if (ui.phase === 'result') {
      ui.phase = 'question';
      window.__szUI = ui;
      saveSizingState();
      window.renderSizing();
      return;
    }
    if (window.sz > 0) {
      window.sz--;
      window.__szUI = { ...(window.__szTaskStates[window.sz] || { phase: 'question', mode: 'bet', rangeVal: 50 }) };
      nav?.pop('sizing');
      window.renderSizing();
      return;
    }
    navGoHome();
  }

  function saveReviewState() {
    const ui = window.__rvUI || { phase: 'pick', rvPick: null };
    window.__rvTaskStates[window.rv] = { ...ui };
    return ui;
  }

  function reviewBack() {
    const nav = window.MiniAppNav;
    const ui = window.__rvUI || { phase: 'pick', rvPick: null };
    if (ui.phase !== 'pick') {
      ui.phase = 'pick';
      window.__rvUI = ui;
      saveReviewState();
      window.MiniAppNav?.pop('review');
      window.renderReview();
      return;
    }
    if (window.rv > 0) {
      window.rv--;
      window.__rvUI = { ...(window.__rvTaskStates[window.rv] || { phase: 'pick', rvPick: null }) };
      nav?.pop('review');
      window.renderReview();
      return;
    }
    navGoHome();
  }

  function wireMiniAppBack(root, app, handler) {
    window.MiniAppNav?.wire(root, app, handler);
  }

  function wrapReviewNavFns() {
    ['reviewReveal', 'reviewRepair'].forEach((name) => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig._maNavWrapped) return;
      window[name] = function maNavReviewStep() {
        window.__rvUI = window.__rvUI || { phase: 'pick', rvPick: window.rvPick };
        window.__rvUI.phase = name === 'reviewRepair' ? 'repair' : 'reveal';
        saveReviewState();
        if (window.MiniAppNav && !window.MiniAppNav.isRestoring()) {
          window.MiniAppNav.push('review', { rv: window.rv, phase: window.__rvUI.phase });
        }
        const out = orig.apply(this, arguments);
        setTimeout(() => {
          const area = document.getElementById('reviewArea');
          if (!area) return;
          const shell = area.querySelector('.pgShell, .panel');
          if (!shell || shell.querySelector('.pgBackBtn')) return;
          const nav = window.MiniAppNav;
          if (!nav) return;
          const hud = shell.querySelector('.pgHud');
          const backHtml = nav.backButtonHtml();
          if (hud) {
            hud.insertAdjacentHTML('afterbegin', `<div class="pgHeadRow">${backHtml}<div class="pgHeadMain"></div></div>`);
          } else {
            shell.insertAdjacentHTML('afterbegin', `<div class="pgHud">${nav.headRow('review', '<div class="pgHudTitle"><span class="ey">ВСКРЫТИЕ</span></div>', {})}</div>`);
          }
          wireMiniAppBack(shell, 'review', reviewBack);
        }, 0);
        return out;
      };
      window[name]._maNavWrapped = true;
    });
  }

  initMiniAppNavOnShow();
  wrapReviewNavFns();

  /** Central poker table arena */
  function gameArena({ board = [], hero = [], pot, street, heroPos, villainPos, villainType } = {}) {
    const boardHtml = (board || []).map((c) => pc(c)).join('') || '<span class="mut" style="font-size:9px">—</span>';
    const heroHtml = (hero || []).map((c) => pc(c, 'hero')).join('');
    const potLabel = pot != null ? esc(String(pot).replace(/ ББ$/, '')) + ' ББ' : '';
    return `<div class="pgArena">
      <div class="pgFelt psPokerTable">
        ${street ? `<div class="pgStreetBadge">${esc(street)}</div>` : ''}
        ${potLabel ? `<div class="pgPot"><div class="pgPotChips"><i></i><i></i><i></i></div><span class="pgPotLabel">БАНК ${potLabel}</span></div>` : ''}
        <div class="pgBoardZone">${boardHtml}</div>
        ${heroHtml ? `<div class="pgHeroZone">${heroHtml}</div>` : ''}
        ${heroPos ? `<div class="pgSeat hero">ТЫ · ${esc(heroPos)}</div>` : ''}
        ${villainPos ? `<div class="pgSeat villain">${esc(villainPos)} · ${esc(villainType || 'рег')}</div>` : ''}
      </div>
    </div>`;
  }

  /** Vertical glowing path timeline */
  function gamePath(nodes, { pickable = false } = {}) {
    const rows = (nodes || []).map((n, i) => {
      const street = n[0] || n.street || '';
      const action = n[1] || n.text || '';
      if (pickable) {
        return `<button type="button" class="pgPathNode node" data-rn="${i}"><span class="pgPathStreet">${esc(street)}</span><span class="pgPathAction">${esc(action)}</span></button>`;
      }
      return `<div class="pgPathNode"><span class="pgPathStreet">${esc(street)}</span><span class="pgPathAction">${esc(action)}</span></div>`;
    }).join('');
    return `<div class="pgPath"><div class="pgPathLabel">ТАЙМЛАЙН РАЗДАЧИ</div><div class="pgPathTrack">${rows}</div></div>`;
  }

  function replaceRender(name, fn) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = fn;
    fn._maOrig = orig;
  }

  /* ── REVIEW: Loss Map game interface ── */
  replaceRender('renderReview', function renderReviewGame() {
    const total = window.REVIEWS?.length || 1;
    const R = window.REVIEWS[window.rv % total];
    window.__rvUI = window.__rvUI || { phase: 'pick', rvPick: null };
    window.rvPick = window.__rvUI.rvPick != null ? window.__rvUI.rvPick : null;
    const ctx = getCtx30('review', R);
    ctx.history = R.nodes;
    ctx.pot = ctx.pot || '—';
    const id = 'review_' + R.id;
    registerCtx(id, ctx);
    const taskNum = (window.rv % total) + 1;

    const qb = typeof window.quickBanner === 'function' ? window.quickBanner('review') : '';
    const area = document.getElementById('reviewArea');
    area.innerHTML = `${qb}<div class="panel pgShell pgReview">
      ${hudWithBack(ctx, id, { title: '<h1 class="impact psGameTitle">ГДЕ<br><span class="accent">СЛОМАЛОСЬ?</span></h1>', subtitle: `Раздача ${taskNum}/${total} · FORENSIC REVIEW` }, 'review')}
      <div class="pgArenaWrap pgDealIn">${gameArena({ board: R.board, hero: R.hero, pot: ctx.pot, street: 'РИВЕР', heroPos: ctx.heroPos, villainPos: ctx.villainPos, villainType: ctx.villainType })}</div>
      ${gamePath(R.nodes, { pickable: true })}
      <div class="pgControls">
        <button type="button" class="choice reviewNone" id="rvNone">НИГДЕ. ЛИНИЯ НОРМАЛЬНАЯ.</button>
        <div id="rvGo"></div>
      </div>
    </div>`;

    const shell = area.querySelector('.pgShell');
    wireMiniAppBack(shell, 'review', reviewBack);

    const restorePick = (pick) => {
      if (pick == null) return;
      if (pick === 'none') {
        document.getElementById('rvNone')?.classList.add('selected');
      } else {
        const node = area.querySelector(`[data-rn="${pick}"]`);
        node?.classList.add('selected');
      }
      document.getElementById('rvGo').innerHTML = '<button class="primary pgCta" id="rvSure">Я УВЕРЕН →</button>';
      document.getElementById('rvSure').onclick = window.reviewReveal;
    };

    area.querySelectorAll('[data-rn]').forEach((b) => {
      b.onclick = () => {
        area.querySelectorAll('[data-rn],#rvNone').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        window.rvPick = +b.dataset.rn;
        window.__rvUI = { phase: 'pick', rvPick: window.rvPick };
        saveReviewState();
        document.getElementById('rvGo').innerHTML = '<button class="primary pgCta" id="rvSure">Я УВЕРЕН →</button>';
        document.getElementById('rvSure').onclick = window.reviewReveal;
      };
    });
    document.getElementById('rvNone').onclick = () => {
      area.querySelectorAll('[data-rn],#rvNone').forEach((x) => x.classList.remove('selected'));
      document.getElementById('rvNone').classList.add('selected');
      window.rvPick = 'none';
      window.__rvUI = { phase: 'pick', rvPick: 'none' };
      saveReviewState();
      document.getElementById('rvGo').innerHTML = '<button class="primary pgCta" id="rvSure">Я УВЕРЕН →</button>';
      document.getElementById('rvSure').onclick = window.reviewReveal;
    };
    restorePick(window.rvPick);
    wireContextButtons(area);
    const nav = window.MiniAppNav;
    if (nav && window.__rvLastRendered != null && window.rv > window.__rvLastRendered) {
      nav.push('review', { rv: window.rv, phase: 'pick' });
    }
    window.__rvLastRendered = window.rv;
  });

  /* ── SIZING: table-dominant game interface ── */
  replaceRender('renderSizing', function renderSizingGame() {
    const total = window.SIZING?.length || 1;
    const s = window.SIZING[window.sz % total];
    window.__szUI = window.__szUI || { phase: 'question', mode: 'bet', rangeVal: 50 };
    const ui = window.__szUI;
    const ctx = getCtx30('sizing', s);
    ctx.pot = `${s.pot} ББ`;
    ctx.extra = s.ctx;
    ctx.concept = s.concept;
    const id = 'sizing_' + s.id;
    registerCtx(id, ctx);
    const taskNum = (window.sz % total) + 1;

    const qb = typeof window.quickBanner === 'function' ? window.quickBanner('sizing') : '';
    const area = document.getElementById('sizingArea');
    area.innerHTML = `${qb}<div class="panel pgShell pgSizing">
      ${hudWithBack(ctx, id, { title: '<h2>Какой сайз?</h2>', subtitle: `Task ${taskNum}/${total} · ${esc(s.street)} · САЙЗИНГ` }, 'sizing')}
      <div class="pgArenaWrap pgDealIn">${gameArena({ board: s.board, hero: s.hero, pot: s.pot, street: s.street, heroPos: ctx.heroPos, villainPos: ctx.villainPos, villainType: ctx.villainType })}</div>
      <div class="pgControls">
        <div class="pgControlsHead">ТВОЁ РЕШЕНИЕ</div>
        <div class="pgDecisionReadout"><b id="sizePct">50%</b><strong id="sizeBB">${(s.pot * 0.5).toFixed(1)} ББ</strong></div>
        <input class="range" id="sizeRange" type="range" min="0" max="150" value="50">
        <div class="scale"><span>CHECK</span><span>25</span><span>50</span><span>75</span><span>100</span><span>150</span></div>
        <div class="pgActionRow">
          <button type="button" class="action call" id="sizeCheck">CHECK</button>
          <button type="button" class="action raise on" id="sizeBet">BET</button>
          <button type="button" class="action fold" id="sizeAllin">ALL-IN</button>
        </div>
        <div class="pgSizeRow">${[25, 33, 50, 75, 100, 125].map((v) => `<button type="button" class="choice pgSizeBtn" data-size-pill="${v}">${v}%</button>`).join('')}<button type="button" class="choice pgSizeBtn" data-size-pill="150">ALL-IN</button></div>
        <button class="primary pgCta" id="sizeLock">ПОСТАВИТЬ 50% →</button>
        <div id="sizeResult"></div>
      </div>
    </div>`;

    const shell = area.querySelector('.pgShell');
    wireMiniAppBack(shell, 'sizing', sizingBack);

    const r = document.getElementById('sizeRange');
    let mode = ui.mode || 'bet';
    const syncUi = () => {
      const v = mode === 'check' ? 0 : mode === 'allin' ? 150 : +r.value;
      window.__szUI = { phase: ui.phase, mode, rangeVal: v, resultHtml: ui.resultHtml || null };
      saveSizingState();
    };
    const upd = () => {
      const v = mode === 'check' ? 0 : mode === 'allin' ? 150 : +r.value;
      if (mode !== 'bet') r.value = v;
      document.getElementById('sizePct').textContent = v ? v + '%' : 'CHECK';
      document.getElementById('sizeBB').textContent = v ? (s.pot * v / 100).toFixed(1) + ' ББ' : '0 ББ';
      document.getElementById('sizeLock').textContent = v ? `ПОСТАВИТЬ ${v}% →` : 'CHECK →';
      syncUi();
    };
    r.oninput = () => { mode = 'bet'; upd(); };
    document.getElementById('sizeCheck').onclick = () => { mode = 'check'; r.value = 0; upd(); };
    document.getElementById('sizeBet').onclick = () => { mode = 'bet'; if (+r.value === 0) r.value = 50; upd(); };
    document.getElementById('sizeAllin').onclick = () => { mode = 'allin'; r.value = 150; upd(); };
    area.querySelectorAll('[data-size-pill]').forEach((b) => { b.onclick = () => { mode = 'bet'; r.value = b.dataset.sizePill; upd(); }; });

    if (ui.phase === 'result' && ui.resultHtml) {
      document.getElementById('sizeResult').innerHTML = ui.resultHtml;
      document.getElementById('sizeLock').style.display = 'none';
      const backBtn = shell.querySelector('.pgBackBtn');
      if (backBtn) {
        backBtn.disabled = false;
        backBtn.classList.remove('is-disabled');
      }
      const nextBtn = document.getElementById('sizeNext');
      if (nextBtn) {
        nextBtn.onclick = () => {
          window.sz++;
          window.__szUI = { phase: 'question', mode: 'bet', rangeVal: 50 };
          window.renderSizing();
        };
      }
    } else {
      r.value = ui.rangeVal != null ? ui.rangeVal : 50;
      upd();
      document.getElementById('sizeLock').onclick = () => {
        const lockBtn = document.getElementById('sizeLock');
        const v = mode === 'check' ? 0 : mode === 'allin' ? 150 : +r.value;
        const action = v === 0 ? 'CHECK' : 'BET';
        const br = window.PokerBrain?.gradeDecision({ ...s, spotId: s.id }, action, v || null);
        const g = br?.grade || 'y';
        window.PsMotion?.decisionLock(lockBtn);
        window.recordEvent({
          spotId: s.id, mode: 'sizing', concept: s.concept, conceptId: br?.concept, street: s.street,
          action, sizePct: v || null, grade: g, gradeAction: br?.actionGrade, gradeSize: br?.sizeGrade,
          why: br?.explanation || s.why, brainSource: br?.source, brainConfidence: br?.confidence, policyScore: br?.score
        });
        const resultHtml = `<div class="verdict"><div class="dualGrade"><div class="gradeBox ${br?.actionGrade || 'y'}"><span class="ey">ДЕЙСТВИЕ</span><b>${action}</b></div><div class="gradeBox ${br?.sizeGrade || br?.actionGrade || 'y'}"><span class="ey">РАЗМЕР</span><b>${v ? v + '%' : '—'}</b></div></div>${typeof window.brainPanel === 'function' && br ? window.brainPanel(br) : `<p>${esc(s.why)}</p>`}<button class="primary pgCta" id="sizeNext">${window.quick?.active ? 'ДАЛЬШЕ ПО СЕССИИ' : 'СЛЕДУЮЩИЙ СПОТ'} →</button></div>`;
        document.getElementById('sizeResult').innerHTML = resultHtml;
        lockBtn.style.display = 'none';
        const backBtn = shell.querySelector('.pgBackBtn');
        if (backBtn) {
          backBtn.disabled = false;
          backBtn.classList.remove('is-disabled');
        }
        window.__szUI = { phase: 'result', mode, rangeVal: v, resultHtml };
        saveSizingState();
        window.MiniAppNav?.push('sizing', { sz: window.sz, phase: 'result' });
        const verdict = document.getElementById('sizeResult')?.querySelector('.verdict');
        window.PsCharacter?.reactVerdict(verdict, g, 'sizing', { actionGrade: br?.actionGrade, sizeGrade: br?.sizeGrade });
        window.PsMotion?.sizingConfirm(area.querySelector('.pgShell'), g);
        window.PsMotion?.progressiveReveal(verdict);
        document.getElementById('sizeNext').onclick = () => {
          if (window.quick?.active) window.quickAdvance();
          else {
            window.sz++;
            window.__szUI = { phase: 'question', mode: 'bet', rangeVal: 50 };
            window.renderSizing();
          }
        };
      };
    }
    wireContextButtons(area);
    window.PsCharacter?.mountArenaCharacter(area.querySelector('.pgArenaWrap'), { state: 'thinking', screen: 'sizing' });
    const nav = window.MiniAppNav;
    if (nav && window.__szLastRendered != null && window.sz > window.__szLastRendered) {
      nav.push('sizing', { sz: window.sz, phase: window.__szUI?.phase || 'question' });
    }
    window.__szLastRendered = window.sz;
  });

  /* ── SWIPE: table-centric decision ── */
  replaceRender('renderSwipe', function renderSwipeGame() {
    if (!window.swSession?.length || window.swIndex >= window.swSession.length) {
      if (typeof window.newSwipeSession === 'function') window.newSwipeSession();
      else return renderSwipeGame._maOrig?.();
    }
    if (!window.swSession?.length || window.swIndex >= window.swSession.length) return;
    const s = window.swSession[window.swIndex];
    window.swLocked = false;
    window.swStart = window.now();
    clearTimeout(window.swTimer);
    document.getElementById('swipeVerdict')?.classList.add('hidden');
    const verdict = document.getElementById('swipeVerdict');
    if (verdict) verdict.innerHTML = '';

    const enriched = attachCanonical(s);
    const ctx = applyCanonicalToCtx(getCtx30('swipe', enriched), enriched);
    const posLabel = [ctx.heroPos, ctx.villainPos ? `vs ${ctx.villainPos}` : ''].filter(Boolean).join(' ');
    ctx.pot = `${enriched.pot ?? s.pot} ББ`;
    if (enriched._canonical?.heroStack != null || enriched.stack != null || s.stack != null) {
      ctx.eff = `${enriched._canonical?.heroStack ?? enriched.stack ?? s.stack} ББ`;
    }
    ctx.extra = enriched.ctx || enriched._canonical?.descriptionLine || s.ctx;
    ctx.concept = enriched.concept || s.concept;
    const id = 'swipe_' + s.id;
    registerCtx(id, ctx);

    const mem = window.quick?.active && window.quick.flow[window.quick.index] === 'memory';
    const qb = typeof window.quickBanner === 'function' ? window.quickBanner('swipe') : '';
    document.getElementById('swipeCard').innerHTML = `${qb}<div class="swipeShell pgSwipeWrap">
      <div class="swipeTop"><span class="ey">${mem ? 'ПАМЯТЬ · ' : ''}${esc(s.street)} · ${esc(posLabel)}</span><span class="ey">${mem ? 'CONCEPT' : 'РУКА ' + (window.swIndex + 1) + '/10'}</span></div>
      <div class="swipeProgress"><span style="width:${window.swIndex / 10 * 100}%"></span></div>
      <div class="swipeCardV in" id="swipeVisual">
        ${hudStrip(ctx, id, { title: '<h2>Твоё решение?</h2>' })}
        <div class="pgArenaWrap pgDealIn">${gameArena({ board: s.board, hero: s.hero, pot: s.pot, street: s.street, heroPos: ctx.heroPos, villainPos: ctx.villainPos, villainType: ctx.villainType })}</div>
      </div>
    </div>`;

    document.getElementById('swipeActions').innerHTML = s.actions.map((a) =>
      `<button class="action ${/ФОЛД/.test(a) ? 'fold' : /КОЛЛ|ЧЕК/.test(a) ? 'call' : 'raise'}" data-sa="${a}">${a}</button>`
    ).join('');
    document.querySelectorAll('[data-sa]').forEach((b) => {
      b.onclick = () => {
        window.PsMotion?.decisionLock(b);
        if (window.swLocked) return;
        document.querySelectorAll('[data-sa]').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        const a = b.dataset.sa;
        if ((a === 'СТАВКА' || (a === 'РЕЙЗ' && s.street !== 'ПРЕФЛОП')) && s.sizeZone && typeof window.renderSwipeSize === 'function') {
          window.renderSwipeSize(s, a);
          return;
        }
        if (typeof window.finalizeSwipe === 'function') window.finalizeSwipe(s, a, null);
      };
    });
    wireContextButtons(document.getElementById('swipeCard'));
  });

  /* ── DAILY: personalised training uses training-ui/gameShell.js ── */
  /* Legacy calendar daily patched in daily-game-patch.js after exposeV32. */

  /* ── X-RAY intro ── */
  replaceRender('renderXray', function renderXrayGame() {
    const area = document.getElementById('xrayArea');
    if (!window.S?.xray?.onboarded) {
      area.innerHTML = `<div class="xrStage pgShell"><div class="pgHud"><div class="pgHudTitle"><h1 class="impact">СОБЕРИ <span class="pink">ДИАПАЗОН</span></h1><span class="ey">◎ РЕНТГЕН</span></div></div><div class="pgControls"><button class="primary pgCta" id="xrOnboard">ПОПРОБОВАТЬ →</button></div></div>`;
      document.getElementById('xrOnboard').onclick = () => { window.S.xray.onboarded = true; window.save(); window.renderXray(); };
      return;
    }
    const s = window.XR[window.S.xray.runs % window.XR.length];
    const ctx = getCtx30('xray', { villain: s.villain, concept: s.title, history: s.line });
    const id = 'xray_i';
    registerCtx(id, ctx);
    area.innerHTML = `<div class="xrStage pgShell pgXray">
      ${hudStrip(ctx, id, { title: '<h2>Сузь диапазон</h2>', subtitle: '◎ ' + esc(s.title) })}
      ${gameArena({ board: s.board.slice(0, 3), hero: s.hero, pot: '8', street: 'ФЛОП', heroPos: ctx.heroPos, villainPos: ctx.villainPos, villainType: ctx.villainType })}
      <div class="pgControls">
        <button class="primary pgCta" id="xrFull">РАЗОБРАТЬ →</button>
        <button class="secondary" id="xrQuick">С ТЁРНА →</button>
      </div>
    </div>`;
    document.getElementById('xrFull').onclick = () => window.xrBegin(0);
    document.getElementById('xrQuick').onclick = () => window.xrBegin(2);
    wireContextButtons(area);
  });

  /* ── X-RAY stage: range inspection arena ── */
  replaceRender('renderXrayStage', function renderXrayStageGame() {
    const s = window.XR[window.xrI];
    const dead = window.xrDead(window.xrStage, false);
    const ref = new Set(s.ref[window.xrStage]);
    const live = window.comboCount(window.xrCurrent, dead);
    const streetNames = ['ПРЕФЛОП', 'ФЛОП', 'ТЁРН', 'РИВЕР'];
    const boardSlice = window.xrStage ? s.board.slice(0, window.xrStage === 1 ? 3 : window.xrStage === 2 ? 4 : 5) : [];
    const ctx = getCtx30('xray', { villain: s.villain, pot: ['3.5', '8', '18', '35'][window.xrStage] + ' ББ', history: s.line });
    const id = 'xray_st_' + window.xrStage;
    registerCtx(id, ctx);

    document.getElementById('xrayArea').innerHTML = `<div class="xrStage pgShell pgXray">
      ${hudStrip(ctx, id, { title: `<h2>${esc(window.xrStreetQuestion(s, window.xrStage))}</h2>`, subtitle: streetNames[window.xrStage] })}
      <div class="pgXrayArena">
        <div class="pgXrayBoard">${boardSlice.map((c) => pc(c)).join('')}</div>
        <div class="pgXrayCombo"><div><span class="ey">КОМБО</span><b id="xrLive">${live}</b></div><div><span class="ey">БОРД</span><b>${boardSlice.length || 0}</b></div></div>
        <div class="pgXrayMatrix">${window.xrGrid()}</div>
      </div>
      <div class="pgControls"><button class="primary pgCta" id="xrLock">ЗАФИКСИРОВАТЬ →</button></div>
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

  if (typeof window.prepend30 === 'function') window.prepend30 = function () {};
  if (typeof window.passport30 === 'function') {
    window.passport30 = function (c) {
      const ctx = ctxFromLegacy(c);
      const id = 'pp_' + Math.random().toString(36).slice(2, 7);
      registerCtx(id, ctx);
      return hudStrip(ctx, id);
    };
  }

  window.MaCompact = { hudStrip, hudWithBack, gameArena, gamePath, getCtx30 };
})();
