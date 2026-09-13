/**
 * Navigation identity + wrong mini-app regression audit.
 * Run: PS_PORT=8920 node tests/navigation_identity_audit.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const PORT = process.env.PS_PORT || '8920';

const HOME_TILES = [
  { id: 'v36Sizing', expected: 'sizing' },
  { id: 'v36Review', expected: 'review' },
  { id: 'v36Swipe', expected: 'swipe' },
  { id: 'v36Xray', expected: 'ranges' },
  { id: 'v36Exploit', expected: 'exploit' },
  { id: 'v36Quick', expected: 'swipe' }
];

const MINI_APP_SCREENS = new Set(['swipe', 'sizing', 'review', 'daily', 'xray', 'ranges', 'exploit', 'heal']);

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = (req.url || '/').split('?')[0];
      const file = path.join(root, url === '/' ? 'index.html' : decodeURIComponent(url.slice(1)));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

function hideAuth() {
  document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
    el.classList.add('hidden');
    el.style.pointerEvents = 'none';
  });
  document.getElementById('mainApp')?.classList.remove('hidden');
}

function seedScript() {
  localStorage.setItem('pokerSwipeDeviceId', 'nav-id-audit');
  localStorage.setItem('pokerSwipeV32_user_nav-id-audit', JSON.stringify({
    version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 62, streak: 3,
    lastDay: '2026-09-01',
    events: Array.from({ length: 10 }, (_, i) => ({ grade: i % 2 ? 'g' : 'r', concept: 'RFI' })),
    hands: [], myHands18: [], tournaments: [], dailyArchive: [], snapshots: [],
    seenSwipe: [], diagnostic: [],
    xray: { onboarded: true, runs: 0, history: [], counts: {} },
    healCourses: {}
  }));
}

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const report = {
  identity: [],
  unrelated: [],
  stress: { interactions: 0, wrong: 0, dupes: 0 },
  timingAbsent: true,
  charts: 0,
  PASS: false
};

try {
  const viewports = [
    { w: 390, h: 844 },
    { w: 393, h: 852 },
    { w: 430, h: 932 },
    { w: 375, h: 812 }
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await ctx.addInitScript(seedScript);
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.evaluate(hideAuth);

    if (vp.w === 390) {
      await page.evaluate(() => {
        const orig = window.show;
        if (orig && !orig.__probe) {
          window.show = function probeShow(id) {
            const mini = new Set(['swipe', 'sizing', 'review', 'daily', 'xray', 'ranges', 'exploit', 'heal']);
            if (!window.__navProbe) window.__navProbe = { calls: [], dupes: 0 };
            const prev = window.__navProbe.calls.at(-1);
            if (prev && prev.id === id && Date.now() - prev.t < 80) window.__navProbe.dupes++;
            if (mini.has(id)) window.__navProbe.calls.push({ id, t: Date.now() });
            return orig.apply(this, arguments);
          };
          window.show.__probe = true;
        }
      });

      // Timing mini-app must stay removed
      report.timingAbsent = await page.evaluate(() => (
        !document.getElementById('timing')
        && !document.querySelector('[data-nav="timing"]')
        && !/тайминг/i.test(document.getElementById('home')?.textContent || '')
      ));

      // Identity: each home tile opens exactly its mini-app
      for (const tile of HOME_TILES) {
        await page.evaluate(() => {
          if (!window.__navProbe) window.__navProbe = { calls: [], dupes: 0 };
          window.__navProbe.calls = [];
          window.__navProbe.dupes = 0;
          window.show('home');
        });
        await page.waitForTimeout(400);
        const el = page.locator(`#${tile.id}`);
        if (!(await el.count())) continue;
        await el.click({ timeout: 5000 });
        await page.waitForTimeout(500);
        const result = await page.evaluate((expected) => {
          const mini = new Set(['swipe', 'sizing', 'review', 'daily', 'xray', 'ranges', 'exploit', 'heal']);
          const active = [...document.querySelectorAll('.screen.active')].map((s) => s.id);
          const calls = window.__navProbe?.calls?.filter((c) => mini.has(c.id)) || [];
          const last = calls.at(-1)?.id || null;
          return { active, last, dupes: window.__navProbe?.dupes || 0, callCount: calls.length };
        }, tile.expected);
        const pass = result.active.includes(tile.expected);
        report.identity.push({ tile: tile.id, expected: tile.expected, actual: result.last || result.active.find((id) => id === tile.expected) || result.active[0] || null, pass, dupes: result.dupes, active: result.active });
      }

      // Daily opens overlay (not #daily.active)
      await page.evaluate(() => { window.__navProbe.calls = []; window.show('home'); });
      await page.waitForTimeout(300);
      await page.locator('#v36Daily').click({ timeout: 5000 });
      await page.waitForTimeout(600);
      const daily = await page.evaluate(() => ({
        overlay: !!document.getElementById('psHandDayOverlay') && document.getElementById('psHandDayOverlay').style.display !== 'none',
        calls: window.__navProbe?.calls?.map((c) => c.id) || []
      }));
      report.identity.push({ tile: 'v36Daily', expected: 'daily-overlay', actual: daily.overlay ? 'daily-overlay' : daily.calls.at(-1), pass: daily.overlay });

      // Unrelated: profile stat chips must NOT open mini-apps (passive / no route)
      await page.evaluate(() => { window.__navProbe.calls = []; window.show('home'); });
      await page.waitForTimeout(300);
      for (const id of ['v36Player', 'v36Form', 'v36Sample']) {
        const stat = page.locator(`#${id}`);
        if (!(await stat.count())) continue;
        await stat.click({ force: true, timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250);
        const leaked = await page.evaluate(() => {
          const mini = new Set(['swipe', 'sizing', 'review', 'daily', 'xray', 'ranges', 'exploit', 'heal']);
          const calls = window.__navProbe?.calls?.filter((c) => mini.has(c.id)) || [];
          return calls.length > 0;
        });
        report.unrelated.push({ control: id, miniAppOpened: leaked, pass: !leaked });
      }

      // Review screen timeline must not bounce to another mini-app
      await page.evaluate(() => { window.rv = 0; window.show('review'); });
      await page.waitForTimeout(700);
      await page.locator('#reviewArea .node').first().click({ timeout: 5000 });
      await page.waitForTimeout(300);
      const reviewStay = await page.evaluate(() => ({
        active: document.getElementById('review')?.classList.contains('active'),
        calls: window.__navProbe?.calls?.slice(-3).map((c) => c.id) || []
      }));
      report.unrelated.push({ control: 'review_timeline_node', pass: reviewStay.active, calls: reviewStay.calls });

      // Stress: rapid nav + home tiles
      await page.evaluate(() => { window.__navProbe.calls = []; window.__navProbe.dupes = 0; });
      const tabs = ['home', 'myhands', 'polyana', 'profile', 'home'];
      for (let i = 0; i < 55; i++) {
        report.stress.interactions++;
        const key = tabs[i % tabs.length];
        await page.locator(`.nav [data-nav="${key}"]`).click({ force: true, timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(120);
        if (i % 7 === 3 && key === 'home') {
          await page.locator('#v36Sizing').click({ force: true, timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(150);
          const wrong = await page.evaluate(() => {
            const mini = new Set(['swipe', 'sizing', 'review', 'daily', 'xray', 'ranges', 'exploit', 'heal']);
            const active = document.querySelector('.screen.active')?.id;
            const lastMini = window.__navProbe?.calls?.filter((c) => mini.has(c.id)).at(-1)?.id;
            return lastMini && lastMini !== 'sizing' && active !== 'sizing';
          });
          if (wrong) report.stress.wrong++;
          await page.evaluate(() => window.show('home'));
        }
      }
      report.stress.dupes = await page.evaluate(() => window.__navProbe?.dupes || 0);

      report.charts = await page.evaluate(async () => {
        const { initBrowserTrainerLookup } = await import('/trainer-knowledge/browserLookup.js');
        const lookup = await initBrowserTrainerLookup();
        return lookup.charts.length;
      });
    }
    await ctx.close();
  }

  const identityFail = report.identity.filter((x) => !x.pass);
  const unrelatedFail = report.unrelated.filter((x) => !x.pass);
  report.PASS = identityFail.length === 0
    && unrelatedFail.length === 0
    && report.stress.wrong === 0
    && report.timingAbsent
    && report.charts === 1698;

  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.PASS, `navigation audit failed: identity=${identityFail.length} unrelated=${unrelatedFail.length} stressWrong=${report.stress.wrong}`);
} finally {
  await browser.close();
  server.close();
}
