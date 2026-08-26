/**
 * Freak Lady + Game Visual V2 runtime QA
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8877';
const OUT = '/opt/cursor/artifacts/game_visual_freaklady_qa';
fs.mkdirSync(OUT, { recursive: true });

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url?.split('?')[0] || '/';
      const file = path.join(root, url === '/' ? 'index.html' : decodeURIComponent(url));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

const report = {
  freakLady: {},
  png: {},
  screens: {},
  layout: {},
  consoleErrors: []
};

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });

try {
  for (const vp of [{ w: 390, h: 844, id: '390x844' }, { w: 375, h: 812, id: '375x812' }, { w: 430, h: 932, id: '430x932' }]) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await context.addInitScript(() => {
      localStorage.setItem('pokerSwipeDeviceId', 'qa-visual-v2');
      localStorage.setItem('pokerSwipeV32_user_qa-visual-v2', JSON.stringify({
        version: '32.0', nick: 'QA', onboarded: true, diagDone: true,
        skill: 55, streak: 3, lastDay: '2026-08-25', events: [], hands: [],
        myHands18: [], tournaments: [], dailyArchive: [], snapshots: [],
        seenSwipe: [], diagnostic: [], xray: { onboarded: true, runs: 0, history: [], counts: {} },
        healCourses: {}
      }));
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text());
    });

    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);

    if (vp.id === '390x844') {
      const fl = await page.evaluate(() => ({
        exists: typeof window.FreakLady === 'object',
        libLen: (window.FREAK_LADY_LIBRARY || []).length,
        hasDebug: !!window.FreakLady?.debug,
        hasMount: typeof window.FreakLady?.mountComposition === 'function',
        gameV2: !!window.__psGameVisualV2,
        assets: window.FreakLady?.assets || {}
      }));
      report.freakLady = fl;

      const tests = await page.evaluate(async () => {
        if (typeof window.runFreakLadyTests === 'function') {
          return window.runFreakLadyTests();
        }
        return { pass: false, results: [{ name: 'runFreakLadyTests missing', pass: false }] };
      });
      report.freakLady.tests = tests;

      for (const state of ['idle', 'thinking', 'correct', 'skeptical', 'wrong', 'streak']) {
        const url = `http://localhost:${PORT}/assets/freak-lady/${state}.png`;
        const res = await page.request.get(url);
        report.png[state] = res.status() === 200;
      }
    }

    const screens = ['home', 'swipe', 'sizing', 'review', 'daily', 'profile'];
    report.screens[vp.id] = {};
    for (const id of screens) {
      await page.evaluate((sid) => window.show(sid), id);
      await page.waitForTimeout(900);
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        navVisible: !!document.querySelector('.nav'),
        navRect: document.querySelector('.nav')?.getBoundingClientRect(),
        charCompose: document.querySelectorAll('.psCharCompose').length,
        blackRects: [...document.querySelectorAll('.freakCoachAvatarWrap, .psCharCompose__art')].filter((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          return bg && !bg.includes('rgba(0, 0, 0, 0)') && !bg.includes('transparent');
        }).length
      }));
      report.screens[vp.id][id] = metrics;
      if (vp.id === '390x844') {
        await page.screenshot({ path: path.join(OUT, `screen_${id}.png`) });
      }
    }

    if (vp.id === '390x844') {
      await page.evaluate(() => window.show('swipe'));
      await page.waitForTimeout(600);
      const action = await page.$('[data-sa]');
      if (action) {
        await action.click();
        await page.waitForTimeout(2500);
        const swipeMetrics = await page.evaluate(() => ({
          hasCompose: !!document.querySelector('.psCharCompose--result, .psCharCompose'),
          hasVerdict: !!document.querySelector('.v31Verdict, #swipeVerdict'),
          blocked: (() => {
            const btn = document.querySelector('#verdictNext, .v31VerdictCTA .primary');
            if (!btn) return false;
            const r = btn.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return el !== btn && !btn.contains(el);
          })()
        }));
        report.layout.swipeResult = swipeMetrics;
        await page.screenshot({ path: path.join(OUT, 'swipe_verdict.png') });
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const overflowCount = Object.values(report.screens).flatMap((vp) => Object.values(vp)).filter((m) => m.overflow).length;
const blockedCount = report.layout.swipeResult?.blocked ? 1 : 0;
const blackRects = Object.values(report.screens).flatMap((vp) => Object.values(vp)).reduce((a, m) => a + (m.blackRects || 0), 0);

const summary = {
  FREAK_LADY_ENGINE: report.freakLady.exists && report.freakLady.libLen === 217,
  LIB_COUNT: report.freakLady.libLen,
  PNG_ALL: Object.values(report.png).every(Boolean),
  TESTS_PASS: report.freakLady.tests?.pass === true,
  GAME_V2: report.freakLady.gameV2 === true,
  HORIZONTAL_OVERFLOW: overflowCount,
  BLOCKED_BUTTONS: blockedCount,
  BLACK_PNG_RECTANGLES: blackRects,
  CONSOLE_ERRORS: report.consoleErrors.length
};

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ summary, report }, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.FREAK_LADY_ENGINE && summary.PNG_ALL && summary.TESTS_PASS ? 0 : 1);
