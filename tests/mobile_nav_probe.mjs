import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const PORT = process.env.PS_PORT || '8899';

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

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const viewports = [
  { w: 390, h: 844 },
  { w: 375, h: 812 },
  { w: 430, h: 932 }
];
const report = {};

try {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await ctx.addInitScript(() => {
      localStorage.setItem('pokerSwipeDeviceId', 'nav-qa');
      localStorage.setItem('pokerSwipeV32_user_nav-qa', JSON.stringify({
        version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 50, streak: 1,
        lastDay: '2026-09-01', events: [], hands: [], myHands18: [], tournaments: [],
        dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
        xray: { onboarded: true, runs: 0, history: [], counts: {} }, healCourses: {}
      }));
    });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.show?.('home'));
    await page.waitForTimeout(800);

    report[`${vp.w}x${vp.h}`] = await page.evaluate(() => {
      const nav = document.querySelector('.nav');
      const r = nav?.getBoundingClientRect();
      const btn = document.querySelector('.nav button');
      const bcs = btn ? getComputedStyle(btn) : null;
      const screen = document.querySelector('.screen.active');
      const scs = screen ? getComputedStyle(screen) : null;
      return {
        navH: r ? Math.round(r.height) : null,
        navBottomGap: r ? Math.max(0, Math.round(window.innerHeight - r.bottom)) : null,
        btnMinH: bcs?.minHeight,
        screenPadBottom: scs?.paddingBottom,
        bottomNavVar: getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height').trim(),
        psBottomNav: getComputedStyle(document.documentElement).getPropertyValue('--ps-bottom-nav-height').trim(),
        timingScreen: !!document.getElementById('timing'),
        timingNav: !!document.querySelector('[data-nav="timing"]'),
        homeHasTiming: /тайминг/i.test(document.getElementById('home')?.textContent || '')
      };
    });
    await ctx.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.close();
}
