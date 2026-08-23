/**
 * My Tournaments Pro — routing, layout @390×844, CRUD, analytics
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8793;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const SAMPLE_OLD = {
  id: 'legacy_1',
  type: 'offline',
  format: 'NLH',
  tournamentName: 'Legacy Sunday',
  clubOrRoom: 'CHIPS CLUB',
  date: '2026-08-20',
  currency: 'RUB',
  baseBuyin: 1500,
  buyin: 1500,
  bountyContribution: 0,
  fee: 100,
  entries: 2,
  addOn: 0,
  prize: 5000,
  bountyWon: 0,
  place: 5,
  field: 40,
  note: 'legacy note',
  updatedAt: Date.now()
};

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
    const polyRoot = document.getElementById('psPolyanaArea');
    const ps72 = document.getElementById('ps72TournamentScreen');
    const navCount = document.querySelectorAll('.nav').length;
    const headerCount = document.querySelectorAll('header.creatorTop, header.top').length;
    const body = document.body;
    const myTour = document.getElementById('mytournaments');
    return {
      scrollW: body.scrollWidth,
      clientW: document.documentElement.clientWidth,
      ps72On: ps72?.classList.contains('on'),
      ps72InRoot: !!document.getElementById('myTournamentsRoot')?.contains(ps72),
      hasMtPro: !!document.querySelector('.mt-pro'),
      polyLeak: !!polyRoot?.querySelector('.mt-pro, .mt-pro-hero'),
      navCount,
      headerCount,
      myTourActive: myTour?.classList.contains('active'),
      statGrid: document.getElementById('mtStatGrid')?.innerText || '',
      chartSvg: document.getElementById('mtChartSvg')?.innerHTML?.length || 0,
      listCount: document.getElementById('mtListCount')?.innerText || '',
      tournamentsLen: window.S?.tournaments?.length || 0
    };
  });
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

  await page.evaluate((sample) => {
    window.S.tournaments = [sample];
    if (typeof window.save === 'function') window.save();
  }, SAMPLE_OLD);

  await page.click('[data-nav="mytournaments"]');
  await page.waitForTimeout(900);
  await page.waitForSelector('#ps72TournamentScreen.on', { timeout: 10000 });

  let a = await audit(page);
  assert.equal(a.ps72On, true);
  assert.equal(a.ps72InRoot, true);
  assert.equal(a.hasMtPro, true);
  assert.equal(a.polyLeak, false);
  assert.equal(a.navCount, 1, 'single bottom nav');
  assert.equal(a.headerCount, 1, 'single app header');
  assert.ok(a.scrollW <= a.clientW + 1, `no horizontal scroll: ${a.scrollW} > ${a.clientW}`);
  assert.ok(a.statGrid.includes('ROI') || a.statGrid.includes('points'), 'dashboard rendered');
  assert.ok(a.chartSvg > 20, 'chart has SVG content');
  assert.match(a.listCount, /\(1\)/, 'legacy tournament visible');

  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/screenshot_mt_pro_dashboard.png`, fullPage: false });

  await page.click('[data-mt="period"][data-val="30"]');
  await page.waitForTimeout(400);

  await page.click('[data-mt="pro-toggle"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/screenshot_mt_pro_mode.png`, fullPage: false });

  await page.click('[data-mt="add"]');
  await page.waitForSelector('#mtProModal.on', { timeout: 5000 });
  await page.click('[data-mt="pick-type"][data-val="online"]');
  await page.fill('#mtFName', 'QA Online Major');
  await page.fill('#mtFVenue', 'POKEROK');
  await page.fill('#mtFBuyin', '1200');
  await page.fill('#mtFPlace', '3');
  await page.fill('#mtFField', '200');
  await page.fill('#mtFCash', '8000');
  await page.click('[data-mt="save"]');
  await page.waitForTimeout(700);
  let c = await audit(page);
  assert.equal(c.tournamentsLen, 2);
  assert.match(c.listCount, /\(2\)/);
  await page.screenshot({ path: `${OUT}/screenshot_mt_pro_after_add.png`, fullPage: false });

  await page.click('[data-mt="edit"]');
  await page.waitForSelector('#mtProModal.on');
  await page.fill('#mtFNote', 'edited via QA');
  await page.click('[data-mt="save"]');
  await page.waitForTimeout(500);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.click('[data-mt="export"]')
  ]);
  assert.ok(download.suggestedFilename().includes('.csv'));

  page.once('dialog', (d) => d.accept());
  await page.locator('[data-mt="delete"]').first().click();
  await page.waitForTimeout(500);
  let d = await audit(page);
  assert.equal(d.tournamentsLen, 1);

  await page.click('[data-nav="polyana"]');
  await page.waitForTimeout(700);
  let e = await audit(page);
  assert.equal(e.ps72On, false);
  assert.equal(e.polyLeak, false);
  await page.screenshot({ path: `${OUT}/screenshot_mt_pro_polyana_regression.png`, fullPage: false });

  await page.click('[data-nav="home"]');
  await page.waitForTimeout(500);
  let f = await audit(page);
  assert.equal(f.ps72On, false);

  const filteredErrors = errors.filter((x) => !/myGo18|leaflet|favicon|only has a getter/i.test(x));
  assert.equal(filteredErrors.length, 0, filteredErrors.join('; '));

  console.log(JSON.stringify({ pass: true, audit: a, afterAdd: c, afterDelete: d }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
