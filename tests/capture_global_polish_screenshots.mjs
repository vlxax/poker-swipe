/**
 * Global premium polish QA — 390×844 screenshots + metrics
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8881';
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
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function qa(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const active = document.querySelector('.screen.active') ||
      (document.getElementById('ps72TournamentScreen')?.classList.contains('on') ? document.getElementById('ps72TournamentScreen') : null);
    const scope = active || document.body;

    let hOverflow = document.documentElement.scrollWidth > vw + 1 ? 1 : 0;
    let contentUnderNav = 0;
    let blockedCta = 0;
    let charColl = 0;
    let textColl = 0;

    const ctas = [...scope.querySelectorAll('.primary, .pgCta, #dHome, .verdictCTA .primary, .btn, button.tile')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    });

    ctas.forEach((btn) => {
      const br = btn.getBoundingClientRect();
      if (br.bottom > navTop + 4) {
        contentUnderNav++;
        blockedCta++;
      }
      scope.querySelectorAll('.fl-scene, .fl-scene__art, .psDailyCoachHost, .psReviewCoachHost, .psSwipeCoachHost, .demon, .companion').forEach((ch) => {
        const cr = ch.getBoundingClientRect();
        if (cr.width < 2) return;
        if (br.left < cr.right - 8 && br.right > cr.left + 8 && br.top < cr.bottom - 8 && br.bottom > cr.top + 8) charColl++;
      });
    });

    const texts = [...scope.querySelectorAll('h1,h2,h3,.impact,.section-title')].filter((e) => (e.textContent || '').trim().length > 2);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].getBoundingClientRect();
        const b = texts[j].getBoundingClientRect();
        if (a.width < 2 || b.width < 2) continue;
        if (a.left < b.right - 4 && a.right > b.left + 4 && a.top < b.bottom - 4 && a.bottom > b.top + 4) textColl++;
      }
    }

    return {
      HORIZONTAL_OVERFLOW: hOverflow,
      CONTENT_UNDER_NAV: contentUnderNav,
      BLOCKED_CTA: blockedCta,
      CHARACTER_COLLISIONS: charColl,
      TEXT_COLLISIONS: textColl,
      hasAtmosphere: !!document.querySelector('.psAtmosphere'),
      hasPolishCss: !!document.querySelector('link[href*="game-polish.css"]'),
      hasZoneClass: !!document.querySelector('.screen.psZone--lobby, .screen.psZone--forensic, .screen.psZone--discovery, .screen.psZone--dossier, .screen.psZone--swipe'),
      navDock: !!nav && getComputedStyle(nav).boxShadow !== 'none',
      gameVisualV2: document.body.classList.contains('psGameVisualV2')
    };
  });
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = { sections: {} };

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('pokerSwipeDeviceId', 'qa-polish-v1');
    localStorage.setItem('pokerSwipeV32_user_qa-polish-v1', JSON.stringify({
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

  // 1. Играть
  await page.evaluate(() => window.show('home'));
  await page.waitForTimeout(1200);
  report.sections.home = await qa(page);
  await page.screenshot({ path: path.join(OUT, 'polish_01_igray_390x844.png') });

  // 2. Freak Lady / Review
  await page.evaluate(() => {
    window.rv = 0;
    window.show('review');
    window.rvPick = 1;
    if (typeof window.reviewReveal === 'function') window.reviewReveal();
  });
  await page.waitForTimeout(3500);
  report.sections.review = await qa(page);
  await page.screenshot({ path: path.join(OUT, 'polish_02_freak_lady_review_390x844.png') });

  // 3. Поляна
  await page.evaluate(() => {
    if (typeof window.openPolyanaV54 === 'function') window.openPolyanaV54();
    else window.show('polyana');
  });
  await page.waitForTimeout(2500);
  report.sections.polyana = await qa(page);
  await page.screenshot({ path: path.join(OUT, 'polish_03_polyana_390x844.png') });

  // 4. Мои турниры
  await page.evaluate(() => {
    if (typeof window.openMyTournamentsV72 === 'function') window.openMyTournamentsV72();
    else if (typeof window.openMyTournamentsV71 === 'function') window.openMyTournamentsV71();
    else window.openJournal?.();
  });
  await page.waitForTimeout(2000);
  report.sections.tournaments = await qa(page);
  await page.screenshot({ path: path.join(OUT, 'polish_04_moi_turniry_390x844.png') });

  // 5. Профиль
  await page.evaluate(() => {
    const screen = document.getElementById('ps72TournamentScreen');
    if (screen?.classList.contains('on') && window.MtProTournaments?.closeScreen) {
      window.MtProTournaments.closeScreen();
    }
    window.show('profile');
  });
  await page.waitForTimeout(1500);
  report.sections.profile = await qa(page);
  await page.screenshot({ path: path.join(OUT, 'polish_05_profil_390x844.png') });

  // 6. Gameplay — Swipe
  await page.evaluate(() => {
    window.show('swipe');
    if (typeof window.renderSwipe === 'function') window.renderSwipe();
  });
  await page.waitForTimeout(1500);
  report.sections.swipe = await qa(page);
  await page.screenshot({ path: path.join(OUT, 'polish_06_gameplay_swipe_390x844.png') });

  const metrics = Object.values(report.sections);
  report.summary = {
    GLOBAL_VISUAL_SYSTEM: metrics.every((m) => m.gameVisualV2 && m.hasPolishCss && m.hasAtmosphere) ? 'PASS' : 'FAIL',
    PREMIUM_BACKGROUND: metrics.every((m) => m.hasAtmosphere) ? 'PASS' : 'FAIL',
    BOTTOM_NAV: metrics.every((m) => m.navDock) ? 'PASS' : 'FAIL',
    HORIZONTAL_OVERFLOW: metrics.reduce((n, m) => n + m.HORIZONTAL_OVERFLOW, 0),
    CONTENT_UNDER_NAV: metrics.reduce((n, m) => n + m.CONTENT_UNDER_NAV, 0),
    BLOCKED_CTA: metrics.reduce((n, m) => n + m.BLOCKED_CTA, 0),
    CHARACTER_COLLISIONS: metrics.reduce((n, m) => n + m.CHARACTER_COLLISIONS, 0),
    TEXT_COLLISIONS: metrics.reduce((n, m) => n + m.TEXT_COLLISIONS, 0),
    MOBILE_390x844: metrics.every((m) =>
      m.HORIZONTAL_OVERFLOW === 0 && m.CONTENT_UNDER_NAV === 0 && m.BLOCKED_CTA === 0
    ) ? 'PASS' : 'FAIL'
  };

  fs.writeFileSync(path.join(OUT, 'global_polish_metrics.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
