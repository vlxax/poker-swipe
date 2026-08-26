/**
 * Capture 390×844 composition screenshots + overlap/safe-area QA
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

    function rect(el) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return null;
      return r;
    }

    function intersects(a, b) {
      if (!a || !b) return false;
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    const avatars = [...scope.querySelectorAll('.freakCoachAvatar')].map(rect).filter(Boolean);
    const ctas = [...scope.querySelectorAll('#dHome, #verdictNext, #rvNext, .verdictCTA .primary')].map(rect).filter(Boolean);
    const textBlocks = [...scope.querySelectorAll(
      '.psVerdictRecap, .psNarrativeStep'
    )].map(rect).filter(Boolean);
    const contentBlocks = [...scope.querySelectorAll(
      '.psCharCompose__bubble, .psVerdictRecap, .psNarrativeStep, .psReviewInsight, .psDailyInsight, .psDailyStatus, .psLossMap, .verdictCTA .primary, #dHome, #rvNext, .psDemonPeek'
    )].map(rect).filter(Boolean);

    let ctaOverCharacter = 0;
    let textOverCharacter = 0;
    let characterUnderNav = 0;
    let contentUnderNav = 0;
    let accidentalClipping = 0;

    ctas.forEach((cta) => {
      avatars.forEach((av) => {
        if (intersects(cta, av) && cta.top < av.bottom - 24) ctaOverCharacter++;
      });
      if (cta.bottom > navTop + 4) contentUnderNav++;
    });

    textBlocks.forEach((block) => {
      avatars.forEach((av) => {
        if (intersects(block, av) && block.right > av.left + av.width * 0.55) textOverCharacter++;
      });
    });

    avatars.forEach((av) => {
      if (av.bottom > navTop + 1) {
        const visible = Math.max(0, navTop - av.top);
        if (visible < av.height * 0.5) characterUnderNav++;
        if (visible < av.height * 0.4) accidentalClipping++;
      }
    });

    const btn = scope.querySelector('#dHome, #verdictNext, #rvNext, .verdictCTA .primary');
    let blockedCta = 0;
    if (btn) {
      const r = rect(btn);
      if (r) {
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const navEl = document.querySelector('.nav');
        if (el !== btn && !btn.contains(el) && el !== navEl && !navEl?.contains(el)) blockedCta++;
      }
    }

    return {
      ctaOverCharacter,
      textOverCharacter,
      characterUnderNav,
      contentUnderNav,
      accidentalClipping,
      blockedCta,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      internalLabels: labelHits,
      navTop: Math.round(navTop)
    };
  }, BAD_LABELS);
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = { viewports: {} };

try {
  for (const vp of [{ w: 390, h: 844, id: '390x844' }]) {
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

    await page.evaluate(() => window.show('swipe'));
    await page.waitForTimeout(800);
    const action = await page.$('[data-sa]');
    if (action) {
      await action.click();
      await page.waitForTimeout(3500);
    }
    report.viewports[vp.id] = {};
    report.viewports[vp.id].swipe = await auditPage(page);
    await page.screenshot({ path: path.join(OUT, 'screen_3_mix_ne_norma_390x844.png') });

    await page.evaluate(() => {
      window.rv = 0;
      window.show('review');
      window.rvPick = 1;
      if (typeof window.reviewReveal === 'function') window.reviewReveal();
    });
    await page.waitForTimeout(3500);
    await page.evaluate(() => {
      const active = document.querySelector('.screen.active');
      if (active) active.scrollTop = active.scrollHeight;
    });
    await page.waitForTimeout(200);
    report.viewports[vp.id].review = await auditPage(page);
    await page.screenshot({ path: path.join(OUT, 'screen_2_gde_slomalos_390x844.png') });

    await page.evaluate(() => {
      window.show('daily');
      window.dChoice = 'BET';
      window.dSize = 66;
      window.dConf = 72;
      window.dArgs = { 0: 'bet', 1: 'check', 2: 'bet' };
      if (typeof window.dailyReveal === 'function') window.dailyReveal();
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const active = document.querySelector('.screen.active');
      if (active) active.scrollTop = active.scrollHeight;
    });
    await page.waitForTimeout(200);
    report.viewports[vp.id].daily = await auditPage(page);
    await page.screenshot({ path: path.join(OUT, 'screen_1_est_chto_dokrutit_390x844.png') });

    await context.close();
  }

  const totals = Object.values(report.viewports).flatMap((vp) => Object.values(vp));
  report.summary = {
    CTA_OVER_CHARACTER: totals.reduce((n, m) => n + (m.ctaOverCharacter || 0), 0),
    TEXT_OVER_CHARACTER: totals.reduce((n, m) => n + (m.textOverCharacter || 0), 0),
    CHARACTER_UNDER_NAV: totals.reduce((n, m) => n + (m.characterUnderNav || 0), 0),
    CONTENT_UNDER_NAV: totals.reduce((n, m) => n + (m.contentUnderNav || 0), 0),
    ACCIDENTAL_CHARACTER_CLIPPING: totals.reduce((n, m) => n + (m.accidentalClipping || 0), 0),
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
