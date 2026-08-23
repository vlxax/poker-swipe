/**
 * Green Monster character system verification @ 390×844
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

async function charAudit(page, rootSel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const slot = root?.querySelector('.psCharSlot');
    const video = slot?.querySelector('video.psCharVideo');
    const rect = slot?.getBoundingClientRect?.() || { width: 0, height: 0 };
    return {
      hasSlot: !!slot,
      hasVideo: !!video,
      videoSrc: video?.currentSrc || video?.getAttribute('src') || '',
      usesUploadedAsset: /green-monster\/demon-/.test(video?.currentSrc || video?.getAttribute('src') || ''),
      slotW: Math.round(rect.width),
      slotH: Math.round(rect.height),
      coversNav: (() => {
        const nav = document.querySelector('.nav')?.getBoundingClientRect();
        if (!nav || !rect.height) return false;
        return rect.bottom > nav.top - 4;
      })(),
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
const stamp = Date.now();

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });
  assert.ok(await page.evaluate(() => !!window.PsCharacter?.ASSETS), 'PsCharacter must exist');

  await page.evaluate(() => window.show('sizing'));
  await page.waitForSelector('#sizingArea .psCharSlot', { state: 'attached', timeout: 15000 });
  report.screens.sizing_before = await charAudit(page, '#sizingArea');
  await page.screenshot({ path: `${OUT}/screenshot_sizing_before_decision_${stamp}.png`, fullPage: false });

  await page.click('#sizeLock');
  await page.waitForSelector('#sizeResult .verdict', { timeout: 10000 });
  report.screens.sizing_reaction = await page.evaluate(() => ({
    hasReaction: !!document.querySelector('#sizeResult .psCharReaction'),
    freakLady: !!document.querySelector('#sizeResult .freakCoachReaction')
  }));
  await page.screenshot({ path: `${OUT}/screenshot_sizing_incorrect_result_${stamp}.png`, fullPage: false });

  await page.evaluate(() => { window.sz = 0; window.renderSizing(); });
  await page.waitForSelector('#sizeLock', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => {
    const s = window.SIZING[window.sz % window.SIZING.length];
    const target = s.zone ? Math.round((s.zone[0] + s.zone[1]) / 2) : 33;
    const r = document.getElementById('sizeRange');
    if (r) { r.value = String(target); r.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.click('#sizeLock');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/screenshot_sizing_correct_result_${stamp}.png`, fullPage: false });

  await page.evaluate(() => { window.show('daily'); if (window.__legacyDailyIntro) window.__legacyDailyIntro(); });
  await page.waitForSelector('#dailyArea .psCharSlot', { state: 'attached', timeout: 15000 });
  report.screens.daily_before = await charAudit(page, '#dailyArea');
  await page.screenshot({ path: `${OUT}/screenshot_daily_before_decision_${stamp}.png`, fullPage: false });

  await page.evaluate(() => {
    window.dStreet = 3; window.dChoice = 'СТАВКА'; window.dSize = 50; window.dConf = 60;
    window.dArgs = {}; window.dStart = window.now();
    if (window.dailyReveal) window.dailyReveal();
  });
  await page.waitForTimeout(900);
  report.screens.daily_after = await page.evaluate(() => ({
    hasReaction: !!document.querySelector('#dailyArea .psCharReaction')
  }));
  assert.equal(report.screens.daily_after.hasReaction, true, 'daily reveal needs monster reaction');
  await page.screenshot({ path: `${OUT}/screenshot_daily_after_decision_${stamp}.png`, fullPage: false });

  const filteredErrors = errors.filter((e) => !/myGo18|only has a getter|leaflet|favicon/i.test(e));
  assert.equal(report.screens.sizing_before.usesUploadedAsset, true);
  assert.equal(report.screens.daily_before.usesUploadedAsset, true);
  assert.equal(report.screens.sizing_reaction.hasReaction, true);
  assert.equal(report.screens.sizing_reaction.freakLady, false);
  assert.equal(filteredErrors.length, 0, filteredErrors.join('; '));
  console.log(JSON.stringify({ pass: true, report }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
