/**
 * Green Monster character system verification @ 390×844
 * Ensures WEBM is never mounted in UI; static PNG or dormant engine only.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8798;
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

async function uiAudit(page, rootSel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const videos = [...(root?.querySelectorAll('video.psCharVideo') || [])];
    const imgs = [...(root?.querySelectorAll('img.psCharImage') || [])];
    const arenaSlots = root?.querySelectorAll('.pgArenaWrap > .psCharSlot, .pgArena > .psCharSlot') || [];
    return {
      hasVideo: videos.length > 0,
      videoSrc: videos.map((v) => v.currentSrc || v.getAttribute('src') || '').join('|'),
      hasWebm: videos.some((v) => /green-monster\/demon-.*\.webm/i.test(v.currentSrc || v.src || '')),
      hasStaticImage: imgs.some((img) => /\.png/i.test(img.currentSrc || img.src || '')),
      imageSrc: imgs.map((img) => img.currentSrc || img.getAttribute('src') || '').join('|'),
      arenaOverlay: arenaSlots.length > 0,
      hasReaction: !!root?.querySelector('.psCharReaction'),
      uiEnabled: !!window.PsCharacter?.UI_ENABLED,
      uiMedia: window.PsCharacter?.ASSETS?.uiMedia || null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  }, rootSel);
}

const server = startServer();
await waitForServer();
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

const report = { screens: {} };

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });
  assert.ok(await page.evaluate(() => !!window.PsCharacter?.ASSETS), 'PsCharacter must exist');

  report.engine = await page.evaluate(() => ({
    uiEnabled: window.PsCharacter.UI_ENABLED,
    uiMedia: window.PsCharacter.ASSETS.uiMedia
  }));

  await page.evaluate(() => window.show('sizing'));
  await page.waitForTimeout(800);
  report.screens.sizing_before = await uiAudit(page, '#sizingArea');

  await page.click('#sizeLock');
  await page.waitForSelector('#sizeResult .verdict', { timeout: 10000 });
  await page.waitForTimeout(600);
  report.screens.sizing_after = await uiAudit(page, '#sizingArea');
  report.screens.sizing_after.freakLady = await page.evaluate(() => !!document.querySelector('#sizeResult .freakCoachReaction'));

  await page.evaluate(() => { window.show('daily'); if (window.__legacyDailyIntro) window.__legacyDailyIntro(); });
  await page.evaluate(() => {
    window.dStreet = 3;
    window.dChoice = null;
    window.dSize = null;
    window.dArgs = {};
    window.dStart = window.now();
    window.dailyStreet();
  });
  await page.waitForSelector('#dailyArea .pgDecisionGrid .choice', { timeout: 15000 });
  report.screens.daily_before = await uiAudit(page, '#dailyArea');

  await page.evaluate(() => {
    window.dStreet = 3;
    window.dChoice = 'СТАВКА';
    window.dSize = 150;
    window.dConf = 40;
    window.dArgs = {};
    window.dStart = window.now();
    if (window.dailyReveal) window.dailyReveal();
  });
  await page.waitForTimeout(900);
  report.screens.daily_after = await uiAudit(page, '#dailyArea');

  const filteredErrors = errors.filter((e) => !/myGo18|only has a getter|leaflet|favicon/i.test(e));

  assert.equal(report.screens.sizing_before.hasWebm, false, 'WEBM must not appear in sizing UI');
  assert.equal(report.screens.sizing_before.hasVideo, false, 'No character video in sizing UI');
  assert.equal(report.screens.sizing_before.arenaOverlay, false, 'No character overlay on poker arena');
  assert.equal(report.screens.daily_before.hasWebm, false, 'WEBM must not appear in daily UI');
  assert.equal(report.screens.daily_before.arenaOverlay, false, 'No character overlay on daily arena');

  if (report.engine.uiEnabled) {
    assert.equal(report.screens.sizing_after.hasReaction, true, 'sizing result needs static character reaction');
    assert.equal(report.screens.daily_after.hasReaction, true, 'daily result needs static character reaction');
    assert.equal(report.screens.sizing_before.hasStaticImage || report.screens.sizing_after.hasStaticImage, true);
  }

  assert.equal(filteredErrors.length, 0, filteredErrors.join('; '));
  console.log(JSON.stringify({ pass: true, report }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
