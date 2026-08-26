// Shared game-interface shell for personalised Daily (HUD + felt + controls).
// Uses window.MaCompact when present; falls back to inline markup.

function esc(s) {
  return typeof window.esc === 'function'
    ? window.esc(s)
    : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pc(c, zone) {
  if (window.MaCompact && typeof window.MaCompact.gameArena === 'function') {
    const cls = zone === 'hero' ? 'pgHeroCard' : 'pgBoardCard';
    return `<span class="pc ${cls} ${/[♥♦]/.test(c) ? 'suit-red' : ''}">${esc(c)}</span>`;
  }
  const suitRed = /[♥♦]/.test(c) ? ' suit-red' : '';
  return `<span class="pc${suitRed}">${esc(c)}</span>`;
}

const STREET_RU = { preflop: 'ПРЕФЛОП', flop: 'ФЛОП', turn: 'ТЁРН', river: 'РИВЕР' };
const STREET_EN = { 'ПРЕФЛОП': 'preflop', 'ФЛОП': 'flop', 'ТЁРН': 'turn', 'РИВЕР': 'river' };

function normStreet(street) {
  if (!street) return 'flop';
  const s = String(street).toLowerCase();
  if (STREET_RU[s]) return s;
  return STREET_EN[String(street).toUpperCase()] || s;
}

function streetRu(street) {
  const n = normStreet(street);
  return STREET_RU[n] || String(street || '').toUpperCase();
}

function boardCountForStreet(street) {
  const n = normStreet(street);
  if (n === 'preflop') return 0;
  if (n === 'flop') return 3;
  if (n === 'turn') return 4;
  return 5;
}

function ctxFromScenario(sc = {}, extra = {}) {
  const spot = {
    pot: sc.potBb,
    stack: sc.effectiveStackBb,
    pos: sc.heroPosition,
    event: sc.format,
    stage: sc.stage,
    table: sc.table,
    board: sc.board,
    hero: sc.heroCards,
    street: sc.street,
    ...extra
  };
  if (window.MaCompact && typeof window.MaCompact.getCtx30 === 'function') {
    return window.MaCompact.getCtx30('daily', spot);
  }
  const tags = [sc.format || 'MTT', sc.stage, sc.table].filter(Boolean);
  return {
    tags,
    pot: sc.potBb != null ? `${Number(sc.potBb).toFixed(1)} ББ` : null,
    eff: sc.effectiveStackBb != null ? `${Number(sc.effectiveStackBb).toFixed(1)} ББ` : null,
    heroPos: sc.heroPosition || 'BTN',
    villainPos: sc.villainPosition || 'BB',
    villainType: sc.villainType || 'рег',
    note: extra.note || '',
    history: extra.history || null
  };
}

function hudStrip(ctx, id, { title, subtitle } = {}) {
  if (window.MaCompact && typeof window.MaCompact.hudStrip === 'function') {
    return window.MaCompact.hudStrip(ctx, id, { title, subtitle });
  }
  const tags = (ctx.tags || []).map((t) => `<span class="pgChip">${esc(t)}</span>`).join('');
  return `<div class="pgHud" data-ma-ctx-id="${esc(id || 'ctx')}">
    ${title ? `<div class="pgHudTitle">${title}${subtitle ? `<span class="ey">${esc(subtitle)}</span>` : ''}</div>` : ''}
    ${tags}
    <button type="button" class="secondary pgHudMore" data-ma-ctx-full="${esc(id || 'ctx')}">ВСЕ УСЛОВИЯ →</button>
  </div>`;
}

function gameArena({ board = [], hero = [], pot, street, heroPos, villainPos, villainType, dealClass = '' } = {}) {
  if (window.MaCompact && typeof window.MaCompact.gameArena === 'function') {
    return window.MaCompact.gameArena({ board, hero, pot, street, heroPos, villainPos, villainType });
  }
  const boardHtml = (board || []).map((c) => pc(c)).join('') || '';
  const heroHtml = (hero || []).map((c) => pc(c, 'hero')).join('');
  const potLabel = pot != null ? esc(String(pot).replace(/ ББ$/, '')) + ' ББ' : '';
  return `<div class="pgArena ${dealClass}"><div class="pgFelt psPokerTable">
    ${street ? `<div class="pgStreetBadge">${esc(street)}</div>` : ''}
    ${potLabel ? `<div class="pgPot"><span class="pgPotLabel">БАНК ${potLabel}</span></div>` : ''}
    <div class="pgBoardZone">${boardHtml}</div>
    ${heroHtml ? `<div class="pgHeroZone">${heroHtml}</div>` : ''}
    ${heroPos ? `<div class="pgSeat hero">ТЫ · ${esc(heroPos)}</div>` : ''}
    ${villainPos ? `<div class="pgSeat villain">${esc(villainPos)} · ${esc(villainType || 'рег')}</div>` : ''}
  </div></div>`;
}

function streetDots(street) {
  const order = ['preflop', 'flop', 'turn', 'river'];
  const idx = order.indexOf(normStreet(street));
  return `<div class="pgStreetDots">${order.map((s, i) =>
    `<span class="${i < idx ? 'done' : i === idx ? 'on' : ''}">${STREET_RU[s].slice(0, 3)}</span>`).join('')}</div>`;
}

function wireContextButtons(root, ctx, id) {
  if (!root || !ctx) return;
  const store = window.__maCtxStore || (window.__maCtxStore = new Map());
  store.set(id, ctx);
  root.querySelectorAll('[data-ma-ctx-full]').forEach((btn) => {
    btn.onclick = () => {
      const c = store.get(btn.dataset.maCtxFull);
      if (!c || typeof window.openModal !== 'function') return;
      const body = `<div class="maCtxModal ctxModal"><div class="spot30 ctxFull">
        <div class="spot30Tags">${(c.tags || []).map((t) => `<span class="spot30Tag">${esc(t)}</span>`).join('')}</div>
        ${c.note ? `<p class="mut small">${esc(c.note)}</p>` : ''}
      </div><button type="button" class="primary ctxCloseBtn">ПОНЯТНО →</button></div>`;
      window.openModal(body);
      setTimeout(() => {
        document.querySelector('.ctxCloseBtn')?.addEventListener('click', () => window.closeModal?.());
      }, 0);
    };
  });
}

function normalizeCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.map((c) => {
    const s = String(c);
    if (/[♠♥♦♣]/.test(s)) return s;
    return s
      .replace(/([2-9TJQKA])(s)$/i, '$1♠')
      .replace(/([2-9TJQKA])(h)$/i, '$1♥')
      .replace(/([2-9TJQKA])(d)$/i, '$1♦')
      .replace(/([2-9TJQKA])(c)$/i, '$1♣');
  });
}

