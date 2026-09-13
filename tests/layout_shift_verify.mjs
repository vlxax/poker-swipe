/**
 * P0 Layout shift verification @ 390×844
 * Measures main container + bottom nav stability on tap/navigation.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8790;
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

async function metrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const main = document.getElementById('mainApp');
    const active = document.querySelector('.screen.active');
    const nr = nav?.getBoundingClientRect();
    const mr = main?.getBoundingClientRect();
    const ar = active?.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      navTop: nr ? Math.round(nr.top) : null,
      navHeight: nr ? Math.round(nr.height) : null,
      mainTop: mr ? Math.round(mr.top) : null,
      activeTop: ar ? Math.round(ar.top) : null,
      bodyTransform: getComputedStyle(document.body).transform,
      mainTransform: main ? getComputedStyle(main).transform : null,
      screenTransform: active ? getComputedStyle(active).transform : null
    };
  });
}

async function checkStable(page, action, label) {
  const before = await metrics(page);
  await action();
  await page.waitForTimeout(180);
  const during = await metrics(page);
  await page.waitForTimeout(220);
  const after = await metrics(page);

  const navJump = before.navTop != null && (
    Math.abs(during.navTop - before.navTop) > 1 ||
    Math.abs(after.navTop - before.navTop) > 1
  );
  const mainJump = before.mainTop != null && Math.abs(after.mainTop - before.mainTop) > 2;
  const scrollJump = Math.abs(after.scrollY - before.scrollY) > 8;
  const parentMoved = [after.bodyTransform, after.mainTransform, after.screenTransform]
    .some((t) => t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)');

  return {
    label,
    navJump,
    mainJump,
    scrollJump,
    parentMoved,
    layoutShift: navJump || mainJump || scrollJump || parentMoved,
    before,
    after
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = startServer();
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const results = [];

  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => window.__psShowWrapped === true, { timeout: 30000 });
    await page.evaluate(() => { if (typeof window.renderHome === 'function') window.renderHome(); });
    await page.waitForTimeout(400);

    results.push(await checkStable(page, async () => {
      const btn = await page.$('#homeDaily30, #homeDaily');
      if (btn) {
        const box = await btn.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(80);
          await page.mouse.up();
        }
      }
    }, 'A_tap_home_cta'));

    results.push(await checkStable(page, () => page.evaluate(() => window.show('review')), 'B_open_miniapp'));

    await page.waitForTimeout(400);
    results.push(await checkStable(page, async () => {
      const node = await page.$('#reviewArea [data-rn="0"]');
      if (node) await node.click();
    }, 'C_select_answer'));

    await page.waitForTimeout(200);
    const sure = await page.$('#rvSure');
    if (sure) {
      results.push(await checkStable(page, () => sure.click(), 'D_reveal_feedback'));
    }

    results.push(await checkStable(page, () => page.evaluate(() => window.show('sizing')), 'E_sizing'));

    await page.waitForTimeout(300);
    results.push(await checkStable(page, async () => {
      const lock = await page.$('#sizeLock');
      if (lock) await lock.click();
    }, 'F_sizing_confirm'));

    results.push(await checkStable(page, () => page.click('[data-nav="polyana"]'), 'G_bottom_nav'));
    results.push(await checkStable(page, () => page.click('[data-nav="home"]'), 'G_bottom_nav_back'));

    await page.goto(DAILY_BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => window.__psShowWrapped === true, { timeout: 30000 });
    await page.evaluate(() => window.show('daily'));
    await page.waitForTimeout(600);

    results.push(await checkStable(page, () => page.click('#trStart'), 'H_daily_start'));

    await page.waitForSelector('#dailyArea .pgDecisionGrid .choice', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(400);

    const choice = await page.$('#dailyArea .pgDecisionGrid .choice');
    if (choice) {
      results.push(await checkStable(page, () => choice.click(), 'H_daily_decision'));
    }

    await page.screenshot({ path: `${OUT}/layout_shift_daily_390x844.png` });

    const layoutShifts = results.filter((r) => r.layoutShift);
    const report = {
      results: results.map(({ label, navJump, mainJump, scrollJump, parentMoved, layoutShift }) => ({
        label, navJump, mainJump, scrollJump, parentMoved, layoutShift
      })),
      layoutShiftCount: layoutShifts.length,
      viewportJumps: results.filter((r) => r.scrollJump).length,
      navMoves: results.filter((r) => r.navJump).length,
      parentMoves: results.filter((r) => r.parentMoved).length,
      runtimeErrors: errors.filter((e) => !/myGo18/.test(e))
    };

    console.log(JSON.stringify(report, null, 2));
    assert.equal(layoutShifts.length, 0, 'Layout shifts detected: ' + JSON.stringify(layoutShifts));
    assert.equal(report.runtimeErrors.length, 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

main();
