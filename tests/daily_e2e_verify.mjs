/**
 * Daily game E2E — intro → start → decision → feedback @ 390×844
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8779;
const BASE = `http://127.0.0.1:${PORT}/tests/daily_game_bootstrap.html`;

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
}

async function waitForServer(ms = 10000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start');
}

async function shot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = startServer();
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];

  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.waitForFunction(() => window.__maGameLayout === true, { timeout: 30000 });

    await page.evaluate(() => window.show('daily'));
    await shot(page, 'daily_a_intro_390x844');

    const intro = await page.evaluate(() => ({
      lobby: !!document.querySelector('#dailyArea .pgDailyLobby'),
      dashboard: !!document.querySelector('#dailyArea .rangesField'),
      felt: !!document.querySelector('#dailyArea .pgFelt'),
      cta: !!document.querySelector('#trStart')
    }));
    assert.ok(intro.lobby, 'daily intro should use game lobby');
    assert.ok(intro.felt, 'daily intro should show felt arena');
    assert.ok(!intro.dashboard, 'daily intro must not show dashboard profile cards');
    assert.ok(intro.cta, 'start CTA present');

    await page.click('#trStart');
    await page.waitForSelector('#dailyArea .pgDecisionGrid .choice, #dailyArea .pgDailyLoading', { timeout: 25000 });
    const loading = await page.$('#dailyArea .pgDailyLoading');
    if (loading) {
      await page.waitForSelector('#dailyArea .pgDecisionGrid .choice', { timeout: 30000 });
    }
    await shot(page, 'daily_b_first_decision_390x844');

    const drill = await page.evaluate(() => ({
      drill: !!document.querySelector('#dailyArea .pgDailyDrill'),
      choices: document.querySelectorAll('#dailyArea .pgDecisionGrid .choice').length,
      felt: !!document.querySelector('#dailyArea .pgFelt'),
      prompt: document.querySelector('#dailyArea .pgPrompt')?.textContent?.trim()
    }));
    assert.ok(drill.drill, 'should reach drill screen');
    assert.ok(drill.choices >= 2, 'decision controls visible');
    assert.ok(drill.felt, 'poker arena on drill');

    await page.click('#dailyArea .pgDecisionGrid .choice');
    await page.waitForSelector('#dailyArea .pgDailyFeedback, #dailyArea .verdict', { timeout: 15000 });
    await shot(page, 'daily_d_feedback_390x844');

    const fb = await page.evaluate(() => ({
      feedback: !!document.querySelector('#dailyArea .pgDailyFeedback'),
      next: !!document.querySelector('#trNext')
    }));
    assert.ok(fb.feedback, 'feedback shown');
    assert.ok(fb.next, 'next button after feedback');

    console.log(JSON.stringify({ pass: true, intro, drill, fb, errors }, null, 2));
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
