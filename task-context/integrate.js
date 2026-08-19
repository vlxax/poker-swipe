// task-context/integrate.js
// Подключает единый компонент условий задачи во все мини-апки первого раздела.
// Классический (не-модуль) скрипт: читает legacy-глобалы (swSession, SIZING,
// REVIEWS, DAILY_TEMPLATES и т.д.) и оборачивает render-функции, чтобы в начало
// карточки задачи вставлялся компактный блок «УСЛОВИЯ» + кнопка «ВСЕ УСЛОВИЯ»,
// открывающая полный контекст (паспорт спота) в модальном окне.
// Самодостаточный: стили переиспользуют существующие классы .spot30 (index.html).
(function () {
  'use strict';
  if (window.__taskContextIntegrated) return;
  window.__taskContextIntegrated = true;

  /* ---------- генерация HTML (аналог task-context/contextUI.js) ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function bb(n) {
    if (n == null || !(n > 0)) return '—';
    var v = Math.round(n * 10) / 10;
    return (Number.isInteger(v) ? String(v) : String(v).replace('.', ',')) + ' ББ';
  }
  function formatLabel(f) {
    var m = { MTT: 'МТТ', PKO: 'ПКО', SNG: 'СНГ', CASH: 'КЭШ', '3MAX': '3-МАКС', HU: 'ХА' };
    return m[f] || f;
  }
  function streetLabel(s) {
    var m = { ПРЕФЛОП: 'ПРЕФЛОП', ФЛОП: 'ФЛОП', ТЁРН: 'ТЁРН', РИВЕР: 'РИВЕР' };
    return m[s] || s;
  }
  function positionLabel(p) {
    var m = { UTG: 'UTG · ранняя позиция', MP: 'MP · средняя позиция', HJ: 'HJ · хай-джек', CO: 'CO · кат-офф', BTN: 'BTN · баттон', SB: 'SB · малый блайнд', BB: 'BB · большой блайнд' };
    return m[p] || p;
  }
  function blindsLabel(sp) {
    if (!sp.blinds) return '';
    var base = sp.blinds[0] + '/' + sp.blinds[1];
    return sp.ante ? base + ' + анте ' + sp.ante : base;
  }
  function tagsOf(sp) {
    return [formatLabel(sp.format), sp.stage, sp.table, sp.left].filter(Boolean);
  }
  function compactConditions(sp) {
    if (!sp) return '';
    var opp = sp.opp;
    var board = (sp.board || []).join(' ');
    var tags = tagsOf(sp);
    return '<div class="spot30 ctxCard">' +
      '<div class="spot30Top"><span class="spot30Field">' + streetLabel(sp.street) + ' · УСЛОВИЯ</span><span class="ey">' + esc(formatLabel(sp.format)) + '</span></div>' +
      '<div class="spot30Tags">' + tags.map(function (t) { return '<span class="spot30Tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="spot30Grid">' +
      '<div><span>БЛАЙНДЫ</span><b>' + esc(blindsLabel(sp)) + '</b></div>' +
      '<div><span>БАНК</span><b>' + bb(sp.pot) + '</b></div>' +
      '<div><span>ЭФФ. СТЕК</span><b>' + bb(sp.effStack || sp.heroStack) + '</b></div>' +
      '<div><span>УЛИЦА</span><b>' + esc(streetLabel(sp.street)) + '</b></div>' +
      '<div><span>ТЫ</span><b>' + esc(positionLabel(sp.position)) + ' · ' + bb(sp.heroStack) + '</b></div>' +
      '<div><span>СОПЕРНИК</span><b>' + esc(positionLabel(sp.villain)) + (opp ? ' · ' + esc(opp.name) : '') + '</b></div>' +
      '</div>' +
      (board ? '<div class="spot30Rule"><b>Доска:</b> ' + esc(board) + '</div>' : '') +
      '<button type="button" class="secondary ctxFullBtn" data-ctx-full="' + esc(sp.id) + '">ВСЕ УСЛОВИЯ →</button>' +
      '</div>';
  }
  function fullConditions(sp) {
    if (!sp) return '';
    var opp = sp.opp;
    var tags = tagsOf(sp);
    var board = (sp.board || []).join(' ');
    var oppRow = opp ? opp.name + ' · VPIP ' + opp.vpip + '% · PFR ' + opp.pfr + '% · выборка ' + opp.sample : '';
    var history = (sp.history || []).map(function (h) {
      return '<div class="ctxHist"><span class="ctxHistStreet">' + esc(streetLabel(h.street)) + '</span><span class="ctxHistText">' + esc(h.text) + '</span></div>';
    }).join('');
    return '<div class="spot30 ctxFull">' +
      '<div class="spot30Top"><span class="spot30Field">ВСЕ УСЛОВИЯ</span><span class="ey">ПАСПОРТ СПОТА</span></div>' +
      '<div class="spot30Tags">' + tags.map(function (t) { return '<span class="spot30Tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="spot30Grid">' +
      '<div><span>ФОРМАТ</span><b>' + esc(formatLabel(sp.format)) + '</b></div>' +
      '<div><span>СТАДИЯ</span><b>' + esc(sp.stage) + '</b></div>' +
      '<div><span>СТОЛ</span><b>' + esc(sp.table) + '</b></div>' +
      '<div><span>В ИГРЕ</span><b>' + esc(sp.left) + '</b></div>' +
      '<div><span>БЛАЙНДЫ</span><b>' + esc(blindsLabel(sp)) + '</b></div>' +
      '<div><span>УЛИЦА</span><b>' + esc(streetLabel(sp.street)) + '</b></div>' +
      '<div><span>ТЫ</span><b>' + esc(positionLabel(sp.position)) + ' · ' + bb(sp.heroStack) + '</b></div>' +
      '<div><span>ТВОИ КАРТЫ</span><b>' + esc((sp.hero || []).join(' ')) + '</b></div>' +
      '<div><span>СОПЕРНИК</span><b>' + esc(positionLabel(sp.villain)) + ' · ' + bb(sp.villainStack) + '</b></div>' +
      '<div><span>ЭФФ. СТЕК</span><b>' + bb(sp.effStack || sp.heroStack) + '</b></div>' +
      '<div><span>БАНК</span><b>' + bb(sp.pot) + '</b></div>' +
      '<div><span>СЛОЖНОСТЬ</span><b>' + '●'.repeat(sp.difficulty || 1) + '○'.repeat(Math.max(0, 3 - (sp.difficulty || 1))) + '</b></div>' +
      '</div>' +
      (board ? '<div class="spot30Rule"><b>Доска:</b> ' + esc(board) + '</div>' : '') +
      (oppRow ? '<div class="spot30Rule"><b>Соперник:</b> ' + esc(oppRow) + '</div>' : '') +
      (opp && opp.note ? '<div class="spot30Rule"><b>О нём:</b> ' + esc(opp.note) + '</div>' : '') +
      (history ? '<div class="spot30Rule"><b>История раздачи:</b><div class="ctxHistList">' + history + '</div></div>' : '') +
      (sp.question ? '<div class="spot30Rule"><b>Вопрос:</b> ' + esc(sp.question) + '</div>' : '') +
      (sp.concept ? '<div class="spot30Rule"><b>Концепция:</b> ' + esc(sp.concept) + '</div>' : '') +
      '</div>';
  }
  function fullContextModal(sp) {
    return '<div class="ctxModal">' + fullConditions(sp) + '<button type="button" class="primary ctxCloseBtn">ПОНЯТНО →</button></div>';
  }
  function wireContextButtons(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-ctx-full]').forEach(function (btn) {
      btn.onclick = function () {
        var spot = lookup(btn.dataset.ctxFull);
        if (!spot) return;
        if (window.openModal) {
          window.openModal(fullContextModal(spot));
          setTimeout(function () {
            var m = document.querySelector('.ctxCloseBtn');
            if (m) m.onclick = function () { window.closeModal && window.closeModal(); };
          }, 0);
        }
      };
    });
  }

  /* ---------- профили соперников ---------- */
  var OPP = {
    НИТ:     { name: 'НИТ',     vpip: 14, pfr: 9,  sample: 2100, style: 'ТАЙТ-ПАССИВНЫЙ',   note: 'Редко входит в раздачи, редко блефует.' },
    РЕГ:     { name: 'РЕГ',     vpip: 21, pfr: 16, sample: 3400, style: 'ТАЙТ-АГРЕССИВНЫЙ', note: 'Дисциплинирован, сбалансирован по улицам.' },
    'АГРО-РЕГ': { name: 'АГРО-РЕГ', vpip: 27, pfr: 23, sample: 1500, style: 'АГРЕССИВНЫЙ',  note: 'Ставит часто, с широкими блефами.' },
    ЛЮБИТЕЛЬ: { name: 'ЛЮБИТЕЛЬ', vpip: 38, pfr: 12, sample: 480,  style: 'НЕБЕЗОПАСНЫЙ-ПАССИВНЫЙ', note: 'Широко колит, мало блефует, платит тонко.' },
    МАНИАК:  { name: 'МАНИАК',  vpip: 52, pfr: 41, sample: 700,  style: 'АГРЕССИВНЫЙ',      note: 'Почти не фолдит, ставит на каждой улице.' },
    СТЕЦИОНЕР: { name: 'СТЕЦИОНЕР', vpip: 46, pfr: 6, sample: 900, style: 'ПАССИВНЫЙ',       note: 'Колит широко, сам почти не ставит.' }
  };
  function oppOf(name) {
    return OPP[name] ? Object.assign({}, OPP[name]) : { name: name || 'РЕГ', vpip: 21, pfr: 16, sample: 3400, style: 'ТАЙТ-АГРЕССИВНЫЙ', note: '' };
  }

  /* ---------- контекстная основа (CTX30 из index.html) ---------- */
  function ctxBase(key) {
    try {
      var c = (typeof window.CTX30 !== 'undefined' && window.CTX30) ? window.CTX30[key] : null;
      if (c) return c;
    } catch (e) {}
    return { stage: 'СРЕДНЯЯ', table: '6-MAX', left: '', eff: '24 ББ', opp: 'РЕГ', note: '' };
  }

  /* ---------- дополнение legacy-спота до полного контекста ---------- */
  function enrich(base, spot) {
    var heroStack = spot.stack || spot.heroStack || 24;
    var villainStack = spot.villainStack || Math.round(heroStack * 0.9);
    var ctx = (base && base.ctx) ? base.ctx : (base || {});
    var oppName = spot.opp || ctx.opp || 'РЕГ';
    var opp = (typeof oppName === 'object' && oppName && oppName.name) ? oppName : oppOf(oppName);
    var history = spot.history || [];
    if (spot.actions && !history.length) {
      history = spot.actions.map(function (a) { return { street: spot.street || 'ПРЕФЛОП', text: String(a) }; });
    }
    return {
      id: spot.id || (ctx.field || 'SPOT'),
      format: spot.format || 'MTT',
      street: spot.street || 'ПРЕФЛОП',
      blinds: spot.blinds || [500, 1000],
      ante: spot.ante != null ? spot.ante : 125,
      stage: spot.stage || ctx.stage || 'СРЕДНЯЯ',
      table: spot.table || ctx.table || '6-MAX',
      left: spot.left || ctx.left || '',
      position: spot.pos || spot.position || 'BTN',
      hero: spot.hero || [],
      heroStack: heroStack,
      villain: spot.villain || spot.villainSeat || 'BB',
      villainStack: villainStack,
      effStack: spot.effStack || Math.min(heroStack, villainStack),
      opp: opp,
      board: spot.board || [],
      pot: spot.pot || 0,
      history: history,
      question: spot.question || spot.ctx || spot.key || '',
      options: spot.options || spot.actions || spot.decision || [],
      correct: spot.correct || spot.preferred || '',
      concept: spot.concept || spot.theme || '',
      explain: spot.explain || spot.why || spot.key || '',
      difficulty: spot.difficulty || 2
    };
  }

  /* ---------- текущий спот каждой мини-апки ---------- */
  // Legacy-глобалы (swSession, SIZING, REVIEWS и т.д.) объявлены top-level
  // let/const в классических скриптах index.html — они НЕ на window, но
  // доступны как голые идентификаторы из этого классического скрипта.
  // Читаем данные через window: top-level const/let из index.html не всегда
  // попадают в общий лексический скоп (jsdom не делит их между скриптами),
  // поэтому в index.html они дополнительно выставлены через exposeV32.
  function current(key) {
    try {
      if (key === 'swipe' && typeof window.swSession !== 'undefined' && typeof window.swIndex === 'number') return window.swSession[window.swIndex];
      if (key === 'sizing' && typeof window.SIZING !== 'undefined' && typeof window.sz === 'number') return window.SIZING[window.sz % window.SIZING.length];
      if (key === 'review' && typeof window.REVIEWS !== 'undefined' && typeof window.rv === 'number') return window.REVIEWS[window.rv % window.REVIEWS.length];
      if (key === 'daily' && typeof window.dailyToday === 'function') return window.dailyToday();
    } catch (e) {}
    return null;
  }

  var enrichedCache = {};
  function lookup(id) {
    if (enrichedCache[id]) return enrichedCache[id];
    return null;
  }

  /* ---------- вставка блока условий в карточку ---------- */
  function inject(key, targetSel, ctxKey) {
    var el = document.querySelector(targetSel);
    if (!el) return;
    el.querySelectorAll(':scope > .spot30').forEach(function (x) { x.remove(); });
    var spot = current(key);
    if (!spot) return;
    var enriched = enrich({ ctx: ctxBase(ctxKey || key) }, spot);
    if (!enriched.id) enriched.id = key + '_' + (spot.id != null ? spot.id : Math.random());
    enrichedCache[enriched.id] = enriched;
    el.insertAdjacentHTML('afterbegin', compactConditions(enriched));
    wireContextButtons(el);
  }

  function wrap(name, targetSel, key, ctxKey) {
    var old = window[name];
    if (typeof old !== 'function') return;
    window[name] = function () {
      var r = old.apply(this, arguments);
      setTimeout(function () {
        try { inject(key, targetSel, ctxKey || key); }
        catch (e) { if (window.console) console.error('task-context ' + name, e); }
      }, 0);
      return r;
    };
  }

  // Мини-апки первого раздела.
  wrap('renderSwipe', '#swipeCard', 'swipe');
  wrap('renderSizing', '#sizingArea', 'sizing');
  wrap('renderReview', '#reviewArea', 'review');
  wrap('renderDaily', '#dailyArea', 'daily');
  wrap('renderHeal', '#healArea', 'heal');
  wrap('renderXray', '#xrayArea', 'xray');
})();