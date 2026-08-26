/**
 * Capture 390×844 composition screenshots for result, review, daily
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8878';
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
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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

  // 1. Swipe result/reaction
  await page.evaluate(() => window.show('swipe'));
  await page.waitForTimeout(800);
  const action = await page.$('[data-sa]');
  if (action) {
    await action.click();
    await page.waitForTimeout(2800);
  }
  await page.waitForTimeout(3500);

  const labelAudit = await page.evaluate(() => {
    const text = document.body.innerText.toUpperCase();
    const bad = ['GENERIC', 'SKEPTICAL', 'THINKING', 'CORRECT.PNG', 'WRONG.PNG', 'STREAK', '· GENERIC'];
    return {
      hasGeneric: text.includes('GENERIC'),
      hits: bad.filter((w) => text.includes(w))
    };
  });

  const swipeMetrics = await page.evaluate(() => {
    const art = document.querySelector('.psVerdictCoachLayer .freakCoachAvatar, .psCharCompose--scene .freakCoachAvatar');
    const rect = art?.getBoundingClientRect();
    const vp = { w: window.innerWidth, h: window.innerHeight };
    return {
      hasScene: !!document.querySelector('.psCharCompose--scene'),
      hasNarrative: !!document.querySelector('.psVerdictNarrative'),
      charWidthPct: rect ? Math.round((rect.width / vp.w) * 100) : 0,
      charHeightPct: rect ? Math.round((rect.height / vp.h) * 100) : 0,
      hasBubble: !!document.querySelector('.psCharCompose__bubble')
    };
  });
  await page.screenshot({ path: path.join(OUT, 'screen_3_mix_ne_norma_390x844.png') });

  // 2. Review / loss map
  await page.evaluate(() => {
    window.rv = 0;
    window.show('review');
    window.rvPick = 1;
    if (typeof window.reviewReveal === 'function') window.reviewReveal();
  });
  await page.waitForTimeout(3500);
  const reviewMetrics = await page.evaluate(() => {
    const art = document.querySelector('.psReviewCoachHost .freakCoachAvatar');
    const rect = art?.getBoundingClientRect();
    return {
      hasForensic: !!document.querySelector('.psReviewForensic__scene'),
      hasLossMap: !!document.querySelector('.psLossMap'),
      hasScene: !!document.querySelector('.psReviewCoachHost .psCharCompose--scene'),
      charWidthPct: rect ? Math.round((rect.width / 390) * 100) : 0
    };
  });
  await page.screenshot({ path: path.join(OUT, 'screen_2_gde_slomalos_390x844.png') });

  // 3. Daily coach moment
  await page.evaluate(() => {
    window.show('daily');
    window.dChoice = 'BET';
    window.dSize = 66;
    window.dConf = 72;
    window.dArgs = { 0: 'bet', 1: 'check', 2: 'bet' };
    if (typeof window.dailyReveal === 'function') window.dailyReveal();
  });
  await page.waitForTimeout(2000);
  const dailyMetrics = await page.evaluate(() => {
    const art = document.querySelector('.psDailyCoachHost .freakCoachAvatar');
    const rect = art?.getBoundingClientRect();
    return {
      hasDailyHost: !!document.querySelector('.psDailyCoachHost'),
      hasScene: !!document.querySelector('.psDailyCoachHost .psCharCompose--scene'),
      charHeightPct: rect ? Math.round((rect.height / 844) * 100) : 0
    };
  });
  await page.screenshot({ path: path.join(OUT, 'screen_1_est_chto_dokrutit_390x844.png') });

  const navMetrics = await page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const r = nav?.getBoundingClientRect();
    return { navHeight: r ? Math.round(r.height) : 0 };
  });

  const summary = { labelAudit, swipeMetrics, reviewMetrics, dailyMetrics, navMetrics };
  fs.writeFileSync(path.join(OUT, 'composition_metrics.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
  server.close();
}
