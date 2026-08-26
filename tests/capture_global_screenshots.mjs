/**
 * Capture 390×844 screenshots for all key sections + global QA
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8879';
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
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

function auditGlobal(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
    const active = document.querySelector('.screen.active') || document.getElementById('ps72TournamentScreen')?.classList.contains('on') ? document.getElementById('ps72TournamentScreen') : document.querySelector('.screen.active');
    const scope = active || document.body;

    function rect(el) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return null;
      return r;
    }

    const ctas = [...scope.querySelectorAll('.primary, .pgCta, #dHome, .verdictCTA .primary')].map(rect).filter(Boolean);
    let contentUnderNav = 0;
    ctas.forEach((cta) => {
      if (cta.bottom > navTop + 4) contentUnderNav++;
    });

    return {
      contentUnderNav,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hasGameVisualV2: document.body.classList.contains('psGameVisualV2'),
      navTop: Math.round(navTop)
    };
  });
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = { sections: {} };

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('pokerSwipeDeviceId', 'qa-global-v2');
    localStorage.setItem('pokerSwipeV32_user_qa-global-v2', JSON.stringify({
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

  // 1. Home / Играть
  await page.evaluate(() => window.show('home'));
  await page.waitForTimeout(1200);
  report.sections.home = await auditGlobal(page);
  await page.screenshot({ path: path.join(OUT, 'section_home_igray_390x844.png') });

  // 2. Review / разбор
  await page.evaluate(() => {
    window.rv = 0;
    window.show('review');
    window.rvPick = 1;
    if (typeof window.reviewReveal === 'function') window.reviewReveal();
  });
  await page.waitForTimeout(3500);
  report.sections.review = await auditGlobal(page);
  await page.screenshot({ path: path.join(OUT, 'section_review_razbor_390x844.png') });

  // 3. Daily / Freak Lady
  await page.evaluate(() => {
    window.show('daily');
    window.dChoice = 'BET';
    window.dSize = 66;
    window.dConf = 72;
    window.dArgs = { 0: 'bet', 1: 'check', 2: 'bet' };
    if (typeof window.dailyReveal === 'function') window.dailyReveal();
  });
  await page.waitForTimeout(2500);
  report.sections.daily = await auditGlobal(page);
  await page.screenshot({ path: path.join(OUT, 'section_freak_lady_390x844.png') });

  // 4. Polyana
  await page.evaluate(() => {
    if (typeof window.openPolyanaV54 === 'function') window.openPolyanaV54();
    else if (typeof window.show === 'function') window.show('polyana');
  });
  await page.waitForTimeout(2500);
  report.sections.polyana = await auditGlobal(page);
  await page.screenshot({ path: path.join(OUT, 'section_polyana_390x844.png') });

  // 5. My Tournaments
  await page.evaluate(() => {
    if (typeof window.openMyTournamentsV72 === 'function') window.openMyTournamentsV72();
    else if (typeof window.openMyTournamentsV71 === 'function') window.openMyTournamentsV71();
    else if (typeof window.openJournal === 'function') window.openJournal();
  });
  await page.waitForTimeout(2000);
  report.sections.mytournaments = await auditGlobal(page);
  await page.screenshot({ path: path.join(OUT, 'section_my_tournaments_390x844.png') });

  // 6. Profile
  await page.evaluate(() => {
    const screen = document.getElementById('ps72TournamentScreen');
    if (screen?.classList.contains('on') && window.MtProTournaments?.closeScreen) {
      window.MtProTournaments.closeScreen();
    }
    window.show('profile');
  });
  await page.waitForTimeout(1500);
  report.sections.profile = await auditGlobal(page);
  await page.screenshot({ path: path.join(OUT, 'section_profile_390x844.png') });

  report.summary = {
    hasGameVisualV2: report.sections.home?.hasGameVisualV2,
    CONTENT_UNDER_NAV: Object.values(report.sections).reduce((n, m) => n + (m.contentUnderNav || 0), 0),
    HORIZONTAL_OVERFLOW: Object.values(report.sections).filter((m) => m.horizontalOverflow).length
  };

  fs.writeFileSync(path.join(OUT, 'global_visual_metrics.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));

  await context.close();
} finally {
  await browser.close();
  server.close();
}
