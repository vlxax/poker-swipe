/**
 * Real browser smoke: ranges + Battleship + gateway + MM exactly-once + reload.
 * Run: PS_PORT=8765 node tests/runtime_smoke_forensic.mjs
 */
import { chromium } from 'playwright';

const PORT = process.env.PS_PORT || '8765';
const BASE = `http://127.0.0.1:${PORT}/index.html`;

function seedUser(id) {
  return {
    version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 50, streak: 1,
    lastDay: '2026-09-01', events: [], hands: [], myHands18: [], tournaments: [],
    dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
    xray: { onboarded: true, runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
    healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] },
    deviceId: id
  };
}

function hideAuth() {
  document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
    el.classList.add('hidden');
    el.style.pointerEvents = 'none';
  });
  document.getElementById('mainApp')?.classList.remove('hidden');
}

function countMmEvents() {
  const events = [];
  const c = window.PokerSwipeRanges?.battleshipController;
  if (c?.learnerMemory) {
    for (const st of c.learnerMemory.allStates()) {
      for (const rec of st._eventLog || []) {
        events.push({ c: rec.c, t: rec.t, itemId: st.itemId, mission: rec.missionResult || st.context?.missionResult });
      }
    }
  }
  for (const k of Object.keys(localStorage).filter((x) => x.includes('mistakeMemory'))) {
    try {
      const payload = JSON.parse(localStorage.getItem(k) || '{}').payload?.items || {};
      for (const [itemId, st] of Object.entries(payload)) {
        for (const rec of st._eventLog || st.eventLog || []) {
          events.push({ c: rec.c, t: rec.t, itemId, source: 'ls' });
        }
      }
    } catch (_) { /* ignore */ }
  }
  return events;
}

