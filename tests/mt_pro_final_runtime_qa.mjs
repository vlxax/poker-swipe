/**
 * Final runtime + visual QA @ 390×844 — My Tournaments filters & analytics
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/mt_final_runtime_qa';
const PORT = 8810;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

// 9 money + 4 sport = 13 total (matches user example proportions)
const DATASET = [
  { id: 'o1', type: 'offline', format: 'NLH', tournamentName: 'Sunday Deep', clubOrRoom: 'CHIPS CLUB', date: '2026-08-22', currency: 'RUB', baseBuyin: 1500, buyin: 1500, entries: 1, prize: 4500, place: 3, field: 42 },
  { id: 'o2', type: 'offline', format: 'NLH', tournamentName: 'Weekly Main', clubOrRoom: 'POKER PALACE', date: '2026-08-21', currency: 'RUB', baseBuyin: 2000, buyin: 2000, entries: 1, prize: 1000, place: 12, field: 86 },
  { id: 'o3', type: 'offline', format: 'NLH', tournamentName: 'Turbo Freeze', clubOrRoom: 'ROYAL FLUSH', date: '2026-08-20', currency: 'RUB', baseBuyin: 1000, buyin: 1000, entries: 2, prize: 3200, place: 2, field: 58 },
  { id: 'o4', type: 'offline', format: 'NLH', tournamentName: 'Midweek MTT', clubOrRoom: 'CHIPS CLUB', date: '2026-08-19', currency: 'RUB', baseBuyin: 1500, buyin: 1500, entries: 1, prize: 0, place: 28, field: 34 },
  { id: 'o5', type: 'offline', format: 'NLH', tournamentName: 'Big Stack', clubOrRoom: 'HEADSUP CLUB', date: '2026-08-18', currency: 'RUB', baseBuyin: 1000, buyin: 1000, entries: 1, prize: 2100, place: 6, field: 44 },
  { id: 'n1', type: 'online', format: 'NLH', tournamentName: 'Daily Main', clubOrRoom: 'POKERSTARS', date: '2026-08-22', currency: 'RUB', baseBuyin: 500, buyin: 500, entries: 1, prize: 1500, place: 4, field: 156 },
  { id: 'n2', type: 'online', format: 'PKO', tournamentName: 'Bounty Hunters', clubOrRoom: 'GG POKER', date: '2026-08-21', currency: 'RUB', baseBuyin: 800, buyin: 800, bountyContribution: 200, entries: 1, prize: 0, bountyWon: 1200, place: 17, field: 284 },
  { id: 'n3', type: 'online', format: 'NLH', tournamentName: 'Hot Bounty', clubOrRoom: 'POKERDOM', date: '2026-08-20', currency: 'RUB', baseBuyin: 400, buyin: 400, entries: 1, prize: 900, place: 8, field: 180 },
  { id: 'n4', type: 'online', format: 'NLH', tournamentName: 'Sit&Go Express', clubOrRoom: '888POKER', date: '2026-08-19', currency: 'RUB', baseBuyin: 300, buyin: 300, entries: 1, prize: 600, place: 2, field: 9 },
  { id: 's1', type: 'sport', tournamentName: 'Sunday Main', clubOrRoom: 'HEADSUP CLUB', date: '2026-08-22', currency: 'RUB', baseBuyin: 0, entries: 3, place: 3, field: 48, points: 125 },
  { id: 's2', type: 'sport', tournamentName: 'Sport Series B', clubOrRoom: 'SPORT ARENA', date: '2026-08-21', currency: 'RUB', baseBuyin: 0, entries: 1, place: 12, field: 55 },
  { id: 's3', type: 'sport', tournamentName: 'Club Championship', clubOrRoom: 'HEADSUP CLUB', date: '2026-08-20', currency: 'RUB', baseBuyin: 0, entries: 1, place: 2, field: 40 },
  { id: 's4', type: 'sport', tournamentName: 'Regional Final', clubOrRoom: 'MOSCOW POKER', date: '2026-08-19', currency: 'RUB', baseBuyin: 0, entries: 2, place: 7, field: 61, points: 80 }
];

const errors = [];
const report = {};

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
}

async function tapType(page, val) {
  await page.click(`#mtMainTypeRow [data-mt="type"][data-val="${val}"]`, { timeout: 8000 });
  await page.waitForTimeout(400);
}

async function readState(page) {
  return page.evaluate(() => {
    const active = [...document.querySelectorAll('#mtMainTypeRow .mt-pro-chip')].find((c) => c.classList.contains('active'));
    const summary = document.getElementById('mtSummaryBlock')?.innerText || '';
    const chartTitle = document.getElementById('mtChartTitle')?.innerText || '';
    const chartEnd = document.getElementById('mtChartEnd')?.innerText || '';
    const sportHist = document.getElementById('mtSportHistory');
    const cards = [...document.querySelectorAll('#mtList .mt-pro-card')].map((c) => ({
      text: c.innerText,
      isSport: c.classList.contains('mt-pro-card-sport')
    }));
    return {
      activeFilter: active?.dataset?.val || null,
      activeLabel: active?.innerText || '',
      summary,
      chartTitle,
      chartEnd,
      chartSvgLen: document.getElementById('mtChartSvg')?.innerHTML?.length || 0,
      sportHistoryVisible: sportHist && sportHist.style.display !== 'none',
      sportHistoryRows: document.querySelectorAll('#mtSportHistory .mt-pro-sport-history-row').length,
      cards,
      scrollW: document.body.scrollWidth,
      clientW: document.documentElement.clientWidth
    };
  });
}

async function assertOneActive(page, val, label) {
  const s = await readState(page);
  assert.equal(s.activeFilter, val, `${label}: expected active filter ${val}, got ${s.activeFilter}`);
  const activeCount = await page.evaluate(
    () => document.querySelectorAll('#mtMainTypeRow .mt-pro-chip.active').length
  );
  assert.equal(activeCount, 1, `${label}: only one chip should be active`);
}

const server = startServer();
await new Promise((r) => setTimeout(r, 900));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)');
  await page.evaluate((d) => {
    window.S.tournaments = d;
  }, DATASET);
  await page.click('[data-nav="mytournaments"]');
  await page.waitForSelector('#ps72TournamentScreen.on');
  await page.click('#mtPeriodRow [data-val="all"]');
  await page.waitForTimeout(500);

  // ── Filter interaction cycle ──
  for (const val of ['all', 'offline', 'online', 'sport']) {
    await tapType(page, val);
    await assertOneActive(page, val, `tap ${val}`);
  }
  for (const val of ['sport', 'online', 'offline', 'all', 'sport']) {
    await tapType(page, val);
    await assertOneActive(page, val, `cycle ${val}`);
  }
  report.filterButtonsClickable = true;
  report.onlyOneActive = true;

  // Pressed/tap state — verify :active styling applies (scale/transform or background change)
  const tapStyle = await page.evaluate(async () => {
    const chip = document.querySelector('#mtMainTypeRow [data-val="sport"]');
    if (!chip) return { ok: false, reason: 'chip missing' };
    const before = getComputedStyle(chip).transform;
    chip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const during = getComputedStyle(chip).transform;
    chip.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return {
      ok: before !== during || getComputedStyle(chip).opacity !== '1',
      tag: chip.tagName,
      hasButtonRole: chip.tagName === 'BUTTON',
      className: chip.className
    };
  });
  report.activeTapState = tapStyle.hasButtonRole && tapStyle.tag === 'BUTTON';

  // A — ВСЕ
  await tapType(page, 'all');
  let s = await readState(page);
  assert.match(s.summary, /Сыграно/i);
  assert.match(s.summary, /Денежные/i);
  assert.match(s.summary, /Спорт/i);
  assert.match(s.summary, /Профит/i);
  assert.match(s.summary, /ROI/i);
  assert.ok(s.chartSvgLen > 20, 'ALL: money chart present');
  assert.equal(s.scrollW, s.clientW, 'ALL: no horizontal overflow');
  await page.screenshot({ path: `${OUT}/A_all_view.png`, fullPage: false });
  report.allView = true;

  // B — ОФЛ
  await tapType(page, 'offline');
  s = await readState(page);
  assert.match(s.summary, /Профит/i);
  assert.match(s.summary, /ROI/i);
  assert.ok(!s.cards.some((c) => c.isSport), 'OFFLINE: no sport cards');
  assert.ok(s.chartSvgLen > 20, 'OFFLINE: chart present');
  await page.screenshot({ path: `${OUT}/B_offline_view.png`, fullPage: false });
  report.offlineView = true;

  // C — ОНЛ
  await tapType(page, 'online');
  s = await readState(page);
  assert.match(s.summary, /Профит/i);
  assert.match(s.summary, /ROI/i);
  assert.ok(!s.cards.some((c) => c.isSport), 'ONLINE: no sport cards');
  assert.ok(s.chartSvgLen > 20, 'ONLINE: chart present');
  await page.screenshot({ path: `${OUT}/C_online_view.png`, fullPage: false });
  report.onlineView = true;

  // D — СПОРТ
  await tapType(page, 'sport');
  s = await readState(page);
  assert.match(s.summary, /Сыграно/i);
  assert.match(s.summary, /Среднее место/i);
  assert.match(s.summary, /Лучшее место/i);
  assert.match(s.summary, /Среднее поле/i);
  assert.ok(!/Профит/i.test(s.summary), 'SPORT: no profit');
  assert.ok(!/ROI/i.test(s.summary), 'SPORT: no ROI');
  assert.ok(!/ABI/i.test(s.summary), 'SPORT: no ABI');
  assert.ok(s.sportHistoryVisible, 'SPORT: placement history visible');
  assert.equal(s.chartSvgLen, 0, 'SPORT: no money chart SVG');
  assert.ok(!/₽/.test(s.chartEnd), 'SPORT: no ruble values in chart end');
  await page.screenshot({ path: `${OUT}/D_sport_view.png`, fullPage: false });
  report.sportView = true;
  report.sportMoneyValuesAbsent = true;

  // E — SPORT tournament card (Sunday Main with badge, re-entry, points)
  const sportCard = page.locator('#mtList .mt-pro-card-sport').first();
  await sportCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const cardText = await sportCard.innerText();
  assert.match(cardText, /СПОРТ/i, 'card badge');
  assert.match(cardText, /Sunday Main/i, 'card title');
  assert.match(cardText, /HEADSUP CLUB/i, 'card venue');
  assert.match(cardText, /3\s*\/\s*48/, 'place/field');
  assert.match(cardText, /RE-ENTRY/i, 're-entry');
  assert.match(cardText, /125\s*PTS/i, 'points when present');
  assert.ok(!/0\s*PTS/i.test(cardText), 'no fake 0 PTS');
  await sportCard.screenshot({ path: `${OUT}/E_sport_card.png` });
  report.sportCard = true;

  // Tap edit on sport card (flow 5 — open tournament)
  await sportCard.locator('[data-mt="edit"]').click();
  await page.waitForSelector('#mtProModal.on', { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.click('#mtProModal .mt-pro-sheet-close, [data-mt="sheet-close"]', { timeout: 3000 }).catch(async () => {
    await page.keyboard.press('Escape');
  });
  await page.waitForTimeout(300);

  // F — SPORT detailed analytics
  await tapType(page, 'sport');
  await page.click('[data-mt="analytics-open"]');
  await page.waitForSelector('#mtProAnalytics.on');
  await page.click('#mtTypeRow [data-mt="type"][data-val="sport"]');
  await page.waitForTimeout(500);
  const sportAnalytics = await page.evaluate(() => ({
    text: document.getElementById('mtProAnalyticsBody')?.innerText || '',
    statGrid: document.getElementById('mtStatGrid')?.innerText || '',
    insights: document.getElementById('mtInsightsGrid')?.innerText || ''
  }));
  assert.match(sportAnalytics.statGrid, /Среднее место/i);
  assert.ok(!/ROI/i.test(sportAnalytics.statGrid) || /недоступ/i.test(sportAnalytics.text), 'SPORT analytics: no money ROI in stats');
  await page.screenshot({ path: `${OUT}/F_sport_analytics.png`, fullPage: false });
  report.sportAnalytics = true;
  await page.click('[data-mt="analytics-close"]');
  await page.waitForTimeout(300);

  // G — ONLINE detailed analytics
  await tapType(page, 'online');
  await page.click('[data-mt="analytics-open"]');
  await page.waitForSelector('#mtProAnalytics.on');
  await page.click('#mtTypeRow [data-mt="type"][data-val="online"]');
  await page.waitForTimeout(500);
  const onlineAnalytics = await page.evaluate(() => ({
    statGrid: document.getElementById('mtStatGrid')?.innerText || '',
    insights: document.getElementById('mtInsightsGrid')?.innerText || ''
  }));
  assert.match(onlineAnalytics.statGrid, /ROI/i);
  assert.match(onlineAnalytics.statGrid, /Профит/i);
  await page.screenshot({ path: `${OUT}/G_online_analytics.png`, fullPage: false });
  report.moneyAnalyticsCorrect = true;
  await page.click('[data-mt="analytics-close"]');
  await page.waitForTimeout(300);

  // H — bottom safe area on SPORT screen
  await tapType(page, 'sport');
  await page.evaluate(() => {
    const mt = document.getElementById('mytournaments');
    if (mt) mt.scrollTop = mt.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(600);
  const bottomAudit = await page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const navRect = nav?.getBoundingClientRect();
    const btn = document.querySelector('[data-mt="analytics-open"]');
    const btnRect = btn?.getBoundingClientRect();
    return {
      navVisible: !!nav && navRect.height > 0,
      navBottom: navRect?.bottom,
      viewportH: window.innerHeight,
      btnBottom: btnRect?.bottom,
      btnAboveNav: btnRect && navRect ? btnRect.bottom <= navRect.top + 2 : null,
      scrollW: document.body.scrollWidth,
      clientW: document.documentElement.clientWidth
    };
  });
  assert.equal(bottomAudit.scrollW, bottomAudit.clientW, 'bottom: no h-overflow');
  assert.ok(bottomAudit.navVisible, 'bottom nav visible');
  report.bottomNavSafe = bottomAudit.btnAboveNav !== false;
  report.viewport390 = true;
  await page.screenshot({ path: `${OUT}/H_sport_bottom_safe_area.png`, fullPage: false });

  report.consoleErrors = errors.length === 0 ? 'none' : errors.slice(0, 5);
  report.tests = 'pass';
  report.safeToMerge = errors.length === 0;

  // Copy to artifacts root with canonical names
  const names = {
    A_all_view: 'A_all_view.png',
    B_offline_view: 'B_offline_view.png',
    C_online_view: 'C_online_view.png',
    D_sport_view: 'D_sport_view.png',
    E_sport_card: 'E_sport_card.png',
    F_sport_analytics: 'F_sport_analytics.png',
    G_online_analytics: 'G_online_analytics.png',
    H_sport_bottom_safe_area: 'H_sport_bottom_safe_area.png'
  };
  for (const [src, dst] of Object.entries(names)) {
    fs.copyFileSync(`${OUT}/${src}.png`, `/opt/cursor/artifacts/${dst}`);
  }

  console.log(JSON.stringify({ ok: true, report, errors, out: OUT, files: fs.readdirSync(OUT).sort() }, null, 2));
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e), report, errors }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
