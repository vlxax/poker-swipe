/**
 * Game interface UX verification — 390×844 + desktop
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8777;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
}

async function waitForServer(ms = 8000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) return;
    } catch (_) { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start');
}

async function checkMiniApp(page, name, checks) {
  await page.evaluate((n) => window.show(n), name);
  await page.waitForTimeout(450);
  return page.evaluate((c) => {
    const area = document.querySelector(c.areaSel);
    if (!area) return { ok: false, err: 'area missing' };
    const html = area.innerHTML;
    const hasHud = !!area.querySelector('.pgHud');
    const hasArena = !!area.querySelector('.pgArena, .pgXrayArena, .pgXrayMatrix, .rangesMatrixWrap');
    const hasTable = !!area.querySelector('.pgFelt');
    const hasCards = !!area.querySelector('.pgBoardZone .pc, .pgHeroZone .pc, .pgXrayBoard .pc');
    const hasPath = c.requirePath ? !!area.querySelector('.pgPathTrack') : true;
    const hasControls = c.requireControls ? !!area.querySelector('.pgControls') : true;
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    const arenaRect = area.querySelector('.pgFelt, .pgXrayMatrix, .rangesMatrixWrap')?.getBoundingClientRect();
    const arenaDominant = arenaRect ? arenaRect.height >= 160 : false;
    const qEl = area.querySelector('.pgHudTitle h1, .pgHudTitle h2, .pgControlsHead');
    const qVisible = qEl ? qEl.getBoundingClientRect().top < window.innerHeight : true;
    return {
      ok: hasHud && hasArena && (c.requireTable ? hasTable : true) && (c.requireCards ? hasCards : true) && hasPath && hasControls && !overflow && arenaDominant && (c.requireFirstViewport ? qVisible : true),
      hasHud, hasArena, hasTable, hasCards, hasPath, hasControls, overflow, arenaDominant, qVisible,
      gameLayout: !!window.__maGameLayout
    };
  }, checks);
}

const APPS = [
  { name: 'review', areaSel: '#reviewArea', requireTable: true, requireCards: true, requirePath: true, requireControls: true, requireFirstViewport: true },
  { name: 'sizing', areaSel: '#sizingArea', requireTable: true, requireCards: true, requirePath: false, requireControls: true, requireFirstViewport: true },
  { name: 'swipe', areaSel: '#swipeCard', requireTable: true, requireCards: true, requirePath: false, requireControls: false, requireFirstViewport: true },
  { name: 'xray', areaSel: '#xrayArea', requireTable: false, requireCards: false, requirePath: false, requireControls: true, requireFirstViewport: true },
];

async function main() {
  const server = startServer();
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const results = { mobile: {}, desktop: {} };

  try {
    for (const vp of [{ w: 390, h: 844, key: 'mobile' }, { w: 1280, h: 800, key: 'desktop' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction(() => window.__maGameLayout === true, { timeout: 30000 });
      for (const app of APPS) {
        results[vp.key][app.name] = await checkMiniApp(page, app.name, app);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log(JSON.stringify(results, null, 2));
  for (const vp of ['mobile', 'desktop']) {
    for (const app of APPS) {
      assert.ok(results[vp][app.name].ok, `${vp}/${app.name}: ${JSON.stringify(results[vp][app.name])}`);
    }
  }
  console.log('GAME UX VERIFY: PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
