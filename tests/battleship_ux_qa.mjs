/**
 * Battleship UX runtime QA — no pre-revealed answers, 390×844.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PS_PORT || '8765';
const BASE = `http://localhost:${PORT}/index.html`;
const OUT = '/opt/cursor/artifacts/battleship_ux_qa';
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
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.show('ranges'));
  await page.waitForTimeout(1500);

  await page.click('#rbOpenBattle');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const id = document.querySelector('#rbStartCourse')?.dataset?.course;
    if (id) return window.PokerSwipeRanges.selectBattleshipCourse(id);
  });
  await page.waitForTimeout(2500);
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

  const scroll = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    viewW: window.innerWidth
  }));

  const summary = {
    ALL_NEUTRAL_BEFORE_TAP: report.beforeTap.hits === 0 && report.beforeTap.misses === 0 && report.beforeTap.dimmed === 0,
    CORRECT_ONLY_AFTER_TAP: report.afterCorrectTap.hits === 1 && report.afterCorrectTap.misses === 0,
    WRONG_ONLY_AFTER_TAP: (report.afterWrongTap.misses || 0) >= 1,
    TUTORIAL_ONE_CELL: report.tutorialOneCell,
    TUTORIAL_CLEARED: report.afterTutorial.pulses === 0,
    VIEWPORT_390: scroll.docW <= scroll.viewW + 2,
    NEW_ERRORS: errors.length,
    PASS: report.beforeTap.hits === 0 && report.beforeTap.dimmed === 0 && report.tutorialOneCell
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ report, summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.PASS ? 0 : 1);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser.close();
}