export function scenarioForDisplay(sc = {}) {
  const street = normStreet(sc.street);
  const n = boardCountForStreet(street);
  const board = normalizeCards(sc.board || []).slice(0, n);
  const hero = normalizeCards(sc.heroCards || sc.hero || []);
  return {
    board,
    hero,
    pot: sc.potBb,
    street: streetRu(street),
    heroPos: sc.heroPosition || sc.heroPos || 'BTN',
    villainPos: sc.villainPosition || sc.villainPos || 'BB',
    villainType: sc.villainType || 'рег'
  };
}

function hudWithBack(ctx, id, opts, app, canBack) {
  const nav = window.MiniAppNav;
  const inner = hudStrip(ctx, id, opts);
  if (!nav) return inner;
  const disabled = canBack === false ? true : !nav.canBack(app);
  return nav.headRow(app, inner, { disabled });
}

export function renderGameLobby(root, vm, handlers = {}) {
  if (!root) return;
  const preview = vm.previewScenario || {};
  const disp = scenarioForDisplay(preview);
  const ctx = ctxFromScenario(preview, { note: vm.whyText || '' });
  const id = 'daily_lobby_' + (vm.planSessionId || 'session');
  const focus = (vm.focusItems && vm.focusItems[0]) ? esc(vm.focusItems[0]) : 'разные игровые ситуации';

  root.innerHTML = `<div class="panel pgShell pgDaily pgDailyLobby">
    ${hudWithBack(ctx, id, {
      title: '<h1 class="impact">РАЗДАЧА <span class="pink">ДНЯ</span></h1>',
      subtitle: vm.subtitle || ''
    }, 'daily', true)}
    <div class="pgArenaWrap pgDealIn">${gameArena({ ...disp })}</div>
    <div class="pgDailyChallenge">
      <span class="ey">${esc(vm.focusHeading || 'СЕГОДНЯ В ФОКУСЕ')}</span>
      <p class="pgChallengeLine">ОДНА РУКА.<br><span class="pink">ОДНО РЕШЕНИЕ.</span></p>
      <p class="mut small pgFocusHint">${focus}</p>
    </div>
    <div class="pgControls">
      <button type="button" class="primary pgCta pgBubblePress" id="trStart">${esc(vm.cta || 'НАЧАТЬ РАЗДАЧУ')} →</button>
    </div>
  </div>`;

  const b = root.querySelector('#trStart');
  if (b && typeof handlers.start === 'function') {
    b.onclick = () => {
      if (window.PsMotion?.startHand) {
        window.PsMotion.startHand(root, () => handlers.start());
      } else {
        b.classList.add('pgPressed');
        setTimeout(() => handlers.start(), 120);
      }
    };
  }
  wireContextButtons(root, ctx, id);
  window.MiniAppNav?.wire(root, 'daily', () => {
    if (typeof handlers.back === 'function') handlers.back();
    else if (typeof window.show === 'function') window.show('home');
  });
  window.PsCharacter?.mountArenaCharacter(root.querySelector('.pgArenaWrap'), { state: 'challenge', screen: 'daily' });
}

