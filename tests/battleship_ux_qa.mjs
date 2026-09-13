/**
 * Battleship UX runtime QA — no pre-revealed answers, 390×844.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PS_PORT || '8765';
const BASE = `http://localhost:${PORT}/index.html`;
const OUT = process.env.PS_QA_OUT || path.join(process.cwd(), 'test-results/battleship_ux_qa');
const DEVICE_ID = 'battleship-ux-' + Date.now();

fs.mkdirSync(OUT, { recursive: true });

function seedUser() {
  return {
    version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 50, streak: 1,
    lastDay: '2026-08-25', events: [], hands: [], myHands18: [], tournaments: [],
    dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
    xray: { onboarded: true, runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
    healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] }
  };
}

const report = {};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ deviceId, user }) => {
    localStorage.setItem('pokerSwipeDeviceId', deviceId);
    localStorage.setItem(`pokerSwipeV32_user_${deviceId}`, JSON.stringify(user));
    localStorage.removeItem('pokerSwipe_rangeBattle_tutorial_v1');
  }, { deviceId: DEVICE_ID, user: seedUser() });

  const page = await context.newPage();
  const errors = [];
  const missingAssets = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console:' + m.text());
  });
  page.on('response', (r) => {
    const url = r.url();
    if (r.status() >= 400 && /trainer|ranges-ui|range-learning|strategy-map|charts-index|trainer-shards|b2-id-alias/i.test(url)) {
      missingAssets.push(`${r.status()} ${url}`);
    }
  });

  function relevantErrors(list) {
    return list.filter((e) =>
      /ranges-ui|trainer-knowledge|range-learning|strategy-map|battleship|PokerSwipeRanges|trainer-shards|charts-index|b2-id-alias|Failed to resolve module specifier/i.test(e)
    );
  }

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.PokerSwipeRanges && document.getElementById('ranges'), undefined, { timeout: 120000 });
  await page.evaluate(() => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
      el.classList.add('hidden');
      el.style.pointerEvents = 'none';
    });
    document.getElementById('mainApp')?.classList.remove('hidden');
    window.show('ranges');
  });
  await page.waitForSelector('#rbOpenBattle', { timeout: 60000 });
  await page.evaluate(() => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
      el.classList.add('hidden');
      el.style.pointerEvents = 'none';
    });
  });
  await page.locator('#rbOpenBattle').click({ force: true });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const id = document.querySelector('#rbStartCourse')?.dataset?.course;
    if (id) return window.PokerSwipeRanges.selectBattleshipCourse(id);
  });
  await page.waitForSelector('#rbBeginMission', { timeout: 60000 });
  await page.click('#rbBeginMission');
  await page.waitForTimeout(600);

  report.beforeTap = await page.evaluate(() => ({
    hits: document.querySelectorAll('.rbCell.hit').length,
    misses: document.querySelectorAll('.rbCell.miss').length,
    dimmed: document.querySelectorAll('.rbCell.dimmed').length,
    neutral: document.querySelectorAll('.rbCell.neutral').length,
    pulses: document.querySelectorAll('.rbCell.tutorial-pulse').length,
    cells: document.querySelectorAll('.rbCell').length
  }));
  await page.screenshot({ path: path.join(OUT, 'A_before_any_tap.png') });

  const tutorialHand = await page.evaluate(() => {
    const c = document.querySelector('.rbCell.tutorial-pulse');
    return c?.dataset?.hand || null;
  });
  report.tutorialOneCell = report.beforeTap.pulses <= 1;
  if (tutorialHand) {
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), tutorialHand);
    await page.waitForTimeout(400);
  }
  report.afterCorrectTap = await page.evaluate(() => ({
    hits: document.querySelectorAll('.rbCell.hit').length,
    misses: document.querySelectorAll('.rbCell.miss').length
  }));
  await page.screenshot({ path: path.join(OUT, 'B_after_correct_tap.png') });

  await page.evaluate(() => window.PokerSwipeRanges.dismissTutorial?.());
  await page.waitForTimeout(300);
  report.afterTutorial = await page.evaluate(() => ({
    pulses: document.querySelectorAll('.rbCell.tutorial-pulse').length,
    hits: document.querySelectorAll('.rbCell.hit').length
  }));

  report.trainerRange = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    return {
      chartId: c.model?.chartId || null,
      supported: c.model?.supported === true,
      cells: document.querySelectorAll('.rbCell').length,
      sourceGroup: c.model?.sourceGroup || c.model?.chart?.sourceGroup || null
    };
  });

  const offTarget = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    const mission = c.missions[c.state.missionIndex];
    const targets = new Set(mission.getTargetHands());
    for (const el of document.querySelectorAll('.rbCell')) {
      const h = el.dataset.hand;
      if (!h || c.state.resolved.has(h)) continue;
      if (c._inRange(h) && !targets.has(h)) return h;
    }
    return null;
  });
  report.offTargetHand = offTarget;
  if (offTarget) {
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), offTarget);
    await page.waitForTimeout(400);
  }
  report.offTargetMemory = await page.evaluate((hand) => {
    const c = window.PokerSwipeRanges.battleshipController;
    const events = [];
    for (const st of c.learnerMemory.allStates()) {
      for (const rec of st._eventLog || []) events.push({ itemId: st.itemId, t: rec.t, c: rec.c, a: rec.a });
    }
    events.sort((a, b) => a.t - b.t);
    const last = events[events.length - 1] || null;
    return {
      lastClassification: last?.c || null,
      lastItemId: last?.itemId || null,
      visualMiss: document.querySelectorAll('.rbCell.miss').length >= 1,
      hand
    };
  }, offTarget);

  const foldHand = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    for (const el of document.querySelectorAll('.rbCell')) {
      const h = el.dataset.hand;
      if (!h || c.state.resolved.has(h)) continue;
      if (!c._inRange(h)) return h;
    }
    return null;
  });
  report.foldHand = foldHand;
  if (foldHand) {
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), foldHand);
    await page.waitForTimeout(400);
  }
  report.falsePositiveMemory = await page.evaluate(() => {
    const c = window.PokerSwipeRanges.battleshipController;
    const events = [];
    for (const st of c.learnerMemory.allStates()) {
      for (const rec of st._eventLog || []) events.push({ t: rec.t, c: rec.c });
    }
    events.sort((a, b) => a.t - b.t);
    return { lastClassification: events[events.length - 1]?.c || null };
  });

  const wrongHand = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.rbCell.neutral:not([disabled])')];
    return cells[0]?.dataset?.hand || null;
  });
  if (wrongHand) {
    await page.evaluate((hand) => window.PokerSwipeRanges.handleCellTap(hand), wrongHand);
    await page.waitForTimeout(400);
  }
  report.afterWrongTap = await page.evaluate(() => ({
    misses: document.querySelectorAll('.rbCell.miss').length
  }));
  await page.screenshot({ path: path.join(OUT, 'C_after_wrong_tap.png') });

  for (let i = 0; i < 3; i++) {
    const hand = await page.evaluate(() => {
      const c = document.querySelector('.rbCell.neutral:not([disabled])');
      return c?.dataset?.hand || null;
    });
    if (!hand) break;
    await page.evaluate((h) => window.PokerSwipeRanges.handleCellTap(h), hand);
    await page.waitForTimeout(200);
  }
  report.after5Taps = await page.evaluate(() => ({
    hits: document.querySelectorAll('.rbCell.hit').length,
    misses: document.querySelectorAll('.rbCell.miss').length,
    neutral: document.querySelectorAll('.rbCell.neutral').length
  }));
  await page.screenshot({ path: path.join(OUT, 'D_after_multiple_taps.png') });

  const beforeRetry = await page.evaluate(() => {
    const s = window.PokerSwipeRanges.battleshipController.state;
    return { hits: s.hits, grenades: s.grenades, missionIndex: s.missionIndex };
  });
  await page.evaluate(() => window.PokerSwipeRanges.battleshipController.retryMission());
  await page.waitForTimeout(400);
  report.retry = await page.evaluate((before) => {
    const s = window.PokerSwipeRanges.battleshipController.state;
    return {
      beforeHits: before.hits,
      afterHits: s.hits,
      afterMisses: s.misses,
      afterGrenades: s.grenades,
      status: s.status,
      playing: s.status === 'playing'
    };
  }, beforeRetry);

  const scroll = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    viewW: window.innerWidth
  }));

  const battleshipErrors = relevantErrors(errors);
  const summary = {
    APP_OPENS: true,
    BATTLESHIP_LOADS: report.beforeTap.cells === 169,
    TRAINER_RANGE_RESOLVES: /^(BL_|UO_)/.test(report.trainerRange.chartId || '') && report.trainerRange.supported && report.trainerRange.cells === 169,
    HIT_WORKS: report.afterCorrectTap.hits === 1 && report.afterCorrectTap.misses === 0,
    STRATEGY_FALSE_POSITIVE: report.falsePositiveMemory.lastClassification === 'OUT_OF_STRATEGY',
    MISSION_OFF_TARGET_STRATEGY_OK: report.offTargetMemory.lastClassification === 'PURE_MATCH',
    RETRY_RESETS: report.retry.afterHits === 0 && report.retry.playing === true && report.retry.afterGrenades > 0,
    ALL_NEUTRAL_BEFORE_TAP: report.beforeTap.hits === 0 && report.beforeTap.misses === 0 && report.beforeTap.dimmed === 0,
    WRONG_ONLY_AFTER_TAP: (report.afterWrongTap.misses || 0) >= 1,
    TUTORIAL_ONE_CELL: report.tutorialOneCell,
    TUTORIAL_CLEARED: report.afterTutorial.pulses === 0,
    VIEWPORT_390: scroll.docW <= scroll.viewW + 2,
    MISSING_ASSETS: missingAssets.length,
    BATTLESHIP_ERRORS: battleshipErrors.length,
    RAW_CONSOLE: errors.length,
    PASS: false
  };
  summary.PASS = summary.ALL_NEUTRAL_BEFORE_TAP
    && summary.HIT_WORKS
    && summary.STRATEGY_FALSE_POSITIVE
    && summary.MISSION_OFF_TARGET_STRATEGY_OK
    && summary.RETRY_RESETS
    && summary.TRAINER_RANGE_RESOLVES
    && summary.BATTLESHIP_LOADS
    && summary.MISSING_ASSETS === 0
    && summary.BATTLESHIP_ERRORS === 0
    && summary.TUTORIAL_ONE_CELL;

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ report, summary, battleshipErrors, missingAssets }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.PASS ? 0 : 1);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser.close();
}
