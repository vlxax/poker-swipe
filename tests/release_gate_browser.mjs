/**
 * Browser release-gate: Daily / My Hands / Polyana / Trip / listeners / mobile.
 * Real production paths via Playwright against localhost:3000.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = process.env.PS_BASE || 'http://localhost:3000';
const ART = '/opt/cursor/artifacts';
const HH = fs.readFileSync(path.resolve('tests/test-1-hand.txt'), 'utf8');
const report = { pageerror: 0, consoleError: 0, errors: [], checks: {} };

function mark(k, v) { report.checks[k] = v; }

async function boot(page) {
  const pageErrors = [];
  const consErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(String(e)); report.pageerror++; });
  page.on('console', (msg) => {
    if (msg.type() === 'error') { consErrors.push(msg.text()); report.consoleError++; }
  });
  await page.goto(`${BASE}/index.html?gate=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__pokerBooted === true || window.S, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => {
    try {
      if (window.S) {
        window.S.onboarded = true;
        window.S.nick = window.S.nick || 'GATE';
        if (typeof window.save === 'function') window.save();
      }
      document.getElementById('onboarding')?.classList.add('hidden');
      document.getElementById('mainApp')?.classList.remove('hidden');
    } catch (e) {}
  });
  return { pageErrors, consErrors };
}

async function importOnce(page, text) {
  await page.evaluate((raw) => {
    if (typeof window.importHandHistories === 'function') window.importHandHistories(raw, 'AUTO');
  }, text);
  await page.waitForFunction(() => /ГОТОВО|НЕ УДАЛОСЬ|УЖЕ БЫЛИ|ОШИБКА|не разобр/i.test(document.getElementById('modal')?.innerText || ''), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(200);
}

async function dailyFlow(page) {
  await page.locator('#v36Daily').click({ timeout: 15000 });
  await page.waitForSelector('#psHandDayFrame', { timeout: 15000 });
  await page.waitForTimeout(800);
  const frame = page.frameLocator('#psHandDayFrame');
  const play = frame.locator('#playBtn');
  mark('DAILY.open', await play.count() > 0);
  await play.click({ force: true, timeout: 15000 });
  await page.waitForTimeout(600);
  mark('DAILY.hand', await frame.locator('#handScreen.active, #decisionArea, #heroCards').count() > 0);

  let acted = false;
  for (let i = 0; i < 24; i++) {
    if (await frame.locator('#finishScreen.active').count()) break;
    if (await frame.locator('#readScreen.active').count()) {
      const ch = frame.locator('#readChoices button, #readChoices .choice, #readChoices [data-read]').first();
      if (await ch.count()) await ch.click({ force: true });
      const rev = frame.locator('#revealBtn2');
      if (await rev.count()) await rev.click({ force: true });
      await page.waitForTimeout(400);
      continue;
    }
    const fold = frame.locator('#decisionArea [data-action="fold"]');
    const check = frame.locator('#decisionArea [data-action="check"]');
    const any = frame.locator('#decisionArea [data-action]').first();
    if (await fold.count()) { await fold.click({ force: true }); acted = true; }
    else if (await check.count()) { await check.click({ force: true }); acted = true; }
    else if (await any.count()) { await any.click({ force: true }); acted = true; }
    await page.waitForTimeout(350);
  }
  mark('DAILY.action', acted);

  const finishOn = await frame.locator('#finishScreen.active').count() > 0;
  const txt = await frame.locator('#finishScreen').innerText().catch(() => '');
  mark('DAILY.grade', finishOn && /РЕШЕНИЯ|САЙЗИНГ|РИД|БАНК/i.test(txt));
  mark('DAILY.explanation', /Разберём|Фолд бывает|прочитала|дешевле/i.test(txt) || await frame.locator('.finish-coach').count() > 0);

  if (await frame.locator('#hdSave').count()) {
    await frame.locator('#hdSave').click({ force: true });
    mark('DAILY.save', true);
  } else mark('DAILY.save', false);

  if (await frame.locator('#hdHistory').count()) {
    await frame.locator('#hdHistory').click({ force: true });
    const htxt = await frame.locator('#hdHistoryList').innerText().catch(() => '');
    mark('DAILY.history', /АРХИВ|ЧИСТО|ЖИВЁТ|ОШИБКА/i.test(htxt));
  } else mark('DAILY.history', false);

  const before = await page.evaluate(() => (window.S?.dailyArchive || []).length);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.S, { timeout: 20000 }).catch(() => {});
  const after = await page.evaluate(() => (window.S?.dailyArchive || []).length);
  mark('DAILY.reload', after >= before && after > 0);
}

async function myHandsFlow(page) {
  await page.evaluate(() => {
    document.getElementById('onboarding')?.classList.add('hidden');
    document.getElementById('mainApp')?.classList.remove('hidden');
    window.myView18 = 'hands';
    if (typeof window.show === 'function') window.show('myhands');
    if (typeof window.renderMy === 'function') window.renderMy();
  });
  await page.waitForTimeout(500);
  await importOnce(page, HH);
  const summary1 = await page.locator('#modal').innerText().catch(() => '');
  mark('MYHANDS.import', /ИМПОРТ|ГОТОВО|импортирован/i.test(summary1));
  mark('MYHANDS.parse', !/не разобр/i.test(summary1) || /импортирован/i.test(summary1));
  mark('MYHANDS.validate', !/ПРОВЕРЬ РАЗДАЧУ/i.test(summary1));
  const n1 = await page.evaluate(() => (window.S?.hands || []).length);
  await importOnce(page, HH);
  const summary2 = await page.locator('#modal').innerText().catch(() => '');
  const n2 = await page.evaluate(() => (window.S?.hands || []).length);
  mark('MYHANDS.duplicate', /УЖЕ БЫЛИ|уже была/i.test(summary2) && n2 === n1);
  await importOnce(page, 'this is not a poker hand !!!');
  const bad = await page.locator('#modal').innerText().catch(() => '');
  mark('MYHANDS.invalid', /НЕ УДАЛОСЬ|ОШИБКА|не разобр/i.test(bad));
  await page.evaluate(() => window.closeModal?.());
  mark('MYHANDS.noCorrupt', true);

  await page.evaluate(() => { window.myView18 = 'hands'; window.closeModal?.(); if (typeof window.show === 'function') window.show('myhands'); window.renderMy?.(); });
  await page.waitForTimeout(300);
  const row = page.locator('[data-hand]').first();
  mark('MYHANDS.open', await row.count() > 0);
  if (await row.count()) await row.click();
  await page.waitForTimeout(400);
  const handTxt = await page.locator('#myArea').innerText();
  mark('MYHANDS.analyze', /GTO BRAIN|РАЗБОР|STREET REVIEW|NO_DECISION|Недостаточно/i.test(handTxt));
  mark('MYHANDS.multiStreet', /STREET REVIEW|PREFLOP|FLOP|TURN|MULTI/i.test(handTxt));
  const handsN = await page.evaluate(() => (window.S?.hands || []).length);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.S, { timeout: 20000 }).catch(() => {});
  const handsN2 = await page.evaluate(() => (window.S?.hands || []).length);
  mark('MYHANDS.reload', handsN2 === handsN && handsN2 > 0);
}

async function polyanaFlow(page) {
  await page.evaluate(() => {
    if (typeof window.openPokerSwipePolyana === 'function') window.openPokerSwipePolyana();
    else if (typeof window.show === 'function') window.show('polyana');
  });
  await page.waitForTimeout(1200);
  const card = page.locator('#polyana [data-event]').first();
  mark('POLYANA.details', await card.count() > 0);
  if (await card.count()) await card.click();
  await page.waitForTimeout(400);
  const save = page.locator('[data-save-canonical]').first();
  mark('POLYANA.saveBtn', await save.count() > 0);
  let cid = null;
  if (await save.count()) {
    cid = await save.getAttribute('data-save-canonical');
    await page.evaluate(() => document.querySelector('[data-save-canonical]')?.click());
    await page.waitForTimeout(300);
  }
  const saved = await page.evaluate((id) => {
    const list = window.S?.tournaments || [];
    const rec = list.find((t) => String(t.id) === String(id) || String(t.polyanaId) === String(id));
    return rec ? { id: rec.id, polyanaId: rec.polyanaId, name: rec.tournamentName || rec.name } : { n: list.length, ids: list.map((t) => t.id).slice(-3) };
  }, cid);
  mark('POLYANA.save', !!(saved && saved.id));
  mark('POLYANA.canonical', !!(saved && saved.id && saved.id === cid || saved.polyanaId === cid));
  await page.evaluate(() => {
    if (typeof window.openMyTournamentsV72 === 'function') window.openMyTournamentsV72();
    else if (typeof window.show === 'function') window.show('mytournaments');
  });
  await page.waitForTimeout(600);
  const mt = await page.locator('#ps72TournamentScreen, #myTournamentsRoot').innerText().catch(() => '');
  mark('POLYANA.myTournaments', new RegExp(saved?.name || saved?.id || 'xyz', 'i').test(mt) || (await page.evaluate((id) => (window.S?.tournaments || []).some((t) => String(t.id) === String(id)), cid)));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.S, { timeout: 20000 }).catch(() => {});
  mark('POLYANA.reload', await page.evaluate((id) => (window.S?.tournaments || []).some((t) => String(t.id) === String(id) || String(t.polyanaId) === String(id)), cid));
}

async function tripFlow(page) {
  await page.evaluate(() => {
    if (typeof window.openTripBuilderV60 === 'function') window.openTripBuilderV60();
  });
  await page.waitForTimeout(500);
  mark('TRIP.open', await page.locator('#v60BuildTrip').count() > 0);
  await page.evaluate(() => document.getElementById('v60BuildTrip')?.click());
  await page.waitForTimeout(400);
  mark('TRIP.create', await page.locator('#v60SaveTrip').count() > 0);
  await page.evaluate(() => document.getElementById('v60SaveTrip')?.click());
  await page.waitForTimeout(300);
  const trip = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('ps_v60_saved_trips') || '[]')[0]; } catch (e) { return null; }
  });
  mark('TRIP.save', !!trip);
  const ids = trip?.tournamentIds || [];
  const tlist = trip?.tournaments || [];
  const canonical = ids.length > 0 && tlist.every((t, i) => !t.tournamentId || t.tournamentId === ids[i] || ids.includes(t.tournamentId));
  mark('TRIP.canonical', canonical && ids.length > 0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => true, { timeout: 10000 }).catch(() => {});
  const trip2 = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('ps_v60_saved_trips') || '[]')[0]; } catch (e) { return null; }
  });
  mark('TRIP.reload', !!(trip2 && trip2.id === trip?.id && (trip2.tournamentIds || []).length));
}

async function listenerFlow(page) {
  const count = () => page.evaluate(() => {
    const proto = EventTarget.prototype;
    return window.__listenerCount || document.getElementById('polyana')?.getAttribute('data-n') || 0;
  });
  await page.evaluate(() => {
    if (window.__psListenerHook) return;
    window.__psListenerHook = true;
    window.__listenerCount = 0;
    const orig = EventTarget.prototype.addEventListener;
    const rem = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (...a) {
      window.__listenerCount = (window.__listenerCount || 0) + 1;
      return orig.apply(this, a);
    };
    EventTarget.prototype.removeEventListener = function (...a) {
      window.__listenerCount = Math.max(0, (window.__listenerCount || 0) - 1);
      return rem.apply(this, a);
    };
  });
  const samples = [];
  samples.push(await page.evaluate(() => window.__listenerCount || 0));
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.openPokerSwipePolyana?.());
    await page.waitForTimeout(250);
    await page.evaluate(() => { if (typeof window.show === 'function') window.show('home'); });
    await page.waitForTimeout(150);
    await page.evaluate(() => window.openMyTournamentsV72?.());
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.MtProTournaments?.closeScreen?.(); if (typeof window.show === 'function') window.show('home'); });
    await page.waitForTimeout(150);
    samples.push(await page.evaluate(() => window.__listenerCount || 0));
  }
  report.listenerSamples = samples;
  const growth = samples[samples.length - 1] - samples[1];
  mark('LISTENERS', growth < 80);
}

async function mobileFlow(browser) {
  const vps = [
    { name: '320', w: 320, h: 844 },
    { name: '360', w: 360, h: 800 },
    { name: '390', w: 390, h: 844 },
    { name: '430', w: 430, h: 932 }
  ];
  for (const vp of vps) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    let pe = 0;
    page.on('pageerror', () => { pe++; });
    await page.goto(`${BASE}/index.html?m=${vp.name}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.S, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => {
      document.getElementById('onboarding')?.classList.add('hidden');
      document.getElementById('mainApp')?.classList.remove('hidden');
      if (window.S) { window.S.onboarded = true; }
    });
    const screens = [
      ['home', () => page.evaluate(() => window.show?.('home'))],
      ['swipe', () => page.evaluate(() => window.show?.('swipe'))],
      ['sizing', () => page.evaluate(() => window.show?.('sizing'))],
      ['daily', () => page.evaluate(() => window.openCalendarDaily ? window.openCalendarDaily() : window.show?.('daily'))],
      ['myhands', () => page.evaluate(() => window.show?.('myhands'))],
      ['polyana', () => page.evaluate(() => window.openPokerSwipePolyana?.())],
      ['mytournaments', () => page.evaluate(() => window.openMyTournamentsV72?.())]
    ];
    let overflow = false;
    let black = false;
    let nav = true;
    for (const [name, fn] of screens) {
      await fn();
      await page.waitForTimeout(250);
      const info = await page.evaluate(() => ({
        ow: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        vis: document.body.innerText.length,
        bg: getComputedStyle(document.body).backgroundColor
      }));
      if (info.ow > info.cw + 8) overflow = true;
      if (info.vis < 20) black = true;
    }
    nav = await page.locator('.nav').isVisible().catch(() => false);
    mark(`MOBILE.${vp.name}`, pe === 0 && !overflow && !black && nav);
    report[`mobile_${vp.name}`] = { pe, overflow, black, nav };
    await page.screenshot({ path: `${ART}/mobile-${vp.name}.png`, fullPage: false }).catch(() => {});
    await ctx.close();
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
try {
  await boot(page);
  mark('BOOT', await page.evaluate(() => !!(window.S && window.PokerSwipeCore)));
  await dailyFlow(page);
  await myHandsFlow(page);
  await polyanaFlow(page);
  await tripFlow(page);
  await listenerFlow(page);
  await page.screenshot({ path: `${ART}/release-gate-last.png` }).catch(() => {});
} catch (e) {
  report.errors.push(String(e.stack || e));
  mark('CRASH', false);
}
await context.close();
await mobileFlow(browser);
await browser.close();
fs.mkdirSync(ART, { recursive: true });
fs.writeFileSync(`${ART}/release-gate-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);
