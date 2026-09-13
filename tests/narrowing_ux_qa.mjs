/**
 * Narrowing UX QA — trainer-backed visual narrowing at 390×844.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PS_PORT || '8765';
const BASE = `http://localhost:${PORT}/index.html`;
const OUT = '/opt/cursor/artifacts/narrowing_ux_qa';
const DEVICE_ID = 'narrowing-ux-' + Date.now();

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
    localStorage.removeItem('pokerSwipe_narrowing_onboard_v1');
  }, { deviceId: DEVICE_ID, user: seedUser() });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.show('ranges'));
  await page.waitForTimeout(1500);

  await page.click('#rbOpenNarrow');
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const id = document.querySelector('#rnStartLesson')?.dataset?.lesson;
    if (id) return window.PokerSwipeRanges.startNarrowingLesson(id);
  });
  await page.waitForTimeout(2500);

  report.catalog = await page.evaluate(() => ({
    hasPicker: !!document.querySelector('.rnPicker'),
    hasStart: !!document.querySelector('#rnStartLesson')
  }));

  report.onboarding = await page.evaluate(() => !!document.querySelector('.rnOnboard'));
  if (report.onboarding) {
    await page.click('#rnOnboardOk');
    await page.waitForTimeout(400);
  }

  report.previewMatrix = await page.evaluate(() => ({
    cells: document.querySelectorAll('.rnCell').length,
    neutral: document.querySelectorAll('.rnCell.neutral').length
  }));

  await page.click('#rnReveal');
  await page.waitForTimeout(800);

  report.afterReveal = await page.evaluate(() => ({
    survives: document.querySelectorAll('.rnCell.survives').length,
    excluded: document.querySelectorAll('.rnCell.excluded').length,
    hasCounts: /ОСТАЛОСЬ/.test(document.body.innerText)
  }));

  await page.click('#rnContinue');
  await page.waitForTimeout(400);

  const choice = await page.$('.rnChoice');
  if (choice) {
    await choice.click();
    await page.waitForTimeout(400);
    report.interactive = true;
  }

  const scroll = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    viewW: window.innerWidth
  }));
  report.viewport390 = scroll.docW <= scroll.viewW + 2;

  await page.screenshot({ path: path.join(OUT, 'narrowing_reveal.png'), fullPage: true });

  const summary = {
    NARROWING_CATALOG: report.catalog?.hasPicker && report.catalog?.hasStart,
    FIRST_TIME_ONBOARD: report.onboarding,
    MATRIX_VISIBLE: report.previewMatrix?.cells === 169,
    BEFORE_AFTER_ANIMATION: report.afterReveal?.survives > 0 && report.afterReveal?.excluded > 0,
    INTERACTIVE: report.interactive,
    VIEWPORT_390: report.viewport390,
    NEW_ERRORS: errors.length,
    PASS: report.afterReveal?.hasCounts && report.afterReveal?.survives > 0 && report.viewport390
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
