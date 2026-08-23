/**
 * Legacy calendar Daily — game interface patch.
 * Runs after exposeV32 so dailyStreet / renderDaily are on window.
 */
(function () {
  'use strict';
  if (!window.MaCompact || !window.__maGameLayout) return;

  const { hudStrip, hudWithBack, gameArena, getCtx30 } = window.MaCompact;
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function wireCtx(root, ctx, id) {
    const store = window.__maCtxStore || (window.__maCtxStore = new Map());
    store.set(id, ctx);
    root.querySelectorAll('[data-ma-ctx-full]').forEach((btn) => {
      btn.onclick = () => {
        const c = store.get(btn.dataset.maCtxFull);
        if (!c || typeof window.openModal !== 'function') return;
        window.openModal(`<div class="maCtxModal ctxModal"><div class="spot30 ctxFull">
          <div class="spot30Tags">${(c.tags || []).map((t) => `<span class="spot30Tag">${esc(t)}</span>`).join('')}</div>
          ${c.note ? `<p class="mut small">${esc(c.note)}</p>` : ''}
        </div><button type="button" class="primary ctxCloseBtn">ПОНЯТНО →</button></div>`);
        setTimeout(() => document.querySelector('.ctxCloseBtn')?.addEventListener('click', () => window.closeModal?.()), 0);
      };
    });
  }

  function legacyDailyBack() {
    const nav = window.MiniAppNav;
    if (window.dChoice != null || window.dSize != null) {
      window.dChoice = null;
      window.dSize = null;
      window.dailyStreet();
      return;
    }
    if (window.dStreet > 0) {
      window.dStreet--;
      nav?.pop('dailyLegacy');
      window.dailyStreet();
      return;
    }
    if (typeof window.__legacyDailyIntro === 'function') window.__legacyDailyIntro();
    else if (typeof window.show === 'function') window.show('home');
  }

  function hudForLegacy(ctx, id, opts) {
    if (typeof hudWithBack === 'function') return hudWithBack(ctx, id, opts, 'dailyLegacy');
    return hudStrip(ctx, id, opts);
  }

  function renderLegacyDailyIntro() {
    const D = window.dailyToday();
    const done = window.S.dailyArchive.find((x) => x.date === window.today());
    const ctx = getCtx30('daily', D);
    ctx.pot = `${D.pot} ББ`;
    ctx.eff = `${D.stack} ББ`;
    ctx.history = D.line;
    const id = 'daily_' + D.id;

    window.MiniAppNav?.reset('dailyLegacy');
    window.MiniAppNav?.push('dailyLegacy', { phase: 'lobby' });

    const area = document.getElementById('dailyArea');
    area.innerHTML = `<div class="panel pgShell pgDaily pgDailyLobby">
      ${hudForLegacy(ctx, id, { title: '<h1 class="impact">РАЗДАЧА <span class="pink">ДНЯ</span></h1>', subtitle: '#' + D.number + ' · ' + esc(D.theme) })}
      <div class="pgArenaWrap pgDealIn">${gameArena({ board: D.board.slice(0, 3), hero: D.hero, pot: D.pot, street: 'ФЛОП', heroPos: ctx.heroPos, villainPos: ctx.villainPos, villainType: ctx.villainType })}</div>
      <div class="pgDailyChallenge">
        <p class="pgChallengeLine">ОДНА РУКА.<br><span class="pink">ОДНО РЕШЕНИЕ.</span></p>
      </div>
      <div class="pgControls">
        <button type="button" class="primary pgCta pgBubblePress" id="dStart">${done ? 'ПЕРЕСМОТРЕТЬ' : 'НАЧАТЬ РАЗДАЧУ'} →</button>
      </div>
    </div>`;

    document.getElementById('dStart').onclick = () => {
      window.dStreet = 0;
      window.dArgs = {};
      window.dChoice = null;
      window.dSize = null;
      window.dStart = window.now();
      window.MiniAppNav?.push('dailyLegacy', { phase: 'street', dStreet: 0 });
      const run = () => window.dailyStreet();
      if (window.PsMotion?.startHand) window.PsMotion.startHand(area, run);
      else run();
    };
    window.MiniAppNav?.wire(area, 'dailyLegacy', () => {
      if (typeof window.show === 'function') window.show('home');
    });
    wireCtx(area, ctx, id);
    window.PsCharacter?.mountArenaCharacter(area.querySelector('.pgArenaWrap'), { state: 'challenge', screen: 'daily' });
  }

  function dailyStreetGame() {
    const D = window.dailyToday();
    const ctx = getCtx30('daily', D);
    const id = 'daily_st_' + D.id;
    const n = window.dStreet === 0 ? 0 : window.dStreet === 1 ? 3 : window.dStreet === 2 ? 4 : 5;
    const streets = ['PRE', 'FLOP', 'TURN', 'RIVER'];
    const streetLabels = ['ПРЕФЛОП', 'ФЛОП', 'ТЁРН', 'РИВЕР'];
    const potNow = window.dStreet === 3 ? D.pot : (D.pot * [.12, .28, .55, 1][window.dStreet]).toFixed(1);
    ctx.pot = potNow + ' ББ';

    const area = document.getElementById('dailyArea');
    area.innerHTML = `<div class="panel pgShell pgDaily pgDailyDrill">
      ${hudForLegacy(ctx, id, { title: '<h2>Разбор решения</h2>', subtitle: `Task ${window.dStreet + 1}/4 · ${streetLabels[window.dStreet]}` })}
      <div class="pgStreetDots">${streets.map((x, i) => `<span class="${i < window.dStreet ? 'done' : i === window.dStreet ? 'on' : ''}">${x}</span>`).join('')}</div>
      <div class="pgArenaWrap pgDealIn">${gameArena({ board: n ? D.board.slice(0, n) : [], hero: D.hero, pot: potNow, street: streetLabels[window.dStreet], heroPos: ctx.heroPos, villainPos: ctx.villainPos, villainType: ctx.villainType })}</div>
      <div class="pgControls">
        ${window.dStreet < 3
          ? `<p class="pgPrompt mut small">${esc(D.line[window.dStreet] || '')}</p><button type="button" class="primary pgCta pgBubblePress" id="dNext">ПРОДОЛЖИТЬ →</button>`
          : `<p class="pgPrompt">${esc(D.line[window.dStreet] || 'ТВОЙ ХОД.')}</p><div class="grid2 pgDecisionGrid">${D.decision.map((x) => `<button type="button" class="choice pgBubblePress${window.dChoice === x ? ' selected' : ''}" data-dchoice="${esc(x)}">${esc(x)}</button>`).join('')}</div><div id="dDecision"></div>`}
      </div>
    </div>`;

    window.MiniAppNav?.wire(area, 'dailyLegacy', legacyDailyBack);

    if (window.dStreet < 3) {
      document.getElementById('dNext').onclick = () => {
        window.dStreet++;
        window.MiniAppNav?.push('dailyLegacy', { phase: 'street', dStreet: window.dStreet });
        window.dailyStreet();
      };
    } else {
      area.querySelectorAll('[data-dchoice]').forEach((b) => {
        b.onclick = () => {
          window.PsMotion?.decisionLock(b);
          window.dChoice = b.dataset.dchoice;
          area.querySelectorAll('[data-dchoice]').forEach((x) => x.classList.toggle('selected', x === b));
          if (window.dChoice === 'СТАВКА' && D.zone) window.dailySize();
          else window.dailyConfidence();
        };
      });
    }
    wireCtx(area, ctx, id);
    if (window.dStreet >= 3) {
      window.PsCharacter?.mountArenaCharacter(area.querySelector('.pgArenaWrap'), { state: 'thinking', screen: 'daily' });
    } else {
      window.PsCharacter?.mountArenaCharacter(area.querySelector('.pgArenaWrap'), { state: 'challenge', screen: 'daily' });
    }
  }

  window.__legacyDailyIntro = renderLegacyDailyIntro;

  if (typeof window.dailyStreet === 'function') {
    window.dailyStreet = dailyStreetGame;
  }
})();
