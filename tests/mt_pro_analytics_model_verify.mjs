/**
 * Analytics model — SPORT excluded from money metrics
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8805;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const DATASET = [
  {
    id: 'off1',
    type: 'offline',
    format: 'NLH',
    tournamentName: 'Offline Win',
    clubOrRoom: 'CLUB A',
    date: '2026-08-20',
    currency: 'RUB',
    baseBuyin: 1000,
    buyin: 1000,
    entries: 1,
    prize: 4000,
    place: 1,
    field: 30
  },
  {
    id: 'off2',
    type: 'offline',
    format: 'NLH',
    tournamentName: 'Offline Loss',
    clubOrRoom: 'CLUB B',
    date: '2026-08-19',
    currency: 'RUB',
    baseBuyin: 2000,
    buyin: 2000,
    entries: 1,
    prize: 1000,
    place: 12,
    field: 40
  },
  {
    id: 'on1',
    type: 'online',
    format: 'NLH',
    tournamentName: 'Online Win A',
    clubOrRoom: 'POKERSTARS',
    date: '2026-08-18',
    currency: 'RUB',
    baseBuyin: 500,
    buyin: 500,
    entries: 1,
    prize: 1000,
    place: 5,
    field: 100
  },
  {
    id: 'on2',
    type: 'online',
    format: 'NLH',
    tournamentName: 'Online Win B',
    clubOrRoom: 'GG POKER',
    date: '2026-08-17',
    currency: 'RUB',
    baseBuyin: 500,
    buyin: 500,
    entries: 1,
    prize: 2000,
    place: 2,
    field: 80
  },
  {
    id: 'sp1',
    type: 'sport',
    tournamentName: 'Sport A',
    clubOrRoom: 'HEADSUP CLUB',
    date: '2026-08-16',
    currency: 'RUB',
    baseBuyin: 0,
    entries: 1,
    place: 3,
    field: 48
  },
  {
    id: 'sp2',
    type: 'sport',
    tournamentName: 'Sport B',
    clubOrRoom: 'SPORT ROOM',
    date: '2026-08-15',
    currency: 'RUB',
    baseBuyin: 0,
    entries: 1,
    place: 12,
    field: 55
  },
  {
    id: 'sp3',
    type: 'sport',
    tournamentName: 'Sport C',
    clubOrRoom: 'HEADSUP CLUB',
    date: '2026-08-14',
    currency: 'RUB',
    baseBuyin: 0,
    entries: 1,
    place: 2,
    field: 40
  }
];

const LEGACY_SPORT = {
  id: 'legacy_sport',
  type: 'sport',
  tournamentName: 'Legacy Sport Cash',
  clubOrRoom: 'OLD CLUB',
  date: '2026-08-13',
  currency: 'RUB',
  baseBuyin: 1000,
  entries: 1,
  prize: 5000,
  place: 1,
  field: 20
};

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
}

async function waitForServer(ms = 12000) {
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

function normMoney(text) {
  return String(text || '')
    .replace(/\u2212/g, '-')
    .replace(/\s/g, '')
    .replace('₽', '')
    .replace('+', '');
}

async function readSummary(page) {
  return page.evaluate(() => {
    const el = document.getElementById('mtSummaryBlock');
    const items = [...(el?.querySelectorAll('.mt-pro-summary-item') || [])].map((n) => ({
      k: n.querySelector('.k')?.innerText?.trim() || '',
      v: n.querySelector('.v')?.innerText?.trim() || ''
    }));
    return {
      text: el?.innerText || '',
      items,
      chartTitle: document.getElementById('mtChartTitle')?.innerText || '',
      chartEnd: document.getElementById('mtChartEnd')?.innerText || '',
      sportHistoryVisible: document.getElementById('mtSportHistory')?.style.display !== 'none',
      sportHistoryRows: document.querySelectorAll('#mtSportHistory .mt-pro-sport-history-row').length,
      chartSvgLen: document.getElementById('mtChartSvg')?.innerHTML?.length || 0,
      cards: [...document.querySelectorAll('#mtList .mt-pro-card')].map((c) => c.innerText)
    };
  });
}

async function clickType(page, val) {
  await page.click(`#mtMainTypeRow [data-mt="type"][data-val="${val}"]`);
  await page.waitForTimeout(350);
}

const server = startServer();
await waitForServer();

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)');
  await page.evaluate((data) => {
    window.S.tournaments = data;
    if (typeof window.__mtProRender === 'function') window.__mtProRender();
  }, DATASET);
  await page.click('[data-nav="mytournaments"]');
  await page.waitForSelector('#ps72TournamentScreen.on');
  await page.waitForTimeout(500);

  // Trigger re-render after data inject
  await page.evaluate(() => {
    document.querySelector('#mtPeriodRow [data-val="all"]')?.click();
  });
  await page.waitForTimeout(400);

  let s = await readSummary(page);
  assert.match(s.text, /Сыграно/i);
  assert.match(s.text, /7/, 'total played includes all records');
  const moneyItem = s.items.find((i) => /денеж/i.test(i.k));
  const sportItem = s.items.find((i) => /спорт/i.test(i.k));
  assert.ok(moneyItem, 'money count shown');
  assert.equal(moneyItem.v, '4', '4 money tournaments');
  assert.ok(sportItem, 'sport count shown');
  assert.equal(sportItem.v, '3', '3 sport tournaments');
  const profitItem = s.items.find((i) => /профит/i.test(i.k));
  assert.ok(profitItem, 'profit shown for ALL filter');
  assert.equal(normMoney(profitItem.v), '4000', 'ALL money profit +4000, sport excluded');

  assert.ok(s.chartSvgLen > 20, 'money chart rendered for ALL');
  assert.equal(s.sportHistoryVisible, false, 'no sport history on ALL');

  await clickType(page, 'offline');
  s = await readSummary(page);
  assert.equal(normMoney(s.items.find((i) => /профит/i.test(i.k))?.v), '2000', 'OFFLINE profit +2000');

  await clickType(page, 'online');
  s = await readSummary(page);
  assert.equal(normMoney(s.items.find((i) => /профит/i.test(i.k))?.v), '2000', 'ONLINE profit +2000');

  await clickType(page, 'sport');
  s = await readSummary(page);
  assert.ok(!/профит/i.test(s.text) || !/0\s*₽/.test(s.text), 'SPORT filter: no fake 0 profit');
  assert.ok(!/ROI\s*0\s*%/i.test(s.text), 'SPORT filter: no fake 0% ROI');
  assert.match(s.text, /Сыграно/i);
  assert.equal(s.items.find((i) => /сыграно/i.test(i.k))?.v, '3');
  assert.equal(s.items.find((i) => /лучшее место/i.test(i.k))?.v, '2');
  assert.equal(s.items.find((i) => /среднее место/i.test(i.k))?.v, '5.7');
  assert.equal(s.items.find((i) => /среднее поле/i.test(i.k))?.v, '48');
  assert.match(s.chartTitle, /история/i);
  assert.ok(s.sportHistoryVisible, 'sport placement history visible');
  assert.ok(s.sportHistoryRows >= 3, 'sport history rows shown');
  assert.equal(s.chartSvgLen, 0, 'no money chart SVG in sport mode');

  const sportCards = await page.evaluate(() =>
    [...document.querySelectorAll('#mtList .mt-pro-card-sport')].map((c) => c.innerText)
  );
  assert.ok(sportCards.some((t) => /СПОРТ/.test(t)), 'sport badge on card');
  assert.ok(!sportCards.some((t) => /0\s*PTS/i.test(t)), 'no 0 PTS on sport cards without points');

  // Legacy sport with prize must not affect ALL money profit (still 4000)
  await page.evaluate((legacy) => {
    window.S.tournaments.push(legacy);
    document.querySelector('#mtMainTypeRow [data-mt="type"][data-val="all"]')?.click();
  }, LEGACY_SPORT);
  await page.waitForTimeout(400);
  s = await readSummary(page);
  assert.equal(normMoney(s.items.find((i) => /профит/i.test(i.k))?.v), '4000', 'legacy sport cash ignored');
  assert.equal(s.items.find((i) => /спорт/i.test(i.k))?.v, '4', 'legacy sport still counted in sport tally');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'SPORT excluded from ALL profit',
          'OFFLINE +2000',
          'ONLINE +2000',
          'SPORT dashboard stats',
          'SPORT placement history',
          'category badges',
          'legacy sport safe'
        ]
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
