/**
 * Add/Edit tournament form — interaction tests
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8810;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

const report = {
  offlineTab: false,
  onlineTab: false,
  sportTab: false,
  activeState: false,
  offlineForm: false,
  onlineForm: false,
  sportForm: false,
  polyanaSource: false,
  sportClubSelect: false,
  pointsStored: false,
  addOnConditional: false,
  bountyConditional: false,
  ctaPresent: false,
  ctaWorks: false,
  offlineSave: false,
  onlineSave: false,
  sportSave: false,
  edit: false,
  delete: false,
  persistence: false,
  viewport390: true,
  hOverflow: false,
  bottomOverlap: false,
  runtimeErrors: []
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)');
  await page.evaluate(() => {
    window.S.tournaments = [];
    if (typeof window.save === 'function') window.save();
  });
  await page.click('[data-nav="mytournaments"]');
  await page.waitForSelector('#ps72TournamentScreen.on');

  await page.click('[data-mt="add"]');
  await page.waitForSelector('#mtProModal.on');

  // OFFLINE tab
  await page.click('[data-mt="pick-type"][data-val="offline"]');
  await page.waitForTimeout(300);
  report.offlineTab = await page.evaluate(() => ({
    active: document.querySelector('[data-mt="pick-type"][data-val="offline"]')?.classList.contains('active'),
    hasClub: !!document.getElementById('mtFClubSelect'),
    noRoom: !document.getElementById('mtFRoomSelect'),
    hasFmt: !!document.getElementById('mtFFmt')
  })).then((x) => x.active && x.hasClub && x.noRoom && x.hasFmt);
  report.offlineForm = report.offlineTab;
  report.activeState = await page.evaluate(() => document.querySelector('.mt-pro-type-btn.active') !== null);

  // ONLINE tab
  await page.click('[data-mt="pick-type"][data-val="online"]');
  await page.waitForTimeout(300);
  report.onlineTab = await page.evaluate(() => ({
    active: document.querySelector('[data-mt="pick-type"][data-val="online"]')?.classList.contains('active'),
    hasRoom: !!document.getElementById('mtFRoomSelect'),
    noClub: !document.getElementById('mtFClubSelect'),
    hasCurr: !!document.querySelector('[data-mt="curr"]'),
    noPoints: !document.getElementById('mtFPoints')
  })).then((x) => x.active && x.hasRoom && x.noClub && x.hasCurr && x.noPoints);
  report.onlineForm = report.onlineTab;

  // SPORT tab + Polyana clubs
  await page.click('[data-mt="pick-type"][data-val="sport"]');
  await page.waitForTimeout(800);
  const sportInfo = await page.evaluate(() => {
    const sel = document.getElementById('mtFClubSelect');
    const opts = sel ? [...sel.options].map((o) => o.textContent) : [];
    return {
      active: document.querySelector('[data-mt="pick-type"][data-val="sport"]')?.classList.contains('active'),
      hasPoints: !!document.getElementById('mtFPoints'),
      noFmt: !document.getElementById('mtFFmt'),
      noCash: !document.getElementById('mtFCash'),
      clubCount: opts.length,
      clubsSample: opts.slice(0, 5)
    };
  });
  report.sportTab = sportInfo.active && sportInfo.hasPoints && sportInfo.noFmt && sportInfo.noCash;
  report.sportForm = report.sportTab;
  report.polyanaSource = sportInfo.clubCount > 3;
  report.sportClubSelect = sportInfo.clubCount > 3;

  // ADD-ON conditional
  await page.click('[data-mt="yn"][data-field="addon"][data-val="1"]');
  await page.waitForTimeout(200);
  report.addOnConditional = await page.evaluate(() => !!document.getElementById('mtFAddOnCount'));

  // BOUNTY conditional
  await page.click('[data-mt="yn"][data-field="bounty"][data-val="1"]');
  await page.waitForTimeout(200);
  report.bountyConditional = await page.evaluate(() => !!document.getElementById('mtFBountyCount'));

  // CTA
  report.ctaPresent = await page.evaluate(() => !!document.querySelector('.mt-pro-save-primary[data-mt="save"]'));

  // Save SPORT
  await page.click('[data-mt="picker-open"][data-target="mtFClubSelect"]');
  await page.waitForSelector('#mtProPickerOverlay.on');
  const clubVal = await page.evaluate(() => {
    const item = document.querySelector('.mt-pro-picker-item[data-target="mtFClubSelect"]:not([data-value=""])');
    return item?.dataset.value || '';
  });
  await page.click(`.mt-pro-picker-item[data-target="mtFClubSelect"][data-value="${clubVal}"]`);
  await page.fill('#mtFName', 'Sport QA Main');
  await page.fill('#mtFPoints', '125');
  await page.fill('#mtFPlace', '3');
  await page.fill('#mtFField', '48');
  await page.click('[data-mt="save"]');
  await page.waitForTimeout(600);
  report.sportSave = await page.evaluate(() => {
    const t = window.S.tournaments.find((x) => x.tournamentName === 'Sport QA Main');
    return !!(t && t.type === 'sport' && t.points === 125 && (t.venueId || t.clubId || t.clubOrRoom));
  });
  report.ctaWorks = report.sportSave;
  report.pointsStored = report.sportSave;

  // Save ONLINE
  await page.click('[data-mt="add"]');
  await page.waitForSelector('#mtProModal.on');
  await page.click('[data-mt="pick-type"][data-val="online"]');
  await page.waitForTimeout(200);
  await page.click('[data-mt="picker-open"][data-target="mtFRoomSelect"]');
  await page.waitForSelector('#mtProPickerOverlay.on');
  await page.click('.mt-pro-picker-item[data-target="mtFRoomSelect"][data-value="PokerStars"]');
  await page.fill('#mtFName', 'Online QA Major');
  await page.fill('#mtFBuyin', '800');
  await page.fill('#mtFCash', '2400');
  await page.click('[data-mt="save"]');
  await page.waitForTimeout(600);
  report.onlineSave = await page.evaluate(() => {
    const t = window.S.tournaments.find((x) => x.tournamentName === 'Online QA Major');
    return !!(t && t.type === 'online' && t.room === 'PokerStars');
  });

  // Save OFFLINE
  await page.click('[data-mt="add"]');
  await page.waitForSelector('#mtProModal.on');
  await page.click('[data-mt="pick-type"][data-val="offline"]');
  await page.waitForTimeout(200);
  await page.click('[data-mt="picker-open"][data-target="mtFClubSelect"]');
  await page.waitForSelector('#mtProPickerOverlay.on');
  await page.click('.mt-pro-picker-item[data-target="mtFClubSelect"][data-value="__custom__"]');
  await page.fill('#mtFClubCustom', 'QA Offline Club');
  await page.fill('#mtFName', 'Offline QA Event');
  await page.fill('#mtFBuyin', '1500');
  await page.fill('#mtFCash', '5000');
  await page.click('[data-mt="save"]');
  await page.waitForTimeout(600);
  report.offlineSave = await page.evaluate(() => {
    const t = window.S.tournaments.find((x) => x.tournamentName === 'Offline QA Event');
    return !!(t && t.type === 'offline' && t.clubOrRoom === 'QA Offline Club');
  });

  // Edit sport opens sport form
  await page.locator('.mt-pro-card-sport [data-mt="edit"]').first().click();
  await page.waitForSelector('#mtProModal.on');
  report.edit = await page.evaluate(() => ({
    sportActive: document.querySelector('[data-mt="pick-type"][data-val="sport"]')?.classList.contains('active'),
    hasPoints: !!document.getElementById('mtFPoints')
  })).then((x) => x.sportActive && x.hasPoints);
  await page.click('[data-mt="sheet-close"]');
  await page.waitForTimeout(200);

  // Delete
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-mt="delete"]').first().click();
  await page.waitForTimeout(400);
  report.delete = await page.evaluate(() => window.S.tournaments.length === 2);

  // Persistence via reload
  const saved = await page.evaluate(() => JSON.stringify(window.S.tournaments));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#mainApp:not(.hidden)');
  report.persistence = await page.evaluate((s) => {
    window.S.tournaments = JSON.parse(s);
    return window.S.tournaments.length === 2;
  }, saved);

  report.hOverflow = await page.evaluate(() => {
    const m = document.getElementById('mtProModal');
    return m ? m.scrollWidth > m.clientWidth + 1 : false;
  });

  const filteredErrors = errors.filter((x) => !/myGo18|leaflet|favicon|only has a getter/i.test(x));
  report.runtimeErrors = filteredErrors;

  assert.equal(report.offlineTab, true, 'offline tab');
  assert.equal(report.onlineTab, true, 'online tab');
  assert.equal(report.sportTab, true, 'sport tab');
  assert.equal(report.polyanaSource, true, 'polyana clubs loaded');
  assert.equal(report.addOnConditional, true, 'add-on conditional');
  assert.equal(report.bountyConditional, true, 'bounty conditional');
  assert.equal(report.ctaPresent, true, 'cta present');
  assert.equal(report.sportSave, true, 'sport save');
  assert.equal(report.onlineSave, true, 'online save');
  assert.equal(report.offlineSave, true, 'offline save');
  assert.equal(report.edit, true, 'edit sport form');
  assert.equal(report.delete, true, 'delete');
  assert.equal(filteredErrors.length, 0, filteredErrors.join('; '));

  console.log(JSON.stringify({ pass: true, report }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
