/**
 * Final runtime acceptance: boot console, 1698 lookup, Battleship, persistence.
 */
import { chromium } from 'playwright';

const PORT = process.env.PS_PORT || '8765';
const BASE = `http://127.0.0.1:${PORT}/index.html`;

function seedUser() {
  return {
    version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 50, streak: 1,
    lastDay: '2026-08-29', events: [], hands: [], myHands18: [], tournaments: [],
    dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
    xray: { onboarded: true, runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
    healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] }
  };
}

function hideAuth() {
  document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
    el.classList.add('hidden');
    el.style.pointerEvents = 'none';
  });
  document.getElementById('mainApp')?.classList.remove('hidden');
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ user }) => {
    localStorage.setItem('pokerSwipeDeviceId', 'runtime-gate');
    localStorage.setItem('pokerSwipeV32_user_runtime-gate', JSON.stringify(user));
    localStorage.setItem('pokerSwipe_rangeBattle_v1', JSON.stringify({
      lastChartId: 'B2_0001',
      lastCourseId: 'B2_0001',
      courses: { B2_0001: { chartId: 'B2_0001', courseId: 'B2_0001' } }
    }));
  }, { user: seedUser() });

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failed = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });

  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.PokerSwipeRanges && window.HandValidation, undefined, { timeout: 120000 });
  const bootMs = Date.now() - t0;
  await page.evaluate(hideAuth);

  const families = await page.evaluate(async () => {
    const { initBrowserTrainerLookup } = await import('/trainer-knowledge/browserLookup.js');
    const api = await initBrowserTrainerLookup();
    const bek = api.getChartById('BL_callpush-009789affc23');
    const uo = api.getChartById('UO_2-4_EP');
    const blu = api.charts.find((c) => String(c.id).startsWith('BL_uo'));
    const b2 = api.getChartById('B2_0001');
    return {
      bekhtold: bek?.id || null,
      uo: uo?.id || null,
      blUo: blu?.id || null,
      b2Canonical: b2?.id || null,
      chartCount: api.charts.length
    };
  });

  await page.evaluate(() => window.show('ranges'));
  await page.waitForSelector('#rbOpenBattle', { timeout: 60000 });
  await page.evaluate(hideAuth);
  await page.locator('#rbOpenBattle').click({ force: true });
  await page.waitForTimeout(1200);
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

  const offTarget = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    const targets = new Set(c.missions[c.state.missionIndex].getTargetHands());
    for (const el of document.querySelectorAll('.rbCell')) {
      const h = el.dataset.hand;
      if (h && !c.state.resolved.has(h) && c._inRange(h) && !targets.has(h)) return h;
    }
    return null;
  });
  if (offTarget) {
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), offTarget);
    await page.waitForTimeout(300);
  }

  const memory = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    const events = [];
    for (const st of c.learnerMemory.allStates()) {
      for (const rec of st._eventLog || []) events.push({ c: rec.c, t: rec.t, itemId: st.itemId });
    }
    events.sort((a, b) => a.t - b.t);
    return {
      chartId: c.model?.chartId,
      attempts: events.length,
      last: events[events.length - 1] || null,
      itemIds: [...new Set(events.map((e) => e.itemId))],
      keys: Object.keys(localStorage).filter((k) => k.includes('mistakeMemory'))
    };
  });

  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('pokerSwipe_rangeBattle_v1') || 'null'));

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.PokerSwipeRanges, undefined, { timeout: 120000 });
  await page.evaluate(hideAuth);
  const afterReload = await page.evaluate(async () => {
    const keys = Object.keys(localStorage).filter((k) => k.includes('mistakeMemory'));
    let items = 0;
    for (const k of keys) {
      try { items += Object.keys(JSON.parse(localStorage.getItem(k) || '{}').payload?.items || {}).length; } catch (_) {}
    }
    const progress = JSON.parse(localStorage.getItem('pokerSwipe_rangeBattle_v1') || 'null');
    const { migratePersistedRangeIds } = await import('/trainer-knowledge/rangeIdAlias.js');
    const migrated = migratePersistedRangeIds(progress || {});
    return { memoryKeys: keys, memoryItems: items, lastChartId: migrated.data?.lastChartId || progress?.lastChartId || null, migratedChanged: migrated.changed };
  });

  const trainerAssets = failed.filter((u) => /trainer|handValidation|charts-index|ranges-ui|b2-id-alias/i.test(u));
  const report = {
    bootMs,
    families,
    memory,
    progressMigrated: progress && !String(progress.lastChartId || '').startsWith('B2_'),
    afterReload,
    uncaught: pageErrors.length,
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 15),
    trainerAssets,
    PASS: pageErrors.length === 0
      && trainerAssets.length === 0
      && families.chartCount === 1698
      && !!families.bekhtold && !!families.uo && !!families.blUo && String(families.b2Canonical).startsWith('BL_')
      && memory.attempts >= 1
      && memory.last?.c === 'PURE_MATCH'
      && afterReload.memoryItems >= 1
      && String(afterReload.lastChartId || '').startsWith('BL_')
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.PASS ? 0 : 1);
} finally {
  await browser.close();
}
