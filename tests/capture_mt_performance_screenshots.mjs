/**
 * My Tournaments Performance Center — EMPTY + POPULATED screenshots @ 390×844
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = process.env.PS_PORT || '8880';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

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
  { id: 'v10', type: 'offline', format: 'NLH', tournamentName: 'Midweek MTT', clubOrRoom: 'CHIPS CLUB', date: '2026-08-05', currency: 'RUB', baseBuyin: 1500, buyin: 1500, bountyContribution: 0, fee: 0, entries: 1, addOn: 0, prize: 600, bountyWon: 0, place: 9, field: 34 }
];

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url?.split('?')[0] || '/';
      const file = path.join(root, url === '/' ? 'index.html' : decodeURIComponent(url));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const ext = path.extname(file);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

function auditNav(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.nav');
    const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight;
    const screen = document.getElementById('ps72TournamentScreen');
    const ctas = [...(screen?.querySelectorAll('.mt-pro-empty-cta, .mt-pro-add-compact, .mt-pro-analytics-btn') || [])];
    let underNav = 0;
    ctas.forEach((btn) => {
      const r = btn.getBoundingClientRect();
      if (r.bottom > navTop + 2) underNav++;
    });
    return {
      contentUnderNav: underNav,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hasEmptyHero: !!screen?.querySelector('#mtEmptyHero')?.offsetParent,
      hasPerfGrid: !!screen?.querySelector('.mt-pro-stat-tile'),
      hasChart: !!screen?.querySelector('#mtChartSvg path'),
      hasCards: (screen?.querySelectorAll('.mt-pro-card')?.length || 0) > 0,
      hasSegControls: !!screen?.querySelector('.mt-pro-seg__indicator')
    };
  });
}

const server = await startStaticServer('/workspace');
const browser = await chromium.launch({ headless: true });
const report = {};

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('pokerSwipeDeviceId', 'qa-mt-perf');
    localStorage.setItem('pokerSwipeV32_user_qa-mt-perf', JSON.stringify({
      version: '32.0', nick: 'QA', onboarded: true, diagDone: true,
      skill: 62, streak: 5, lastDay: '2026-08-25', events: [],
      hands: [], myHands18: [], tournaments: [], dailyArchive: [], snapshots: [],
      seenSwipe: [], diagnostic: [], xray: { onboarded: true, runs: 0, history: [], counts: {} },
      healCourses: {}
    }));
  });

  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);

  // EMPTY STATE
  await page.evaluate(() => {
    window.S.tournaments = [];
    if (typeof window.openMyTournamentsV72 === 'function') window.openMyTournamentsV72();
  });
  await page.waitForSelector('#ps72TournamentScreen.on', { timeout: 10000 });
  await page.waitForTimeout(800);
  report.empty = await auditNav(page);
  await page.screenshot({ path: path.join(OUT, 'mt_empty_state_390x844.png') });

  // POPULATED STATE
  await page.evaluate((demo) => {
    window.S.tournaments = demo;
    if (window.MtProTournaments?.render) window.MtProTournaments.render();
    else if (typeof window.openMyTournamentsV72 === 'function') window.openMyTournamentsV72();
  }, DEMO);
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  report.populated = await auditNav(page);
  await page.screenshot({ path: path.join(OUT, 'mt_populated_state_390x844.png') });

  await page.evaluate(() => {
    document.querySelector('.mt-pro-recent')?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'mt_populated_cards_390x844.png') });

  // SPORT filter
  await page.click('#mtMainTypeRow [data-val="sport"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'mt_sport_filter_390x844.png') });

  report.summary = {
    EMPTY_CONTENT_UNDER_NAV: report.empty.contentUnderNav,
    POPULATED_CONTENT_UNDER_NAV: report.populated.contentUnderNav,
    HORIZONTAL_OVERFLOW: (report.empty.horizontalOverflow ? 1 : 0) + (report.populated.horizontalOverflow ? 1 : 0)
  };

  fs.writeFileSync(path.join(OUT, 'mt_performance_metrics.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));

  await context.close();
} finally {
  await browser.close();
  server.close();
}
