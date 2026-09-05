/**
 * Real-browser smoke for AUTH_REQUIRED=false direct launch.
 * Run: PS_PORT=8935 node tests/auth_bypass_smoke.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const PORT = process.env.PS_PORT || '8935';

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

function makeSession(userId = 'smoke-session-user') {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: 'smoke-access-token',
    refresh_token: 'smoke-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: userId, email: 'smoke@example.com' },
    savedAt: Date.now()
  };
}

async function collectBootState(page) {
  return page.evaluate(() => ({
    authRequired: window.PokerSwipeConfig?.AUTH_REQUIRED,
    mainVisible: !document.getElementById('mainApp')?.classList.contains('hidden'),
    authVisible: ['authWelcome', 'authEmail', 'authOtp', 'authOtpSuccess'].some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    }),
    bootstrapState: window.PokerSwipeAuthBootstrap?.getState?.(),
    deviceId: localStorage.getItem('pokerSwipeDeviceId'),
    sessionRaw: localStorage.getItem('pokerswipe_auth_session'),
    url: location.href
  }));
}

async function assertDirectBoot(page, label) {
  await page.waitForFunction(
    () => {
      const main = document.getElementById('mainApp');
      return window.PokerSwipeAuthBootstrap?.getState?.() === 'HOME'
        && main && !main.classList.contains('hidden');
    },
    undefined,
    { timeout: 45000 }
  );
  const state = await collectBootState(page);
  assert.equal(state.authRequired, false, `${label}: AUTH_REQUIRED should be false`);
  assert.equal(state.mainVisible, true, `${label}: mainApp should be visible`);
  assert.equal(state.authVisible, false, `${label}: auth screens must stay hidden`);
  assert.equal(state.bootstrapState, 'HOME', `${label}: bootstrap should reach HOME`);
  assert.match(state.url, /index\.html/, `${label}: no redirect loop`);
  return state;
}

async function attachMonitors(page, report) {
  page.on('pageerror', (e) => report.pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(m.text());
  });
}

const report = {
  checks: [],
  pageErrors: [],
  consoleErrors: [],
  charts: null,
  PASS: false
};

const server = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  // 1) Fresh launch — empty storage
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    attachMonitors(page, report);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const state = await assertDirectBoot(page, 'fresh_launch');
    assert.ok(state.deviceId, 'fresh_launch: device id should be set');
    report.checks.push({ name: 'fresh_launch_direct', pass: true, deviceId: state.deviceId });

    // 2) Reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloadState = await assertDirectBoot(page, 'reload');
    assert.equal(reloadState.deviceId, state.deviceId, 'device id must survive reload');
    report.checks.push({ name: 'reload_direct', pass: true });

    await ctx.close();
  }

  // 3) Close/reopen — new browser context
  let reopenedDeviceId;
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      localStorage.setItem('pokerSwipeDeviceId', 'auth-smoke-reopen-device');
    });
    const page = await ctx.newPage();
    attachMonitors(page, report);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const state = await assertDirectBoot(page, 'reopen');
    reopenedDeviceId = state.deviceId;
    report.checks.push({ name: 'close_reopen_direct', pass: true, deviceId: reopenedDeviceId });
    await ctx.close();
  }

  // 4) Existing Supabase session preserved
  {
    const session = makeSession('persist-smoke-user');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((s) => {
      localStorage.setItem('pokerswipe_auth_session', JSON.stringify(s));
      window.fetch = async (input) => {
        const href = String(input);
        if (href.includes('supabase.co')) {
          return {
            ok: true,
            status: 200,
            text: async () => '[]',
            json: async () => ([])
          };
        }
        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };
    }, session);
    const page = await ctx.newPage();
    attachMonitors(page, report);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await assertDirectBoot(page, 'session_preserved');
    const stored = await page.evaluate(() => localStorage.getItem('pokerswipe_auth_session'));
    const parsed = JSON.parse(stored);
    assert.equal(parsed.user.id, 'persist-smoke-user');
    assert.equal(parsed.access_token, 'smoke-access-token');
    report.checks.push({ name: 'session_not_deleted', pass: true });
    await ctx.close();
  }

  // 5) Learning surfaces + charts.length
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      const deviceId = 'auth-smoke-learning';
      localStorage.setItem('pokerSwipeDeviceId', deviceId);
      localStorage.setItem(`pokerSwipeV32_user_${deviceId}`, JSON.stringify({
        version: '32.0', nick: 'QA', onboarded: true, diagDone: true, skill: 50, streak: 1,
        lastDay: '2026-09-05', events: [], hands: [], myHands18: [], tournaments: [],
        dailyArchive: [], snapshots: [], seenSwipe: [], diagnostic: [],
        xray: { onboarded: true, runs: 0, history: [], counts: {} },
        healCourses: {}
      }));
      localStorage.setItem(`pokerSwipe_mistakeMemory_v1:device:${deviceId}`, JSON.stringify({
        schemaVersion: 1,
        storeSchema: 1,
        userId: `device:${deviceId}`,
        savedAt: Date.now(),
        payload: { items: { 'UO_2-4_EP:AA': { id: 'UO_2-4_EP:AA', attempts: 2, correct: 1 } } }
      }));
      localStorage.setItem('pokerSwipe_rangeBattle_v1', JSON.stringify({
        lastChartId: 'B2_0001',
        lastCourseId: 'B2_0001',
        courses: { B2_0001: { chartId: 'B2_0001', courseId: 'B2_0001' } }
      }));
    });
    const page = await ctx.newPage();
    attachMonitors(page, report);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await assertDirectBoot(page, 'learning_surfaces');
    await page.waitForTimeout(1500);

    const charts = await page.evaluate(async () => {
      const { initBrowserTrainerLookup } = await import('/trainer-knowledge/browserLookup.js');
      const api = await initBrowserTrainerLookup();
      return api.charts.length;
    });
    report.charts = charts;
    assert.equal(charts, 1698);
    report.checks.push({ name: 'charts_length_1698', pass: true, charts });

    const homeActive = await page.evaluate(() => document.getElementById('home')?.classList.contains('active'));
    assert.equal(homeActive, true);
    report.checks.push({ name: 'home_opens', pass: true });

    // My Hands
    await page.locator('.nav [data-nav="myhands"]').click({ force: true, timeout: 8000 });
    await page.waitForTimeout(500);
    const myHands = await page.evaluate(() => document.getElementById('myhands')?.classList.contains('active'));
    assert.equal(myHands, true);
    report.checks.push({ name: 'my_hands_opens', pass: true });

    // Trainer (sizing)
    await page.evaluate(() => window.show('home'));
    await page.waitForTimeout(400);
    if (await page.locator('#v36Sizing').count()) {
      await page.locator('#v36Sizing').click({ timeout: 5000 });
    } else {
      await page.evaluate(() => window.show('sizing'));
    }
    await page.waitForTimeout(500);
    const sizing = await page.evaluate(() => document.getElementById('sizing')?.classList.contains('active'));
    assert.equal(sizing, true);
    report.checks.push({ name: 'trainer_opens', pass: true });

    // Hand of Day (fullscreen overlay via hand-day-bridge)
    await page.evaluate(() => window.show('home'));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.show('daily'));
    await page.waitForTimeout(800);
    const handOfDay = await page.evaluate(() => {
      const overlay = document.getElementById('psHandDayOverlay');
      return !!overlay
        && overlay.style.display !== 'none'
        && overlay.getAttribute('aria-hidden') === 'false';
    });
    assert.equal(handOfDay, true);
    report.checks.push({ name: 'hand_of_day_opens', pass: true });

    // Mistake Memory key survives reload
    const mmBefore = await page.evaluate(() => {
      const deviceId = localStorage.getItem('pokerSwipeDeviceId');
      return localStorage.getItem(`pokerSwipe_mistakeMemory_v1:device:${deviceId}`);
    });
    assert.ok(mmBefore);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertDirectBoot(page, 'mm_reload');
    const mmAfter = await page.evaluate(() => {
      const deviceId = localStorage.getItem('pokerSwipeDeviceId');
      return JSON.parse(localStorage.getItem(`pokerSwipe_mistakeMemory_v1:device:${deviceId}`) || '{}');
    });
    assert.equal(mmAfter.payload?.items?.['UO_2-4_EP:AA']?.attempts, 2);
    report.checks.push({ name: 'mistake_memory_persists', pass: true });

    // Ranges + Battleship
    await page.evaluate(() => window.show('ranges'));
    await page.waitForTimeout(600);
    const rangesActive = await page.evaluate(() => document.getElementById('ranges')?.classList.contains('active'));
    assert.equal(rangesActive, true);
    report.checks.push({ name: 'ranges_opens', pass: true });

    await page.waitForSelector('#rbOpenBattle', { timeout: 60000 });
    await page.locator('#rbOpenBattle').click({ force: true });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const id = document.querySelector('#rbStartCourse')?.dataset?.course;
      if (id && window.PokerSwipeRanges?.selectBattleshipCourse) {
        window.PokerSwipeRanges.selectBattleshipCourse(id);
      }
    });
    await page.waitForSelector('#rbBeginMission', { timeout: 60000 });
    report.checks.push({ name: 'battleship_opens', pass: true });

    await ctx.close();
  }

  // 6) AUTH_REQUIRED=true restores email gate (served config override; branch stays false on disk)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      window.fetch = async (input) => {
        const href = String(input);
        if (href.includes('supabase.co')) {
          return { ok: true, status: 200, text: async () => 'null', json: async () => null };
        }
        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };
    });
    const page = await ctx.newPage();
    await page.route('**/js/pokerswipe-config.js', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.PokerSwipeConfig = { AUTH_REQUIRED: true };'
      });
    });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(
      () => {
        const email = document.getElementById('authEmail');
        const welcome = document.getElementById('authWelcome');
        const emailVisible = email && !email.classList.contains('hidden');
        const welcomeVisible = welcome && !welcome.classList.contains('hidden');
        const mainHidden = document.getElementById('mainApp')?.classList.contains('hidden') !== false;
        return (emailVisible || welcomeVisible) && mainHidden;
      },
      undefined,
      { timeout: 45000 }
    );
    const gate = await page.evaluate(() => ({
      authRequired: window.PokerSwipeConfig?.AUTH_REQUIRED,
      bootstrapState: window.PokerSwipeAuthBootstrap?.getState?.(),
      emailVisible: !document.getElementById('authEmail')?.classList.contains('hidden'),
      mainHidden: document.getElementById('mainApp')?.classList.contains('hidden') !== false
    }));
    assert.equal(gate.authRequired, true);
    assert.ok(gate.emailVisible || gate.bootstrapState === 'EMAIL');
    report.checks.push({ name: 'auth_required_true_restores_gate', pass: true });
    await ctx.close();
  }

  const fatalConsole = report.consoleErrors.filter((e) => !/favicon|404.*\.map|Failed to load resource.*400/i.test(e));
  report.PASS = report.checks.every((c) => c.pass)
    && report.pageErrors.length === 0
    && fatalConsole.length === 0;

  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.PASS, `auth bypass smoke failed: pageErrors=${report.pageErrors.length} console=${fatalConsole.length}`);
} finally {
  await browser.close();
  server.close();
}
