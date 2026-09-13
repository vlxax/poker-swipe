/**
 * Final polish — 4 screenshots @ 390×844
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/mt_final_polish';
const PORT = 8797;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const DEMO = [
  { id: 'v1', type: 'offline', format: 'NLH', tournamentName: 'Weekly Deep', clubOrRoom: 'HEADSUP CLUB', date: '2026-08-22', currency: 'RUB', baseBuyin: 1500, buyin: 1500, bountyContribution: 0, fee: 0, entries: 3, addOn: 0, prize: 9000, bountyWon: 0, place: 3, field: 42 },
  { id: 'v2', type: 'online', format: 'PKO', tournamentName: 'Bounty Hunters', clubOrRoom: 'GG / POKEROK', date: '2026-08-21', currency: 'RUB', baseBuyin: 1200, buyin: 1200, bountyContribution: 300, fee: 0, entries: 1, addOn: 0, prize: 0, bountyWon: 800, place: 17, field: 284 },
  { id: 'v3', type: 'offline', format: 'NLH', tournamentName: 'Sunday Main', clubOrRoom: 'POKER PALACE', date: '2026-08-19', currency: 'RUB', baseBuyin: 2000, buyin: 2000, bountyContribution: 0, fee: 100, entries: 1, addOn: 0, prize: 4100, bountyWon: 0, place: 12, field: 86 },
  { id: 'v4', type: 'online', format: 'NLH', tournamentName: 'Daily Main Event', clubOrRoom: 'POKERSTARS', date: '2026-08-20', currency: 'USD', baseBuyin: 800, buyin: 800, bountyContribution: 0, fee: 0, entries: 2, reentryCost: 800, addOn: 0, prize: 1620, bountyWon: 0, place: 4, field: 156 },
  { id: 'v5', type: 'offline', format: 'NLH', tournamentName: 'Turbo Freeze', clubOrRoom: 'CHIPS CLUB', date: '2026-08-15', currency: 'RUB', baseBuyin: 1500, buyin: 1500, bountyContribution: 0, fee: 0, entries: 2, addOn: 0, prize: 0, bountyWon: 0, place: 28, field: 34 },
  { id: 'v6', type: 'online', format: 'NLH', tournamentName: 'Sit&Go Express', clubOrRoom: '888POKER', date: '2026-08-14', currency: 'USD', baseBuyin: 150, buyin: 150, bountyContribution: 0, fee: 0, entries: 1, addOn: 0, prize: 60, bountyWon: 0, place: 2, field: 9 },
  { id: 'v7', type: 'offline', format: 'NLH', tournamentName: 'Big Stack', clubOrRoom: 'ROYAL FLUSH', date: '2026-08-11', currency: 'RUB', baseBuyin: 1000, buyin: 1000, bountyContribution: 0, fee: 0, entries: 4, addOn: 500, prize: 7200, bountyWon: 0, place: 6, field: 58 },
  { id: 'v8', type: 'sport', format: 'NLH', tournamentName: 'Ranking Cup #4', clubOrRoom: 'FEDERATION CLUB', date: '2026-08-10', currency: 'RUB', baseBuyin: 1000, buyin: 1000, entries: 1, points: 180, place: 2, field: 64 },
  { id: 'v9', type: 'online', format: 'PKO', tournamentName: 'Mini Bounty', clubOrRoom: 'POKERDOM', date: '2026-08-07', currency: 'RUB', baseBuyin: 600, buyin: 600, bountyContribution: 150, fee: 0, entries: 1, addOn: 0, prize: 0, bountyWon: 450, place: 41, field: 210 },
  { id: 'v10', type: 'offline', format: 'NLH', tournamentName: 'Midweek MTT', clubOrRoom: 'CHIPS CLUB', date: '2026-08-05', currency: 'RUB', baseBuyin: 1500, buyin: 1500, bountyContribution: 0, fee: 0, entries: 1, addOn: 0, prize: 600, bountyWon: 0, place: 9, field: 34 },
  { id: 'v11', type: 'offline', format: 'NLH', tournamentName: 'Weekend Deep', clubOrRoom: 'POKER PALACE', date: '2026-08-02', currency: 'RUB', baseBuyin: 1500, buyin: 1500, bountyContribution: 0, fee: 0, entries: 2, reentryCost: 1300, addOn: 0, prize: 5400, bountyWon: 0, place: 2, field: 70 },
  { id: 'v12', type: 'online', format: 'NLH', tournamentName: 'Hot Bounty', clubOrRoom: 'POKERDOM', date: '2026-07-28', currency: 'RUB', baseBuyin: 400, buyin: 400, bountyContribution: 100, fee: 0, entries: 1, addOn: 0, prize: 0, bountyWon: 80, place: 53, field: 180 },
  { id: 'v13', type: 'offline', format: 'NLH', tournamentName: 'Freezeout', clubOrRoom: 'ROYAL FLUSH', date: '2026-07-25', currency: 'RUB', baseBuyin: 1000, buyin: 1000, bountyContribution: 0, fee: 0, entries: 1, addOn: 0, prize: 0, bountyWon: 0, place: 31, field: 52 },
  { id: 'v14', type: 'offline', format: 'NLH', tournamentName: 'Late Night', clubOrRoom: 'CHIPS CLUB', date: '2026-07-20', currency: 'RUB', baseBuyin: 800, buyin: 800, bountyContribution: 0, fee: 0, entries: 1, addOn: 0, prize: 1200, bountyWon: 0, place: 8, field: 44 }
];

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server timeout');
}

const server = startServer();
await waitForServer();
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)');
  await page.evaluate((demo) => { window.S.tournaments = demo; }, DEMO);
  await page.click('[data-nav="mytournaments"]');
  await page.waitForSelector('#ps72TournamentScreen.on .mt-pro');
  await page.waitForTimeout(600);

  // SCREEN A — main screen top
  await page.evaluate(() => {
    const sc = document.getElementById('ps72TournamentScreen');
    if (sc) sc.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/screen_a_main_top.png`, fullPage: false });

  // SCREEN B — scrolled to bottom, no nav overlap
  await page.evaluate(() => {
    const mt = document.getElementById('mytournaments');
    const ps72 = document.getElementById('ps72TournamentScreen');
    [mt, ps72, document.documentElement, document.body].forEach((el) => {
      if (el) el.scrollTop = el.scrollHeight;
    });
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/screen_b_main_bottom_no_overlap.png`, fullPage: false });

  // SCREEN C — analytics overview
  await page.evaluate(() => {
    const sc = document.getElementById('ps72TournamentScreen');
    if (sc) sc.scrollTop = 0;
  });
  await page.click('[data-mt="analytics-open"]');
  await page.waitForSelector('#mtProAnalytics.on');
  await page.waitForSelector('#mtAnalyticsTabs .mt-pro-seg.active');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/screen_c_analytics_overview.png`, fullPage: false });

  // SCREEN D — analytics buy-in tab (enable pro first)
  await page.click('[data-mt="pro-toggle"]');
  await page.waitForTimeout(300);
  await page.click('[data-mt="analytics-tab"][data-val="buyin"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/screen_d_analytics_buyin.png`, fullPage: false });

  console.log(JSON.stringify({ ok: true, out: OUT, files: fs.readdirSync(OUT).sort() }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