const browser = await chromium.launch({ headless: true });
const report = { modes: [], errors: [], timings: {} };

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const deviceId = 'forensic-smoke';
  await context.addInitScript(({ user, deviceId: did }) => {
    localStorage.setItem('pokerSwipeDeviceId', did);
    localStorage.setItem(`pokerSwipeV32_user_${did}`, JSON.stringify(user));
    localStorage.setItem('pokerSwipe_rangeBattle_v1', JSON.stringify({
      lastChartId: 'B2_0001',
      lastCourseId: 'B2_0001',
      courses: { B2_0001: { chartId: 'B2_0001', courseId: 'B2_0001' } }
    }));
  }, { user: seedUser(deviceId), deviceId });

  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(`pageerror:${e}`));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`console:${m.text()}`); });

  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.PokerSwipeGrading && window.PokerSwipeRanges, undefined, { timeout: 120000 });
  report.timings.bootMs = Date.now() - t0;
  await page.evaluate(hideAuth);

  // Range families
  const families = await page.evaluate(async () => {
    const { initBrowserTrainerLookup } = await import('/trainer-knowledge/browserLookup.js');
    const api = await initBrowserTrainerLookup();
    return {
      bekhtold: api.getChartById('BL_callpush-009789affc23')?.id || null,
      uo: api.getChartById('UO_2-4_EP')?.id || null,
      blUo: api.charts.find((c) => String(c.id).startsWith('BL_uo'))?.id || null,
      b2: api.getChartById('B2_0001')?.id || null,
      chartCount: api.charts.length
    };
  });
  report.families = families;

  // Gateway instrumentation
  await page.evaluate(() => {
    window.__gwCalls = [];
    const G = window.PokerSwipeGrading;
    const orig = G.gradeDecision.bind(G);
    G.gradeDecision = function (input, opts) {
      const t0 = performance.now();
      const r = orig(input, opts);
      window.__gwCalls.push({
        mode: input?.mode,
        ms: performance.now() - t0,
        ok: r?.ok,
        memoryWritten: r?.memory?.written,
        memoryReason: r?.memory?.reason
      });
      return r;
    };
    const origB = G.gradeBrain.bind(G);
    G.gradeBrain = function (...args) {
      const t0 = performance.now();
      const r = origB(...args);
      window.__gwCalls.push({ mode: args[3] || 'swipe', via: 'gradeBrain', ms: performance.now() - t0, grade: r?.grade });
      return r;
    };
  });

  // Swipe
  const swipeT0 = Date.now();
  await page.evaluate(() => { window.show?.('swipe'); });
  await page.waitForSelector('[data-sa]', { timeout: 30000 });
  const beforeSwipeMm = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.includes('mistakeMemory'));
    return { keys: keys.length, gwOwner: window.PokerSwipeGrading.__owner };
  });
  await page.locator('[data-sa]').first().click({ force: true });
  await page.waitForTimeout(500);
  const swipe = await page.evaluate(() => ({
    locked: window.swLocked,
    verdict: !document.getElementById('swipeVerdict')?.classList.contains('hidden'),
    selected: document.querySelector('[data-sa].selected')?.className || null,
    gwCalls: window.__gwCalls?.length || 0
  }));
  report.timings.swipeMs = Date.now() - swipeT0;
  report.modes.push({ mode: 'swipe', ...swipe, gatewayOwner: beforeSwipeMm.gwOwner });

  // Battleship: off-target (strategy ok) + miss
  await page.evaluate(() => window.show('ranges'));
  await page.waitForSelector('#rbOpenBattle', { timeout: 60000 });
  await page.evaluate(hideAuth);
  const battleT0 = Date.now();
  await page.locator('#rbOpenBattle').click({ force: true });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const id = document.querySelector('#rbStartCourse')?.dataset?.course;
    if (id) window.PokerSwipeRanges.selectBattleshipCourse(id);
  });
  await page.waitForSelector('#rbBeginMission', { timeout: 60000 });
  await page.locator('#rbBeginMission').click({ force: true });
  await page.waitForTimeout(700);

  const tutorial = await page.evaluate(() => document.querySelector('.rbCell.tutorial-pulse')?.dataset?.hand);
  if (tutorial) {
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), tutorial);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.PokerSwipeRanges.dismissTutorial?.());
  }

  function readBattleEvents() {
    const c = window.PokerSwipeRanges.battleshipController;
    const events = [];
    for (const st of c.learnerMemory.allStates()) {
      for (const rec of st._eventLog || []) {
        events.push({
          c: rec.c,
          t: rec.t,
          itemId: st.itemId,
          missionResult: st.context?.missionResult || null,
          strategyOk: st.context?.strategyOk
        });
      }
    }
    events.sort((a, b) => a.t - b.t);
    return { events, chartId: c.model?.chartId };
  }

  const taps = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    const targets = new Set(c.missions[c.state.missionIndex].getTargetHands());
    let offTarget = null;
    let miss = null;
    for (const el of document.querySelectorAll('.rbCell')) {
      const h = el.dataset.hand;
      if (!h || c.state.resolved.has(h)) continue;
      const inR = c._inRange(h);
      if (!targets.has(h) && inR && !offTarget) offTarget = h;
      if (!inR && !miss) miss = h;
    }
    return { offTarget, miss };
  });

  const eventsBefore = await page.evaluate(readBattleEvents);
  if (taps.offTarget) {
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), taps.offTarget);
    await page.waitForTimeout(300);
  }
  const afterOff = await page.evaluate(readBattleEvents);
  if (taps.miss) {
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), taps.miss);
    await page.waitForTimeout(300);
  }
  const afterBoth = await page.evaluate(readBattleEvents);
  report.battleship = { ...taps, eventsBefore: eventsBefore.events.length, afterOff, afterBoth };
  report.timings.battleshipMs = Date.now() - battleT0;

  const battleStates = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    return [...c.learnerMemory.allStates()].map((st) => ({
      itemId: st.itemId,
      lastC: st._eventLog?.at(-1)?.c || null
    }));
  });
  report.battleStates = battleStates;

  // Reload persistence (Battleship MM via controller + localStorage)
  const preReload = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.includes('mistakeMemory'));
    let items = 0;
    let events = 0;
    const c = window.PokerSwipeRanges?.battleshipController;
    if (c?.learnerMemory) {
      for (const st of c.learnerMemory.allStates()) events += (st._eventLog || []).length;
    }
    for (const k of keys) {
      const payload = JSON.parse(localStorage.getItem(k) || '{}').payload?.items || {};
      items += Object.keys(payload).length;
    }
    return { keys, items, events };
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.PokerSwipeRanges, undefined, { timeout: 120000 });
  const postReload = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.includes('mistakeMemory'));
    let items = 0;
    let events = 0;
    for (const k of keys) {
      const payload = JSON.parse(localStorage.getItem(k) || '{}').payload?.items || {};
      items += Object.keys(payload).length;
      for (const st of Object.values(payload)) events += (st._eventLog || st.eventLog || []).length;
    }
    return { keys, items, events };
  });
  report.persistence = { preReload, postReload, noDuplicationOnReload: preReload.events === postReload.events };

  const gwCalls = await page.evaluate(() => window.__gwCalls || []);
  report.gatewayCalls = gwCalls;
  report.errors = report.errors.filter((e) => !/Failed to load resource/.test(e));

  const allBattleEvents = report.battleship?.afterBoth?.events || [];
  const offTargetState = battleStates.find((s) => s.itemId?.includes(report.battleship?.offTarget || 'ZZZ'));
  const missState = battleStates.find((s) => s.itemId?.includes(report.battleship?.miss || 'ZZZ'));

  report.PASS = report.errors.length === 0
    && families.chartCount === 1698
    && !!families.bekhtold && !!families.uo && !!families.blUo
    && swipe.verdict === true
    && swipe.gwCalls >= 1
    && allBattleEvents.length >= 2
    && offTargetState?.lastC === 'PURE_MATCH'
    && missState?.lastC === 'OUT_OF_STRATEGY'
    && report.persistence.noDuplicationOnReload
    && postReload.events >= preReload.events
    && (report.timings.swipeMs || 9999) < 3000
    && (report.timings.battleshipMs || 9999) < 8000;

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.PASS ? 0 : 1);
} finally {
  await browser.close();
}
