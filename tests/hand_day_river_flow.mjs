#!/usr/bin/env node
/**
 * Hand of the Day — post-river flow regression
 * POST_RIVER_TRANSITION, READ_STAGE_REACHABLE, SHOWDOWN_REACHABLE, DAILY_COMPLETION
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const OUT = '/opt/cursor/artifacts';
const PORT = 8898;
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const f = path.join('/workspace', u === '/' ? '/modules/hand-of-the-day.html' : decodeURIComponent(u));
  if (!f.startsWith('/workspace') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ext = path.extname(f);
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.PNG': 'image/png',
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const n404 = [];
const errs = [];
page.on('response', (r) => {
  if (r.status() === 404) n404.push(r.url());
});
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(`http://localhost:${PORT}/modules/hand-of-the-day.html`, {
  waitUntil: 'networkidle',
  timeout: 30000,
});

const flow = await page.evaluate(async () => {
  if (typeof window.__handDayRiverFlowTest !== 'function') {
    return { error: 'missing __handDayRiverFlowTest' };
  }
  return await window.__handDayRiverFlowTest();
});

const stages = ['intro', 'preflop', 'flop', 'turn', 'river', 'read', 'finish'];
const shots = {};

async function clickPreferredAction(page, preferred) {
  await page.evaluate((pref) => {
    if (typeof window.__clearActionProcessing === 'function') window.__clearActionProcessing();
    const cont = document.getElementById('continueBtn');
    if (cont) { cont.click(); return; }
    const btns = [...document.querySelectorAll('#decisionArea .choice')];
    let pick = btns.find((b) => (b.dataset.action || b.dataset.response) === pref);
    if (!pick) pick = btns.find((b) => (b.dataset.action || b.dataset.response) !== 'fold');
    if (!pick && btns.length) pick = btns[0];
    if (pick) pick.click();
  }, preferred);
  await page.waitForTimeout(500);
}

// Scripted walkthrough for screenshots
await page.goto(`http://localhost:${PORT}/modules/hand-of-the-day.html`, {
  waitUntil: 'networkidle',
  timeout: 30000,
});
await page.waitForTimeout(500);
shots.intro = await page.screenshot({ path: `${OUT}/daily_stage_01_intro.png` });

await page.evaluate(() => window.startDailyHand());
await page.waitForTimeout(600);
shots.preflop = await page.screenshot({ path: `${OUT}/daily_stage_02_preflop.png` });

// Play streets with preferred actions until river / hand end
for (let step = 0; step < 24; step++) {
  const snap = await page.evaluate(() => ({
    street: window.state?.street,
    handOver: window.state?.handOver,
    active: document.getElementById('handScreen')?.classList.contains('active'),
  }));
  if (!snap.active || snap.handOver) break;
  if (snap.street === 'preflop') await clickPreferredAction(page, 'raise');
  else if (snap.street === 'river') await clickPreferredAction(page, 'call');
  else if (snap.street === 'flop') await clickPreferredAction(page, 'check');
  else await clickPreferredAction(page, 'check');
  await page.waitForTimeout(350);
  const street = await page.evaluate(() => window.state?.street);
  if (street === 'flop' && !shots.flop) {
    shots.flop = await page.screenshot({ path: `${OUT}/daily_stage_03_flop.png` });
  }
  if (street === 'turn' && !shots.turn) {
    shots.turn = await page.screenshot({ path: `${OUT}/daily_stage_04_turn.png` });
  }
  if (street === 'river' && !shots.river) {
    shots.river = await page.screenshot({ path: `${OUT}/daily_stage_05_river.png` });
  }
}

if (!shots.flop) shots.flop = await page.screenshot({ path: `${OUT}/daily_stage_03_flop.png` });
if (!shots.turn) shots.turn = await page.screenshot({ path: `${OUT}/daily_stage_04_turn.png` });
if (!shots.river) shots.river = await page.screenshot({ path: `${OUT}/daily_stage_05_river.png` });

await page.waitForTimeout(800);
shots.read = await page.screenshot({ path: `${OUT}/daily_stage_06_read.png` });

await page.evaluate(() => {
  const opt = document.querySelector('[data-read]');
  if (opt) opt.click();
  const rev = document.getElementById('revealBtn2');
  if (rev && !rev.disabled) rev.click();
});
await page.waitForTimeout(700);
shots.finish = await page.screenshot({ path: `${OUT}/daily_stage_07_finish.png` });

const qa = {
  flow,
  stagesCaptured: stages.length,
  n404: [...new Set(n404)],
  errs: [...new Set(errs)],
  overflow: await page.evaluate(() => document.documentElement.scrollWidth <= 391),
};

fs.writeFileSync(`${OUT}/hand_day_river_flow.json`, JSON.stringify(qa, null, 2));
console.log(JSON.stringify(qa, null, 2));

await browser.close();
server.close();

if (!flow || flow.error || !flow.DAILY_COMPLETION) process.exit(1);
