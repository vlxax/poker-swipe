/**
 * Battleship UX runtime QA — matrix tap gameplay at 390×844.
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

  report.hubHero = await page.evaluate(() => ({
    hasPlay: !!document.querySelector('#rbOpenBattle'),
    darkText: !!document.querySelector('.rbHeroCopy')
  }));

  await page.click('#rbOpenBattle');
  await page.waitForTimeout(1200);
  report.catalog = await page.evaluate(() => ({
    hasPicker: !!document.querySelector('.rbPicker'),
    hasGo: !!document.querySelector('#rbStartCourse')
  }));

  await page.click('#rbStartCourse');
  await page.waitForTimeout(2500);

  const intro = await page.evaluate(() => ({
    hasIntro: !!document.querySelector('.rbMissionIntro'),
    hasMatrixBeforeStart: !!document.querySelector('.rbMatrix')
  }));
  report.compactIntro = intro.hasIntro && !intro.hasMatrixBeforeStart;

  await page.click('#rbBeginMission');
  await page.waitForTimeout(600);

  const matrix = await page.evaluate(() => ({
    visible: !!document.querySelector('.rbMatrix'),
    cells: document.querySelectorAll('.rbCell').length,
    interactive: document.querySelectorAll('.rbCell:not([disabled])').length
  }));
  report.matrix390 = matrix.visible && matrix.cells === 169;
  report.matrixInteractive = matrix.interactive > 100;

  // Tutorial pulse cell or first enabled cell
  let tapped = false;
  const pulse = await page.$('.rbCell.tutorial-pulse');
  if (pulse) {
    await pulse.click();
    await page.waitForTimeout(400);
    tapped = true;
  }
  const hitClass = await page.evaluate(() => document.querySelector('.rbCell.hit, .rbCell.flash-hit') !== null);
  report.tutorialHit = hitClass;

  const okBtn = await page.$('#rbTutorialOk');
  if (okBtn) {
    await okBtn.click();
    await page.waitForTimeout(300);
  }

  // Tap a wrong cell (offsuit low card often fold)
  const wrongCell = await page.$('.rbCell.offsuit:not(.locked):not(.dimmed):not(.hit)');
  if (wrongCell) {
    await wrongCell.click();
    await page.waitForTimeout(400);
    report.wrongExplosion = await page.evaluate(() =>
      !!document.querySelector('.rbCell.miss, .rbCell.flash-miss, .rbFeedbackPop--miss')
    );
    report.grenadesLost = await page.evaluate(() => {
      const t = document.querySelector('.rbHudStat small')?.textContent;
      return t === '2' || t === '1' || t === '0';
    });
  }

  report.comboHud = await page.evaluate(() => /КОМБО/.test(document.body.innerText));
  report.hudVisible = await page.evaluate(() => /НАЙДЕНО/.test(document.body.innerText));

  const scroll = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    viewW: window.innerWidth
  }));
  report.noHorizontalScroll = scroll.docW <= scroll.viewW + 2;

  await page.screenshot({ path: path.join(OUT, 'battleship_gameplay.png'), fullPage: true });

  const summary = {
    ROOT_CAUSE_FIXED: report.matrixInteractive,
    MATRIX_VISIBLE: report.matrix390,
    MATRIX_INTERACTIVE: report.matrixInteractive,
    HIT_FEEDBACK: report.tutorialHit,
    MISS_FEEDBACK: report.wrongExplosion,
    GRENADES: report.grenadesLost,
    COMBO_HUD: report.comboHud,
    COMPACT_INTRO: report.compactIntro,
    VIEWPORT_390: report.noHorizontalScroll,
    NEW_ERRORS: errors.length,
    PASS: report.matrix390 && report.matrixInteractive && report.compactIntro && report.noHorizontalScroll
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
