/**
 * Table scene QA — 390×844 screenshots
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8883';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url?.split('?')[0] || '/';
      const file = path.join(root, url === '/' ? 'index.html' : decodeURIComponent(url));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function auditScene(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const felt = document.querySelector('.psPokerTable, .pgFelt');
    const scene = document.querySelector('.psTableScene');
    const r = {
      hasScene: !!scene,
      hasAmbient: !!document.querySelector('.psTableScene__ambient'),
      tableTooSmall: 0,
      tableDistorted: 0,
      cardsFloating: 0,
      boardClipped: 0,
      controlsBlocked: 0,
      horizontalOverflow: document.documentElement.scrollWidth > vw + 1 ? 1 : 0,
      bottomNavCollision: 0
    };
    if (!felt) return r;

    const fr = felt.getBoundingClientRect();
    const expectedRatio = 1672 / 941;
    if (fr.width > 2 && fr.height > 2) {
      const ratio = fr.width / fr.height;
      if (Math.abs(ratio - expectedRatio) > 0.06) r.tableDistorted = 1;
      if (fr.width < vw * 0.82) r.tableTooSmall = 1;
      if (fr.height < 180) r.tableTooSmall = 1;
    }

    const padX = fr.width * 0.05;
    const padY = fr.height * 0.06;
    felt.querySelectorAll('.pgBoardZone .pc, .pgHeroZone .pc').forEach((card) => {
      const cr = card.getBoundingClientRect();
      if (cr.width < 2) return;
      const inside = cr.left >= fr.left + padX && cr.right <= fr.right - padX &&
        cr.top >= fr.top + padY && cr.bottom <= fr.bottom - padY;
      if (!inside) r.cardsFloating++;
    });

    document.querySelectorAll('.screen.active .primary, .screen.active .pgCta, .screen.active .action, .screen.active [data-sa]').forEach((btn) => {
      const br = btn.getBoundingClientRect();
      if (br.width < 2 || br.height < 2) return;
      if (br.top >= navTop - 2) {
        r.bottomNavCollision++;
        r.controlsBlocked++;
      }
    });

    return r;
  });
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = { screens: {} };

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('pokerSwipeDeviceId', 'qa-scene-v1');
    localStorage.setItem('pokerSwipeV32_user_qa-scene-v1', JSON.stringify({
      version: '32.0', nick: 'QA', onboarded: true, diagDone: true,
      skill: 62, streak: 5, lastDay: '2026-08-25',
      events: [], hands: [], myHands18: [], tournaments: [], dailyArchive: [],
      seenSwipe: [], diagnostic: [], xray: { onboarded: true, runs: 0, history: [], counts: {} },
      healCourses: {}
    }));
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => { window.scrollTo(0, 0); window.show('swipe'); window.renderSwipe?.(); });
  await page.waitForTimeout(1200);
  report.screens.swipe = await auditScene(page);
  await page.screenshot({ path: path.join(OUT, 'scene_swipe_decision_390x844.png') });

  await page.evaluate(() => { window.scrollTo(0, 0); window.show('sizing'); window.renderSizing?.(); });
  await page.waitForTimeout(1200);
  report.screens.sizing = await auditScene(page);
  await page.screenshot({ path: path.join(OUT, 'scene_sizing_390x844.png') });

  await page.evaluate(() => { window.scrollTo(0, 0); window.show('review'); window.renderReview?.(); });
  await page.waitForTimeout(1200);
  report.screens.review = await auditScene(page);
  await page.screenshot({ path: path.join(OUT, 'scene_review_forensic_390x844.png') });

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.show('daily');
    if (typeof window.__legacyDailyIntro === 'function') window.__legacyDailyIntro();
  });
  await page.waitForTimeout(1200);
  report.screens.daily = await auditScene(page);
  await page.screenshot({ path: path.join(OUT, 'scene_daily_390x844.png') });

  const pass = (m) => m && m.hasScene && m.tableTooSmall === 0 && m.tableDistorted === 0 &&
    m.cardsFloating === 0 && m.boardClipped === 0 && m.controlsBlocked === 0 &&
    m.horizontalOverflow === 0 && m.bottomNavCollision === 0;

  report.summary = {
    SWIPE: pass(report.screens.swipe) ? 'PASS' : 'FAIL',
    SIZING: pass(report.screens.sizing) ? 'PASS' : 'FAIL',
    REVIEW: pass(report.screens.review) ? 'PASS' : 'FAIL',
    DAILY: pass(report.screens.daily) ? 'PASS' : 'FAIL'
  };

  fs.writeFileSync(path.join(OUT, 'scene_qa_metrics.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
