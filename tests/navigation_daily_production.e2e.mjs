/**
 * Production index.html — Daily navigation P0 regression (real clicks, no force).
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function startServer(port) {
  return spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore'
  });
}

function attachConsoleGate(page, bucket) {
  page.on('pageerror', (e) => bucket.pageErrors.push(String(e)));
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error' || /ReferenceError|TypeError|uncaught/i.test(text)) {
      bucket.consoleErrors.push(text);
    } else if (type === 'warning') {
      bucket.warnings.push(text);
    }
  });
}

async function waitForServer(port, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start on ${port}`);
}

async function openDailyFromHome(page) {
  await page.locator('[data-nav="home"]').click({ timeout: 15000 });
  await page.waitForTimeout(600);
  const cta = page.locator('.dailyFigmaCta, button:has-text("ПЕРЕЙТИ К РАЗДАЧЕ ДНЯ")').first();
  await cta.click({ timeout: 20000 });
  await page.waitForFunction(
    () =>
      document.getElementById('daily')?.classList.contains('active') &&
      !!document.querySelector('#dailyArea .pgDailyLobby'),
    { timeout: 45000 }
  );
}

async function interactDailyPartial(page) {
  const start = page.locator('#trStart');
  if (!(await start.isVisible().catch(() => false))) return;
  await start.click({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const choice = page.locator('#dailyArea .pgDecisionGrid .choice').first();
  if (await choice.isVisible({ timeout: 8000 }).catch(() => false)) {
    await choice.click({ timeout: 10000 });
    await page.waitForTimeout(800);
  }
}

async function assertNavWorks(page, navId, expectScreenId) {
  await page.locator(`[data-nav="${navId}"]`).click({ timeout: 15000 });
  await page.waitForTimeout(900);
  const state = await page.evaluate(() => {
    const o = document.getElementById('psHandDayOverlay');
    let overlay = { exists: false, intercepts: false };
    if (o) {
      const style = getComputedStyle(o);
      const intercepts = style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
      overlay = {
        exists: true,
        display: style.display,
        ariaHidden: o.getAttribute('aria-hidden'),
        intercepts
      };
    }
    return {
      active: document.querySelector('.screen.active')?.id,
      overlay,
      handDayOpen: document.documentElement.classList.contains('psHandDayOpen'),
      bodyOverflow: document.body.style.overflow
    };
  });
  assert.equal(state.active, expectScreenId, `expected screen ${expectScreenId}`);
  assert.equal(state.overlay.intercepts, false, `overlay still intercepts: ${JSON.stringify(state.overlay)}`);
  assert.equal(state.handDayOpen, false, 'psHandDayOpen should be cleared');
  return state;
}

async function main() {
  const port = await pickFreePort();
  const server = startServer(port);
  await waitForServer(port);
  const base = `http://127.0.0.1:${port}/index.html`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const gate = { pageErrors: [], consoleErrors: [], warnings: [] };
  attachConsoleGate(page, gate);

  const results = { testA: null, testB: null, testC: null, showChain: null };

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4000);

    results.showChain = await page.evaluate(() => {
      const s = window.show;
      if (!s) return { error: 'no show' };
      const flags = [];
      if (s._psScreenRouter) flags.push('_psScreenRouter');
      if (s._wrappedByPatch) flags.push('_wrappedByPatch');
      if (s.__psHandDayBridge) flags.push('__psHandDayBridge');
      if (s._psMotionWrap) flags.push('_psMotionWrap');
      if (s._psAppShellPatch) flags.push('_psAppShellPatch');
      if (s._maNavHook) flags.push('_maNavHook');
      if (s._exploitHook) flags.push('_exploitHook');
      return {
        name: s.name || 'anonymous',
        flags,
        hasTeardown: typeof window.PsScreenRouter?.teardownTransientUI === 'function',
        handDayHijacksDaily: false
      };
    });

    // TEST A
    await openDailyFromHome(page);
    await interactDailyPartial(page);
    const stateA = await assertNavWorks(page, 'myhands', 'myhands');
    const myVisible = await page.evaluate(() => !!document.querySelector('#myhands.active #myArea, #myhands.active .panel'));
    assert.ok(myVisible, 'My Hands content should be visible');
    results.testA = { pass: true, state: stateA };

    // TEST B
    await openDailyFromHome(page);
    await interactDailyPartial(page);
    const stateB = await assertNavWorks(page, 'polyana', 'polyana');
    const polyVisible = await page.evaluate(() => document.getElementById('polyana')?.classList.contains('active'));
    assert.ok(polyVisible, 'Polyana screen active');
    results.testB = { pass: true, state: stateB };

    // TEST C
    await page.locator('[data-nav="home"]').click({ timeout: 15000 });
    await page.waitForTimeout(500);
    await openDailyFromHome(page);
    await page.locator('[data-nav="home"]').click({ timeout: 15000 });
    await page.waitForTimeout(500);
    await openDailyFromHome(page);
    const counts = await page.evaluate(() => ({
      overlays: document.querySelectorAll('#psHandDayOverlay').length,
      frames: document.querySelectorAll('#psHandDayFrame').length,
      dailyActive: document.getElementById('daily')?.classList.contains('active'),
      lobby: !!document.querySelector('#dailyArea .pgDailyLobby')
    }));
    assert.ok(counts.overlays <= 1, `overlay count ${counts.overlays}`);
    assert.ok(counts.frames <= 1, `frame count ${counts.frames}`);
    assert.ok(counts.dailyActive && counts.lobby, 'second daily open should show lobby');
    results.testC = { pass: true, counts };

    const out = {
      pass: true,
      results,
      consoleGate: {
        pageErrors: gate.pageErrors,
        consoleErrors: gate.consoleErrors,
        warnings: gate.warnings.slice(0, 20)
      }
    };
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.log(
      JSON.stringify(
        {
          pass: false,
          error: String(e),
          results,
          consoleGate: gate
        },
        null,
        2
      )
    );
    process.exit(1);
  } finally {
    await browser.close();
    server.kill();
  }
}

main();
