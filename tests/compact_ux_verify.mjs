/**
 * Compact mini-app UX verification — real browser @ 390x844 + desktop
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function waitForServer(ms = 8000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(BASE.replace('/tests/bubble_ui_bootstrap.html', '/'));
      if (r.ok) return;
    } catch (_) { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start');
}

async function checkMiniApp(page, name, checks) {
  await page.evaluate((n) => window.show(n), name);
  await page.waitForTimeout(400);
  return page.evaluate((c) => {
    const area = document.querySelector(c.areaSel);
    if (!area) return { ok: false, err: 'area missing: ' + c.areaSel };
    const html = area.innerHTML;
    const hasCtx = !!area.querySelector('.maCtx');
    const hasCards = !!area.querySelector('.pc, .cards .pc, .maTableBoard .pc');
    const hasTimeline = !!area.querySelector('.maTimeline');
    const hasQuestion = c.questionRe ? c.questionRe.test(html) : true;
    const hasOldSpot30 = !!area.querySelector(':scope > .spot30, .swipeCardV > .spot30');
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    const viewportH = window.innerHeight;
    const mainQ = area.querySelector('.maQuestion, .impact, h2.maQuestion');
    const qVisible = mainQ ? mainQ.getBoundingClientRect().top < viewportH : true;
    return {
      ok: hasCtx && (c.requireCards ? hasCards : true) && (c.requireTimeline ? hasTimeline : true) && hasQuestion && !hasOldSpot30 && !overflow && (c.requireFirstViewport ? qVisible : true),
      hasCtx, hasCards, hasTimeline, hasQuestion, hasOldSpot30, overflow, qVisible,
      compact: !!window.__maCompactLayout,
      sample: html.slice(0, 200)
    };
  }, checks);
}

const APPS = [
  { name: 'review', areaSel: '#reviewArea', requireCards: true, requireTimeline: true, requireFirstViewport: true, questionRe: /СЛОМАЛАСЬ/i },
  { name: 'sizing', areaSel: '#sizingArea', requireCards: true, requireTimeline: false, requireFirstViewport: true, questionRe: /Какой сайз/i },
  { name: 'swipe', areaSel: '#swipeCard', requireCards: true, requireTimeline: false, requireFirstViewport: true, questionRe: /Твоё решение/i },
  { name: 'xray', areaSel: '#xrayArea', requireCards: false, requireTimeline: false, requireFirstViewport: true, questionRe: /диапазон|Сузь/i },
];

async function main() {
  const server = startServer();
  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  const results = { mobile: {}, desktop: {}, errors: [] };

  try {
    for (const vp of [{ w: 390, h: 844, key: 'mobile' }, { w: 1280, h: 800, key: 'desktop' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction(() => window.__maCompactLayout === true, { timeout: 30000 });

      for (const app of APPS) {
        try {
          results[vp.key][app.name] = await checkMiniApp(page, app.name, app);
        } catch (e) {
          results[vp.key][app.name] = { ok: false, err: String(e) };
        }
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
      const r = results[vp][app.name];
      assert.ok(r.ok, `${vp}/${app.name}: ${JSON.stringify(r)}`);
    }
  }
  console.log('COMPACT UX VERIFY: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
