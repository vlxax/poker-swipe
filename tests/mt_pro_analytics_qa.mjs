/**
 * Analytics tabs QA — 5 screenshots @ 390×844
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/mt_analytics_qa';
const PORT = 8800;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const DEMO = [
  { id: 'v1', type: 'offline', format: 'NLH', tournamentName: 'Weekly Deep', clubOrRoom: 'HEADSUP CLUB', date: '2026-08-22', currency: 'RUB', baseBuyin: 1500, buyin: 1500, entries: 3, prize: 9000, place: 3, field: 42 },
  { id: 'v2', type: 'online', format: 'PKO', tournamentName: 'Bounty Hunters', clubOrRoom: 'GG / POKEROK', date: '2026-08-21', currency: 'RUB', baseBuyin: 1200, buyin: 1200, bountyContribution: 300, entries: 1, prize: 0, bountyWon: 800, place: 17, field: 284 },
  { id: 'v3', type: 'offline', format: 'NLH', tournamentName: 'Sunday Main', clubOrRoom: 'POKER PALACE', date: '2026-08-19', currency: 'RUB', baseBuyin: 2000, buyin: 2000, fee: 100, entries: 1, prize: 4100, place: 12, field: 86 },
  { id: 'v4', type: 'online', format: 'NLH', tournamentName: 'Daily Main Event', clubOrRoom: 'POKERSTARS', date: '2026-08-20', currency: 'USD', baseBuyin: 800, buyin: 800, entries: 2, reentryCost: 800, prize: 1620, place: 4, field: 156 },
  { id: 'v5', type: 'offline', format: 'NLH', tournamentName: 'Turbo Freeze', clubOrRoom: 'CHIPS CLUB', date: '2026-08-15', currency: 'RUB', baseBuyin: 1500, buyin: 1500, entries: 2, prize: 0, place: 28, field: 34 },
  { id: 'v6', type: 'online', format: 'NLH', tournamentName: 'Sit&Go Express', clubOrRoom: '888POKER', date: '2026-08-14', currency: 'USD', baseBuyin: 150, buyin: 150, entries: 1, prize: 60, place: 2, field: 9 },
  { id: 'v7', type: 'offline', format: 'NLH', tournamentName: 'Big Stack', clubOrRoom: 'ROYAL FLUSH', date: '2026-08-11', currency: 'RUB', baseBuyin: 1000, buyin: 1000, entries: 4, addOn: 500, prize: 7200, place: 6, field: 58 },
  { id: 'v8', type: 'online', format: 'PKO', tournamentName: 'Mini Bounty', clubOrRoom: 'POKERDOM', date: '2026-08-07', currency: 'RUB', baseBuyin: 600, buyin: 600, bountyContribution: 150, entries: 1, prize: 0, bountyWon: 450, place: 41, field: 210 },
  { id: 'v9', type: 'offline', format: 'NLH', tournamentName: 'Midweek MTT', clubOrRoom: 'CHIPS CLUB', date: '2026-08-05', currency: 'RUB', baseBuyin: 1500, buyin: 1500, entries: 1, prize: 600, place: 9, field: 34 },
  { id: 'v10', type: 'offline', format: 'NLH', tournamentName: 'Weekend Deep', clubOrRoom: 'POKER PALACE', date: '2026-08-02', currency: 'RUB', baseBuyin: 1500, buyin: 1500, entries: 2, reentryCost: 1300, prize: 5400, place: 2, field: 70 },
  { id: 'v11', type: 'online', format: 'NLH', tournamentName: 'Hot Bounty', clubOrRoom: 'POKERDOM', date: '2026-07-28', currency: 'RUB', baseBuyin: 400, buyin: 400, bountyContribution: 100, entries: 1, prize: 0, bountyWon: 80, place: 53, field: 180 },
  { id: 'v12', type: 'offline', format: 'NLH', tournamentName: 'Freezeout', clubOrRoom: 'ROYAL FLUSH', date: '2026-07-25', currency: 'RUB', baseBuyin: 1000, buyin: 1000, entries: 1, prize: 0, place: 31, field: 52 },
  { id: 'v13', type: 'offline', format: 'NLH', tournamentName: 'Late Night', clubOrRoom: 'CHIPS CLUB', date: '2026-07-20', currency: 'RUB', baseBuyin: 800, buyin: 800, entries: 1, prize: 1200, place: 8, field: 44 }
];

async function assertTabHasContent(page, selector, label) {
  const info = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, reason: 'missing element' };
    const text = (el.innerText || '').trim();
    const cards = el.querySelectorAll('.mt-pro-bucket-card, .mt-pro-conclusion, .mt-pro-bar').length;
    return { ok: text.length > 8 || cards > 0, text: text.slice(0, 120), cards };
  }, selector);
  if (!info.ok) throw new Error(`${label} empty: ${JSON.stringify(info)}`);
}

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)');
  await page.evaluate((demo) => { window.S.tournaments = demo; }, DEMO);
  await page.click('[data-nav="mytournaments"]');
  await page.waitForSelector('#ps72TournamentScreen.on');
  await page.waitForTimeout(500);

  await page.click('[data-mt="analytics-open"]');
  await page.waitForSelector('#mtProAnalytics.on');
  await page.waitForTimeout(500);

  // 1. ОБЗОР
  await assertTabHasContent(page, '#mtInsightsGrid', 'overview');
  await page.screenshot({ path: `${OUT}/01_analytics_overview.png`, fullPage: false });

  // 2. ПО БАЙ-ИНАМ — without pro mode
  await page.click('[data-mt="analytics-tab"][data-val="buyin"]');
  await page.waitForTimeout(500);
  await assertTabHasContent(page, '#mtBucketsGrid', 'buyin');
  await page.screenshot({ path: `${OUT}/02_analytics_buyin.png`, fullPage: false });

  // 3. ФОРМАТЫ
  await page.click('[data-mt="analytics-tab"][data-val="formats"]');
  await page.waitForTimeout(500);
  await assertTabHasContent(page, '#mtFormatList', 'formats');
  await page.screenshot({ path: `${OUT}/03_analytics_formats.png`, fullPage: false });

  // 4. ПЛОЩАДКИ
  await page.click('[data-mt="analytics-tab"][data-val="venues"]');
  await page.waitForTimeout(500);
  await assertTabHasContent(page, '#mtVenueList', 'venues');
  await page.screenshot({ path: `${OUT}/04_analytics_venues.png`, fullPage: false });

  // 5. Main bottom safe area
  await page.click('[data-mt="analytics-close"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const mt = document.getElementById('mytournaments');
    if (mt) mt.scrollTop = mt.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/05_main_bottom_safe_area.png`, fullPage: false });

  console.log(JSON.stringify({ ok: true, out: OUT, files: fs.readdirSync(OUT).sort() }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
