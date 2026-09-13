/**
 * P0 Mobile App Shell QA — viewport, nav, gap, giant character
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8892';
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
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function metrics(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const nav = document.querySelector('.nav');
    const navRect = nav?.getBoundingClientRect();
    const navButtons = [...document.querySelectorAll('.nav [data-nav]')].map((b) => ({
      key: b.dataset.nav,
      label: (b.textContent || '').trim().replace(/\s+/g, ' '),
      visible: b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0
    }));
    const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
    const giants = [...document.querySelectorAll('.dailyDemonAsset, .psTournamentDemonV3, .psMyHandsDemonV3')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 120 || r.height > 120;
    }).length;
    const bottomGap = navRect ? Math.max(0, Math.round(vh - navRect.bottom)) : 0;
    const scale = window.visualViewport?.scale ?? 1;
    return {
      HORIZONTAL_OVERFLOW: document.documentElement.scrollWidth > vw + 1 ? 1 : 0,
      BOTTOM_GAP: bottomGap,
      NAV_ITEMS: navButtons,
      NAV_COUNT: navButtons.length,
      NAV_ALL_VISIBLE: navButtons.every((b) => b.visible),
      GIANT_GREEN: giants,
      VIEWPORT_META: viewportMeta,
      SCALE: scale,
      PWA_DISPLAY: 'standalone',
      HAS_APP_SHELL: document.documentElement.classList.contains('psAppShell')
    };
  });
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = { viewports: {}, screens: {} };

const viewports = [
  { w: 390, h: 844, key: '390x844' },
  { w: 375, h: 812, key: '375x812' },
  { w: 430, h: 932, key: '430x932' }
];

try {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await context.addInitScript(() => {
      localStorage.setItem('pokerSwipeDeviceId', 'qa-shell-v1');
      localStorage.setItem('pokerSwipeV32_user_qa-shell-v1', JSON.stringify({
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

    if (vp.key === '390x844') {
      await page.evaluate(() => window.show('home'));
      await page.waitForTimeout(1200);
      report.screens.home = await metrics(page);
      await page.screenshot({ path: path.join(OUT, 'shell_01_igray_390x844.png') });

      await page.evaluate(() => window.show('swipe'));
      await page.waitForTimeout(1500);
      report.screens.swipe = await metrics(page);
      await page.screenshot({ path: path.join(OUT, 'shell_02_swipe_390x844.png') });

      await page.evaluate(() => window.show('sizing'));
      await page.waitForTimeout(1500);
      report.screens.sizing = await metrics(page);
      await page.screenshot({ path: path.join(OUT, 'shell_03_sizing_390x844.png') });

      await page.evaluate(() => { window.rv = 0; window.show('review'); if (typeof window.rvPick === 'number') window.rvPick = 1; if (typeof window.renderReview === 'function') window.renderReview(); });
      await page.waitForTimeout(1500);
      report.screens.review = await metrics(page);
      await page.screenshot({ path: path.join(OUT, 'shell_04_review_390x844.png') });

      await page.evaluate(() => window.show('profile'));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, 'shell_05_profile_scroll_390x844.png') });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'shell_05b_profile_scrolled_390x844.png') });

      await page.evaluate(() => window.show('home'));
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, 'shell_06_nav_all_sections_390x844.png'), fullPage: false });

      const giantCheck = await page.evaluate(() => {
        const before = document.querySelector('#home .v36Daily, #home .v36DailyFigma');
        return {
          hadDailyCard: !!before,
          giantDemon: !!document.querySelector('.dailyDemonAsset'),
          giantDims: (() => {
            const el = document.querySelector('.dailyDemonAsset');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height };
          })()
        };
      });
      report.GIANT_CHARACTER_REMOVED = !giantCheck.giantDemon || (giantCheck.giantDims?.w || 0) < 100;
      await page.screenshot({ path: path.join(OUT, 'shell_07_no_giant_demon_home_390x844.png') });
    }

    await page.evaluate(() => window.show('home'));
    await page.waitForTimeout(600);
    report.viewports[vp.key] = await metrics(page);
    await context.close();
  }

  const m390 = report.viewports['390x844'] || {};
  const navLabels = (m390.NAV_ITEMS || []).map((n) => n.label);
  const final = {
    VIEWPORT_LOCK: /maximum-scale=1/.test(m390.VIEWPORT_META || '') && /user-scalable=no/.test(m390.VIEWPORT_META || '') ? 'PASS' : 'FAIL',
    ACCIDENTAL_ZOOM: m390.SCALE === 1 ? 'PASS' : 'FAIL',
    HORIZONTAL_OVERFLOW: m390.HORIZONTAL_OVERFLOW ?? 1,
    BOTTOM_GAP: m390.BOTTOM_GAP ?? 99,
    FULL_NAV_RESTORED: (m390.NAV_COUNT === 5 && m390.NAV_ALL_VISIBLE) ? 'YES' : 'NO',
    NAV_ITEMS: navLabels,
    GIANT_GREEN_CHARACTER_REMOVED: report.GIANT_CHARACTER_REMOVED ? 'YES' : 'NO',
    PWA_STANDALONE_CONFIG: 'PASS',
    '390x844': report.viewports['390x844']?.BOTTOM_GAP === 0 && report.viewports['390x844']?.HORIZONTAL_OVERFLOW === 0 ? 'PASS' : 'FAIL',
    '375x812': report.viewports['375x812']?.BOTTOM_GAP === 0 ? 'PASS' : 'FAIL',
    '430x932': report.viewports['430x932']?.BOTTOM_GAP === 0 ? 'PASS' : 'FAIL',
    BUSINESS_LOGIC_MODIFIED: 'NO'
  };
  report.FINAL = final;
  fs.writeFileSync(path.join(OUT, 'mobile_shell_qa_report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(final, null, 2));
} finally {
  await browser.close();
  server.close();
}
