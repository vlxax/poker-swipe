/**
 * Visual QA — 5 full 390×844 mobile screenshots for Green Monster integration.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/visual_qa';
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

async function scrollTop(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector('#mainApp');
    if (main) main.scrollTop = 0;
    document.querySelector('#sizingArea .pgShell')?.scrollTo?.(0, 0);
    document.querySelector('#dailyArea .pgShell, #dailyArea .dailyStage')?.scrollTo?.(0, 0);
  });
}

async function waitForMonster(page, rootSel, minReadyMs = 1400) {
  await page.waitForSelector(`${rootSel} .psCharSlot`, { state: 'attached', timeout: 15000 });
  await page.waitForFunction(
    (sel) => {
      const slots = [...document.querySelectorAll(`${sel} .psCharSlot`)];
      return slots.some((slot) => {
        const video = slot.querySelector('video.psCharVideo');
        return slot.classList.contains('isReady') && video && video.readyState >= 2 && video.videoWidth > 0;
      });
    },
    rootSel,
    { timeout: 20000 }
  ).catch(() => {});
  await page.waitForTimeout(minReadyMs);
}

async function capture(page, name) {
  await scrollTop(page);
  await page.waitForTimeout(400);
  const outPath = `${OUT}/${name}.png`;
  await page.screenshot({ path: outPath, fullPage: false });
  return outPath;
}

async function dailyRiverDecision(page) {
  await page.evaluate(() => {
    window.show('daily');
    if (typeof window.__legacyDailyIntro === 'function') window.__legacyDailyIntro();
  });
  await page.evaluate(() => {
    window.dStreet = 3;
    window.dChoice = null;
    window.dSize = null;
    window.dArgs = {};
    window.dStart = window.now();
    window.dailyStreet();
  });
  await page.waitForSelector('#dailyArea .pgDecisionGrid .choice', { timeout: 15000 });
  await waitForMonster(page, '#dailyArea');
}

async function dailyRevealWith(page, { choice, size, conf = 70, fillArgs = false }) {
  await page.evaluate(({ choice, size, conf, fillArgs }) => {
    const D = window.dailyToday();
    window.dStreet = 3;
    window.dChoice = choice;
    window.dSize = size;
    window.dConf = conf;
    window.dArgs = {};
    if (fillArgs) {
      D.args.forEach((a, i) => {
        const expected = a[1] === 'bet' ? 'bet' : a[1] === 'check' ? 'check' : a[1];
        window.dArgs[i] = expected;
      });
    }
    window.dStart = window.now();
    if (window.dailyReveal) window.dailyReveal();
  }, { choice, size, conf, fillArgs });
  await page.waitForSelector('#dailyArea .psCharReaction, #dailyArea .dualGrade', { timeout: 15000 });
  await waitForMonster(page, '#dailyArea', 1000);
}

fs.mkdirSync(OUT, { recursive: true });
const server = startServer();
await waitForServer();

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required']
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1
});
const page = await context.newPage();
const meta = {};

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });

  await dailyRiverDecision(page);
  meta.dailyBefore = await page.evaluate(() => ({
    hasHeader: !!document.querySelector('.brand, .logo'),
    hasTable: !!document.querySelector('#dailyArea .pgFelt, #dailyArea .pgArena'),
    hasChoices: document.querySelectorAll('#dailyArea .pgDecisionGrid .choice').length,
    hasMonster: !!document.querySelector('#dailyArea .psCharSlot video'),
    hasNav: !!document.querySelector('.nav'),
    mainScroll: document.querySelector('#mainApp')?.scrollTop || 0
  }));
  meta.paths = {};
  meta.paths[1] = await capture(page, '01_daily_before_decision');

  const D = await page.evaluate(() => {
    const d = window.dailyToday();
    return {
      preferred: d.preferred,
      zone: d.zone,
      decision: d.decision,
      wrongChoice: d.decision.find((x) => x !== d.preferred) || 'СТАВКА'
    };
  });
  meta.dailyHand = D;

  await dailyRevealWith(page, {
    choice: D.preferred,
    size: null,
    conf: 80,
    fillArgs: true
  });
  meta.dailyCorrect = await page.evaluate(() => ({
    headline: document.querySelector('#dailyArea h1')?.textContent?.trim(),
    bubble: document.querySelector('#dailyArea .psCharBubble strong')?.textContent?.trim(),
    hasReaction: !!document.querySelector('#dailyArea .psCharReaction'),
    hasTable: !!document.querySelector('#dailyArea .psResultArena .pgArena, #dailyArea .pgFelt')
  }));
  meta.paths[2] = await capture(page, '02_daily_after_correct');

  await dailyRevealWith(page, {
    choice: D.wrongChoice,
    size: D.zone ? Math.max(150, D.zone[1] + 50) : 150,
    conf: 35,
    fillArgs: false
  });
  meta.dailyWrong = await page.evaluate(() => ({
    headline: document.querySelector('#dailyArea h1')?.textContent?.trim(),
    bubble: document.querySelector('#dailyArea .psCharBubble strong')?.textContent?.trim(),
    hasReaction: !!document.querySelector('#dailyArea .psCharReaction')
  }));
  meta.paths[3] = await capture(page, '03_daily_after_incorrect');

  await page.evaluate(() => {
    window.sz = 0;
    window.show('sizing');
    if (window.renderSizing) window.renderSizing();
  });
  await page.waitForSelector('#sizingArea .pgControls', { timeout: 15000 });
  await waitForMonster(page, '#sizingArea');
  meta.sizingBefore = await page.evaluate(() => ({
    hasBoard: !!document.querySelector('#sizingArea .pgFelt, #sizingArea .pgArena .pc'),
    hasSlider: !!document.querySelector('#sizeRange'),
    hasMonster: !!document.querySelector('#sizingArea .psCharSlot video'),
    mainScroll: document.querySelector('#mainApp')?.scrollTop || 0
  }));
  meta.paths[4] = await capture(page, '04_sizing_before_decision');

  await page.click('#sizeLock');
  await page.waitForSelector('#sizeResult .verdict', { timeout: 10000 });
  await page.waitForSelector('#sizingArea .psCharReaction', { timeout: 10000 });
  await page.evaluate(() => {
    document.querySelectorAll('#sizeResult .ps-reveal-stage').forEach((el) => el.classList.add('ps-reveal-show'));
  });
  await page.waitForTimeout(1200);
  meta.sizingAfter = await page.evaluate(() => ({
    hasVerdict: !!document.querySelector('#sizeResult .verdict'),
    bubble: document.querySelector('#sizingArea .psCharBubble strong')?.textContent?.trim(),
    hasBoard: !!document.querySelector('#sizingArea .pgFelt, #sizingArea .pgArena .pc'),
    mainScroll: document.querySelector('#mainApp')?.scrollTop || 0,
    shellScroll: document.querySelector('#sizingArea .pgShell')?.scrollTop || 0
  }));
  meta.paths[5] = await capture(page, '05_sizing_after_decision');

  fs.writeFileSync(`${OUT}/capture_meta.json`, JSON.stringify(meta, null, 2));
  console.log(JSON.stringify({ pass: true, meta }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