export function renderGameDrill(root, vm, handlers = {}) {
  if (!root) return;
  const sc = vm.scenario || {};
  const disp = scenarioForDisplay(sc);
  const ctx = ctxFromScenario(sc, {
    note: [vm.contextLine, vm.historyLine].filter(Boolean).join(' · ')
  });
  const id = 'daily_drill_' + (vm.drillId || vm.progress.index);
  const selectedId = vm.selectedOptionId || null;

  root.innerHTML = `<div class="panel pgShell pgDaily pgDailyDrill">
    ${hudWithBack(ctx, id, {
      title: '<h2>Разбор решения</h2>',
      subtitle: `Task ${vm.progress.index}/${vm.progress.total}`
    }, 'daily')}
    ${streetDots(vm.street)}
    <div class="pgArenaWrap pgDealIn">${gameArena({ ...disp })}</div>
    <div class="pgControls">
      <p class="pgPrompt">${esc(vm.prompt)}</p>
      <div class="grid2 pgDecisionGrid">${vm.options.map((o) =>
        `<button type="button" class="choice pgBubblePress${selectedId === o.id ? ' selected' : ''}" data-option="${esc(o.id)}">${esc(o.labelRu)}</button>`).join('')}</div>
    </div>
  </div>`;

  root.querySelectorAll('[data-option]').forEach((b) => {
    b.onclick = () => {
      if (typeof handlers.answer !== 'function') return;
      window.PsMotion?.decisionLock(b);
      handlers.answer(b.dataset.option);
    };
  });
  window.MiniAppNav?.wire(root, 'daily', () => handlers.back?.());
  wireContextButtons(root, ctx, id);
  window.PsCharacter?.mountArenaCharacter(root.querySelector('.pgArenaWrap'), { state: 'thinking', screen: 'daily' });
}

export function renderGameFeedback(root, vm, handlers = {}) {
  if (!root) return;
  const cls = vm.grade === 'EXCELLENT' || vm.grade === 'GOOD' ? 'g'
    : vm.grade === 'INACCURACY' ? 'y' : 'r';

  root.innerHTML = `<div class="panel pgShell pgDaily pgDailyFeedback">
    <div class="pgHud">${window.MiniAppNav?.headRow('daily', `<div class="pgHudTitle"><h2>Вскрытие</h2><span class="ey">${esc(vm.gradeTitle || vm.verdict || 'Результат')}</span></div>`, {}) || ''}</div>
    <div class="pgControls">
      <div class="verdict pgVerdictCompact">
        <div class="dualGrade">
          <div class="gradeBox ${cls}"><span class="ey">ОЦЕНКА</span><b>${esc(vm.gradeTitle || vm.verdict || vm.grade || '—')}</b></div>
          <div class="gradeBox ${cls}"><span class="ey">EV</span><b>${vm.evLossBb != null ? Number(vm.evLossBb).toFixed(2) : '—'} BB</b></div>
        </div>
        <p class="mut small">${esc(vm.why || vm.summary || '')}</p>
        ${vm.remember ? `<p><b>${esc(vm.remember)}</b></p>` : ''}
        ${vm.tip ? `<p class="mut small">${esc(vm.tip)}</p>` : ''}
      </div>
      <button type="button" class="primary pgCta pgBubblePress" id="trNext">СЛЕДУЮЩАЯ РАЗДАЧА →</button>
    </div>
  </div>`;

  const verdict = root.querySelector('.verdict');
  if (window.PsCharacter && verdict) {
    window.PsCharacter.reactVerdict(verdict, cls, 'daily');
  } else if (window.FreakLady && verdict) {
    window.FreakLady.react(verdict, cls, 'daily', { wide: true });
  }
  window.PsMotion?.pulseTarget(root, cls, '.pgVerdictCompact');
  window.PsMotion?.progressiveReveal(verdict);

  const b = root.querySelector('#trNext');
  if (b && typeof handlers.next === 'function') {
    b.onclick = () => handlers.next();
  }
  window.MiniAppNav?.wire(root, 'daily', () => handlers.back?.());
}

export function renderGameLoading(root, vm = {}) {
  if (!root) return;
  root.innerHTML = `<div class="panel pgShell pgDaily pgDailyLoading">
    ${hudStrip({ tags: ['MTT'] }, 'daily_load', { title: '<h2>Раздача дня</h2>', subtitle: 'ЗАГРУЗКА' })}
    <div class="pgArena"><div class="pgFelt pgFeltLoading"><span class="ey">ПОДБИРАЕМ РАЗДАЧИ…</span></div></div>
    <div class="pgControls"><button type="button" class="secondary" id="trCancel">ОТМЕНИТЬ</button></div>
  </div>`;
  const b = root.querySelector('#trCancel');
  if (b && typeof vm.cancel === 'function') b.onclick = () => vm.cancel();
}

export { esc, streetRu, normStreet, boardCountForStreet, ctxFromScenario, hudStrip, gameArena, wireContextButtons };
