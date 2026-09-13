/**
 * Integration runtime QA — Home recommendation + Range Battleship (390×844).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PS_PORT || '8765';
const BASE = `http://localhost:${PORT}/index.html`;
const OUT = '/opt/cursor/artifacts/integration_runtime_qa';
const DEVICE_ID = 'integration-qa-' + Date.now();

fs.mkdirSync(OUT, { recursive: true });

function seedUser(events = []) {
  return {
    version: '32.0',
    nick: 'QA',
    onboarded: true,
    diagDone: true,
    skill: 50,
    streak: 1,
    lastDay: '2026-08-25',
    events,
    hands: [],
    myHands18: [],
    tournaments: [],
    dailyArchive: [],
    snapshots: [],
    seenSwipe: [],
    diagnostic: [],
    xray: { onboarded: true, runs: 0, pre: 0, narrow: 0, river: 0, blockers: 0, best: 0, history: [], counts: {} },
    healCourses: { river_bluffcatch: [0, 0, 0, 0], sizing: [0, 0, 0, 0], bb_defence: [0, 0, 0, 0], thin_value: [0, 0, 0, 0] }
  };
}

async function setupPage(browser, events) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ deviceId, user }) => {
    localStorage.setItem('pokerSwipeDeviceId', deviceId);
    localStorage.setItem(`pokerSwipeV32_user_${deviceId}`, JSON.stringify(user));
  }, { deviceId: DEVICE_ID, user: seedUser(events) });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('#v36Swipe, #home.active', { timeout: 90000 });
  await page.waitForTimeout(2500);
  return { page, context };
}

const thinValueEvents = Array.from({ length: 4 }, (_, i) => ({
  concept: 'thin value', grade: 'r', mode: 'swipe', ts: Date.now() - i * 1000
}));

const sizingEvents = Array.from({ length: 5 }, (_, i) => ({
  concept: 'turn sizing', grade: 'r', mode: 'sizing', ts: Date.now() - i * 1000
}));

const results = { home: {}, ranges: {}, viewport: {}, errors: [] };

const browser = await chromium.launch({ headless: true });
try {
  const { page } = await setupPage(browser, thinValueEvents);
  await page.evaluate(() => window.show('home'));
  await page.waitForTimeout(500);

  const homeText = await page.evaluate(() => document.getElementById('home')?.innerText || '');
  results.home.showsThinValue = /thin value/i.test(homeText);
  results.home.hasTvoyaIgra = /ТВОЯ ИГРА/i.test(homeText);
  await page.screenshot({ path: path.join(OUT, 'home_thin_value.png') });

  await page.click('#v36Personal');
  await page.waitForTimeout(800);
  const afterCta = await page.evaluate(() => ({
    swipeActive: !!document.querySelector('#swipe.active'),
    healActive: !!document.querySelector('#heal.active'),
    sizingActive: !!document.querySelector('#sizing.active')
  }));
  results.home.ctaLaunchesSwipe = afterCta.swipeActive && !afterCta.healActive;
  results.home.ctaNotHeal = !afterCta.healActive;
  await page.screenshot({ path: path.join(OUT, 'after_home_cta.png') });

  await page.evaluate(() => window.show('home'));
  await page.waitForTimeout(300);
  await page.click('#v36Xray');
  await page.waitForTimeout(2000);
  const rangesHub = await page.evaluate(() => ({
    rangesActive: !!document.querySelector('#ranges.active'),
    xrayActive: !!document.querySelector('#xray.active'),
    text: document.querySelector('#rangesArea')?.innerText?.slice(0, 300) || '',
    hasBtn: !!document.querySelector('#rbOpenBattle')
  }));
  if (!rangesHub.hasBtn) {
    await page.evaluate(() => window.show('ranges'));
    await page.waitForTimeout(2000);
  }
  results.ranges.hubActive = rangesHub.rangesActive && !rangesHub.xrayActive;
  results.ranges.hasBattleship = /МОРСКОЙ БОЙ/i.test(rangesHub.text);
  await page.screenshot({ path: path.join(OUT, 'ranges_hub.png') });

  await page.click('#rbOpenBattle');
  await page.waitForTimeout(1500);
  const catalog = await page.evaluate(() => document.querySelector('#rangesArea')?.innerText || '');
  results.ranges.catalogShown = /ВЫБЕРИ ДИАПАЗОН|BTN/i.test(catalog);
  await page.screenshot({ path: path.join(OUT, 'battleship_catalog.png') });

  const chip = await page.$('.rbCourseChip, #rbStartCourse');
  if (chip) {
    if (await page.$('#rbStartCourse')) {
      await page.click('#rbStartCourse');
    } else {
      await chip.click();
    }
    await page.waitForTimeout(2500);
    const begin = await page.$('#rbBeginMission');
    if (begin) {
      await begin.click();
      await page.waitForTimeout(600);
    }
    const game = await page.evaluate(() => ({
      hasMatrix: !!document.querySelector('.rbMatrix'),
      cellCount: document.querySelectorAll('.rbCell').length,
      text: document.querySelector('#rangesArea')?.innerText?.slice(0, 200) || ''
    }));
    results.ranges.matrixVisible = game.hasMatrix && game.cellCount === 169;
    await page.screenshot({ path: path.join(OUT, 'battleship_matrix.png') });

    const cell = await page.$('.rbCell.tutorial-pulse, .rbCell.pair:not(.locked):not(.dimmed)');
    if (cell) {
      await cell.click();
      await page.waitForTimeout(500);
      const ok = await page.$('#rbTutorialOk');
      if (ok) await ok.click();
      results.ranges.missionPlayed = true;
      await page.screenshot({ path: path.join(OUT, 'battleship_mission.png') });
    }
  }

  const scroll = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    viewW: window.innerWidth
  }));
  results.viewport.noHorizontalScroll = scroll.docW <= scroll.viewW + 2;

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const progress = await page.evaluate(() => {
    const raw = localStorage.getItem('pokerSwipe_rangeBattle_v1');
    return raw ? JSON.parse(raw) : null;
  });
  results.ranges.progressPersisted = !!progress?.courses && Object.keys(progress.courses).length > 0;

  // Sizing mismatch test
  const { page: page2 } = await setupPage(browser, sizingEvents);
  await page2.evaluate(() => window.show('home'));
  await page2.waitForTimeout(400);
  const sizingHome = await page2.evaluate(() => document.getElementById('home')?.innerText || '');
  results.home.sizingLabel = /sizing|сайзинг/i.test(sizingHome);
  await page2.click('#v36Personal');
  await page2.waitForTimeout(600);
  results.home.sizingCta = await page2.evaluate(() => !!document.querySelector('#sizing.active'));
  await page2.screenshot({ path: path.join(OUT, 'home_sizing_cta.png') });

  const report = {
    HOME_THIN_VALUE_SHOWN: results.home.showsThinValue,
    HOME_CTA_NOT_HEAL: results.home.ctaNotHeal,
    HOME_CTA_LAUNCHES_REAL: results.home.ctaLaunchesSwipe || results.home.sizingCta,
    SIZING_CTA: results.home.sizingCta,
    RANGES_HUB: results.ranges.hubActive && results.ranges.hasBattleship,
    BATTLESHIP_MATRIX: results.ranges.matrixVisible,
    VIEWPORT_390: results.viewport.noHorizontalScroll,
    PROGRESS_PERSISTENCE: results.ranges.progressPersisted,
    artifacts: OUT
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ results, report }, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const fail = !report.HOME_CTA_NOT_HEAL || !report.RANGES_HUB || !report.BATTLESHIP_MATRIX || !report.VIEWPORT_390;
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser.close();
}
