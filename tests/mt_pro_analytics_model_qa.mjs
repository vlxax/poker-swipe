/**
 * Analytics model QA screenshots
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/mt_analytics_model_qa';
const PORT = 8806;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const DATASET = [
  { id: 'off1', type: 'offline', format: 'NLH', tournamentName: 'Offline Win', clubOrRoom: 'CLUB A', date: '2026-08-20', currency: 'RUB', baseBuyin: 1000, buyin: 1000, entries: 1, prize: 4000, place: 1, field: 30 },
  { id: 'off2', type: 'offline', format: 'NLH', tournamentName: 'Offline Loss', clubOrRoom: 'CLUB B', date: '2026-08-19', currency: 'RUB', baseBuyin: 2000, buyin: 2000, entries: 1, prize: 1000, place: 12, field: 40 },
  { id: 'on1', type: 'online', format: 'NLH', tournamentName: 'Online Win A', clubOrRoom: 'POKERSTARS', date: '2026-08-18', currency: 'RUB', baseBuyin: 500, buyin: 500, entries: 1, prize: 1000, place: 5, field: 100 },
  { id: 'on2', type: 'online', format: 'NLH', tournamentName: 'Online Win B', clubOrRoom: 'GG POKER', date: '2026-08-17', currency: 'RUB', baseBuyin: 500, buyin: 500, entries: 1, prize: 2000, place: 2, field: 80 },
  { id: 'sp1', type: 'sport', tournamentName: 'Sunday Main', clubOrRoom: 'HEADSUP CLUB', date: '2026-08-16', currency: 'RUB', baseBuyin: 0, entries: 3, place: 3, field: 48, points: 125 },
  { id: 'sp2', type: 'sport', tournamentName: 'Sport B', clubOrRoom: 'SPORT ROOM', date: '2026-08-15', currency: 'RUB', baseBuyin: 0, entries: 1, place: 12, field: 55 },
  { id: 'sp3', type: 'sport', tournamentName: 'Sport C', clubOrRoom: 'HEADSUP CLUB', date: '2026-08-14', currency: 'RUB', baseBuyin: 0, entries: 1, place: 2, field: 40 }
];

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)');
  await page.evaluate((d) => { window.S.tournaments = d; }, DATASET);
  await page.click('[data-nav="mytournaments"]');
  await page.waitForSelector('#ps72TournamentScreen.on');
  await page.click('#mtPeriodRow [data-val="all"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01_all_filter_split_counts.png` });

  await page.click('#mtMainTypeRow [data-mt="type"][data-val="sport"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/02_sport_dashboard.png` });

  await page.click('[data-mt="analytics-open"]');
  await page.waitForSelector('#mtProAnalytics.on');
  await page.click('#mtTypeRow [data-mt="type"][data-val="sport"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03_sport_analytics_insights.png` });

  console.log(JSON.stringify({ ok: true, out: OUT, files: fs.readdirSync(OUT).sort() }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
