/**
 * Capture 390×844 composition screenshots + mobile safe-area QA
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8878';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const BAD_LABELS = ['GENERIC', 'SKEPTICAL', 'THINKING', 'CORRECT.PNG', 'WRONG.PNG', 'STREAK', '· GENERIC', 'SIZE / ЛОГИКА'];

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url?.split('?')[0] || '/';
      const file = path.join(root, url === '/' ? 'index.html' : decodeURIComponent(url));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

function auditPage(page) {
  return page.evaluate((badLabels) => {
    const active = document.querySelector('.screen.active');
    const scope = active || document.body;
    const nav = document.querySelector('.nav');
    const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
    const text = scope.innerText.toUpperCase();
    const labelHits = badLabels.filter((w) => text.includes(w));

    const meaningfulSelectors = [
      '.freakCoachAvatar',
      '.psCharCompose__bubble',
      '.psCharCompose__text',
      '.psDemonPeek',
      '.psDemonPeek .psCharBubble',
      '.psReviewInsight',
      '.psDailyInsight',
      '.psDailyStatus',
      '.psLossMap',
      '.verdictCTA .primary',
      '.psVerdictRecap',
      '.psNarrativeStep'
    ];

    let navCollisions = 0;
    let clippedCharacters = 0;
    let blockedCta = 0;

    meaningfulSelectors.forEach((sel) => {
      scope.querySelectorAll(sel).forEach((el) => {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        if (r.bottom > navTop + 1) {
          navCollisions++;
          if (el.classList.contains('freakCoachAvatar')) {
            const visible = Math.max(0, navTop - r.top);
            if (visible < r.height * 0.4) clippedCharacters++;
          }
        }
      });
    });

    const btn = scope.querySelector('#dHome, #verdictNext, #rvNext, .verdictCTA .primary, .primary');
    if (btn) {
      const r = btn.getBoundingClientRect();
      const style = getComputedStyle(btn);
      if (style.display !== 'none' && r.height > 2) {
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const navEl = document.querySelector('.nav');
        if (el !== btn && !btn.contains(el) && el !== navEl && !navEl?.contains(el)) blockedCta++;
        if (r.bottom > navTop + 1) navCollisions++;
      }
    }

    return {
      navCollisions,
      clippedCharacters,
      blockedCta,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      internalLabels: labelHits,
      navTop: Math.round(navTop),
      navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : 0
    };
  }, BAD_LABELS);
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = { viewports: {}, screenshots: {} };

try {
  for (const vp of [{ w: 390, h: 844, id: '390x844' }, { w: 375, h: 812, id: '375x812' }, { w: 430, h: 932, id: '430x932' }]) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await context.addInitScript(() => {
      localStorage.setItem('pokerSwipeDeviceId', 'qa-compose-v2');
      localStorage.setItem('pokerSwipeV32_user_qa-compose-v2', JSON.stringify({
        version: '32.0', nick: 'QA', onboarded: true, diagDone: true,
        skill: 55, streak: 3, lastDay: '2026-08-25', events: [], hands: [],
        myHands18: [], tournaments: [], dailyArchive: [], snapshots: [],
        seenSwipe: [], diagnostic: [], xray: { onboarded: true, runs: 0, history: [], counts: {} },
        healCourses: {}
      }));
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);

    // Swipe verdict
    await page.evaluate(() => window.show('swipe'));
    await page.waitForTimeout(800);
    const action = await page.$('[data-sa]');
    if (action) {
      await action.click();
      await page.waitForTimeout(3500);
    await page.waitForTimeout(250);
    report.viewports[vp.id] = report.viewports[vp.id] || {};
    report.viewports[vp.id].swipe = await auditPage(page);
    if (vp.id === '390x844') {
      await page.screenshot({ path: path.join(OUT, 'screen_3_mix_ne_norma_390x844.png') });
    }

    // Review
    await page.evaluate(() => {
      window.rv = 0;
      window.show('review');
      window.rvPick = 1;
      if (typeof window.reviewReveal === 'function') window.reviewReveal();
    });
    await page.waitForTimeout(3500);
    await page.waitForTimeout(250);
    report.viewports[vp.id].review = await auditPage(page);
    if (vp.id === '390x844') {
      await page.screenshot({ path: path.join(OUT, 'screen_2_gde_slomalos_390x844.png') });
    }

    // Daily
    await page.evaluate(() => {
      window.show('daily');
      window.dChoice = 'BET';
      window.dSize = 66;
      window.dConf = 72;
      window.dArgs = { 0: 'bet', 1: 'check', 2: 'bet' };
      if (typeof window.dailyReveal === 'function') window.dailyReveal();
    });
    await page.waitForTimeout(2500);
    await page.waitForTimeout(250);
    report.viewports[vp.id].daily = await auditPage(page);
    if (vp.id === '390x844') {
      await page.screenshot({ path: path.join(OUT, 'screen_1_est_chto_dokrutit_390x844.png') });
    }

    await context.close();
  }

  const totals = Object.values(report.viewports).flatMap((vp) => Object.values(vp));
  report.summary = {
    BOTTOM_NAV_COLLISIONS: totals.reduce((n, m) => n + (m.navCollisions || 0), 0),
    CLIPPED_CHARACTERS: totals.reduce((n, m) => n + (m.clippedCharacters || 0), 0),
    BLOCKED_CTA: totals.reduce((n, m) => n + (m.blockedCta || 0), 0),
    INTERNAL_LABELS_VISIBLE: [...new Set(totals.flatMap((m) => m.internalLabels || []))].length,
    HORIZONTAL_OVERFLOW: totals.filter((m) => m.horizontalOverflow).length
  };

  fs.writeFileSync(path.join(OUT, 'composition_metrics.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
} finally {
  await browser.close();
  server.close();
}
