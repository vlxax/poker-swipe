/**
 * PokerSwipe — My Tournaments Pro
 * Full analytics dashboard integrated into #myTournamentsRoot / #ps72TournamentScreen
 */
(function () {
  'use strict';

  const RATE = 90;
  const BUCKETS = [
    { label: 'Micro', max: 1000, tier: 'micro' },
    { label: 'Low', max: 5000, tier: 'low' },
    { label: 'Mid', max: 25000, tier: 'mid' },
    { label: 'High', max: Infinity, tier: 'high' }
  ];
  const WINDOWS = [50, 100, 200];
  const PERIODS = [['7', '7Д'], ['30', '30Д'], ['90', '3М'], ['365', 'ГОД'], ['all', 'ВСЁ']];
  const TYPES = [['all', 'ВСЕ'], ['offline', 'ОФЛ'], ['online', 'ОНЛ'], ['sport', 'СПОРТ']];
  const MONTHS = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];

  const RECENT_LIMIT = 4;
  let periodFilter = 'all';
  let typeFilter = 'all';
  let bucketFilter = 'all';
  let proMode = localStorage.getItem('mtProMode') === '1';
  let addType = null;
  let editingId = null;
  let selCurr = 'RUB';
  let chartData = [];
  let typeData = [];
  let analyticsOpen = false;
  let analyticsTab = 'overview';

  const num = (v) => {
    const n = Number(String(v ?? 0).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
    );

  const state = () => {
    window.S = window.S || {};
    if (!Array.isArray(window.S.tournaments)) window.S.tournaments = [];
    return window.S;
  };

  const list = () => state().tournaments;

  const persist = () => {
    if (typeof window.save === 'function') window.save();
  };

  const cat = (t) => (t.type === 'sport' ? 'sport' : t.type === 'online' ? 'online' : 'offline');
  const title = (t) => t.tournamentName || t.name || 'Без названия';
  const venue = (t) =>
    (t.clubOrRoom || t.club || t.room || (cat(t) === 'online' ? 'Online room' : 'Poker club')).toUpperCase();
  const displayVenue = (t) => {
    const raw = (t.clubOrRoom || t.club || t.room || '').trim();
    if (!raw) return cat(t) === 'online' ? 'Online' : 'Club';
    return raw
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };
  const currency = (t) => t.currency || 'RUB';
  const entries = (t) => Math.max(1, Math.round(num(t.entries) || 1));
  const reentryCount = (t) => Math.max(0, entries(t) - 1);
  const baseBuy = (t) => num(t.baseBuyin ?? t.buyin);
  const unitCost = (t) => baseBuy(t) + num(t.bountyContribution) + num(t.fee);
  const reentryCostVal = (t) => num(t.reentryCost) || unitCost(t) || baseBuy(t);

  const toRub = (t, amount) => (currency(t) === 'USD' ? Math.round(amount * RATE) : amount);

  const investedRub = (t) => {
    if (cat(t) === 'sport') {
      return toRub(t, baseBuy(t) + reentryCostVal(t) * reentryCount(t));
    }
    return toRub(t, unitCost(t) * entries(t) + num(t.addOn));
  };

  const totalReturnedRub = (t) => {
    if (cat(t) === 'sport') return 0;
    return toRub(t, num(t.prize) + num(t.bountyWon));
  };

  const profitRub = (t) => {
    if (cat(t) === 'sport') return num(t.points);
    return totalReturnedRub(t) - investedRub(t);
  };

  const buyinRub = (t) => toRub(t, baseBuy(t));

  const fmtDisplay = (t) => {
    const f = String(t.format || t.game || '').toUpperCase();
    const n = title(t);
    if (/PKO|BOUNTY/i.test(f) || /PKO|BOUNTY/i.test(n)) return 'PKO';
    if (/MYSTERY/i.test(f)) return 'Mystery Bounty';
    if (/SNG/i.test(f) || /SNG/i.test(n)) return 'SNG';
    if (f === 'PLO') return 'PLO';
    if (f === 'NLH' || !f) return 'MTT';
    return f;
  };

  const isBountyFmt = (t) => /PKO|BOUNTY|MYSTERY/i.test(fmtDisplay(t));

  const isITM = (t) => cat(t) !== 'sport' && num(t.prize) > 0;
  const isFT = (t) => {
    if (cat(t) === 'sport' || !t.field || num(t.field) < 9) return false;
    const field = num(t.field);
    const place = num(t.place);
    return field >= 100 ? place <= 9 : place <= Math.round(field * 0.1);
  };
  const isTop3 = (t) => num(t.place) <= 3;

  const getBucket = (buyin) => BUCKETS.find((b) => buyin <= b.max) || BUCKETS[BUCKETS.length - 1];

  const parseDate = (s) => {
    if (!s) return null;
    const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const dateSortKey = (t) => parseDate(t.date)?.getTime() || num(t.updatedAt) || 0;

  const fmtMoney = (n) => {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    return sign + Math.abs(Math.round(n)).toLocaleString('ru-RU') + ' ₽';
  };

  const fmtMoneyUSD = (n) => {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
  };

  const fmtPts = (n) => (n > 0 ? '+' : '') + Math.round(n) + ' pts';

  const fmtDateShort = (d) => {
    const p = String(d || '').split('-');
    if (p.length === 3) return `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1] || ''}`;
    return d;
  };

  const inPeriod = (t) => {
    if (periodFilter === 'all') return true;
    const days = { 7: 7, 30: 30, 90: 90, 365: 365 }[periodFilter];
    const d = parseDate(t.date);
    if (!d || !days) return true;
    const cutoff = new Date();
    cutoff.setHours(12, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);
    return d >= cutoff;
  };

  const moneyList = (arr) => arr.filter((t) => cat(t) !== 'sport');
  const sportOnlyList = (arr) => arr.filter((t) => cat(t) === 'sport');

  const filtered = () => {
    let arr = list().filter((t) => inPeriod(t) && (typeFilter === 'all' || cat(t) === typeFilter));
    if (bucketFilter !== 'all' && proMode) {
      const idx = BUCKETS.findIndex((b) => b.label === bucketFilter);
      if (idx >= 0) {
        const prev = idx > 0 ? BUCKETS[idx - 1].max : 0;
        const max = BUCKETS[idx].max;
        arr = arr.filter((t) => cat(t) !== 'sport' && buyinRub(t) > prev && buyinRub(t) <= max);
      }
    }
    return arr.sort((a, b) => dateSortKey(b) - dateSortKey(a));
  };

  const filteredForMain = () =>
    list()
      .filter((t) => inPeriod(t))
      .sort((a, b) => dateSortKey(b) - dateSortKey(a));

  const groupBy = (arr, keyFn) => {
    const map = {};
    arr.forEach((t) => {
      const k = typeof keyFn === 'function' ? keyFn(t) : t[keyFn];
      (map[k] = map[k] || []).push(t);
    });
    return map;
  };

  /* ── DOM bootstrap ── */
  const rootEl = document.getElementById('myTournamentsRoot');
  let SCREEN = document.getElementById('ps72TournamentScreen');
  let MODAL = document.getElementById('mtProModal');
  let ANALYTICS = document.getElementById('mtProAnalytics');
  let DETAIL_OVERLAY = document.getElementById('mtProDetailOverlay');
  let DETAIL = document.getElementById('mtProDetail');
  let TOAST = document.getElementById('mtProToast');

  function ensureDom() {
    if (!SCREEN) {
      SCREEN = document.createElement('section');
      SCREEN.id = 'ps72TournamentScreen';
      SCREEN.setAttribute('aria-hidden', 'true');
      (rootEl || document.body).appendChild(SCREEN);
    }
    if (!MODAL) {
      MODAL = document.createElement('div');
      MODAL.id = 'mtProModal';
      MODAL.innerHTML = '<div class="mt-pro-sheet" id="mtProSheet"></div>';
      document.body.appendChild(MODAL);
      MODAL.addEventListener('click', (e) => {
        if (e.target === MODAL) closeSheet();
      });
    }
    if (!DETAIL_OVERLAY) {
      DETAIL_OVERLAY = document.createElement('div');
      DETAIL_OVERLAY.id = 'mtProDetailOverlay';
      DETAIL_OVERLAY.addEventListener('click', closeDetail);
      document.body.appendChild(DETAIL_OVERLAY);
    }
    if (!DETAIL) {
      DETAIL = document.createElement('div');
      DETAIL.id = 'mtProDetail';
      DETAIL.className = 'mt-pro-detail';
      DETAIL.innerHTML =
        '<button type="button" class="mt-pro-detail-close" data-mt="detail-close">✕</button><div id="mtProDetailBody"></div>';
      document.body.appendChild(DETAIL);
      DETAIL.querySelector('[data-mt="detail-close"]').addEventListener('click', closeDetail);
    }
    if (!TOAST) {
      TOAST = document.createElement('div');
      TOAST.id = 'mtProToast';
      TOAST.className = 'mt-pro-toast';
      document.body.appendChild(TOAST);
    }
    if (!ANALYTICS) {
      ANALYTICS = document.createElement('div');
      ANALYTICS.id = 'mtProAnalytics';
      ANALYTICS.innerHTML = `<div class="mt-pro-analytics-sheet" id="mtProAnalyticsBody"></div>`;
      document.body.appendChild(ANALYTICS);
      ANALYTICS.addEventListener('click', (e) => {
        if (e.target === ANALYTICS) closeAnalytics();
      });
    }
    if (!SCREEN.querySelector('.mt-pro') || !SCREEN.querySelector('#mtSummaryBlock')) {
      if (SCREEN.querySelector('.mt-pro')) SCREEN.innerHTML = '';
      SCREEN.innerHTML = `<div class="mt-pro">
        <div class="mt-pro-glow"></div>
        <div class="mt-pro-head mt-pro-hero">
          <h2>МОИ <em>ТУРНИРЫ</em></h2>
          <div class="mt-pro-actions">
            <button type="button" class="mt-pro-add" data-mt="add">+ Добавить</button>
          </div>
        </div>
        <div class="mt-pro-filters">
          <div class="mt-pro-filter-row" id="mtPeriodRow"></div>
        </div>
        <div class="mt-pro-summary" id="mtSummaryBlock"></div>
        <div class="mt-pro-hero-insight" id="mtHeroInsight" style="display:none"></div>
        <div class="mt-pro-chart-wrap">
          <div class="mt-pro-chart-card">
            <div class="mt-pro-chart-head">
              <div class="mt-pro-chart-title" id="mtChartTitle">ГРАФИК РЕЗУЛЬТАТОВ</div>
              <div class="mt-pro-chart-end" id="mtChartEnd"></div>
            </div>
            <svg class="mt-pro-chart" id="mtChartSvg" viewBox="0 0 340 140" preserveAspectRatio="none"></svg>
            <div class="mt-pro-chart-tip" id="mtChartTip"></div>
          </div>
        </div>
        <div class="mt-pro-recent" id="mtRecentSection">
          <div class="mt-pro-list-head">
            <div class="mt-pro-list-title">ПОСЛЕДНИЕ ТУРНИРЫ</div>
          </div>
          <div class="mt-pro-list" id="mtList"></div>
          <button type="button" class="mt-pro-show-all" id="mtShowAllBtn" data-mt="show-all" style="display:none">ПОКАЗАТЬ ВСЕ →</button>
          <div class="mt-pro-empty" id="mtEmpty" style="display:none">
            <h3>Ещё нет турниров</h3>
            <p>Добавь результат — и здесь появится аналитика по нему.</p>
            <button type="button" class="cta" data-mt="add">+ ДОБАВИТЬ ТУРНИР</button>
          </div>
        </div>
        <button type="button" class="mt-pro-analytics-btn" data-mt="analytics-open">ПОДРОБНАЯ АНАЛИТИКА →</button>
        <div class="mt-pro-bottom-spacer" aria-hidden="true"></div>
      </div>`;
      ensureAnalyticsDom();
      bindStaticEvents();
    }
  }

  function ensureAnalyticsDom() {
    const body = document.getElementById('mtProAnalyticsBody');
    if (!body) return;
    if (body.querySelector('#mtAnalyticsTabs')) return;
    body.innerHTML = `
      <div class="mt-pro-sheet-handle"></div>
      <div class="mt-pro-analytics-head">
        <span>ПОДРОБНАЯ АНАЛИТИКА</span>
        <button type="button" class="mt-pro-sheet-close" data-mt="analytics-close">✕</button>
      </div>
      <div class="mt-pro-filters mt-pro-filters-analytics">
        <div class="mt-pro-filter-row" id="mtTypeRow"></div>
        <div class="mt-pro-filter-row" id="mtBucketRow" style="display:none"></div>
      </div>
      <div class="mt-pro-analytics-tabs" id="mtAnalyticsTabs"></div>
      <div id="mtTabOverview" class="mt-pro-tab-panel">
        <div class="mt-pro-dash">
          <div class="mt-pro-dash-title">
            <span>МОЯ ИГРА</span>
            <div class="mt-pro-pro-toggle" data-mt="pro-toggle">
              <span>Профи-режим</span>
              <div class="mt-pro-switch" id="mtProSwitch"><i></i></div>
            </div>
          </div>
          <div class="mt-pro-stat-grid" id="mtStatGrid"></div>
          <div id="mtSampleNote"></div>
          <div class="mt-pro-add-stats" id="mtAddStats"></div>
        </div>
        <div class="mt-pro-section" id="mtInsightsSection">
          <div class="mt-pro-section-title">КЛЮЧЕВЫЕ ВЫВОДЫ</div>
          <div class="mt-pro-conclusions" id="mtInsightsGrid"></div>
          <div class="mt-pro-warning" id="mtInsightWarning" style="display:none"><span class="mt-pro-warn-icon"></span><p id="mtWarningText"></p></div>
        </div>
        <div class="mt-pro-section" id="mtRollingSection" style="display:none">
          <div class="mt-pro-section-title">ROI СКОЛЬЗЯЩИМ ОКНОМ</div>
          <div class="mt-pro-rolling" id="mtRollingGrid"></div>
        </div>
        <div class="mt-pro-section" id="mtSplitSection">
          <div class="mt-pro-section-title">ОФЛАЙН VS ОНЛАЙН</div>
          <div class="mt-pro-split" id="mtSplitCard"></div>
        </div>
        <div class="mt-pro-analytics-export">
          <button type="button" class="mt-pro-export" data-mt="export">Экспорт CSV</button>
        </div>
        <div class="mt-pro-list-head">
          <div class="mt-pro-list-title">ИСТОРИЯ <span class="count" id="mtListCount">(0)</span></div>
        </div>
        <div class="mt-pro-list" id="mtFullList"></div>
        <div class="mt-pro-bottom-spacer" aria-hidden="true"></div>
      </div>
      <div id="mtTabBuyin" class="mt-pro-tab-panel" style="display:none">
        <div class="mt-pro-section" id="mtBucketsSection">
          <div class="mt-pro-section-title">ROI ПО БАЙ-ИНАМ <span class="mt-pro-badge-count" id="mtBucketsCount"></span></div>
          <div class="mt-pro-buckets-compact" id="mtBucketsGrid"></div>
          <div class="mt-pro-tab-hint" id="mtBuyinHint" style="display:none">Включи профи-режим во вкладке «Обзор» для детализации по бай-инам.</div>
        </div>
        <div class="mt-pro-bottom-spacer" aria-hidden="true"></div>
      </div>
      <div id="mtTabFormats" class="mt-pro-tab-panel" style="display:none">
        <div class="mt-pro-section" id="mtFormatSection">
          <div class="mt-pro-section-title">ПО ФОРМАТАМ <span class="n" id="mtFormatN"></span></div>
          <div class="mt-pro-bar-list" id="mtFormatList"></div>
        </div>
        <div class="mt-pro-bottom-spacer" aria-hidden="true"></div>
      </div>
      <div id="mtTabVenues" class="mt-pro-tab-panel" style="display:none">
        <div class="mt-pro-section" id="mtVenueSection">
          <div class="mt-pro-section-title" id="mtVenueTitle">ПО ПЛОЩАДКАМ</div>
          <div class="mt-pro-bar-list" id="mtVenueList"></div>
        </div>
        <div class="mt-pro-bottom-spacer" aria-hidden="true"></div>
      </div>`;
    if (!body.dataset.bound) {
      body.addEventListener('click', onAnalyticsClick);
      body.dataset.bound = '1';
    }
  }

  function $(id) {
    return SCREEN.querySelector('#' + id) || document.getElementById(id);
  }

  function openAnalytics() {
    ensureDom();
    ensureAnalyticsDom();
    analyticsOpen = true;
    ANALYTICS.classList.add('on');
    document.body.style.overflow = 'hidden';
    renderAnalytics();
  }

  function closeAnalytics() {
    analyticsOpen = false;
    ANALYTICS?.classList.remove('on');
    if (!MODAL?.classList.contains('on')) document.body.style.overflow = '';
  }

  function onAnalyticsClick(e) {
    const t = e.target.closest('[data-mt]');
    if (!t) return;
    const action = t.dataset.mt;
    if (action === 'analytics-close') closeAnalytics();
    else if (action === 'export') exportCSV();
    else if (action === 'pro-toggle') toggleProMode();
    else if (action === 'type') {
      typeFilter = t.dataset.val;
      render();
    } else if (action === 'bucket') {
      bucketFilter = t.dataset.val;
      render();
    } else if (action === 'edit') editTournament(t.dataset.id);
    else if (action === 'delete') deleteTournament(t.dataset.id);
    else if (action === 'bar-detail') showDetailList((t.dataset.ids || '').split('|').filter(Boolean), t.dataset.title || '');
    else if (action === 'type-insight') showTypeList();
    else if (action === 'analytics-tab') {
      analyticsTab = t.dataset.val || 'overview';
      renderAnalytics();
    }
  }

  function showToast(msg, isErr) {
    TOAST.textContent = msg;
    TOAST.className = 'mt-pro-toast' + (isErr ? ' error' : '');
    TOAST.classList.add('on');
    setTimeout(() => TOAST.classList.remove('on'), 2500);
  }

  function bindStaticEvents() {
    SCREEN.addEventListener('click', onRootClick);
    const svg = () => $('mtChartSvg');
    $('mtChartSvg')?.addEventListener('click', (e) => {
      const c = e.target.closest('[data-chart-idx]');
      if (c) showChartTooltip(Number(c.dataset.chartIdx));
    });
  }

  function onRootClick(e) {
    const t = e.target.closest('[data-mt]');
    if (!t) return;
    const action = t.dataset.mt;
    if (action === 'add') openSheet();
    else if (action === 'period') {
      periodFilter = t.dataset.val;
      render();
    } else if (action === 'edit') editTournament(t.dataset.id);
    else if (action === 'delete') deleteTournament(t.dataset.id);
    else if (action === 'show-all') openAnalytics();
    else if (action === 'analytics-open') openAnalytics();
  }

  function toggleProMode() {
    proMode = !proMode;
    localStorage.setItem('mtProMode', proMode ? '1' : '0');
    render();
  }

  function renderFilters() {
    $('mtPeriodRow').innerHTML = PERIODS.map(
      ([k, l]) =>
        `<button type="button" class="mt-pro-chip ${periodFilter === k ? 'active' : ''}" data-mt="period" data-val="${k}">${l}</button>`
    ).join('');
    if (!document.getElementById('mtTypeRow')) return;
    $('mtTypeRow').innerHTML = TYPES.map(([k, l]) => {
      let cls = 'mt-pro-chip';
      if (typeFilter === k) {
        cls += ' active';
        if (k === 'online') cls += ' type-online';
        if (k === 'sport') cls += ' type-sport';
      }
      return `<button type="button" class="${cls}" data-mt="type" data-val="${k}">${l}</button>`;
    }).join('');
    const bucketRow = $('mtBucketRow');
    if (proMode) {
      bucketRow.style.display = 'flex';
      bucketRow.innerHTML =
        `<button type="button" class="mt-pro-chip ${bucketFilter === 'all' ? 'active' : ''}" data-mt="bucket" data-val="all">ВСЕ</button>` +
        BUCKETS.map(
          (b) =>
            `<button type="button" class="mt-pro-chip ${bucketFilter === b.label ? 'active' : ''}" data-mt="bucket" data-val="${esc(b.label)}">${b.label}</button>`
        ).join('');
    } else {
      bucketRow.style.display = 'none';
    }
    $('mtProSwitch')?.classList.toggle('on', proMode);
    $('mtRollingSection').style.display = proMode && analyticsTab === 'overview' ? '' : 'none';
  }

  const ANALYTICS_TABS = [
    ['overview', 'ОБЗОР'],
    ['buyin', 'ПО БАЙ-ИНАМ'],
    ['formats', 'ФОРМАТЫ'],
    ['venues', 'ПЛОЩАДКИ']
  ];

  function renderAnalyticsTabBar() {
    const el = $('mtAnalyticsTabs');
    if (!el) return;
    el.innerHTML = ANALYTICS_TABS.map(
      ([k, l]) =>
        `<button type="button" class="mt-pro-seg ${analyticsTab === k ? 'active' : ''}" data-mt="analytics-tab" data-val="${k}">${l}</button>`
    ).join('');
  }

  function showAnalyticsPanel() {
    const map = { overview: 'mtTabOverview', buyin: 'mtTabBuyin', formats: 'mtTabFormats', venues: 'mtTabVenues' };
    Object.entries(map).forEach(([k, id]) => {
      const el = $(id);
      if (el) el.style.display = analyticsTab === k ? 'block' : 'none';
    });
  }

  function groupRoi(items) {
    if (!items.length) return null;
    const inv = items.reduce((s, t) => s + investedRub(t), 0);
    const ret = items.reduce((s, t) => s + totalReturnedRub(t), 0);
    if (!inv) return null;
    return {
      roi: Math.round(((ret - inv) / inv) * 1000) / 10,
      profit: ret - inv,
      n: items.length
    };
  }

  function periodLabel() {
    const p = PERIODS.find(([k]) => k === periodFilter);
    return p ? p[1] : 'ВСЁ';
  }

  function renderCompactSummary(arr, isSportOnly) {
    const el = $('mtSummaryBlock');
    if (isSportOnly) {
      const sp = sportOnlyList(arr);
      const totalPts = sp.reduce((s, t) => s + num(t.points), 0);
      const avg = sp.length ? Math.round(totalPts / sp.length) : 0;
      el.innerHTML = `
        <div class="mt-pro-summary-item"><span class="k">Сыграно</span><span class="v">${sp.length}</span></div>
        <div class="mt-pro-summary-item"><span class="k">Points</span><span class="v pos">${totalPts}</span></div>
        <div class="mt-pro-summary-item"><span class="k">Среднее</span><span class="v">${avg}</span></div>
        <div class="mt-pro-summary-item"><span class="k">Период</span><span class="v muted">${periodLabel()}</span></div>`;
      return;
    }
    const m = moneyList(arr);
    const n = m.length;
    if (n === 0) {
      el.innerHTML = `<div class="mt-pro-summary-empty">Нет турниров за выбранный период</div>`;
      return;
    }
    const totalInv = m.reduce((s, t) => s + investedRub(t), 0);
    const totalRet = m.reduce((s, t) => s + totalReturnedRub(t), 0);
    const net = totalRet - totalInv;
    const roi = totalInv ? Math.round((net / totalInv) * 1000) / 10 : null;
    const itmPct = Math.round((m.filter(isITM).length / n) * 100);
    el.innerHTML = `
      <div class="mt-pro-summary-item"><span class="k">Сыграно</span><span class="v">${n}</span></div>
      <div class="mt-pro-summary-item"><span class="k">Профит</span><span class="v ${net >= 0 ? 'pos' : 'neg'}">${proMode ? fmtMoneyUSD(net / RATE) : fmtMoney(net)}</span></div>
      <div class="mt-pro-summary-item"><span class="k">ROI</span><span class="v ${roi === null ? 'neutral' : roi >= 0 ? 'pos' : 'neg'}">${roi === null ? '—' : (roi >= 0 ? '+' : '') + roi + '%'}</span></div>
      <div class="mt-pro-summary-item"><span class="k">ITM</span><span class="v">${itmPct}%</span></div>`;
  }

  function renderHeroInsight(arr) {
    const el = $('mtHeroInsight');
    const m = moneyList(arr);
    if (m.length < 2 || typeFilter === 'sport') {
      el.style.display = 'none';
      return;
    }
    const calc = (items) => {
      const inv = items.reduce((s, t) => s + investedRub(t), 0);
      const ret = items.reduce((s, t) => s + totalReturnedRub(t), 0);
      const roi = inv ? Math.round(((ret - inv) / inv) * 1000) / 10 : null;
      return { roi, n: items.length };
    };
    const off = calc(m.filter((t) => cat(t) === 'offline'));
    const on = calc(m.filter((t) => cat(t) === 'online'));
    let label = '';
    let roi = null;
    if (off.n >= 1 && on.n >= 1) {
      if ((off.roi ?? -Infinity) >= (on.roi ?? -Infinity)) {
        label = 'офлайне';
        roi = off.roi;
      } else {
        label = 'онлайне';
        roi = on.roi;
      }
    } else if (off.n >= 1) {
      label = 'офлайне';
      roi = off.roi;
    } else if (on.n >= 1) {
      label = 'онлайне';
      roi = on.roi;
    } else {
      el.style.display = 'none';
      return;
    }
    if (roi === null) {
      el.style.display = 'none';
      return;
    }
    const periodTxt = periodFilter === 'all' ? 'ЗА ВСЁ ВРЕМЯ' : `ЗА ${periodLabel()}`;
    el.style.display = 'block';
    el.innerHTML = `
      <div class="mt-pro-hero-tag">${periodTxt}</div>
      <div class="mt-pro-hero-text">Лучший результат у тебя в <strong>${label}</strong></div>
      <div class="mt-pro-hero-val ${roi >= 0 ? 'pos' : 'neg'}">ROI ${roi >= 0 ? '+' : ''}${roi}%</div>`;
  }

  function renderStats(arr, isSportOnly) {
    const grid = $('mtStatGrid');
    const note = $('mtSampleNote');
    const addStats = $('mtAddStats');

    if (isSportOnly) {
      const sp = sportOnlyList(arr);
      const totalPts = sp.reduce((s, t) => s + num(t.points), 0);
      const avg = sp.length ? Math.round(totalPts / sp.length) : 0;
      const best = sp.length ? Math.max(...sp.map((t) => num(t.points))) : 0;
      grid.innerHTML = `
        <div class="mt-pro-stat"><div class="lbl">Турниров</div><div class="val">${sp.length}</div></div>
        <div class="mt-pro-stat"><div class="lbl">Всего points</div><div class="val pos">${totalPts}</div></div>
        <div class="mt-pro-stat"><div class="lbl">Средние points</div><div class="val">${avg}</div><div class="sub">за турнир</div></div>
        <div class="mt-pro-stat"><div class="lbl">Лучший результат</div><div class="val pos">${best}</div><div class="sub">pts за турнир</div></div>`;
      note.innerHTML = '';
      note.className = '';
      addStats.textContent = '';
      return;
    }

    const m = moneyList(arr);
    const n = m.length;
    if (n === 0) {
      grid.innerHTML =
        '<div class="mt-pro-stat" style="grid-column:span 2;text-align:center;color:var(--mt-muted)"><div class="val neutral">Нет турниров</div></div>';
      note.innerHTML = '';
      addStats.textContent = '';
      return;
    }

    const totalInv = m.reduce((s, t) => s + investedRub(t), 0);
    const totalRet = m.reduce((s, t) => s + totalReturnedRub(t), 0);
    const net = totalRet - totalInv;
    const roi = totalInv ? Math.round((net / totalInv) * 1000) / 10 : null;
    const itmPct = Math.round((m.filter(isITM).length / n) * 100);
    const abi = Math.round(m.reduce((s, t) => s + buyinRub(t), 0) / n);
    const ftPct = Math.round((m.filter(isFT).length / n) * 100);
    const top3Pct = Math.round((m.filter(isTop3).length / n) * 100);
    const totalEntries = m.reduce((s, t) => s + entries(t), 0);
    const avgEntries = (totalEntries / n).toFixed(2);

    const sorted = m.slice().sort((a, b) => dateSortKey(a) - dateSortKey(b));
    let cum = 0,
      peak = -Infinity,
      curDD = 0,
      curDDLen = 0,
      lastPeakIdx = 0;
    sorted.forEach((t, i) => {
      cum += profitRub(t);
      if (cum > peak) {
        peak = cum;
        lastPeakIdx = i;
      }
      const dd = peak - cum;
      if (i === sorted.length - 1) {
        curDD = dd;
        curDDLen = i - lastPeakIdx;
      }
    });
    const isAtHigh = curDD === 0;

    addStats.textContent = `${n} тур. · ITM ${itmPct}% · FT ${ftPct}% · Top3 ${top3Pct}% · ${totalEntries} входов · ${avgEntries} входа/тур`;

    grid.innerHTML = `
      <div class="mt-pro-stat"><div class="lbl">ROI</div><div class="val ${roi === null ? 'neutral' : roi >= 0 ? 'pos' : 'neg'}">${roi === null ? '—' : (roi >= 0 ? '+' : '') + roi + '%'}</div></div>
      <div class="mt-pro-stat"><div class="lbl">Профит</div><div class="val ${net >= 0 ? 'pos' : 'neg'}">${proMode ? fmtMoneyUSD(net / RATE) : fmtMoney(net)}</div><div class="sub">${proMode ? '' : 'USD: ' + fmtMoneyUSD(net / RATE)}</div></div>
      <div class="mt-pro-stat"><div class="lbl">ABI</div><div class="val">${proMode ? '$' + (abi / RATE).toFixed(0) : abi.toLocaleString('ru-RU') + ' ₽'}</div></div>
      <div class="mt-pro-stat"><div class="lbl">Просадка</div><div class="val ${curDD > 0 ? 'neg' : 'pos'}">${isAtHigh ? '0' : proMode ? fmtMoneyUSD(-curDD / RATE) : fmtMoney(-curDD)}</div><div class="sub">${isAtHigh ? 'Новый максимум' : curDDLen > 0 ? curDDLen + ' тур.' : ''}</div></div>`;

    let noteHtml = '';
    if (n < 15) noteHtml = `${n} тур. — очень мало данных`;
    else if (n < 100) noteHtml = `${n} тур. — ранняя выборка`;
    else if (n < 300) noteHtml = `${n} тур. — тенденция видна`;
    else noteHtml = `${n} тур. — информативная дистанция`;
    note.innerHTML = noteHtml;
    note.className = noteHtml ? 'mt-pro-sample' : '';
  }

  function renderChart(arr, isSportOnly) {
    const svg = $('mtChartSvg');
    const titleEl = $('mtChartTitle');
    const endEl = $('mtChartEnd');
    const tip = $('mtChartTip');
    titleEl.textContent = isSportOnly ? 'ДИНАМИКА POINTS' : 'ГРАФИК РЕЗУЛЬТАТОВ';

    const src = (isSportOnly ? sportOnlyList(arr) : moneyList(arr))
      .slice()
      .sort((a, b) => dateSortKey(a) - dateSortKey(b));
    if (src.length === 0) {
      svg.innerHTML = '';
      endEl.textContent = '';
      tip.style.opacity = 0;
      chartData = [];
      return;
    }

    let cum = 0;
    const data = src.map((t) => {
      const val = isSportOnly ? num(t.points) : profitRub(t);
      cum += val;
      return { t, cum, val };
    });
    chartData = data.map((d) => ({
      date: fmtDateShort(d.t.date),
      name: title(d.t),
      venue: venue(d.t),
      place: num(d.t.place),
      field: num(d.t.field),
      cum: d.cum,
      val: d.val,
      isSport: isSportOnly
    }));

    const pts = data.map((d) => d.cum);
    const min = Math.min(0, ...pts);
    const max = Math.max(0, ...pts);
    const range = max - min || 1;
    const H = 130;
    const PAD = 8;
    const x = (i) => (pts.length === 1 ? 170 : (i / (pts.length - 1)) * 340);
    const y = (v) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
    const zeroY = y(0);
    const endVal = pts[pts.length - 1];
    const color = endVal >= 0 ? '#c8ff3d' : '#ff6b5b';

    let peakIdx = 0;
    let peakVal = -Infinity;
    data.forEach((d, i) => {
      if (d.cum > peakVal) {
        peakVal = d.cum;
        peakIdx = i;
      }
    });
    const peakX = x(peakIdx);
    const peakY = y(peakVal);
    const curX = x(data.length - 1);
    const curY = y(endVal);

    const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const areaPath = `${path} L${x(pts.length - 1).toFixed(1)},${zeroY} L${x(0).toFixed(1)},${zeroY} Z`;

    let ddArea = '';
    if (peakIdx < data.length - 1 && endVal < peakVal) {
      ddArea = `<rect x="${(peakX + 2).toFixed(1)}" y="${(peakY - 2).toFixed(1)}" width="${(curX - peakX - 4).toFixed(1)}" height="${(curY - peakY + 4).toFixed(1)}" fill="#ff6b5b" opacity="0.12" rx="3"/>
        <line x1="${peakX.toFixed(1)}" y1="${(peakY - 4).toFixed(1)}" x2="${peakX.toFixed(1)}" y2="${(peakY + 4).toFixed(1)}" stroke="#f5c84c" stroke-width="2"/>`;
    }

    let axisLabels = '';
    if (data.length > 1) {
      const step = Math.max(1, Math.floor(data.length / 5));
      for (let i = 0; i < data.length; i += step) {
        const label = String(data[i].t.date || '').slice(5);
        axisLabels += `<text x="${x(i).toFixed(1)}" y="${H + 10}" text-anchor="middle" font-size="7" fill="#5c6259">${esc(label)}</text>`;
      }
    }

    const points = data
      .map(
        (d, i) =>
          `<circle cx="${x(i).toFixed(1)}" cy="${y(d.cum).toFixed(1)}" r="3" fill="${color}" opacity="0.55" data-chart-idx="${i}"/>`
      )
      .join('');

    svg.innerHTML = `
      <line x1="0" y1="${zeroY.toFixed(1)}" x2="340" y2="${zeroY.toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="3,4"/>
      <path d="${areaPath}" fill="${color}" opacity="0.06"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${ddArea}${points}
      <circle cx="${curX.toFixed(1)}" cy="${curY.toFixed(1)}" r="4.5" fill="${color}" stroke="#07080a" stroke-width="2"/>
      ${axisLabels}`;

    endEl.textContent = isSportOnly
      ? `${endVal > 0 ? '+' : ''}${endVal} pts`
      : proMode
        ? fmtMoneyUSD(endVal / RATE)
        : fmtMoney(endVal);
    endEl.className = 'mt-pro-chart-end ' + (endVal >= 0 ? 'pos' : 'neg');
    tip.style.opacity = 0;
  }

  function showChartTooltip(idx) {
    const d = chartData[idx];
    const tip = $('mtChartTip');
    if (!d) {
      tip.style.opacity = 0;
      return;
    }
    tip.innerHTML = `
      <div style="font-weight:700;margin-bottom:2px">${esc(d.date)}</div>
      <div style="color:#888;font-size:8px">${esc(d.venue)} · ${esc(d.name)}</div>
      <div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px;font-size:9px">
        <span>${d.isSport ? 'Points' : 'Результат'}: <strong>${d.isSport ? d.val + ' pts' : proMode ? fmtMoneyUSD(d.val / RATE) : fmtMoney(d.val)}</strong></span>
        <span>Место: <strong>${d.place}${d.field ? '/' + d.field : ''}</strong></span>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,.08);margin-top:3px;padding-top:3px;font-size:8px;color:#888">
        Кумулятивно: ${d.isSport ? d.cum + ' pts' : proMode ? fmtMoneyUSD(d.cum / RATE) : fmtMoney(d.cum)}
      </div>`;
    tip.style.opacity = 1;
    tip.style.left = '12px';
    tip.style.top = '8px';
  }

  function renderBuckets(arr) {
    const m = moneyList(arr);
    const grid = $('mtBucketsGrid');
    const hint = $('mtBuyinHint');
    if (!grid) return;
    const countEl = $('mtBucketsCount');
    if (countEl) countEl.textContent = `(${m.length} тур.)`;
    if (!proMode) {
      grid.innerHTML = '';
      if (hint) hint.style.display = 'block';
      return;
    }
    if (hint) hint.style.display = 'none';
    grid.innerHTML = BUCKETS.map((b, idx) => {
      const prev = idx > 0 ? BUCKETS[idx - 1].max : 0;
      const filtered = m.filter((t) => buyinRub(t) > prev && buyinRub(t) <= b.max);
      const inv = filtered.reduce((s, t) => s + investedRub(t), 0);
      const ret = filtered.reduce((s, t) => s + totalReturnedRub(t), 0);
      const net = ret - inv;
      const roi = inv ? Math.round((net / inv) * 1000) / 10 : null;
      const ids = filtered.map((t) => String(t.id)).join('|');
      const lowData = filtered.length < 2 || !inv;
      const roiHtml = lowData
        ? '<span class="mt-pro-bucket-low">мало данных</span>'
        : `<span class="mt-pro-bucket-roi ${roi >= 0 ? 'pos' : 'neg'}">${roi >= 0 ? '+' : ''}${roi}%</span>`;
      const profitHtml = lowData
        ? ''
        : `<span class="mt-pro-bucket-profit ${net >= 0 ? 'pos' : 'neg'}">${proMode ? fmtMoneyUSD(net / RATE) : fmtMoney(net)}</span>`;
      return `<div class="mt-pro-bucket-row ${lowData ? 'dim' : ''}" data-mt="bar-detail" data-title="${esc(b.label)}" data-ids="${esc(ids)}">
        <span class="mt-pro-bucket-dot ${b.tier}"></span>
        <span class="mt-pro-bucket-name">${b.label}</span>
        <span class="mt-pro-bucket-count">${filtered.length} тур.</span>
        ${roiHtml}
        ${profitHtml}
      </div>`;
    }).join('');
  }

  function renderRollingROI(arr) {
    const m = moneyList(arr).slice().sort((a, b) => dateSortKey(b) - dateSortKey(a));
    $('mtRollingGrid').innerHTML = WINDOWS.map((w) => {
      const slice = m.slice(0, Math.min(w, m.length));
      const inv = slice.reduce((s, t) => s + investedRub(t), 0);
      const ret = slice.reduce((s, t) => s + totalReturnedRub(t), 0);
      const roi = inv ? Math.round(((ret - inv) / inv) * 1000) / 10 : null;
      const net = ret - inv;
      return `<div class="mt-pro-roll">
        <div class="lbl">последние ${Math.min(w, m.length)}</div>
        <div class="val ${roi === null ? 'neutral' : roi >= 0 ? 'pos' : 'neg'}">${roi === null ? '—' : (roi >= 0 ? '+' : '') + roi + '%'}</div>
        <div class="lbl">${proMode ? fmtMoneyUSD(net / RATE) : fmtMoney(net)}</div>
      </div>`;
    }).join('');
  }

  function conclusionCard(label, name, roi, extraCls) {
    if (!name) return '';
    const cls = roi === null ? 'neutral' : roi >= 0 ? 'pos' : 'neg';
    const val = roi === null ? '—' : `${roi >= 0 ? '+' : ''}${roi}%`;
    return `<div class="mt-pro-conclusion ${extraCls || ''}">
      <div class="mt-pro-conclusion-lbl">${label}</div>
      <div class="mt-pro-conclusion-name">${esc(name)}</div>
      <div class="mt-pro-conclusion-val ${cls}">ROI ${val}</div>
    </div>`;
  }

  function renderInsights(arr) {
    const grid = $('mtInsightsGrid');
    const warning = $('mtInsightWarning');
    const m = moneyList(arr);
    const n = m.length;
    if (!grid) return;
    if (n === 0) {
      grid.innerHTML = '';
      if (warning) warning.style.display = 'none';
      return;
    }

    const groups = groupBy(m, (t) => fmtDisplay(t));
    typeData = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    const formatStats = typeData
      .map(([fmt, items]) => ({ fmt, ...groupRoi(items) }))
      .filter((x) => x && x.n >= 2 && x.roi !== null);
    const bestFmt = formatStats.length ? formatStats.reduce((a, b) => (a.roi > b.roi ? a : b)) : null;
    const worstFmt = formatStats.length ? formatStats.reduce((a, b) => (a.roi < b.roi ? a : b)) : null;

    const venueGroups = Object.entries(groupBy(m, (t) => displayVenue(t)))
      .map(([name, items]) => ({ name, ...groupRoi(items) }))
      .filter((x) => x && x.n >= 2 && x.roi !== null);
    const bestVenue = venueGroups.length ? venueGroups.reduce((a, b) => (a.roi > b.roi ? a : b)) : null;

    const sorted = m.slice().sort((a, b) => dateSortKey(b) - dateSortKey(a));
    let trendHtml = '';
    if (sorted.length >= 6) {
      const last5 = groupRoi(sorted.slice(0, 5));
      const prev5 = groupRoi(sorted.slice(5, 10));
      if (last5 && prev5) {
        const better = last5.roi > prev5.roi;
        trendHtml = `<div class="mt-pro-conclusion span2">
          <div class="mt-pro-conclusion-lbl">ТРЕНД</div>
          <div class="mt-pro-conclusion-name">${better ? 'Последние 5 турниров лучше предыдущих 5' : 'Последние 5 турниров слабее предыдущих 5'}</div>
          <div class="mt-pro-conclusion-val ${better ? 'pos' : 'neg'}">${last5.roi >= 0 ? '+' : ''}${last5.roi}% vs ${prev5.roi >= 0 ? '+' : ''}${prev5.roi}%</div>
        </div>`;
      }
    }

    grid.innerHTML =
      conclusionCard('ЛУЧШИЙ ФОРМАТ', bestFmt?.fmt, bestFmt?.roi ?? null, 'highlight') +
      conclusionCard('СЛАБОЕ МЕСТО', worstFmt && worstFmt.fmt !== bestFmt?.fmt ? worstFmt.fmt : null, worstFmt?.roi ?? null, 'weak') +
      conclusionCard('ЛУЧШАЯ ПЛОЩАДКА', bestVenue?.name, bestVenue?.roi ?? null) +
      trendHtml;

    const totalInv = m.reduce((s, t) => s + investedRub(t), 0);
    const totalRet = m.reduce((s, t) => s + totalReturnedRub(t), 0);
    const totalRoi = totalInv ? Math.round(((totalRet - totalInv) / totalInv) * 1000) / 10 : null;
    if (warning && totalRoi !== null && totalRoi > 10 && n < 200 && n > 0) {
      const needed = Math.max(0, Math.round(350 * (1 - n / 350)));
      $('mtWarningText').textContent = `ROI ${totalRoi > 0 ? '+' : ''}${totalRoi}% — сыграно ${n} тур. Для достоверности нужно ~${needed} тур.`;
      warning.style.display = 'flex';
    } else if (warning) {
      warning.style.display = 'none';
    }
  }

  function renderSplit(arr) {
    const off = moneyList(arr).filter((t) => cat(t) === 'offline');
    const on = moneyList(arr).filter((t) => cat(t) === 'online');
    const calc = (items) => {
      const inv = items.reduce((s, t) => s + investedRub(t), 0);
      const ret = items.reduce((s, t) => s + totalReturnedRub(t), 0);
      const roi = inv ? Math.round(((ret - inv) / inv) * 1000) / 10 : null;
      return { roi, n: items.length };
    };
    const o = calc(off);
    const n = calc(on);
    $('mtSplitCard').innerHTML = `
      <div class="mt-pro-split-item"><div class="lbl">Офлайн</div><div class="roi ${o.roi === null ? '' : o.roi >= 0 ? 'pos' : 'neg'}">${o.roi === null ? '—' : (o.roi >= 0 ? '+' : '') + o.roi + '%'}</div><div class="meta">${o.n} тур.</div></div>
      <div class="mt-pro-split-div"></div>
      <div class="mt-pro-split-item"><div class="lbl">Онлайн</div><div class="roi ${n.roi === null ? '' : n.roi >= 0 ? 'pos' : 'neg'}">${n.roi === null ? '—' : (n.roi >= 0 ? '+' : '') + n.roi + '%'}</div><div class="meta">${n.n} тур.</div></div>`;
  }

  function renderBarList(el, entries, isSportOnly) {
    if (entries.length === 0) {
      el.innerHTML = '<div style="font-size:11px;color:#888;padding:6px 2px">Нет данных</div>';
      return;
    }
    el.innerHTML = entries
      .map(([name, items]) => {
        if (isSportOnly) {
          const total = items.reduce((s, t) => s + num(t.points), 0);
          const avg = items.length ? Math.round(total / items.length) : 0;
          return `<div class="mt-pro-bar"><div class="mt-pro-bar-top"><div class="mt-pro-bar-name">${esc(name)}</div><div class="mt-pro-bar-roi pos">${total} pts</div></div><div class="mt-pro-bar-foot"><span>${items.length} тур.</span><span>ср. ${avg} pts</span></div></div>`;
        }
        const inv = items.reduce((s, t) => s + investedRub(t), 0);
        const ret = items.reduce((s, t) => s + totalReturnedRub(t), 0);
        const roi = inv ? Math.round(((ret - inv) / inv) * 1000) / 10 : 0;
        const pct = Math.min(50, Math.abs(roi));
        const ids = items.map((t) => String(t.id)).join('|');
        return `<div class="mt-pro-bar" data-mt="bar-detail" data-title="${esc(name)}" data-ids="${esc(ids)}">
          <div class="mt-pro-bar-top"><div class="mt-pro-bar-name">${esc(name)}</div><div class="mt-pro-bar-roi ${roi >= 0 ? 'pos' : 'neg'}">${roi >= 0 ? '+' : ''}${roi}%</div></div>
          <div class="mt-pro-bar-track"><div class="mt-pro-bar-mid"></div><div class="mt-pro-bar-fill ${roi >= 0 ? 'pos' : 'neg'}" style="width:${pct}%"></div></div>
          <div class="mt-pro-bar-foot"><span>${items.length} тур.</span><span>${proMode ? fmtMoneyUSD((ret - inv) / RATE) : fmtMoney(ret - inv)}</span></div>
        </div>`;
      })
      .join('');
  }

  function renderFormatBreakdown(arr, isSportOnly) {
    const src = isSportOnly ? sportOnlyList(arr) : moneyList(arr);
    const groups = groupBy(src, (t) => fmtDisplay(t));
    $('mtFormatN').textContent = `(${Object.keys(groups).length})`;
    renderBarList($('mtFormatList'), Object.entries(groups), isSportOnly);
  }

  function renderVenueBreakdown(arr, isSportOnly) {
    const src = isSportOnly ? sportOnlyList(arr) : moneyList(arr);
    const groups = groupBy(src, (t) => venue(t));
    const entries = Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);
    renderBarList($('mtVenueList'), entries, isSportOnly);
  }

  function cardHtml(t) {
    const isSport = cat(t) === 'sport';
    const p = profitRub(t);
    const win = isSport ? num(t.points) > 0 : p > 0;
    const badgeLabel = cat(t) === 'offline' ? 'ОФЛ' : cat(t) === 'online' ? 'ОНЛ' : 'СПОРТ';
    const resHtml = isSport
      ? `<div class="mt-pro-card-result pts">${fmtPts(num(t.points))}</div>`
      : `<div class="mt-pro-card-result ${p >= 0 ? 'pos' : 'neg'}">${proMode ? fmtMoneyUSD(p / RATE) : fmtMoney(p)}</div>`;
    const buyinTxt = isSport
      ? `${baseBuy(t).toLocaleString('ru-RU')} ${currency(t)}`
      : proMode
        ? '$' + (buyinRub(t) / RATE).toFixed(0)
        : buyinRub(t).toLocaleString('ru-RU') + ' ₽';
    const placeTxt = num(t.place) ? `${num(t.place)}${t.field ? '/' + num(t.field) : ''}` : '—';
    return `<div class="mt-pro-card ${win ? 'win' : ''}">
      <div class="mt-pro-card-row1">
        <div class="mt-pro-card-title">${esc(title(t))}</div>
        ${resHtml}
      </div>
      <div class="mt-pro-card-row2">
        <span class="mt-pro-card-meta">${fmtDateShort(t.date)} · ${esc(fmtDisplay(t))}</span>
      </div>
      <div class="mt-pro-card-row3">
        <span class="mt-pro-card-meta"><span class="mt-pro-badge ${cat(t)}">${badgeLabel}</span> · ${esc(venue(t))}</span>
      </div>
      <div class="mt-pro-card-row4">
        <span class="mt-pro-card-meta">${placeTxt}</span>
        <span class="mt-pro-card-buyin">BI ${buyinTxt}</span>
      </div>
      <div class="mt-pro-card-actions">
        <button type="button" data-mt="edit" data-id="${esc(t.id)}">Изменить</button>
        <span class="mt-pro-card-actions-sep">/</span>
        <button type="button" class="danger" data-mt="delete" data-id="${esc(t.id)}">Удалить</button>
      </div>
    </div>`;
  }

  function renderRecentHistory(arr) {
    const el = $('mtList');
    const empty = $('mtEmpty');
    const showAllBtn = $('mtShowAllBtn');
    if (arr.length === 0) {
      el.innerHTML = '';
      el.style.display = 'none';
      showAllBtn.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    el.style.display = 'flex';
    const recent = arr.slice(0, RECENT_LIMIT);
    el.innerHTML = recent.map(cardHtml).join('');
    showAllBtn.style.display = arr.length > RECENT_LIMIT ? 'block' : 'none';
  }

  function renderFullHistory(arr) {
    const el = $('mtFullList');
    if (!el) return;
    $('mtListCount').textContent = `(${arr.length})`;
    if (arr.length === 0) {
      el.innerHTML = '<div class="mt-pro-summary-empty" style="padding:12px 0">Нет турниров в этом фильтре</div>';
      return;
    }
    el.innerHTML = arr.map(cardHtml).join('');
  }

  function renderMain() {
    renderFilters();
    const arr = filteredForMain();
    const hasSportOnly = arr.length > 0 && arr.every((t) => cat(t) === 'sport');
    renderCompactSummary(arr, hasSportOnly);
    if (!hasSportOnly) renderHeroInsight(arr);
    else $('mtHeroInsight').style.display = 'none';
    renderChart(arr, hasSportOnly);
    renderRecentHistory(arr);
  }

  function renderAnalytics() {
    ensureAnalyticsDom();
    renderFilters();
    renderAnalyticsTabBar();
    showAnalyticsPanel();
    const arr = filtered();
    const isSportOnly = typeFilter === 'sport';
    $('mtInsightsSection').style.display = isSportOnly ? 'none' : '';
    $('mtSplitSection').style.display = isSportOnly ? 'none' : '';

    if (analyticsTab === 'overview') {
      renderStats(arr, isSportOnly);
      if (!isSportOnly) {
        renderInsights(arr);
        renderSplit(arr);
        if (proMode) renderRollingROI(arr);
      }
      renderFullHistory(arr);
    } else if (analyticsTab === 'buyin') {
      if (!isSportOnly) renderBuckets(arr);
      else $('mtBucketsGrid').innerHTML = '<div class="mt-pro-tab-hint">Спортивный режим — ROI по бай-инам недоступен.</div>';
    } else if (analyticsTab === 'formats') {
      renderFormatBreakdown(arr, isSportOnly);
    } else if (analyticsTab === 'venues') {
      $('mtVenueTitle').textContent = isSportOnly ? 'ПО КЛУБАМ' : 'ПО ПЛОЩАДКАМ';
      renderVenueBreakdown(arr, isSportOnly);
    }
  }

  function render() {
    ensureDom();
    $('mtChartTip').style.opacity = 0;
    renderMain();
    if (analyticsOpen) renderAnalytics();
  }

  function showDetailList(idKeys, detailTitle) {
    const keySet = new Set(idKeys.map(String));
    const items = list().filter((t) => keySet.has(String(t.id)));
    if (!items.length) return;
    let html = `<div class="mt-pro-detail-title">${esc(detailTitle)} · ${items.length} тур.</div>`;
    items.slice(0, 20).forEach((t) => {
      const p = profitRub(t);
      html += `<div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);gap:8px">
        <span style="color:#888;min-width:0">${esc(String(t.date || '').slice(5))} · ${esc(title(t))}</span>
        <span style="color:${cat(t) === 'sport' ? '#f5c84c' : p >= 0 ? '#c8ff3d' : '#ff6b5b'};font-weight:700;flex-shrink:0">${cat(t) === 'sport' ? fmtPts(num(t.points)) : proMode ? fmtMoneyUSD(p / RATE) : fmtMoney(p)}</span></div>`;
    });
    if (items.length > 20) html += `<div style="color:#888;font-size:8px;padding:4px 0">+ ещё ${items.length - 20} турниров</div>`;
    document.getElementById('mtProDetailBody').innerHTML = html;
    DETAIL_OVERLAY.classList.add('on');
    DETAIL.classList.add('on');
  }

  function closeDetail() {
    DETAIL_OVERLAY.classList.remove('on');
    DETAIL.classList.remove('on');
  }

  function showTypeList() {
    if (!typeData.length) return;
    let html = '<div class="mt-pro-detail-title">Все турниры по типам</div>';
    typeData.forEach(([fmt, items]) => {
      html += `<div style="margin-bottom:10px"><div style="font-weight:700;font-size:12px">${esc(fmt)} <span style="color:#888;font-weight:400;font-size:10px">${items.length} тур.</span></div>`;
      items.slice(0, 8).forEach((t) => {
        const p = profitRub(t);
        html += `<div style="display:flex;justify-content:space-between;font-size:10px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)">
          <span style="color:#888">${esc(venue(t))} · ${esc(title(t))}</span>
          <span style="color:${p >= 0 ? '#c8ff3d' : '#ff6b5b'};font-weight:700">${proMode ? fmtMoneyUSD(p / RATE) : fmtMoney(p)}</span></div>`;
      });
      if (items.length > 8) html += `<div style="color:#888;font-size:8px">+ ещё ${items.length - 8}</div>`;
      html += '</div>';
    });
    document.getElementById('mtProDetailBody').innerHTML = html;
    DETAIL_OVERLAY.classList.add('on');
    DETAIL.classList.add('on');
  }

  /* ── Form / CRUD ── */
  const SHEET = () => document.getElementById('mtProSheet');

  function openSheet() {
    editingId = null;
    addType = null;
    selCurr = 'RUB';
    MODAL.classList.add('on');
    renderSheetShell();
  }

  function closeSheet() {
    MODAL.classList.remove('on');
    addType = null;
    editingId = null;
  }

  function renderSheetShell() {
    SHEET().innerHTML = `
      <div class="mt-pro-sheet-handle"></div>
      <div class="mt-pro-sheet-title"><span id="mtSheetTitle">Добавить турнир</span><button type="button" class="mt-pro-sheet-close" data-mt="sheet-close">✕</button></div>
      <div class="mt-pro-choice">
        <button type="button" id="mtChoiceOffline" data-mt="pick-type" data-val="offline">Офлайн</button>
        <button type="button" id="mtChoiceOnline" data-mt="pick-type" data-val="online">Онлайн</button>
        <button type="button" id="mtChoiceSport" data-mt="pick-type" data-val="sport">Спорт</button>
      </div>
      <div class="mt-pro-fields" id="mtSheetFields"></div>`;
    SHEET().querySelector('[data-mt="sheet-close"]').addEventListener('click', closeSheet);
    SHEET().querySelectorAll('[data-mt="pick-type"]').forEach((b) => {
      b.addEventListener('click', () => selectAddType(b.dataset.val));
    });
  }

  function mapFormatToSave(fmtVal) {
    if (fmtVal === 'PKO' || fmtVal === 'Mystery Bounty') return 'PKO';
    if (fmtVal === 'PLO') return 'PLO';
    if (fmtVal === 'SNG') return 'SNG';
    return 'NLH';
  }

  function mapFormatFromRecord(t) {
    const d = fmtDisplay(t);
    if (d === 'PKO' || d === 'Mystery Bounty') return d;
    if (d === 'SNG') return 'SNG';
    if (d === 'PLO') return 'PLO';
    return 'MTT';
  }

  function selectAddType(type, old) {
    addType = type;
    ['Offline', 'Online', 'Sport'].forEach((s) => {
      const el = document.getElementById('mtChoice' + s);
      if (!el) return;
      const val = s.toLowerCase();
      el.className = addType === val ? 'sel ' + val : '';
    });
    const fields = document.getElementById('mtSheetFields');
    const vLabel = type === 'offline' ? 'Клуб' : type === 'online' ? 'Рум' : 'Клуб';
    const vPh = type === 'offline' ? 'Название клуба' : type === 'online' ? 'PokerOK, PokerDom...' : 'Название клуба';
    const rec = old || {};
    const fmtVal = old ? mapFormatFromRecord(old) : 'MTT';
    const cur = old ? currency(old) : selCurr;
    selCurr = cur === 'EUR' ? 'RUB' : cur;

    fields.innerHTML = `
      <div class="mt-pro-field"><label>Дата</label><input type="date" id="mtFDate" value="${esc(rec.date || new Date().toISOString().slice(0, 10))}"></div>
      <div class="mt-pro-field"><label>Валюта</label><div class="mt-pro-curr-row">
        <button type="button" class="mt-pro-curr-btn ${selCurr === 'RUB' ? 'sel' : ''}" data-mt="curr" data-val="RUB">₽ RUB</button>
        <button type="button" class="mt-pro-curr-btn ${selCurr === 'USD' ? 'sel' : ''}" data-mt="curr" data-val="USD">$ USD</button>
      </div></div>
      <div class="mt-pro-field"><label>${vLabel}</label><input type="text" id="mtFVenue" value="${esc(rec.clubOrRoom || rec.club || rec.room || '')}" placeholder="${esc(vPh)}"></div>
      <div class="mt-pro-field"><label>Название турнира</label><input type="text" id="mtFName" value="${esc(rec.tournamentName || rec.name || '')}" placeholder="Daily Main Event"></div>
      <div class="mt-pro-field"><label>Тип турнира</label><select id="mtFFmt">
        <option value="MTT" ${fmtVal === 'MTT' ? 'selected' : ''}>Regular (MTT)</option>
        <option value="PKO" ${fmtVal === 'PKO' ? 'selected' : ''}>PKO / Bounty</option>
        <option value="Mystery Bounty" ${fmtVal === 'Mystery Bounty' ? 'selected' : ''}>Mystery Bounty</option>
        <option value="SNG" ${fmtVal === 'SNG' ? 'selected' : ''}>SNG</option>
        <option value="PLO" ${fmtVal === 'PLO' ? 'selected' : ''}>PLO</option>
      </select></div>
      <div class="mt-pro-field-row">
        <div class="mt-pro-field"><label>Buy-in</label><input type="number" id="mtFBuyin" min="0" value="${old ? baseBuy(old) : ''}" placeholder="1500"></div>
        <div class="mt-pro-field"><label>Re-entry, шт</label><input type="number" id="mtFReentry" min="0" value="${old ? reentryCount(old) : 0}"></div>
      </div>
      <div class="mt-pro-field"><label>Стоимость re-entry</label><input type="number" id="mtFReentryCost" min="0" value="${old ? reentryCostVal(old) : ''}" placeholder="= buy-in + fee"></div>
      <div class="mt-pro-field-row">
        <div class="mt-pro-field"><label>Место</label><input type="number" id="mtFPlace" min="1" value="${old ? num(old.place) || '' : ''}" placeholder="3"></div>
        <div class="mt-pro-field"><label>Участников</label><input type="number" id="mtFField" min="0" value="${old && old.field ? num(old.field) : ''}" placeholder="необязательно"></div>
      </div>
      ${type !== 'sport' ? `<div class="mt-pro-field"><label>Призовые / Cash</label><input type="number" id="mtFCash" min="0" value="${old ? num(old.prize) : 0}"></div>
      <div class="mt-pro-field"><label>Получено bounty</label><input type="number" id="mtFBounty" min="0" value="${old ? num(old.bountyWon) : 0}"></div>` : `<div class="mt-pro-field"><label>Получено points</label><input type="number" id="mtFPoints" min="0" value="${old ? num(old.points) : ''}" placeholder="180"></div>`}
      <details class="mt-pro-advanced"><summary>Детали (fee, add-on, bounty contribution)</summary><div class="mt-pro-advanced-body">
        <div class="mt-pro-field-row">
          <div class="mt-pro-field"><label>Bounty contribution</label><input type="number" id="mtFBC" min="0" value="${old ? num(old.bountyContribution) : 0}"></div>
          <div class="mt-pro-field"><label>Fee / комиссия</label><input type="number" id="mtFFee" min="0" value="${old ? num(old.fee) : 0}"></div>
        </div>
        <div class="mt-pro-field"><label>Add-on</label><input type="number" id="mtFAddOn" min="0" value="${old ? num(old.addOn) : 0}"></div>
      </div></details>
      <div class="mt-pro-field"><label>Заметка</label><input type="text" id="mtFNote" maxlength="100" value="${esc(rec.note || '')}" placeholder="Баббл-колл, ошибка..."></div>
      <div class="mt-pro-form-errors" id="mtFormErrors"></div>
      <button type="button" class="mt-pro-save" data-mt="save">${editingId ? '✎ Сохранить изменения' : '+ Добавить турнир'}</button>`;

    fields.querySelectorAll('[data-mt="curr"]').forEach((b) => {
      b.addEventListener('click', () => {
        selCurr = b.dataset.val;
        fields.querySelectorAll('[data-mt="curr"]').forEach((x) => x.classList.toggle('sel', x === b));
      });
    });
    fields.querySelector('[data-mt="save"]').addEventListener('click', saveTournament);
    if (editingId) document.getElementById('mtSheetTitle').textContent = '✎ Редактировать турнир';
  }

  function validateForm() {
    const errs = [];
    const place = num(document.getElementById('mtFPlace')?.value);
    const field = num(document.getElementById('mtFField')?.value);
    const reentry = num(document.getElementById('mtFReentry')?.value);
    if (place < 1) errs.push('Место >= 1');
    if (field > 0 && place > field) errs.push('Место ≤ поле');
    if (reentry < 0) errs.push('Re-entry ≥ 0');
    document.getElementById('mtFormErrors').textContent = errs.join(' · ');
    return errs.length === 0;
  }

  function saveTournament() {
    if (!addType) {
      selectAddType('offline');
      return;
    }
    if (!validateForm()) return;
    const g = (id) => document.getElementById(id);
    const name = g('mtFName').value.trim();
    if (!name) {
      g('mtFName').focus();
      return;
    }
    const buyin = Math.max(0, num(g('mtFBuyin').value));
    const reentry = Math.max(0, Math.round(num(g('mtFReentry').value)));
    const reentryCost = Math.max(0, num(g('mtFReentryCost').value) || buyin + num(g('mtFFee')?.value));
    const fmtVal = g('mtFFmt').value;
    const old = editingId ? list().find((t) => String(t.id) === String(editingId)) : null;

    const rec = {
      ...(old || {}),
      id: old?.id || 'mt_' + Date.now(),
      type: addType,
      format: mapFormatToSave(fmtVal),
      tournamentName: name,
      name,
      clubOrRoom: g('mtFVenue').value.trim(),
      date: g('mtFDate').value,
      currency: selCurr,
      baseBuyin: buyin,
      buyin,
      bountyContribution: Math.max(0, num(g('mtFBC')?.value)),
      fee: Math.max(0, num(g('mtFFee')?.value)),
      entries: reentry + 1,
      reentryCost,
      addOn: Math.max(0, num(g('mtFAddOn')?.value)),
      place: Math.max(0, Math.round(num(g('mtFPlace').value))),
      field: Math.max(0, Math.round(num(g('mtFField').value))) || undefined,
      note: g('mtFNote').value.trim(),
      updatedAt: Date.now(),
      createdAt: old?.createdAt || Date.now()
    };

    if (addType === 'sport') {
      rec.points = Math.max(0, num(g('mtFPoints')?.value));
      rec.prize = 0;
      rec.bountyWon = 0;
    } else {
      rec.prize = Math.max(0, num(g('mtFCash')?.value));
      rec.bountyWon = Math.max(0, num(g('mtFBounty')?.value));
      rec.points = undefined;
    }

    state().tournaments = list().filter((t) => String(t.id) !== String(rec.id));
    state().tournaments.push(rec);
    persist();
    closeSheet();
    render();
    showToast(editingId ? 'Турнир обновлён ✓' : 'Турнир добавлен ✓');
  }

  function editTournament(id) {
    const t = list().find((x) => String(x.id) === String(id));
    if (!t) return;
    editingId = t.id;
    addType = cat(t);
    selCurr = currency(t);
    MODAL.classList.add('on');
    renderSheetShell();
    selectAddType(addType, t);
    document.getElementById('mtSheetTitle').textContent = '✎ Редактировать турнир';
  }

  function deleteTournament(id) {
    if (!confirm('Удалить турнир?')) return;
    state().tournaments = list().filter((t) => String(t.id) !== String(id));
    persist();
    render();
    showToast('Турнир удалён');
  }

  function exportCSV() {
    const headers = [
      'Дата', 'Категория', 'Рум/Клуб', 'Название', 'Формат', 'Валюта', 'Buy-in', 'Re-entry', 'Re-entry Cost',
      'Fee', 'Add-on', 'Bounty Contribution', 'Место', 'Поле', 'Призовые', 'Баунти', 'Points', 'Profit (RUB)', 'Profit (USD)', 'ITM', 'Заметка'
    ];
    const rows = filtered().map((t) => {
      const p = cat(t) === 'sport' ? 0 : profitRub(t);
      return [
        t.date || '',
        cat(t),
        venue(t),
        title(t),
        fmtDisplay(t),
        currency(t),
        baseBuy(t),
        reentryCount(t),
        reentryCostVal(t),
        num(t.fee),
        num(t.addOn),
        num(t.bountyContribution),
        num(t.place),
        num(t.field) || '',
        num(t.prize),
        num(t.bountyWon),
        num(t.points),
        cat(t) === 'sport' ? '' : p,
        cat(t) === 'sport' ? '' : Math.round(p / RATE),
        cat(t) === 'sport' ? '' : isITM(t) ? 'Да' : 'Нет',
        t.note || ''
      ];
    });
    let csv = headers.join(',') + '\n';
    rows.forEach((row) => {
      csv += row.map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v)).join(',') + '\n';
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'poker_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV выгружен');
  }

  function openScreen() {
    ensureDom();
    if (typeof window.show === 'function') window.show('mytournaments');
    SCREEN.classList.add('on');
    SCREEN.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = '';
    render();
  }

  function closeScreen() {
    SCREEN.classList.remove('on');
    SCREEN.setAttribute('aria-hidden', 'true');
    MODAL?.classList.remove('on');
    closeAnalytics();
    closeDetail();
    document.body.style.overflow = '';
  }

  function routeCapture(e) {
    const btn = e.target?.closest?.('.nav [data-nav="mytournaments"]');
    if (btn) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      openScreen();
      return;
    }
    const other = e.target?.closest?.('.nav [data-nav]');
    if (other && SCREEN?.classList.contains('on')) closeScreen();
  }

  ensureDom();
  window.addEventListener('pointerdown', routeCapture, true);
  window.addEventListener('touchstart', routeCapture, true);
  window.addEventListener('click', routeCapture, true);

  window.openMyTournamentsV71 = openScreen;
  window.openMyTournamentsV72 = openScreen;
  window.MtProTournaments = { render, openScreen, closeScreen };
  window.POKER_SWIPE_BUILD = 'MT-PRO-TOURNAMENTS';
})();
