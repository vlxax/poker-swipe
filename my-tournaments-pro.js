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
  let formAddOn = false;
  let formBounty = false;
  let polyanaClubs = [];
  let polyanaClubsLoading = false;
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

  const addOnInvestedRub = (t) => {
    if (t.addOnEnabled || num(t.addOnCount) > 0) {
      return num(t.addOnCount) * num(t.addOnCost || 0);
    }
    return num(t.addOn);
  };

  const investedRub = (t) => {
    if (cat(t) === 'sport') {
      let inv = baseBuy(t) + reentryCostVal(t) * reentryCount(t) + addOnInvestedRub(t);
      if (t.bountyEnabled) inv += num(t.bountyValue) * Math.max(1, num(t.bountyCount) || 1);
      return toRub(t, inv);
    }
    return toRub(t, unitCost(t) * entries(t) + addOnInvestedRub(t));
  };

  const totalReturnedRub = (t) => {
    if (cat(t) === 'sport') return 0;
    return toRub(t, num(t.prize) + num(t.bountyWon));
  };

  const profitRub = (t) => {
    if (cat(t) === 'sport') return 0;
    return totalReturnedRub(t) - investedRub(t);
  };

  const sportPoints = (t) => (cat(t) === 'sport' ? num(t.points) : 0);

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

  const fmtCompactMoney = (n, useUsd) => {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    const abs = Math.abs(n);
    if (useUsd) {
      if (abs >= 1000) return sign + (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return sign + '$' + Math.round(abs).toLocaleString('en-US');
    }
    if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 10_000) return sign + (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return sign + Math.round(abs).toLocaleString('ru-RU');
  };

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

  const sportStats = (sp) => {
    const withPlace = sp.filter((t) => num(t.place) > 0);
    const withField = sp.filter((t) => num(t.field) > 0);
    const places = withPlace.map((t) => num(t.place));
    const fields = withField.map((t) => num(t.field));
    const avgPlace = places.length
      ? Math.round((places.reduce((a, b) => a + b, 0) / places.length) * 10) / 10
      : null;
    const bestPlace = places.length ? Math.min(...places) : null;
    const avgField = fields.length ? Math.round(fields.reduce((a, b) => a + b, 0) / fields.length) : null;
    const top3 = places.filter((p) => p <= 3).length;
    const top10 = places.filter((p) => p <= 10).length;
    const withPts = sp.filter((t) => num(t.points) !== 0);
    const totalPts = withPts.reduce((s, t) => s + num(t.points), 0);
    return { n: sp.length, avgPlace, bestPlace, avgField, top3, top10, totalPts, hasPoints: withPts.length > 0 };
  };

  const moneyAgg = (m) => {
    if (!m.length) return { n: 0, net: 0, roi: null, itmPct: 0 };
    const totalInv = m.reduce((s, t) => s + investedRub(t), 0);
    const totalRet = m.reduce((s, t) => s + totalReturnedRub(t), 0);
    const net = totalRet - totalInv;
    const roi = totalInv ? Math.round((net / totalInv) * 1000) / 10 : null;
    const itmPct = Math.round((m.filter(isITM).length / m.length) * 100);
    return { n: m.length, net, roi, itmPct };
  };

  const summaryItem = (k, v, cls = '') =>
    `<div class="mt-pro-summary-item"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`;

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
    const layoutVer = 'v-final';
    const shell = SCREEN.querySelector('.mt-pro');
    if (!shell || shell.dataset.mtLayout !== layoutVer) {
      if (shell) SCREEN.innerHTML = '';
      SCREEN.innerHTML = `<div class="mt-pro" data-mt-layout="${layoutVer}">
        <div class="mt-pro-glow"></div>
        <div class="mt-pro-brand" id="mtProBrand">
          <span class="mt-pro-brand-logo">POKER SWIPE</span>
          <span class="mt-pro-brand-by">ФРИКОВАЯ ДАМА</span>
        </div>
        <div class="mt-pro-head mt-pro-hero">
          <div class="mt-pro-head-copy">
            <h2>МОИ <em>ТУРНИРЫ</em></h2>
            <p class="mt-pro-sub">Трекер офлайна, онлайна и спорта</p>
          </div>
          <div class="mt-pro-actions">
            <button type="button" class="mt-pro-add" data-mt="add" aria-label="Добавить турнир">
              <span class="mt-pro-add-icon" aria-hidden="true">+</span>
              <span class="mt-pro-add-label">Добавить</span>
            </button>
          </div>
        </div>
        <div class="mt-pro-filters">
          <div class="mt-pro-filter-block">
            <div class="mt-pro-filter-label">ТИП</div>
            <div class="mt-pro-filter-row" id="mtMainTypeRow"></div>
          </div>
          <div class="mt-pro-filter-block">
            <div class="mt-pro-filter-label">ПЕРИОД</div>
            <div class="mt-pro-filter-row" id="mtPeriodRow"></div>
          </div>
        </div>
        <div class="mt-pro-summary" id="mtSummaryBlock"></div>
        <div class="mt-pro-hero-insight" id="mtHeroInsight" style="display:none">
          <div class="mt-pro-signal-label">ГЛАВНЫЙ СИГНАЛ</div>
          <div class="mt-pro-signal-body" id="mtHeroInsightText"></div>
          <div class="mt-pro-signal-val" id="mtHeroInsightVal"></div>
        </div>
        <div class="mt-pro-chart-wrap">
          <div class="mt-pro-chart-card">
            <div class="mt-pro-chart-head">
              <div class="mt-pro-chart-title" id="mtChartTitle">ДИНАМИКА ПРОФИТА</div>
              <div class="mt-pro-chart-end" id="mtChartEnd"></div>
            </div>
            <svg class="mt-pro-chart" id="mtChartSvg" viewBox="0 0 340 140" preserveAspectRatio="none"></svg>
            <div class="mt-pro-sport-history" id="mtSportHistory" style="display:none"></div>
            <div class="mt-pro-chart-tip" id="mtChartTip"></div>
          </div>
        </div>
        <div class="mt-pro-recent" id="mtRecentSection">
          <div class="mt-pro-list-head">
            <div class="mt-pro-list-title">ПОСЛЕДНИЕ ТУРНИРЫ</div>
            <span class="mt-pro-list-count" id="mtRecentCount"></span>
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
    if (!SCREEN.querySelector('#mtMainTypeRow')) {
      const filters = SCREEN.querySelector('.mt-pro-filters');
      if (filters) {
        const row = document.createElement('div');
        row.className = 'mt-pro-filter-row';
        row.id = 'mtMainTypeRow';
        filters.appendChild(row);
      }
    }
    if (!SCREEN.querySelector('#mtSportHistory')) {
      const chartCard = SCREEN.querySelector('.mt-pro-chart-card');
      if (chartCard && !chartCard.querySelector('#mtSportHistory')) {
        const hist = document.createElement('div');
        hist.className = 'mt-pro-sport-history';
        hist.id = 'mtSportHistory';
        hist.style.display = 'none';
        const tip = chartCard.querySelector('#mtChartTip');
        chartCard.insertBefore(hist, tip);
      }
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
    } else if (action === 'type') {
      typeFilter = t.dataset.val;
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

  function renderTypeChips() {
    return TYPES.map(([k, l]) => {
      let cls = 'mt-pro-chip';
      if (typeFilter === k) {
        cls += ' active';
        if (k === 'online') cls += ' type-online';
        if (k === 'sport') cls += ' type-sport';
      }
      return `<button type="button" class="${cls}" data-mt="type" data-val="${k}">${l}</button>`;
    }).join('');
  }

  function renderFilters() {
    $('mtPeriodRow').innerHTML = PERIODS.map(
      ([k, l]) =>
        `<button type="button" class="mt-pro-chip ${periodFilter === k ? 'active' : ''}" data-mt="period" data-val="${k}">${l}</button>`
    ).join('');
    const mainTypeRow = document.getElementById('mtMainTypeRow');
    if (mainTypeRow) mainTypeRow.innerHTML = renderTypeChips();
    const analyticsTypeRow = document.getElementById('mtTypeRow');
    if (analyticsTypeRow) analyticsTypeRow.innerHTML = renderTypeChips();
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
    document.getElementById('mtProAnalyticsBody')?.scrollTo(0, 0);
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

  function renderCompactSummary(arr, mode) {
    const el = $('mtSummaryBlock');
    const isSportOnly = mode === 'sport';
    const isAll = mode === 'all';

    if (isSportOnly) {
      const st = sportStats(sportOnlyList(arr));
      if (!st.n) {
        el.className = 'mt-pro-summary';
        el.innerHTML = `<div class="mt-pro-summary-empty">Нет спортивных турниров за выбранный период</div>`;
        return;
      }
      const items = [
        summaryItem('Сыграно', st.n),
        summaryItem('Среднее место', st.avgPlace ?? '—'),
        summaryItem('Лучшее место', st.bestPlace ?? '—'),
        summaryItem('Среднее поле', st.avgField ?? '—')
      ];
      if (st.top3 > 0) items.push(summaryItem('Top-3', st.top3));
      if (st.hasPoints) items.push(summaryItem('Points', (st.totalPts > 0 ? '+' : '') + st.totalPts, st.totalPts >= 0 ? 'pos' : 'neg'));
      el.className = 'mt-pro-summary cols-' + Math.min(items.length, 6);
      el.innerHTML = items.join('');
      return;
    }

    const m = moneyList(arr);
    if (!m.length && !isAll) {
      el.className = 'mt-pro-summary';
      el.innerHTML = `<div class="mt-pro-summary-empty">Нет турниров за выбранный период</div>`;
      return;
    }

    const agg = moneyAgg(m);

    if (isAll) {
      const sp = sportOnlyList(arr);
      const total = m.length + sp.length;
      if (!total) {
        el.className = 'mt-pro-summary';
        el.innerHTML = `<div class="mt-pro-summary-empty">Нет турниров за выбранный период</div>`;
        return;
      }
      const items = [
        summaryItem('Сыграно', total),
        summaryItem('Денежные', m.length),
        summaryItem('Спорт', sp.length)
      ];
      if (m.length) {
        items.push(
          summaryItem('Профит', proMode ? fmtMoneyUSD(agg.net / RATE) : fmtMoney(agg.net), agg.net >= 0 ? 'pos' : 'neg'),
          summaryItem('ROI', agg.roi === null ? '—' : (agg.roi >= 0 ? '+' : '') + agg.roi + '%', agg.roi === null ? 'neutral' : agg.roi >= 0 ? 'pos' : 'neg')
        );
      }
      el.className = 'mt-pro-summary cols-' + items.length;
      el.innerHTML = items.join('');
      return;
    }

    if (!m.length) {
      el.className = 'mt-pro-summary';
      el.innerHTML = `<div class="mt-pro-summary-empty">Нет турниров за выбранный период</div>`;
      return;
    }
    el.className = 'mt-pro-summary';
    const abi = Math.round(m.reduce((s, t) => s + buyinRub(t), 0) / m.length);
    el.innerHTML = `
      ${summaryItem('Профит', proMode ? fmtMoneyUSD(agg.net / RATE) : fmtMoney(agg.net), agg.net >= 0 ? 'pos' : 'neg')}
      ${summaryItem('ROI', agg.roi === null ? '—' : (agg.roi >= 0 ? '+' : '') + agg.roi + '%', agg.roi === null ? 'neutral' : agg.roi >= 0 ? 'pos' : 'neg')}
      ${summaryItem('ABI', proMode ? '$' + (abi / RATE).toFixed(0) : fmtCompactMoney(abi), 'neutral')}
      ${summaryItem('MTT', agg.n)}`;
  }

  function renderHeroInsight(arr) {
    const wrap = $('mtHeroInsight');
    const textEl = $('mtHeroInsightText');
    const valEl = $('mtHeroInsightVal');
    const m = moneyList(arr);
    if (m.length < 2 || typeFilter === 'sport' || !wrap || !textEl || !valEl) {
      if (wrap) wrap.style.display = 'none';
      return;
    }

    const channelProfit = (items) => items.reduce((s, t) => s + profitRub(t), 0);
    const offItems = m.filter((t) => cat(t) === 'offline');
    const onItems = m.filter((t) => cat(t) === 'online');
    const offProfit = channelProfit(offItems);
    const onProfit = channelProfit(onItems);
    const totalProfit = offProfit + onProfit;

    if (!totalProfit && offItems.length + onItems.length < 2) {
      wrap.style.display = 'none';
      return;
    }

    let headline = '';
    let detail = '';
    let signalVal = totalProfit;
    const absOff = Math.abs(offProfit);
    const absOn = Math.abs(onProfit);

    if (offItems.length >= 1 && onItems.length >= 1) {
      if (offProfit > 0 && onProfit <= 0) {
        headline = 'Оффлайн вытягивает период.';
        detail = 'Большая часть профита пришла из живых турниров.';
        signalVal = offProfit;
      } else if (onProfit > 0 && offProfit <= 0) {
        headline = 'Онлайн тянет результат.';
        detail = 'Виртуальные столы дают основной профит за выбранный период.';
        signalVal = onProfit;
      } else if (absOff >= absOn * 1.15) {
        headline = 'Оффлайн сильнее в деньгах.';
        detail = `Основной вклад — живые турниры (${offItems.length} MTT).`;
        signalVal = offProfit;
      } else if (absOn >= absOff * 1.15) {
        headline = 'Онлайн доминирует по профиту.';
        detail = `Больше всего заработано в румах (${onItems.length} MTT).`;
        signalVal = onProfit;
      } else {
        headline = 'Офлайн и онлайн близки по результату.';
        detail = 'Диверсификация работает — оба канала в плюсе.';
        signalVal = totalProfit;
      }
    } else if (offItems.length >= 2) {
      headline = totalProfit >= 0 ? 'Оффлайн в плюсе.' : 'Оффлайн в минусе.';
      detail = `${offItems.length} живых турниров за ${periodFilter === 'all' ? 'всё время' : periodLabel().toLowerCase()}.`;
      signalVal = offProfit;
    } else if (onItems.length >= 2) {
      headline = totalProfit >= 0 ? 'Онлайн в плюсе.' : 'Онлайн в минусе.';
      detail = `${onItems.length} онлайн-турниров за ${periodFilter === 'all' ? 'всё время' : periodLabel().toLowerCase()}.`;
      signalVal = onProfit;
    } else {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';
    textEl.innerHTML = `<strong>${headline}</strong> ${detail}`;
    valEl.className = 'mt-pro-signal-val ' + (signalVal >= 0 ? 'pos' : 'neg');
    valEl.textContent = proMode ? fmtMoneyUSD(signalVal / RATE) : fmtMoney(signalVal);
  }

  function renderStats(arr, isSportOnly) {
    const grid = $('mtStatGrid');
    const note = $('mtSampleNote');
    const addStats = $('mtAddStats');

    if (isSportOnly) {
      const st = sportStats(sportOnlyList(arr));
      if (!st.n) {
        grid.innerHTML =
          '<div class="mt-pro-stat" style="grid-column:span 2;text-align:center;color:var(--mt-muted)"><div class="val neutral">Нет спортивных турниров</div></div>';
        note.innerHTML = '';
        note.className = '';
        addStats.textContent = '';
        return;
      }
      let extra = '';
      if (st.top3 > 0) extra += `<div class="mt-pro-stat"><div class="lbl">Top-3</div><div class="val">${st.top3}</div></div>`;
      if (st.top10 > 0) extra += `<div class="mt-pro-stat"><div class="lbl">Top-10</div><div class="val">${st.top10}</div></div>`;
      if (st.hasPoints) {
        extra += `<div class="mt-pro-stat"><div class="lbl">Points</div><div class="val pos">${(st.totalPts > 0 ? '+' : '') + st.totalPts}</div><div class="sub">суммарно</div></div>`;
      }
      grid.innerHTML = `
        <div class="mt-pro-stat"><div class="lbl">Сыграно</div><div class="val">${st.n}</div></div>
        <div class="mt-pro-stat"><div class="lbl">Среднее место</div><div class="val">${st.avgPlace ?? '—'}</div></div>
        <div class="mt-pro-stat"><div class="lbl">Лучшее место</div><div class="val pos">${st.bestPlace ?? '—'}</div></div>
        <div class="mt-pro-stat"><div class="lbl">Среднее поле</div><div class="val">${st.avgField ?? '—'}</div></div>
        ${extra}`;
      note.innerHTML = `${st.n} спорт. турнир${st.n === 1 ? '' : st.n < 5 ? 'а' : 'ов'} — без денежной аналитики`;
      note.className = 'mt-pro-sample';
      addStats.textContent = '';
      return;
    }

    const m = moneyList(arr);
    const agg = moneyAgg(m);
    const n = agg.n;
    if (n === 0) {
      grid.innerHTML =
        '<div class="mt-pro-stat" style="grid-column:span 2;text-align:center;color:var(--mt-muted)"><div class="val neutral">Нет турниров</div></div>';
      note.innerHTML = '';
      addStats.textContent = '';
      return;
    }

    const totalInv = m.reduce((s, t) => s + investedRub(t), 0);
    const totalRet = m.reduce((s, t) => s + totalReturnedRub(t), 0);
    const net = agg.net;
    const roi = agg.roi;
    const itmPct = agg.itmPct;
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
    const histEl = $('mtSportHistory');
    const titleEl = $('mtChartTitle');
    const endEl = $('mtChartEnd');
    const tip = $('mtChartTip');

    if (isSportOnly) {
      titleEl.textContent = 'ИСТОРИЯ РЕЗУЛЬТАТОВ';
      svg.style.display = 'none';
      svg.innerHTML = '';
      if (histEl) histEl.style.display = '';
      tip.style.opacity = 0;
      chartData = [];

      const sp = sportOnlyList(arr).slice().sort((a, b) => dateSortKey(b) - dateSortKey(a));
      if (!sp.length) {
        if (histEl) histEl.innerHTML = '<div class="mt-pro-sport-history-empty">Нет спортивных турниров</div>';
        endEl.textContent = '';
        endEl.className = 'mt-pro-chart-end';
        return;
      }

      if (histEl) {
        histEl.innerHTML = sp
          .slice(0, 12)
          .map((t) => {
            const place = num(t.place);
            const field = num(t.field);
            const line = place ? `${place}${field ? '/' + field : ''}` : '—';
            return `<div class="mt-pro-sport-history-row">
              <span class="mt-pro-sport-history-date">${esc(fmtDateShort(t.date))}</span>
              <span class="mt-pro-sport-history-place">${line}</span>
              <span class="mt-pro-sport-history-name">${esc(title(t))}</span>
            </div>`;
          })
          .join('');
      }

      const st = sportStats(sp);
      endEl.textContent = st.bestPlace ? `лучшее: ${st.bestPlace}${st.avgField ? '/' + st.avgField : ''}` : `${st.n} турниров`;
      endEl.className = 'mt-pro-chart-end pos';
      return;
    }

    svg.style.display = '';
    if (histEl) {
      histEl.style.display = 'none';
      histEl.innerHTML = '';
    }
    titleEl.textContent = 'ДИНАМИКА ПРОФИТА';

    const src = moneyList(arr)
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
      const val = profitRub(t);
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
      isSport: false
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

    endEl.textContent = proMode ? fmtMoneyUSD(endVal / RATE) : fmtMoney(endVal);
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

  function bucketRangeLabel(b, idx) {
    const prev = idx > 0 ? BUCKETS[idx - 1].max : 0;
    const fmt = (n) => (proMode ? '$' + Math.round(n / RATE) : n.toLocaleString('ru-RU') + ' ₽');
    if (b.max === Infinity) return `от ${fmt(prev)}`;
    if (prev === 0) return `до ${fmt(b.max)}`;
    return `${fmt(prev)}–${fmt(b.max)}`;
  }

  function tournamentCountLabel(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return `${n} турниров`;
    if (mod10 === 1) return `${n} турнир`;
    if (mod10 >= 2 && mod10 <= 4) return `${n} турнира`;
    return `${n} турниров`;
  }

  function renderBuckets(arr) {
    const m = moneyList(arr);
    const grid = $('mtBucketsGrid');
    if (!grid) return;
    const countEl = $('mtBucketsCount');
    if (countEl) countEl.textContent = `(${m.length} тур.)`;
    const hint = $('mtBuyinHint');
    if (hint) hint.style.display = 'none';
    if (m.length === 0) {
      grid.innerHTML = '<div class="mt-pro-tab-hint">Нет турниров для расчёта ROI по бай-инам.</div>';
      return;
    }
    grid.innerHTML = BUCKETS.map((b, idx) => {
      const prev = idx > 0 ? BUCKETS[idx - 1].max : 0;
      const filtered = m.filter((t) => buyinRub(t) > prev && buyinRub(t) <= b.max);
      const inv = filtered.reduce((s, t) => s + investedRub(t), 0);
      const ret = filtered.reduce((s, t) => s + totalReturnedRub(t), 0);
      const net = ret - inv;
      const roi = inv ? Math.round((net / inv) * 1000) / 10 : null;
      const ids = filtered.map((t) => String(t.id)).join('|');
      const lowData = filtered.length < 2 || !inv;
      const statsHtml = lowData
        ? '<div class="mt-pro-bucket-low-data">Мало данных</div>'
        : `<div class="mt-pro-bucket-stats">
            <span class="mt-pro-bucket-roi ${roi >= 0 ? 'pos' : 'neg'}">ROI ${roi >= 0 ? '+' : ''}${roi}%</span>
            <span class="mt-pro-bucket-profit ${net >= 0 ? 'pos' : 'neg'}">Профит ${proMode ? fmtMoneyUSD(net / RATE) : fmtMoney(net)}</span>
          </div>`;
      return `<div class="mt-pro-bucket-card ${lowData ? 'dim' : ''}" data-mt="bar-detail" data-title="${esc(b.label)}" data-ids="${esc(ids)}">
        <div class="mt-pro-bucket-card-head">
          <span class="mt-pro-bucket-dot ${b.tier}"></span>
          <span class="mt-pro-bucket-name">${b.label}</span>
        </div>
        <div class="mt-pro-bucket-range">${bucketRangeLabel(b, idx)}</div>
        <div class="mt-pro-bucket-count">${tournamentCountLabel(filtered.length)}</div>
        ${statsHtml}
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

  function renderSportInsights(arr) {
    const grid = $('mtInsightsGrid');
    const warning = $('mtInsightWarning');
    if (!grid) return;
    if (warning) warning.style.display = 'none';

    const sp = sportOnlyList(arr);
    const st = sportStats(sp);
    if (!st.n) {
      grid.innerHTML = '<div class="mt-pro-tab-hint">Нет спортивных турниров для выводов.</div>';
      return;
    }

    const cards = [];
    if (st.avgPlace !== null) {
      cards.push(`<div class="mt-pro-conclusion highlight">
        <div class="mt-pro-conclusion-lbl">СРЕДНЕЕ МЕСТО</div>
        <div class="mt-pro-conclusion-name">${st.avgPlace}</div>
        <div class="mt-pro-conclusion-val neutral">из ${st.n} турниров</div>
      </div>`);
    }
    if (st.bestPlace !== null) {
      const bestT = sp.find((t) => num(t.place) === st.bestPlace);
      const bestTxt = bestT && num(bestT.field) ? `${st.bestPlace}/${num(bestT.field)}` : String(st.bestPlace);
      cards.push(`<div class="mt-pro-conclusion">
        <div class="mt-pro-conclusion-lbl">ЛУЧШИЙ РЕЗУЛЬТАТ</div>
        <div class="mt-pro-conclusion-name">${esc(bestTxt)}</div>
        <div class="mt-pro-conclusion-val pos">${esc(title(bestT || sp[0]))}</div>
      </div>`);
    }
    const clubGroups = Object.entries(groupBy(sp, (t) => venue(t))).sort((a, b) => b[1].length - a[1].length);
    const topClub = clubGroups[0];
    if (topClub && topClub[1].length >= 2) {
      cards.push(`<div class="mt-pro-conclusion span2">
        <div class="mt-pro-conclusion-lbl">ЧАЩЕ ВСЕГО ИГРАЕШЬ</div>
        <div class="mt-pro-conclusion-name">${esc(topClub[0])}</div>
        <div class="mt-pro-conclusion-val neutral">${topClub[1].length} турниров</div>
      </div>`);
    }
    grid.innerHTML = cards.length ? cards.join('') : '<div class="mt-pro-tab-hint">Мало данных для спортивных выводов.</div>';
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
          <div class="mt-pro-conclusion-lbl">ПОСЛЕДНИЕ 5</div>
          <div class="mt-pro-conclusion-name">${better ? '↑ Лучше предыдущих 5' : '↓ Слабее предыдущих 5'}</div>
          <div class="mt-pro-conclusion-val ${better ? 'pos' : 'neg'}">${last5.roi >= 0 ? '+' : ''}${last5.roi}% vs ${prev5.roi >= 0 ? '+' : ''}${prev5.roi}%</div>
        </div>`;
      }
    }

    const html =
      conclusionCard('ЛУЧШИЙ ФОРМАТ', bestFmt?.fmt, bestFmt?.roi ?? null, 'highlight') +
      conclusionCard('СЛАБОЕ МЕСТО', worstFmt && worstFmt.fmt !== bestFmt?.fmt ? worstFmt.fmt : null, worstFmt?.roi ?? null, 'weak') +
      conclusionCard('ЛУЧШАЯ ПЛОЩАДКА', bestVenue?.name, bestVenue?.roi ?? null) +
      trendHtml;
    grid.innerHTML = html.trim() ? html : '<div class="mt-pro-tab-hint">Мало данных</div>';

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
          const st = sportStats(items);
          const avgPlace = st.avgPlace ?? '—';
          return `<div class="mt-pro-bar">
            <div class="mt-pro-bar-top"><div class="mt-pro-bar-name">${esc(name)}</div><div class="mt-pro-bar-roi pos">ср. ${avgPlace}</div></div>
            <div class="mt-pro-bar-foot"><span>${items.length} тур.</span><span>лучшее: ${st.bestPlace ?? '—'}</span></div>
          </div>`;
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
    const win = isSport ? num(t.place) > 0 && num(t.place) <= 3 : p > 0;
    const badgeLabel = cat(t) === 'offline' ? 'ОФЛАЙН' : cat(t) === 'online' ? 'ОНЛАЙН' : 'СПОРТ';
    if (isSport) {
      const placeTxt = num(t.place) ? `${num(t.place)}${t.field ? ' / ' + num(t.field) : ''}` : '—';
      const reCnt = reentryCount(t);
      const reTxt = reCnt > 0 ? `${reCnt} RE-ENTRY` : '';
      const ptsVal = num(t.points);
      const ptsBlock =
        ptsVal !== 0
          ? `<span class="mt-pro-card-result pts">${ptsVal > 0 ? '+' : ''}${Math.round(ptsVal)} PTS</span>`
          : '';
      return `<div class="mt-pro-card mt-pro-card-sport ${win ? 'win' : ''}">
      <div class="mt-pro-card-top">
        <span class="mt-pro-badge sport">${badgeLabel}</span>
        <span class="mt-pro-card-venue">${esc(venue(t))}</span>
      </div>
      <div class="mt-pro-card-name">${esc(title(t))}</div>
      <div class="mt-pro-card-sport-meta">
        <span class="mt-pro-card-place-line">${placeTxt}</span>
        ${reTxt ? `<span class="mt-pro-card-reentry">${reTxt}</span>` : ''}
        ${ptsBlock}
      </div>
      <div class="mt-pro-card-actions">
        <button type="button" data-mt="edit" data-id="${esc(t.id)}">Изменить</button>
        <span class="mt-pro-card-actions-sep">/</span>
        <button type="button" class="danger" data-mt="delete" data-id="${esc(t.id)}">Удалить</button>
      </div>
    </div>`;
    }
    const resHtml = `<div class="mt-pro-card-result ${p >= 0 ? 'pos' : 'neg'}">${proMode ? fmtMoneyUSD(p / RATE) : fmtMoney(p)}</div>`;
    const buyinTxt = proMode
      ? '$' + (buyinRub(t) / RATE).toFixed(0)
      : buyinRub(t).toLocaleString('ru-RU') + ' ₽';
    const placeTxt = num(t.place) ? `${num(t.place)}${t.field ? ' / ' + num(t.field) : ''}` : '—';
    const fmtLabel = fmtDisplay(t) === 'MTT' ? 'NLH' : fmtDisplay(t);
    return `<div class="mt-pro-card ${win ? 'win' : ''}">
      <div class="mt-pro-card-top">
        <span class="mt-pro-badge ${cat(t)}">${badgeLabel}</span>
        <span class="mt-pro-card-venue">${esc(venue(t))}</span>
      </div>
      <div class="mt-pro-card-name">${esc(title(t))} · ${esc(fmtLabel)}</div>
      <div class="mt-pro-card-mid">
        <span class="mt-pro-card-place">${placeTxt}</span>
        <span class="mt-pro-card-buyin">BI ${buyinTxt}</span>
      </div>
      <div class="mt-pro-card-profit-row">${resHtml}</div>
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
    const countEl = $('mtRecentCount');
    const recordsLabel = (n) => {
      const mod10 = n % 10;
      const mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return 'запись';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'записи';
      return 'записей';
    };
    if (countEl) countEl.textContent = arr.length ? `${arr.length} ${recordsLabel(arr.length)}` : '';
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
    const arr = filtered();
    const mode = typeFilter === 'sport' ? 'sport' : typeFilter === 'all' ? 'all' : 'money';
    renderCompactSummary(arr, mode);
    if (typeFilter === 'sport') {
      $('mtHeroInsight').style.display = 'none';
    } else {
      renderHeroInsight(arr);
    }
    renderChart(arr, typeFilter === 'sport');
    renderRecentHistory(arr);
  }

  function setOverviewCompact(compact) {
    const isSportOnly = typeFilter === 'sport';
    const vis = (id, visible) => {
      const el = $(id);
      if (el) el.style.display = visible ? '' : 'none';
    };
    vis('mtStatGrid', !compact || isSportOnly);
    vis('mtSampleNote', !compact || isSportOnly);
    vis('mtAddStats', !compact && !isSportOnly);
    vis('mtRollingSection', !compact && !isSportOnly);
    vis('mtSplitSection', !compact && !isSportOnly);
    const insightTitle = document.querySelector('#mtInsightsSection .mt-pro-section-title');
    if (insightTitle) insightTitle.style.display = compact && !isSportOnly ? 'none' : '';
    const histHead = document.querySelector('#mtTabOverview .mt-pro-list-head');
    const exportWrap = document.querySelector('#mtTabOverview .mt-pro-analytics-export');
    if (histHead) histHead.style.display = compact ? 'none' : '';
    vis('mtFullList', !compact);
    if (exportWrap) exportWrap.style.display = compact ? '' : 'none';
  }

  function renderAnalytics() {
    ensureAnalyticsDom();
    renderFilters();
    renderAnalyticsTabBar();
    showAnalyticsPanel();
    const arr = filtered();
    const isSportOnly = typeFilter === 'sport';
    $('mtInsightsSection').style.display = '';
    setOverviewCompact(analyticsTab === 'overview');

    if (analyticsTab === 'overview') {
      renderStats(arr, isSportOnly);
      renderFullHistory(arr);
      if (isSportOnly) {
        renderSportInsights(arr);
        $('mtSplitSection').style.display = 'none';
        $('mtRollingSection').style.display = 'none';
      } else {
        renderInsights(arr);
        renderSplit(arr);
        if (proMode) {
          $('mtRollingSection').style.display = analyticsTab === 'overview' ? '' : 'none';
          renderRollingROI(arr);
        }
      }
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
      const isSport = cat(t) === 'sport';
      const sportPlace = num(t.place) ? `${num(t.place)}${t.field ? '/' + num(t.field) : ''}` : '—';
      const pts = num(t.points);
      const sportVal = pts !== 0 ? fmtPts(pts) : sportPlace;
      html += `<div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);gap:8px">
        <span style="color:#888;min-width:0">${esc(String(t.date || '').slice(5))} · ${esc(title(t))}</span>
        <span style="color:${isSport ? '#f5c84c' : p >= 0 ? '#c8ff3d' : '#ff6b5b'};font-weight:700;flex-shrink:0">${isSport ? sportVal : proMode ? fmtMoneyUSD(p / RATE) : fmtMoney(p)}</span></div>`;
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
  const DEFAULT_ROOMS = ['PokerOK', 'PokerStars', 'PokerDom', '888Poker', 'GG Poker', 'Winamax'];

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  async function ensurePolyanaClubs() {
    if (polyanaClubs.length) return polyanaClubs;
    if (polyanaClubsLoading) return polyanaClubs;
    polyanaClubsLoading = true;
    try {
      if (typeof window.PolyanaClubsAdapter?.loadPolyanaClubs === 'function') {
        polyanaClubs = await window.PolyanaClubsAdapter.loadPolyanaClubs();
      }
    } catch (_) {
      polyanaClubs = [];
    }
    polyanaClubsLoading = false;
    return polyanaClubs;
  }

  function knownRooms() {
    const set = new Set(DEFAULT_ROOMS);
    list()
      .filter((t) => cat(t) === 'online')
      .forEach((t) => {
        const r = (t.room || t.clubOrRoom || '').trim();
        if (r) set.add(r);
      });
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function recordAddOnEnabled(t) {
    if (!t) return false;
    if (t.addOnEnabled) return true;
    return num(t.addOnCount) > 0 || num(t.addOn) > 0;
  }

  function recordBountyEnabled(t) {
    if (!t) return false;
    if (t.bountyEnabled) return true;
    return num(t.bountyCount) > 0 || num(t.bountyValue) > 0;
  }

  function openSheet() {
    editingId = null;
    addType = 'offline';
    selCurr = 'RUB';
    formAddOn = false;
    formBounty = false;
    MODAL.classList.add('on');
    renderSheetShell();
    ensurePolyanaClubs().then(() => renderAddForm('offline'));
  }

  function closeSheet() {
    MODAL.classList.remove('on');
    addType = null;
    editingId = null;
    formAddOn = false;
    formBounty = false;
  }

  function renderSheetShell() {
    SHEET().innerHTML = `
      <div class="mt-pro-sheet-handle"></div>
      <div class="mt-pro-sheet-title"><span id="mtSheetTitle">Добавить турнир</span><button type="button" class="mt-pro-sheet-close" data-mt="sheet-close">✕</button></div>
      <div class="mt-pro-type-seg" id="mtTypeSeg">
        <button type="button" class="mt-pro-type-btn mt-pro-pressable" data-mt="pick-type" data-val="offline">ОФЛАЙН</button>
        <button type="button" class="mt-pro-type-btn mt-pro-pressable" data-mt="pick-type" data-val="online">ОНЛАЙН</button>
        <button type="button" class="mt-pro-type-btn mt-pro-pressable" data-mt="pick-type" data-val="sport">СПОРТ</button>
      </div>
      <div class="mt-pro-form-body" id="mtFormBody">
        <div class="mt-pro-fields" id="mtSheetFields"></div>
        <div class="mt-pro-form-footer" id="mtFormFooter"></div>
      </div>`;
    SHEET().querySelector('[data-mt="sheet-close"]').addEventListener('click', closeSheet);
    SHEET().querySelectorAll('[data-mt="pick-type"]').forEach((b) => {
      b.addEventListener('click', () => {
        if (addType === b.dataset.val) return;
        formAddOn = false;
        formBounty = false;
        renderAddForm(b.dataset.val);
      });
    });
  }

  function updateTypePickerUI() {
    SHEET()?.querySelectorAll('[data-mt="pick-type"]').forEach((b) => {
      const on = b.dataset.val === addType;
      b.classList.toggle('active', on);
      b.classList.toggle('offline', on && b.dataset.val === 'offline');
      b.classList.toggle('online', on && b.dataset.val === 'online');
      b.classList.toggle('sport', on && b.dataset.val === 'sport');
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

  function ynSegHtml(field, yes) {
    return `<div class="mt-pro-yn-seg mt-pro-bubble-seg" data-yn="${field}">
      <button type="button" class="mt-pro-yn-btn mt-pro-pressable ${yes ? 'active' : ''}" data-mt="yn" data-field="${field}" data-val="1">ДА</button>
      <button type="button" class="mt-pro-yn-btn mt-pro-pressable ${!yes ? 'active' : ''}" data-mt="yn" data-field="${field}" data-val="0">НЕТ</button>
    </div>`;
  }

  function formSection(label, inner) {
    return `<div class="mt-pro-form-section"><div class="mt-pro-form-section-label">${label}</div>${inner}</div>`;
  }

  function customSelectWrap(selectId, optionsHtml, searchable) {
    return `<div class="mt-pro-picker-wrap" data-picker="${selectId}" data-searchable="${searchable ? '1' : '0'}">
      <button type="button" class="mt-pro-glass-trigger mt-pro-pressable" data-mt="picker-open" data-target="${selectId}">
        <span class="mt-pro-glass-trigger-val" id="${selectId}Label">—</span>
        <span class="mt-pro-glass-trigger-icon" aria-hidden="true">▾</span>
      </button>
      <select id="${selectId}" class="mt-pro-native-select" tabindex="-1" aria-hidden="true">${optionsHtml}</select>
    </div>`;
  }

  function formatSelectHtml(fmtVal) {
    const opts = `
      <option value="MTT" ${fmtVal === 'MTT' ? 'selected' : ''}>MTT</option>
      <option value="PKO" ${fmtVal === 'PKO' ? 'selected' : ''}>PKO / Bounty</option>
      <option value="Mystery Bounty" ${fmtVal === 'Mystery Bounty' ? 'selected' : ''}>Mystery Bounty</option>
      <option value="SNG" ${fmtVal === 'SNG' ? 'selected' : ''}>SNG</option>
      <option value="PLO" ${fmtVal === 'PLO' ? 'selected' : ''}>PLO</option>`;
    return customSelectWrap('mtFFmt', opts, false);
  }

  function ensurePickerOverlay() {
    if (document.getElementById('mtProPickerOverlay')) return;
    const el = document.createElement('div');
    el.id = 'mtProPickerOverlay';
    el.className = 'mt-pro-picker-overlay';
    el.innerHTML = `
      <div class="mt-pro-picker-panel" role="dialog" aria-modal="true">
        <div class="mt-pro-picker-head">
          <span id="mtPickerTitle">Выбор</span>
          <button type="button" class="mt-pro-picker-close mt-pro-pressable" data-mt="picker-close">✕</button>
        </div>
        <input type="search" id="mtPickerSearch" class="mt-pro-glass-input mt-pro-picker-search" placeholder="Поиск..." autocomplete="off">
        <div id="mtPickerList" class="mt-pro-picker-list"></div>
      </div>`;
    MODAL.appendChild(el);
    el.addEventListener('click', (e) => {
      if (e.target === el) closePicker();
    });
  }

  let activePickerId = null;

  function pickerLabelFromSelect(sel) {
    if (!sel) return '—';
    const opt = sel.options[sel.selectedIndex];
    if (!sel.value) return opt?.textContent?.trim() || '— выберите —';
    return opt?.textContent?.trim() || sel.value;
  }

  function syncPickerLabel(selectId) {
    const sel = document.getElementById(selectId);
    const label = document.getElementById(selectId + 'Label');
    if (label && sel) label.textContent = pickerLabelFromSelect(sel);
  }

  function syncAllPickerLabels() {
    document.querySelectorAll('.mt-pro-picker-wrap').forEach((wrap) => {
      syncPickerLabel(wrap.dataset.picker);
    });
  }

  function closePicker() {
    const overlay = document.getElementById('mtProPickerOverlay');
    if (overlay) overlay.classList.remove('on');
    activePickerId = null;
  }

  function openPicker(selectId) {
    ensurePickerOverlay();
    const sel = document.getElementById(selectId);
    const wrap = document.querySelector(`.mt-pro-picker-wrap[data-picker="${selectId}"]`);
    if (!sel || !wrap) return;
    activePickerId = selectId;
    const overlay = document.getElementById('mtProPickerOverlay');
    const list = document.getElementById('mtPickerList');
    const search = document.getElementById('mtPickerSearch');
    const title = document.getElementById('mtPickerTitle');
    const searchable = wrap.dataset.searchable === '1' || sel.options.length > 8;
    title.textContent =
      selectId === 'mtFClubSelect' ? 'КЛУБ' : selectId === 'mtFRoomSelect' ? 'РУМ' : selectId === 'mtFFmt' ? 'ФОРМАТ' : 'ВЫБОР';
    search.style.display = searchable ? 'block' : 'none';
    search.value = '';
    const renderList = (filter) => {
      const q = (filter || '').trim().toLowerCase();
      list.innerHTML = [...sel.options]
        .filter((o) => !q || o.textContent.toLowerCase().includes(q))
        .map((o) => {
          const active = o.value === sel.value;
          return `<button type="button" class="mt-pro-picker-item mt-pro-pressable ${active ? 'active' : ''}" data-mt="picker-pick" data-target="${selectId}" data-value="${esc(o.value)}" data-name="${esc(o.dataset.name || '')}">${esc(o.textContent.trim())}</button>`;
        })
        .join('');
    };
    renderList('');
    search.oninput = () => renderList(search.value);
    overlay.classList.add('on');
    bindPressable(list);
    if (searchable) setTimeout(() => search.focus(), 120);
  }

  function bindPressable(root) {
    (root || document).querySelectorAll('.mt-pro-pressable').forEach((el) => {
      if (el.dataset.pressBound) return;
      el.dataset.pressBound = '1';
      el.addEventListener('pointerdown', () => el.classList.add('is-pressed'));
      const up = () => el.classList.remove('is-pressed');
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointercancel', up);
    });
  }

  function clubOptionsHtml(rec, allowCustom) {
    const selId = rec.venueId || rec.clubId || '';
    const name = rec.venueName || rec.clubOrRoom || rec.club || '';
    let html = `<option value="">— выберите клуб —</option>`;
    if (allowCustom) html += `<option value="__custom__" ${!selId && name ? 'selected' : ''}>Другой клуб…</option>`;
    polyanaClubs.forEach((c) => {
      const selected = (selId && selId === c.id) || (!selId && name && name.toLowerCase() === c.name.toLowerCase());
      html += `<option value="${esc(c.id || c.name)}" data-name="${esc(c.name)}" ${selected ? 'selected' : ''}>${esc(c.name)}</option>`;
    });
    return html;
  }

  function roomOptionsHtml(rec) {
    const room = (rec.room || rec.clubOrRoom || rec.club || '').trim();
    const rooms = knownRooms();
    let html = `<option value="">— выберите рум —</option><option value="__custom__" ${room && !rooms.includes(room) ? 'selected' : ''}>Другой рум…</option>`;
    rooms.forEach((r) => {
      html += `<option value="${esc(r)}" ${room === r ? 'selected' : ''}>${esc(r)}</option>`;
    });
    return html;
  }

  function formFooterHtml() {
    const label = editingId ? 'СОХРАНИТЬ ИЗМЕНЕНИЯ →' : 'ДОБАВИТЬ ТУРНИР →';
    return `<div class="mt-pro-form-errors" id="mtFormErrors"></div>
      <button type="button" class="mt-pro-save-primary mt-pro-pressable" data-mt="save">${label}</button>
      <div class="mt-pro-form-safe-spacer" aria-hidden="true"></div>`;
  }

  function subcardBlock(label, inner, id) {
    return `<div class="mt-pro-subcard mt-pro-subcard-reveal" ${id ? `id="${id}"` : ''}>
      <div class="mt-pro-subcard-label">${label}</div>${inner}
    </div>`;
  }

  function renderAddForm(type, old) {
    addType = type;
    const rec = old || {};
    if (old) {
      formAddOn = recordAddOnEnabled(old);
      formBounty = recordBountyEnabled(old) || isBountyFmt(old);
      selCurr = currency(old) === 'EUR' ? 'RUB' : currency(old);
    }
    updateTypePickerUI();
    const fields = document.getElementById('mtSheetFields');
    const footer = document.getElementById('mtFormFooter');
    if (!fields || !footer) return;

    const dateVal = rec.date || todayIso();
    const fmtVal = old ? mapFormatFromRecord(old) : 'MTT';
    const showPko = fmtVal === 'PKO' || fmtVal === 'Mystery Bounty';
    const addOnBlock = formAddOn
      ? subcardBlock(
          'ADD-ON',
          `<div class="mt-pro-field-row">
            <div class="mt-pro-field"><label>Количество</label><input class="mt-pro-glass-input" type="number" id="mtFAddOnCount" min="0" value="${old ? num(rec.addOnCount) || (num(rec.addOn) ? 1 : 0) : 0}"></div>
            <div class="mt-pro-field"><label>Стоимость</label><input class="mt-pro-glass-input" type="number" id="mtFAddOnCost" min="0" value="${old ? num(rec.addOnCost) || num(rec.addOn) : ''}" placeholder="500"></div>
          </div>`,
          'mtAddOnBlock'
        )
      : '';

    const sportBountyBlock =
      formBounty && type === 'sport'
        ? subcardBlock(
            'BOUNTY',
            `<div class="mt-pro-field-row">
              <div class="mt-pro-field"><label>Нокауты, шт</label><input class="mt-pro-glass-input" type="number" id="mtFBountyCount" min="0" value="${old ? num(rec.bountyCount) : 0}"></div>
              <div class="mt-pro-field"><label>Стоимость</label><input class="mt-pro-glass-input" type="number" id="mtFBountyValue" min="0" value="${old ? num(rec.bountyValue) : ''}" placeholder="500"></div>
            </div>`,
            'mtBountyBlock'
          )
        : '';

    const moneyBountyBlock =
      showPko && type !== 'sport'
        ? subcardBlock(
            'BOUNTY',
            `<div class="mt-pro-field-row">
              <div class="mt-pro-field"><label>В buy-in</label><input class="mt-pro-glass-input" type="number" id="mtFBC" min="0" value="${old ? num(rec.bountyContribution) : 0}"></div>
              <div class="mt-pro-field"><label>Получено</label><input class="mt-pro-glass-input" type="number" id="mtFBountyWon" min="0" value="${old ? num(rec.bountyWon) : 0}"></div>
            </div>`,
            'mtPkoBlock'
          )
        : '';

    if (type === 'offline') {
      const customClub = !rec.venueId && !rec.clubId && (rec.clubOrRoom || rec.club);
      fields.innerHTML =
        formSection(
          'ОСНОВНОЕ',
          `<div class="mt-pro-field" id="mtFieldDate"><label>Дата</label><input class="mt-pro-glass-input" type="date" id="mtFDate" value="${esc(dateVal)}"></div>
        <div class="mt-pro-field" id="mtFieldClub"><label>Клуб / площадка</label>
          ${customSelectWrap('mtFClubSelect', clubOptionsHtml(rec, true), true)}
          <input type="text" id="mtFClubCustom" class="mt-pro-glass-input mt-pro-custom-input" style="display:${customClub ? 'block' : 'none'}" value="${esc(customClub ? rec.clubOrRoom || rec.club || '' : '')}" placeholder="Название клуба">
        </div>
        <div class="mt-pro-field" id="mtFieldName"><label>Название турнира</label><input class="mt-pro-glass-input" type="text" id="mtFName" value="${esc(rec.tournamentName || rec.name || '')}" placeholder="Sunday Main"></div>
        <div class="mt-pro-field"><label>Формат</label>${formatSelectHtml(fmtVal)}</div>`
        ) +
        formSection(
          'ВХОД',
          `<div class="mt-pro-field-row">
          <div class="mt-pro-field" id="mtFieldBuyin"><label>Buy-in</label><input class="mt-pro-glass-input" type="number" id="mtFBuyin" min="0" value="${old ? baseBuy(old) : ''}" placeholder="1500"></div>
          <div class="mt-pro-field"><label>Re-entry, шт</label><input class="mt-pro-glass-input" type="number" id="mtFReentry" min="0" value="${old ? reentryCount(old) : 0}"></div>
        </div>
        <div class="mt-pro-field"><label>Стоимость re-entry</label><input class="mt-pro-glass-input" type="number" id="mtFReentryCost" min="0" value="${old ? reentryCostVal(old) : ''}" placeholder="= buy-in"></div>
        <div class="mt-pro-field"><label>Add-on</label>${ynSegHtml('addon', formAddOn)}</div>
        ${addOnBlock}
        ${moneyBountyBlock}`
        ) +
        formSection(
          'РЕЗУЛЬТАТ',
          `<div class="mt-pro-field-row">
          <div class="mt-pro-field"><label>Место</label><input class="mt-pro-glass-input" type="number" id="mtFPlace" min="1" value="${old ? num(rec.place) || '' : ''}" placeholder="3"></div>
          <div class="mt-pro-field"><label>Участников</label><input class="mt-pro-glass-input" type="number" id="mtFField" min="0" value="${old && rec.field ? num(rec.field) : ''}" placeholder="48"></div>
        </div>
        <div class="mt-pro-field"><label>Fee / комиссия</label><input class="mt-pro-glass-input" type="number" id="mtFFee" min="0" value="${old ? num(rec.fee) : 0}"></div>
        <div class="mt-pro-field" id="mtFieldCash"><label>Призовые / Cash</label><input class="mt-pro-glass-input" type="number" id="mtFCash" min="0" value="${old ? num(rec.prize) : 0}"></div>`
        ) +
        formSection(
          'ДОПОЛНИТЕЛЬНО',
          `<div class="mt-pro-field"><label>Заметка</label><input class="mt-pro-glass-input" type="text" id="mtFNote" maxlength="120" value="${esc(rec.note || '')}" placeholder="Необязательно"></div>`
        );
    } else if (type === 'online') {
      const customRoom = rec.room || rec.clubOrRoom;
      const rooms = knownRooms();
      const isCustomRoom = customRoom && !rooms.includes(customRoom);
      fields.innerHTML =
        formSection(
          'ОСНОВНОЕ',
          `<div class="mt-pro-field" id="mtFieldDate"><label>Дата</label><input class="mt-pro-glass-input" type="date" id="mtFDate" value="${esc(dateVal)}"></div>
        <div class="mt-pro-field" id="mtFieldRoom"><label>Рум</label>
          ${customSelectWrap('mtFRoomSelect', roomOptionsHtml(rec), true)}
          <input type="text" id="mtFRoomCustom" class="mt-pro-glass-input mt-pro-custom-input" style="display:${isCustomRoom ? 'block' : 'none'}" value="${esc(isCustomRoom ? customRoom : '')}" placeholder="Название рума">
        </div>
        <div class="mt-pro-field" id="mtFieldName"><label>Название турнира</label><input class="mt-pro-glass-input" type="text" id="mtFName" value="${esc(rec.tournamentName || rec.name || '')}" placeholder="Daily Main Event"></div>
        <div class="mt-pro-field"><label>Формат</label>${formatSelectHtml(fmtVal)}</div>
        <div class="mt-pro-field"><label>Валюта</label><div class="mt-pro-curr-row">
          <button type="button" class="mt-pro-curr-btn mt-pro-pressable ${selCurr === 'RUB' ? 'sel' : ''}" data-mt="curr" data-val="RUB">₽ RUB</button>
          <button type="button" class="mt-pro-curr-btn mt-pro-pressable ${selCurr === 'USD' ? 'sel' : ''}" data-mt="curr" data-val="USD">$ USD</button>
        </div></div>`
        ) +
        formSection(
          'ВХОД',
          `<div class="mt-pro-field-row">
          <div class="mt-pro-field" id="mtFieldBuyin"><label>Buy-in</label><input class="mt-pro-glass-input" type="number" id="mtFBuyin" min="0" value="${old ? baseBuy(old) : ''}" placeholder="800"></div>
          <div class="mt-pro-field"><label>Re-entry, шт</label><input class="mt-pro-glass-input" type="number" id="mtFReentry" min="0" value="${old ? reentryCount(old) : 0}"></div>
        </div>
        <div class="mt-pro-field"><label>Стоимость re-entry</label><input class="mt-pro-glass-input" type="number" id="mtFReentryCost" min="0" value="${old ? reentryCostVal(old) : ''}" placeholder="= buy-in"></div>
        <div class="mt-pro-field"><label>Add-on</label>${ynSegHtml('addon', formAddOn)}</div>
        ${addOnBlock}
        ${moneyBountyBlock}`
        ) +
        formSection(
          'РЕЗУЛЬТАТ',
          `<div class="mt-pro-field-row">
          <div class="mt-pro-field"><label>Место</label><input class="mt-pro-glass-input" type="number" id="mtFPlace" min="1" value="${old ? num(rec.place) || '' : ''}" placeholder="4"></div>
          <div class="mt-pro-field"><label>Участников</label><input class="mt-pro-glass-input" type="number" id="mtFField" min="0" value="${old && rec.field ? num(rec.field) : ''}" placeholder="156"></div>
        </div>
        <div class="mt-pro-field"><label>Fee / комиссия</label><input class="mt-pro-glass-input" type="number" id="mtFFee" min="0" value="${old ? num(rec.fee) : 0}"></div>
        <div class="mt-pro-field" id="mtFieldCash"><label>Призовые / Cash</label><input class="mt-pro-glass-input" type="number" id="mtFCash" min="0" value="${old ? num(rec.prize) : 0}"></div>`
        ) +
        formSection(
          'ДОПОЛНИТЕЛЬНО',
          `<div class="mt-pro-field"><label>Заметка</label><input class="mt-pro-glass-input" type="text" id="mtFNote" maxlength="120" value="${esc(rec.note || '')}" placeholder="Необязательно"></div>`
        );
    } else {
      fields.innerHTML =
        formSection(
          'ОСНОВНОЕ',
          `<div class="mt-pro-field" id="mtFieldDate"><label>Дата</label><input class="mt-pro-glass-input" type="date" id="mtFDate" value="${esc(dateVal)}"></div>
        <div class="mt-pro-field" id="mtFieldClub"><label>Клуб</label>
          ${customSelectWrap('mtFClubSelect', clubOptionsHtml(rec, false), true)}
        </div>
        <div class="mt-pro-field" id="mtFieldName"><label>Название турнира</label><input class="mt-pro-glass-input" type="text" id="mtFName" value="${esc(rec.tournamentName || rec.name || '')}" placeholder="Sunday Main"></div>`
        ) +
        formSection(
          'ВХОД',
          `<div class="mt-pro-field-row">
          <div class="mt-pro-field" id="mtFieldBuyin"><label>Вход / Buy-in</label><input class="mt-pro-glass-input" type="number" id="mtFBuyin" min="0" value="${old ? baseBuy(old) : ''}" placeholder="1500"></div>
          <div class="mt-pro-field"><label>Re-entry, шт</label><input class="mt-pro-glass-input" type="number" id="mtFReentry" min="0" value="${old ? reentryCount(old) : 0}"></div>
        </div>
        <div class="mt-pro-field"><label>Стоимость re-entry</label><input class="mt-pro-glass-input" type="number" id="mtFReentryCost" min="0" value="${old ? reentryCostVal(old) : ''}" placeholder="= buy-in"></div>
        <div class="mt-pro-field"><label>Add-on</label>${ynSegHtml('addon', formAddOn)}</div>
        ${addOnBlock}
        <div class="mt-pro-field"><label>Bounty</label>${ynSegHtml('bounty', formBounty)}</div>
        ${sportBountyBlock}`
        ) +
        formSection(
          'РЕЗУЛЬТАТ',
          `<div class="mt-pro-field-row">
          <div class="mt-pro-field"><label>Место</label><input class="mt-pro-glass-input" type="number" id="mtFPlace" min="1" value="${old ? num(rec.place) || '' : ''}" placeholder="3"></div>
          <div class="mt-pro-field"><label>Участников</label><input class="mt-pro-glass-input" type="number" id="mtFField" min="0" value="${old && rec.field ? num(rec.field) : ''}" placeholder="48"></div>
        </div>
        <div class="mt-pro-field mt-pro-field-points" id="mtFieldPoints"><label><span class="mt-pro-points-indicator" aria-hidden="true"></span>Рейтинг / Points</label><input class="mt-pro-glass-input mt-pro-points-input" type="number" id="mtFPoints" value="${old ? num(rec.points) : ''}" placeholder="125"></div>`
        ) +
        formSection(
          'ДОПОЛНИТЕЛЬНО',
          `<div class="mt-pro-field"><label>Заметка</label><input class="mt-pro-glass-input" type="text" id="mtFNote" maxlength="120" value="${esc(rec.note || '')}" placeholder="Необязательно"></div>`
        );
    }

    footer.innerHTML = formFooterHtml();
    bindFormEvents(type);
    ensurePickerOverlay();
    syncAllPickerLabels();
    bindPressable(document.getElementById('mtFormBody'));
    bindPressable(document.getElementById('mtTypeSeg'));
    if (editingId) document.getElementById('mtSheetTitle').textContent = 'Редактировать турнир';
  }

  function snapshotFormFields() {
    const snap = {};
    document.querySelectorAll('#mtSheetFields input, #mtSheetFields select').forEach((el) => {
      if (el.id) snap[el.id] = el.value;
    });
    return snap;
  }

  function restoreFormFields(snap) {
    Object.entries(snap || {}).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    });
    syncAllPickerLabels();
  }

  function bindFormEvents(type) {
    const root = document.getElementById('mtFormBody');
    if (!root) return;

    if (!MODAL.dataset.pickerBound) {
      MODAL.addEventListener('click', (e) => {
        const openBtn = e.target.closest('[data-mt="picker-open"]');
        if (openBtn) {
          openPicker(openBtn.dataset.target);
          return;
        }
        const pickBtn = e.target.closest('[data-mt="picker-pick"]');
        if (pickBtn) {
          const sel = document.getElementById(pickBtn.dataset.target);
          if (sel) {
            sel.value = pickBtn.dataset.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            syncPickerLabel(pickBtn.dataset.target);
          }
          closePicker();
          return;
        }
        if (e.target.closest('[data-mt="picker-close"]')) closePicker();
      });
      MODAL.dataset.pickerBound = '1';
    }

    root.querySelectorAll('[data-mt="curr"]').forEach((b) => {
      b.addEventListener('click', () => {
        selCurr = b.dataset.val;
        root.querySelectorAll('[data-mt="curr"]').forEach((x) => x.classList.toggle('sel', x === b));
      });
    });

    root.querySelectorAll('[data-mt="yn"]').forEach((b) => {
      b.addEventListener('click', () => {
        const field = b.dataset.field;
        const yes = b.dataset.val === '1';
        const snap = snapshotFormFields();
        const old = editingId ? list().find((t) => String(t.id) === String(editingId)) : null;
        if (field === 'addon') formAddOn = yes;
        if (field === 'bounty') formBounty = yes;
        renderAddForm(addType, old || undefined);
        restoreFormFields(snap);
      });
    });

    const clubSel = document.getElementById('mtFClubSelect');
    const clubCustom = document.getElementById('mtFClubCustom');
    if (clubSel && clubCustom) {
      clubSel.addEventListener('change', () => {
        clubCustom.style.display = clubSel.value === '__custom__' ? 'block' : 'none';
        if (clubSel.value !== '__custom__') clubCustom.value = '';
      });
    }

    const roomSel = document.getElementById('mtFRoomSelect');
    const roomCustom = document.getElementById('mtFRoomCustom');
    if (roomSel && roomCustom) {
      roomSel.addEventListener('change', () => {
        roomCustom.style.display = roomSel.value === '__custom__' ? 'block' : 'none';
        if (roomSel.value !== '__custom__') roomCustom.value = '';
      });
    }

    const fmtSel = document.getElementById('mtFFmt');
    if (fmtSel && type !== 'sport') {
      fmtSel.addEventListener('change', () => {
        const snap = snapshotFormFields();
        const old = editingId ? list().find((t) => String(t.id) === String(editingId)) : null;
        renderAddForm(addType, old || undefined);
        restoreFormFields(snap);
      });
    }

    root.querySelector('[data-mt="save"]')?.addEventListener('click', () => {
      const btn = root.querySelector('[data-mt="save"]');
      btn?.classList.add('is-saving');
      saveTournament();
      btn?.classList.remove('is-saving');
    });
  }

  function setFieldInvalid(wrapId, message) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    wrap.classList.add('invalid');
    let hint = wrap.querySelector('.mt-pro-field-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'mt-pro-field-hint';
      wrap.appendChild(hint);
    }
    hint.textContent = message;
  }

  function clearFieldInvalids() {
    document.querySelectorAll('.mt-pro-field.invalid').forEach((el) => {
      el.classList.remove('invalid');
      el.querySelector('.mt-pro-field-hint')?.remove();
    });
    const err = document.getElementById('mtFormErrors');
    if (err) err.textContent = '';
  }

  function readVenueFromForm(type) {
    if (type === 'online') {
      const sel = document.getElementById('mtFRoomSelect');
      const custom = document.getElementById('mtFRoomCustom');
      if (!sel) return { room: '', venueName: '' };
      if (sel.value === '__custom__') {
        const room = custom?.value.trim() || '';
        return { room, venueName: room, clubOrRoom: room };
      }
      const room = sel.value.trim();
      return { room, venueName: room, clubOrRoom: room };
    }
    const sel = document.getElementById('mtFClubSelect');
    const custom = document.getElementById('mtFClubCustom');
    if (!sel) return { venueId: null, venueName: '', clubOrRoom: '' };
    if (sel.value === '__custom__') {
      const name = custom?.value.trim() || '';
      return { venueId: null, venueName: name, clubOrRoom: name };
    }
    if (!sel.value) return { venueId: null, venueName: '', clubOrRoom: '' };
    const opt = sel.options[sel.selectedIndex];
    const name = opt?.dataset?.name || opt?.textContent?.trim() || sel.value;
    const venueId = sel.value !== name ? sel.value : null;
    return { venueId, venueName: name, clubOrRoom: name };
  }

  function validateForm() {
    clearFieldInvalids();
    const errs = [];
    const g = (id) => document.getElementById(id);
    const date = g('mtFDate')?.value?.trim();
    const name = g('mtFName')?.value?.trim();
    const buyin = num(g('mtFBuyin')?.value);
    const place = num(g('mtFPlace')?.value);
    const field = num(g('mtFField')?.value);
    const reentry = num(g('mtFReentry')?.value);

    if (!date) {
      errs.push('Укажите дату');
      setFieldInvalid('mtFieldDate', 'Обязательное поле');
    }
    if (!name) {
      errs.push('Укажите название');
      setFieldInvalid('mtFieldName', 'Обязательное поле');
    }

    const venue = readVenueFromForm(addType);
    if (addType === 'online') {
      if (!venue.room) {
        errs.push('Выберите рум');
        setFieldInvalid('mtFieldRoom', 'Обязательное поле');
      }
      const buyinRaw = g('mtFBuyin')?.value;
      if (buyinRaw === '' || buyinRaw === null) {
        errs.push('Укажите buy-in');
        setFieldInvalid('mtFieldBuyin', 'Обязательное поле');
      }
    } else if (addType === 'offline') {
      if (!venue.clubOrRoom) {
        errs.push('Выберите клуб');
        setFieldInvalid('mtFieldClub', 'Обязательное поле');
      }
      const buyinRaw = g('mtFBuyin')?.value;
      if (buyinRaw === '' || buyinRaw === null) {
        errs.push('Укажите buy-in');
        setFieldInvalid('mtFieldBuyin', 'Обязательное поле');
      }
    } else if (addType === 'sport') {
      if (!venue.clubOrRoom) {
        errs.push('Выберите клуб из Поляны');
        setFieldInvalid('mtFieldClub', 'Обязательное поле');
      }
    }

    if (place > 0 && field > 0 && place > field) errs.push('Место не может быть больше поля');
    if (reentry < 0) errs.push('Re-entry ≥ 0');

    const errEl = g('mtFormErrors');
    if (errEl) errEl.textContent = errs.join(' · ');
    return errs.length === 0;
  }

  function saveTournament() {
    if (!addType) {
      renderAddForm('offline');
      return;
    }
    if (!validateForm()) return;

    const g = (id) => document.getElementById(id);
    const name = g('mtFName').value.trim();
    const buyin = Math.max(0, num(g('mtFBuyin')?.value));
    const reentry = Math.max(0, Math.round(num(g('mtFReentry')?.value)));
    const reentryCost = Math.max(0, num(g('mtFReentryCost')?.value) || buyin + num(g('mtFFee')?.value));
    const fmtVal = g('mtFFmt')?.value || 'MTT';
    const old = editingId ? list().find((t) => String(t.id) === String(editingId)) : null;
    const venue = readVenueFromForm(addType);

    const addOnCount = formAddOn ? Math.max(0, Math.round(num(g('mtFAddOnCount')?.value))) : 0;
    const addOnCost = formAddOn ? Math.max(0, num(g('mtFAddOnCost')?.value)) : 0;

    const rec = {
      ...(old || {}),
      id: old?.id || 'mt_' + Date.now(),
      type: addType,
      format: addType === 'sport' ? 'NLH' : mapFormatToSave(fmtVal),
      tournamentName: name,
      name,
      date: g('mtFDate').value,
      currency: addType === 'online' ? selCurr : 'RUB',
      baseBuyin: buyin,
      buyin,
      fee: Math.max(0, num(g('mtFFee')?.value)),
      entries: reentry + 1,
      reentryCost,
      addOnEnabled: formAddOn,
      addOnCount,
      addOnCost,
      addOn: formAddOn ? addOnCount * addOnCost : 0,
      place: Math.max(0, Math.round(num(g('mtFPlace')?.value))) || undefined,
      field: Math.max(0, Math.round(num(g('mtFField')?.value))) || undefined,
      note: g('mtFNote')?.value.trim() || '',
      venueId: venue.venueId || undefined,
      venueName: venue.venueName || venue.clubOrRoom || undefined,
      clubOrRoom: venue.clubOrRoom || venue.room || '',
      updatedAt: Date.now(),
      createdAt: old?.createdAt || Date.now()
    };

    if (addType === 'online') {
      rec.room = venue.room;
      rec.clubId = undefined;
    } else {
      rec.clubId = venue.venueId || undefined;
      rec.room = undefined;
    }

    if (addType === 'sport') {
      rec.points = num(g('mtFPoints')?.value);
      rec.prize = 0;
      rec.bountyWon = 0;
      rec.bountyEnabled = formBounty;
      rec.bountyCount = formBounty ? Math.max(0, Math.round(num(g('mtFBountyCount')?.value))) : 0;
      rec.bountyValue = formBounty ? Math.max(0, num(g('mtFBountyValue')?.value)) : 0;
      rec.bountyContribution = 0;
    } else {
      const pko = fmtVal === 'PKO' || fmtVal === 'Mystery Bounty';
      rec.bountyContribution = pko ? Math.max(0, num(g('mtFBC')?.value)) : 0;
      rec.bountyWon = pko ? Math.max(0, num(g('mtFBountyWon')?.value)) : 0;
      rec.bountyEnabled = pko;
      rec.bountyCount = 0;
      rec.bountyValue = 0;
      rec.prize = Math.max(0, num(g('mtFCash')?.value));
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
    formAddOn = recordAddOnEnabled(t);
    formBounty = recordBountyEnabled(t) || isBountyFmt(t);
    MODAL.classList.add('on');
    renderSheetShell();
    ensurePolyanaClubs().then(() => renderAddForm(addType, t));
    document.getElementById('mtSheetTitle').textContent = 'Редактировать турнир';
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
