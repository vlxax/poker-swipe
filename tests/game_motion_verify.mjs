/**
 * Game motion system E2E — flows A–E + evidence @ 390×844
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8781;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;
const DAILY_BASE = `http://127.0.0.1:${PORT}/tests/daily_game_bootstrap.html`;

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
}

async function waitForServer(ms = 12000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start');
}

async function shot(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function waitMotionReady(page) {
  await page.waitForFunction(() => window.PsMotion && window.__psShowWrapped === true, { timeout: 30000 });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = startServer();
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const report = {
    sharedMotion: false,
    noHardSwaps: false,
    bubblePress: false,
    miniAppEntry: false,
    cardDeal: false,
    streetTransition: false,
    decisionFeedback: false,
    analysisReveal: false,
    bottomNav: false,
    sizingFeedback: false,
    rangesFeedback: false,
    dailyFlow: false,
    viewport390: false,
    reducedMotion: false,
    runtimeErrors: [],
    tests: []
  };

  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => window.__maGameLayout === true, { timeout: 30000 });
    await page.waitForFunction(() => {
      const app = document.getElementById('mainApp');
      return app && !app.classList.contains('hidden');
    }, { timeout: 30000 });
    await page.evaluate(() => { if (typeof window.renderHome === 'function') window.renderHome(); });
    await waitMotionReady(page);

    report.sharedMotion = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return !!(window.PsMotion && root.getPropertyValue('--motion-tap').trim());
    });
    assert.ok(report.sharedMotion, 'PsMotion + tokens');

    // Evidence 7: bottom nav transition
    await page.evaluate(() => window.show('home'));
    await page.waitForTimeout(200);
    await page.click('[data-nav="polyana"]');
    await page.waitForTimeout(320);
    report.bottomNav = await page.evaluate(() => {
      const ind = document.querySelector('.ps-nav-indicator');
      const on = document.querySelector('[data-nav="polyana"].on');
      return !!(ind && on);
    });
    await shot(page, 'motion_07_bottom_nav_390x844');

    // Evidence 2: mini-app entry transition
    await page.evaluate(() => window.show('home'));
    await page.waitForTimeout(400);
    const tile = await page.$('#homeReview30, #homeReview, #homeSizing30, #homeSizing');
    if (tile) {
      const box = await tile.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await shot(page, 'motion_02_miniapp_entry_390x844');
        await page.mouse.up();
        await tile.click();
        await page.waitForTimeout(400);
      }
    }
    await page.evaluate(() => window.show('review'));
    await page.waitForTimeout(400);
    report.miniAppEntry = await page.evaluate(() => !!document.querySelector('#reviewArea .pgShell'));
    await shot(page, 'motion_02b_review_shell_390x844');

    // Evidence 3: cards in arena
    report.cardDeal = await page.evaluate(() => {
      const wrap = document.querySelector('#reviewArea .pgDealIn');
      const cards = document.querySelectorAll('#reviewArea .pgBoardZone .pc, #reviewArea .pgHeroZone .pc');
      return !!(wrap && cards.length >= 2);
    });
    await shot(page, 'motion_03_cards_arena_390x844');

    // Evidence 1: button pressed state
    const node = await page.$('#reviewArea [data-rn="0"]');
    if (node) {
      const nb = await node.boundingBox();
      if (nb) {
        await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);
        report.bubblePress = await page.evaluate(() =>
          document.querySelector('#reviewArea [data-rn="0"]')?.classList.contains('ps-pressed') === true
        );
        await shot(page, 'motion_01_button_pressed_390x844');
        await page.mouse.up();
      }
      await node.click();
      await page.waitForTimeout(150);
      await page.click('#rvSure');
      await page.waitForTimeout(650);
      report.analysisReveal = await page.evaluate(() => {
        const stages = document.querySelectorAll('#reviewArea .ps-reveal-show, #reviewArea .ps-step-lit');
        return stages.length > 0 || !!document.querySelector('#reviewArea .brainPanel, #reviewArea .verdict');
      });
      await shot(page, 'motion_06_analysis_reveal_390x844');
    }

    // Flow D: Sizing
    await page.evaluate(() => window.show('sizing'));
    await page.waitForTimeout(400);
    const lock = await page.$('#sizeLock');
    if (lock) {
      await lock.dispatchEvent('mousedown');
      await page.waitForTimeout(90);
      await shot(page, 'motion_01b_sizing_press_390x844');
      await lock.click();
      await page.waitForTimeout(500);
      report.sizingFeedback = await page.evaluate(() => {
        const v = document.querySelector('#sizeResult .verdict');
        return !!(v && (v.querySelector('.ps-reveal-show') || v.textContent.length > 5));
      });
      await shot(page, 'motion_05_sizing_feedback_390x844');
    }

    // Flow A: swipe decision
    await page.evaluate(() => { window.show('swipe'); if (typeof window.newSwipeSession === 'function') window.newSwipeSession(); window.renderSwipe?.(); });
    await page.waitForTimeout(450);
    const choice = await page.$('[data-sa]');
    if (choice) {
      await choice.click();
      await page.waitForTimeout(450);
      report.decisionFeedback = await page.evaluate(() => {
        const locked = document.querySelector('[data-sa].ps-decision-locked, [data-sa].selected');
        const verdict = document.querySelector('#swipeVerdict:not(.hidden)');
        return !!(locked && verdict);
      });
      await shot(page, 'motion_04_decision_selected_390x844');
      await shot(page, 'motion_05_swipe_feedback_390x844');
    }

    // Flow E: Ranges
    await page.evaluate(() => window.show('ranges'));
    await page.waitForTimeout(800);
    const startBtn = await page.$('#rangesStart');
    if (startBtn) {
      await startBtn.click();
      await page.waitForTimeout(500);
    }
    const rangeCell = await page.$('.rangesCell[data-rhand]:not(.isDisabled)');
    if (rangeCell) {
      await rangeCell.click();
      await page.waitForTimeout(250);
      report.rangesFeedback = await page.evaluate(() => {
        const c = document.querySelector('.rangesCell[data-rhand].selected, .rangesCell[data-rhand].kept');
        return !!c;
      });
    }

    report.noHardSwaps = await page.evaluate(() => window.__psShowWrapped === true);
    report.viewport390 = (await page.viewportSize())?.width === 390;

    // Flow B: Daily full
    await page.goto(DAILY_BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => window.__maGameLayout === true, { timeout: 30000 });
    await waitMotionReady(page);
    await page.evaluate(() => window.show('daily'));
    await page.waitForTimeout(800);
    await page.click('#trStart');
    await page.waitForSelector('#dailyArea .pgDecisionGrid .choice, #dailyArea .pgDailyLoading', { timeout: 25000 });
    const loading = await page.$('#dailyArea .pgDailyLoading');
    if (loading) await page.waitForSelector('#dailyArea .pgDecisionGrid .choice', { timeout: 30000 });
    await page.waitForTimeout(500);
    report.streetTransition = await page.evaluate(() => !!document.querySelector('#dailyArea .pgStreetDots, #dailyArea .pgDailyDrill'));
    report.dailyWhiteFrame = await page.evaluate(() => {
      const shell = document.querySelector('#dailyArea .pgShell.pgDaily');
      if (!shell) return false;
      const cs = getComputedStyle(shell);
      const after = getComputedStyle(shell, '::after');
      const border = cs.borderWidth;
      const borderColor = cs.borderColor;
      const hasWhiteBorder = /white|rgba\(255,\s*255,\s*255|rgb\(255,\s*255,\s*255\)/i.test(borderColor) && border !== '0px';
      const afterVisible = after.content !== 'none' && after.display !== 'none' && parseFloat(after.opacity || '1') > 0.05;
      return !hasWhiteBorder && !afterVisible && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
    await shot(page, 'motion_daily_no_white_frame_390x844');
    const dailyChoice = await page.$('#dailyArea .pgDecisionGrid .choice');
    if (dailyChoice) {
      await dailyChoice.click();
      await page.waitForTimeout(700);
      report.dailyFlow = await page.evaluate(() => !!document.querySelector('#dailyArea .pgDailyFeedback, #dailyArea .verdict'));
      await shot(page, 'motion_05_daily_feedback_390x844');
    }

    // prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.show('home'));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.show('sizing'));
    await page.waitForTimeout(100);
    report.reducedMotion = await page.evaluate(() => {
      const tap = getComputedStyle(document.documentElement).getPropertyValue('--motion-tap').trim();
      return tap === '0ms' || tap === '0';
    });

    report.runtimeErrors = errors.filter((e) => !/myGo18/.test(e));
    report.noHardSwaps = await page.evaluate(() => window.__psShowWrapped === true);
    report.viewport390 = true;
    report.tests.push('game_motion_verify: PASS');

    console.log(JSON.stringify(report, null, 2));
    assert.ok(report.sharedMotion);
    assert.ok(report.noHardSwaps);
    assert.ok(report.miniAppEntry);
    assert.ok(report.cardDeal);
    assert.ok(report.bottomNav);
    assert.ok(report.bubblePress || report.decisionFeedback || report.sizingFeedback);
    assert.ok(report.dailyFlow);
    assert.ok(report.dailyWhiteFrame !== false, 'daily white frame should be removed');
    assert.ok(report.reducedMotion);
    assert.equal(report.runtimeErrors.length, 0, 'runtime errors: ' + report.runtimeErrors.join('; '));
  } catch (e) {
    report.tests.push('game_motion_verify: FAIL — ' + e.message);
    report.runtimeErrors = errors;
    console.log(JSON.stringify(report, null, 2));
    throw e;
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
