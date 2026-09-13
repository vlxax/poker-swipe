/**
 * P0 My Tournaments routing / screen isolation @ 390×844
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8792;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

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

async function audit(page) {
  return page.evaluate(() => {
    const polyana = document.getElementById('polyana');
    const polyRoot = document.getElementById('psPolyanaArea');
    const myTour = document.getElementById('mytournaments');
    const ps72 = document.getElementById('ps72TournamentScreen');
    const markers = ['.v59Journal', '.t23', '.v58JournalHero', '.mt-pro-hero', '.ps72hero', 'h1'];
    const polyText = (polyRoot?.innerText || '').toLowerCase();
    const hasMyTourInPolyana =
      !!polyRoot?.querySelector('.v59Journal, .t23, .v58JournalHero, #ps72TournamentScreen') ||
      (polyText.includes('мои турниры') && polyText.includes('profit'));
    const ps72Parent = ps72?.parentElement?.id || ps72?.parentElement?.tagName;
    const activeScreens = [...document.querySelectorAll('.screen.active')].map((s) => s.id);
    return {
      activeScreens,
      polyanaActive: polyana?.classList.contains('active'),
      myTourActive: myTour?.classList.contains('active'),
      ps72On: ps72?.classList.contains('on'),
      ps72Visible: ps72 ? getComputedStyle(ps72).display !== 'none' : false,
      ps72InMyTourRoot: !!document.getElementById('myTournamentsRoot')?.contains(ps72),
      ps72InPolyana: !!polyRoot?.contains(ps72),
      hasMyTourInPolyana,
      polyanaScrollHeight: polyRoot?.scrollHeight || 0,
      polyanaHasJournalMarkers: !!polyRoot?.querySelector('.v59Journal, .t23, .v58JournalHero')
    };
  });
}

async function scrollToBottom(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollTop = el.scrollHeight;
    const main = document.getElementById('mainApp');
    if (main) main.scrollTop = main.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  }, selector);
}

const server = startServer();
await waitForServer();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });
  await page.waitForSelector('[data-nav="mytournaments"]', { timeout: 15000 });

  // 1. Polyana — scroll bottom, no My Tournaments leak
  await page.click('[data-nav="polyana"]');
  await page.waitForTimeout(800);
  await scrollToBottom(page, '#psPolyanaArea');
  await page.waitForTimeout(400);
  let a = await audit(page);
  assert.equal(a.activeScreens.length, 1, `expected one active screen, got ${a.activeScreens.join(',')}`);
  assert.equal(a.polyanaActive, true, 'polyana should be active');
  assert.equal(a.hasMyTourInPolyana, false, 'Polyana must not contain My Tournaments content');
  assert.equal(a.ps72Visible, false, 'ps72 must not be visible on Polyana');
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/screenshot_polyana_bottom_no_tournaments.png`, fullPage: true });

  // 2. My Tournaments — dedicated screen from nav
  await page.click('[data-nav="mytournaments"]');
  await page.waitForTimeout(900);
  let b = await audit(page);
  assert.equal(b.myTourActive, true, 'mytournaments screen should be active');
  assert.equal(b.ps72On, true, 'ps72 should be on');
  assert.equal(b.ps72Visible, true, 'ps72 should be visible');
  assert.equal(b.ps72InMyTourRoot, true, 'ps72 must live inside #myTournamentsRoot');
  assert.equal(b.activeScreens.length, 1, 'only one main view active');
  await page.screenshot({ path: `${OUT}/screenshot_my_tournaments_screen.png`, fullPage: true });

  // 3. Back to Polyana — My Tournaments gone
  await page.click('[data-nav="polyana"]');
  await page.waitForTimeout(800);
  let c = await audit(page);
  assert.equal(c.polyanaActive, true, 'polyana active after switch');
  assert.equal(c.myTourActive, false, 'mytournaments inactive after switch');
  assert.equal(c.ps72Visible, false, 'ps72 hidden after leaving My Tournaments');
  assert.equal(c.hasMyTourInPolyana, false, 'no tournament leak after switch back');
  await page.screenshot({ path: `${OUT}/screenshot_polyana_after_my_tournaments.png`, fullPage: true });

  // 4. Navigation loop — profile, my tour, home, polyana
  for (const nav of ['profile', 'mytournaments', 'home', 'polyana']) {
    await page.click(`[data-nav="${nav}"]`);
    await page.waitForTimeout(700);
    const snap = await audit(page);
    assert.equal(snap.activeScreens.length, 1, `single active screen on ${nav}`);
    if (nav !== 'mytournaments') {
      assert.equal(snap.ps72Visible, false, `ps72 hidden on ${nav}`);
    }
    if (nav === 'polyana') {
      assert.equal(snap.hasMyTourInPolyana, false, `no leak on ${nav}`);
    }
  }

  const filteredErrors = errors.filter(
    (e) => !/myGo18|only has a getter|leaflet|favicon/i.test(e)
  );
  assert.equal(filteredErrors.length, 0, `runtime errors: ${filteredErrors.join('; ')}`);

  console.log(JSON.stringify({ pass: true, polyana: a, myTour: b, afterSwitch: c }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
