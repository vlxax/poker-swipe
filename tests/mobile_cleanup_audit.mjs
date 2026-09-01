/**
 * Mobile cleanup audit: compact nav, clickability, Timing removal, nav stress.
 * Run: PS_PORT=8902 node tests/mobile_cleanup_audit.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const PORT = process.env.PS_PORT || '8902';
const MAX_NAV_H = 60;
const MAX_BTN_MIN_H = 48;

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

function hideAuth() {
  document.querySelectorAll('.pokerswipe-auth-screen').forEach((el) => {
    el.classList.add('hidden');
    el.style.pointerEvents = 'none';
  });
  document.getElementById('mainApp')?.classList.remove('hidden');
}

function seedScript() {
  localStorage.setItem('pokerSwipeDeviceId', 'mobile-audit');
  localStorage.setItem('pokerSwipeV32_user_mobile-audit', JSON.stringify({
    version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 62, streak: 3,
    lastDay: '2026-09-01',
    events: Array.from({ length: 8 }, (_, i) => ({ grade: i % 2 ? 'g' : 'r', concept: 'RFI' })),
    hands: [], myHands18: [], tournaments: [], dailyArchive: [], snapshots: [],
    seenSwipe: [], diagnostic: [],
    xray: { onboarded: true, runs: 0, history: [], counts: {} },
    healCourses: {}
  }));
}

async function navMetrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const r = nav?.getBoundingClientRect();
    const btn = document.querySelector('.nav [data-nav]');
    const bcs = btn ? getComputedStyle(btn) : null;
    return {
      navH: r ? Math.round(r.height) : 999,
      navBottomGap: r ? Math.max(0, Math.round(window.innerHeight - r.bottom)) : 99,
      btnMinH: parseFloat(bcs?.minHeight || '999'),
      hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
}

async function clickNav(page, key) {
  await page.locator(`.nav [data-nav="${key}"]`).click({ timeout: 8000, force: true });
  await page.waitForTimeout(350);
}

const server = await startServer();
const browser = await chromium.launch({ headless: true });
const report = { checks: [], errors: [] };

try {
  const viewports = [
    { w: 390, h: 844, key: '390x844' },
    { w: 393, h: 852, key: '393x852' },
    { w: 430, h: 932, key: '430x932' },
    { w: 375, h: 812, key: '375x812' }
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await ctx.addInitScript(seedScript);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(`pageerror:${e}`));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`console:${m.text()}`); });

    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.evaluate(hideAuth);

    const m = await navMetrics(page);
    report.checks.push({
      name: `nav_compact_${vp.key}`,
      pass: m.navH <= MAX_NAV_H && m.btnMinH <= MAX_BTN_MIN_H && m.navBottomGap === 0,
      navH: m.navH,
      btnMinH: m.btnMinH
    });

    if (vp.key === '390x844') {
      // Timing mini-app must not exist or be reachable
      const timing = await page.evaluate(() => ({
        screen: !!document.getElementById('timing'),
        nav: !!document.querySelector('[data-nav="timing"]'),
        homeText: /тайминг/i.test(document.getElementById('home')?.textContent || ''),
        showTiming: typeof window.show === 'function' && !!document.getElementById('timing')
      }));
      report.checks.push({
        name: 'timing_mini_app_removed',
        pass: !timing.screen && !timing.nav && !timing.homeText && !timing.showTiming
      });

      // Home tiles clickable
      await page.evaluate(() => window.show('home'));
      await page.waitForTimeout(600);
      for (const [id, screen, extra] of [
        ['v36Review', 'review', null],
        ['v36Sizing', 'sizing', null],
        ['v36Daily', 'daily', 'handDayOverlay'],
        ['v36Swipe', 'swipe', null]
      ]) {
        await page.evaluate(() => window.show('home'));
        await page.waitForTimeout(300);
        const el = page.locator(`#${id}`);
        if (await el.count()) {
          await el.click({ timeout: 5000 });
          await page.waitForTimeout(700);
          let pass = false;
          if (extra === 'handDayOverlay') {
            pass = await page.evaluate(() => {
              const o = document.getElementById('psHandDayOverlay');
              return !!o && o.style.display !== 'none' && o.getAttribute('aria-hidden') === 'false';
            });
            await page.evaluate(() => {
              const overlay = document.getElementById('psHandDayOverlay');
              if (overlay) { overlay.style.display = 'none'; overlay.setAttribute('aria-hidden', 'true'); }
              document.documentElement.classList.remove('psHandDayOpen');
              document.body.classList.remove('psHandDayOpen');
            });
          } else {
            pass = await page.evaluate((s) => document.getElementById(s)?.classList.contains('active'), screen);
          }
          report.checks.push({ name: `home_tile_${id}`, pass, screen });
        }
      }

      // Review screen ("ГДЕ СЛОМАЛОСЬ?")
      await page.evaluate(() => { window.rv = 0; window.show('home'); window.show('review'); });
      await page.waitForTimeout(1000);
      const review = await page.evaluate(() => {
        const area = document.getElementById('reviewArea');
        const nodes = [...(area?.querySelectorAll('.node, button[data-rn], .timeline button') || [])];
        return { nodeCount: nodes.length, hasArea: !!area?.textContent?.trim() };
      });
      report.checks.push({ name: 'review_screen_renders', pass: review.hasArea && review.nodeCount > 0 });

      const firstNode = page.locator('#reviewArea .node').first();
      if (await firstNode.count()) {
        await firstNode.click();
        await page.waitForTimeout(300);
        const selected = await firstNode.evaluate((el) => el.classList.contains('selected'));
        report.checks.push({ name: 'review_timeline_clickable', pass: selected });
      }

      // Bottom nav tabs stress
      await page.evaluate(() => {
        document.querySelectorAll('.pokerswipe-auth-screen,#psHandDayOverlay,[data-ps-modal]').forEach((el) => {
          el.classList?.add('hidden');
          if (el.style) el.style.display = 'none';
        });
      });
      const tabs = ['home', 'myhands', 'polyana', 'profile'];
      let stressOk = true;
      for (let i = 0; i < 12; i++) {
        const key = tabs[i % tabs.length];
        try {
          await clickNav(page, key);
          const active = await page.evaluate((k) => {
            const map = { home: 'home', myhands: 'myhands', polyana: 'polyana', profile: 'profile' };
            return document.getElementById(map[k])?.classList.contains('active');
          }, key);
          if (!active) stressOk = false;
        } catch (e) {
          stressOk = false;
          report.errors.push(`nav_stress:${key}:${e.message}`);
        }
      }
      // mytournaments opens journal overlay — just verify click does not throw
      try {
        await clickNav(page, 'mytournaments');
        stressOk = stressOk && true;
      } catch (e) {
        stressOk = false;
        report.errors.push(`nav_stress:mytournaments:${e.message}`);
      }
      report.checks.push({ name: 'nav_stress_alternate', pass: stressOk });

      // Range count safety
      const charts = await page.evaluate(async () => {
        const { initBrowserTrainerLookup } = await import('/trainer-knowledge/browserLookup.js');
        const lookup = await initBrowserTrainerLookup();
        return lookup.charts.length;
      });
      report.checks.push({ name: 'range_chart_count_1698', pass: charts === 1698, charts });

      report.checks.push({
        name: 'horizontal_overflow_home',
        pass: !(await navMetrics(page)).hOverflow
      });
    }

    await ctx.close();
  }

  const failed = report.checks.filter((c) => !c.pass);
  const fatalErrors = report.errors.filter((e) => !/favicon|404.*\.map/i.test(e));
  report.PASS = failed.length === 0 && fatalErrors.length === 0;
  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.PASS, `mobile audit failed: ${failed.map((f) => f.name).join(', ')} errors=${fatalErrors.length}`);
} finally {
  await browser.close();
  server.close();
}
