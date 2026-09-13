/**
 * Canonical poker table QA — screenshots + metrics at 390×844
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8882';
const OUT = '/opt/cursor/artifacts';
const TABLE_ASSET = 'assets/47E8A69D-35C9-4268-8937-E1FD874EC272.PNG';
const TABLE_RATIO = 1672 / 941;
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

async function auditTable(page) {
  return page.evaluate(({ assetPath, expectedRatio }) => {
    const nav = document.querySelector('.nav');
    const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const felt = document.querySelector('.pgFelt, .table');
    const result = {
      hasCanonicalTable: false,
      tableDistortion: 0,
      cardsOutsideTable: 0,
      boardClipping: 0,
      controlsBlocked: 0,
      tableBlockingClicks: 0,
      horizontalOverflow: document.documentElement.scrollWidth > vw + 1 ? 1 : 0,
      bottomNavCollision: 0,
      feltFound: !!felt
    };

    if (!felt) return result;

    const feltStyle = getComputedStyle(felt, '::before');
    const bg = feltStyle.backgroundImage || '';
    result.hasCanonicalTable = bg.includes('47E8A69D') || felt.classList.contains('psPokerTable');

    const fr = felt.getBoundingClientRect();
    if (fr.width > 2 && fr.height > 2) {
      const actualRatio = fr.width / fr.height;
      if (Math.abs(actualRatio - expectedRatio) > 0.08) result.tableDistortion = 1;
    }

    const tableLayer = felt;
    const tr = tableLayer.getBoundingClientRect();
    const padX = tr.width * 0.06;
    const padY = tr.height * 0.08;

    felt.querySelectorAll('.pc, .pgBoardZone, .pgHeroZone').forEach((zone) => {
      zone.querySelectorAll('.pc, span.pc').forEach((card) => {
        const cr = card.getBoundingClientRect();
        if (cr.width < 2) return;
        const inside = cr.left >= tr.left + padX && cr.right <= tr.right - padX &&
          cr.top >= tr.top + padY && cr.bottom <= tr.bottom - padY;
        if (!inside) result.cardsOutsideTable++;
      });
      const zr = zone.getBoundingClientRect();
      if (zr.bottom > tr.bottom - padY / 2 || zr.top < tr.top + padY / 2) {
        if (zone.classList.contains('pgBoardZone') || zone.classList.contains('pgHeroZone')) {
          const cards = zone.querySelectorAll('.pc');
          if (cards.length && (zr.right > tr.right || zr.left < tr.left)) result.boardClipping++;
        }
      }
    });

    document.querySelectorAll('.screen.active .primary, .screen.active .pgCta, .screen.active .action, .screen.active [data-sa]').forEach((btn) => {
      const br = btn.getBoundingClientRect();
      if (br.width < 2) return;
      if (br.bottom > navTop + 2) result.bottomNavCollision++;
      if (br.bottom > navTop + 2 && getComputedStyle(btn).pointerEvents !== 'none') result.controlsBlocked++;
    });

    const beforePe = getComputedStyle(felt, '::before').pointerEvents;
    if (beforePe !== 'none') result.tableBlockingClicks = 1;

    return result;
  }, { assetPath: TABLE_ASSET, expectedRatio: TABLE_RATIO });
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = { screens: {} };

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('pokerSwipeDeviceId', 'qa-table-v1');
    localStorage.setItem('pokerSwipeV32_user_qa-table-v1', JSON.stringify({
      version: '32.0', nick: 'QA', onboarded: true, diagDone: true,
      skill: 62, streak: 5, lastDay: '2026-08-25',
      events: Array.from({ length: 12 }, (_, i) => ({ grade: i % 3 === 0 ? 'r' : 'g', concept: 'RFI', confidence: 80 })),
      hands: [], myHands18: [], tournaments: [], dailyArchive: [], snapshots: [],
      seenSwipe: [], diagnostic: [], xray: { onboarded: true, runs: 0, history: [], counts: {} },
      healCourses: {}
    }));
  });

  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);

  // Swipe
  await page.evaluate(() => { window.show('swipe'); window.renderSwipe?.(); });
  await page.waitForTimeout(1200);
  report.screens.swipe = await auditTable(page);
  await page.screenshot({ path: path.join(OUT, 'table_swipe_390x844.png') });

  // Sizing
  await page.evaluate(() => { window.show('sizing'); window.renderSizing?.(); });
  await page.waitForTimeout(1200);
  report.screens.sizing = await auditTable(page);
  await page.screenshot({ path: path.join(OUT, 'table_sizing_390x844.png') });

  // Daily (legacy game patch)
  await page.evaluate(() => {
    window.show('daily');
    if (typeof window.__legacyDailyIntro === 'function') window.__legacyDailyIntro();
    else window.renderDaily?.();
  });
  await page.waitForTimeout(1200);
  report.screens.daily = await auditTable(page);
  await page.screenshot({ path: path.join(OUT, 'table_daily_390x844.png') });

  // Review
  await page.evaluate(() => {
    window.rv = 0;
    window.show('review');
    window.rvPick = 1;
    window.renderReview?.();
  });
  await page.waitForTimeout(1500);
  report.screens.review = await auditTable(page);
  await page.screenshot({ path: path.join(OUT, 'table_review_390x844.png') });

  // X-ray intro (additional mini-app with old felt)
  await page.evaluate(() => {
    window.S.xray.onboarded = true;
    window.show('xray');
    window.renderXray?.();
  });
  await page.waitForTimeout(1200);
  report.screens.xray = await auditTable(page);
  await page.screenshot({ path: path.join(OUT, 'table_xray_390x844.png') });

  const pass = (name) => {
    const m = report.screens[name];
    if (!m?.feltFound) return 'FAIL';
    return m.tableDistortion === 0 && m.cardsOutsideTable === 0 && m.boardClipping === 0 &&
      m.controlsBlocked === 0 && m.tableBlockingClicks === 0 && m.horizontalOverflow === 0 &&
      m.bottomNavCollision === 0 && m.hasCanonicalTable ? 'PASS' : 'FAIL';
  };

  report.summary = {
    CANONICAL_TABLE: TABLE_ASSET,
    SWIPE: pass('swipe'),
    SIZING: pass('sizing'),
    DAILY: pass('daily'),
    REVIEW: pass('review'),
    XRAY: pass('xray'),
    MOBILE_390x844: Object.keys(report.screens).every((k) => pass(k) === 'PASS') ? 'PASS' : 'FAIL'
  };

  fs.writeFileSync(path.join(OUT, 'table_qa_metrics.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
