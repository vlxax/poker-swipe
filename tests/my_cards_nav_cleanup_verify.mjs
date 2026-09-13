/**
 * My Cards header + bottom nav cleanup @ 390×844
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8795;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const EXPECTED_LABELS = ['ИГРАТЬ', 'МОИ', 'ПОЛЯНА', 'МОИ ТУРНИРЫ', 'ПРОФИЛЬ'];
const STALE_LABELS = ['ГЛАВНАЯ', 'РАЗДАЧИ', 'ТЫ'];

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
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

async function inspectMyCards(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    };

    const intro = document.querySelector('#myArea .my18Intro, #myhands .my18Intro');
    const promo = document.querySelector('#myArea .v36Hand, #myhands .v36Hand');
    const recon = document.querySelector('#myArea .reconCard, #myhands .reconCard');
    const title = document.querySelector('#myArea h1.impact, #myhands h1.impact');
    const demon = document.querySelector('#myArea .psMyHandsDemonV3, #myhands .psMyHandsDemonV3');
    const introText = intro?.textContent?.replace(/\s+/g, ' ').trim() || '';

    return {
      my18IntroCount: document.querySelectorAll('#myArea .my18Intro, #myhands .my18Intro').length,
      my18IntroVisible: visible(intro),
      my18IntroText: introText,
      v36HandCount: document.querySelectorAll('#myArea .v36Hand, #myhands .v36Hand').length,
      v36HandVisible: visible(promo),
      reconCardPresent: !!recon,
      titleText: title?.textContent?.replace(/\s+/g, ' ').trim() || '',
      demonVisible: visible(demon),
      hasMigrationCopy: /мигрирован|втором массиве|Калькуляторы и единая/i.test(document.querySelector('#myArea, #myhands')?.textContent || '')
    };
  });
}

async function inspectNav(page) {
  return page.evaluate(({ expected, stale }) => {
    const nav = document.querySelector('.nav');
    const buttons = [...nav.querySelectorAll('button[data-nav]')];
    const labels = buttons.map((btn) => {
      const labelSpans = [...btn.querySelectorAll('.ps73NavLabel, .ps3d-label')];
      const textNodes = [...btn.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      return {
        nav: btn.dataset.nav,
        labelSpanTexts: labelSpans.map((s) => s.textContent.trim()),
        textNodeTexts: textNodes.map((n) => n.textContent.trim()),
        combined: btn.textContent.replace(/\s+/g, ' ').trim()
      };
    });

    const perButtonLabels = labels.map((l) => l.labelSpanTexts[0] || '').filter(Boolean);
    const expectedCounts = Object.fromEntries(expected.map((label) => [
      label,
      perButtonLabels.filter((t) => t === label).length
    ]));
    const duplicateStale = stale.filter((s) => labels.some((l) => l.labelSpanTexts.includes(s) || l.textNodeTexts.includes(s)));

    return {
      buttonCount: buttons.length,
      labels,
      perButtonLabels,
      expectedCounts,
      duplicateStale,
      duplicateLabelSpans: labels.reduce((acc, l) => acc + Math.max(0, l.labelSpanTexts.length - 1), 0),
      strayTextNodes: labels.reduce((acc, l) => acc + l.textNodeTexts.length, 0)
    };
  }, { expected: EXPECTED_LABELS, stale: STALE_LABELS });
}

const server = startServer();
await waitForServer();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });
  await page.waitForSelector('[data-nav="myhands"]', { timeout: 15000 });

  // My Cards screen
  await page.click('[data-nav="myhands"]');
  await page.waitForTimeout(1200);
  const myCards = await inspectMyCards(page);

  assert.equal(myCards.my18IntroCount, 0, 'my18Intro must be removed');
  assert.equal(myCards.my18IntroVisible, false, 'my18Intro must not be visible');
  assert.equal(myCards.v36HandCount, 0, 'v36Hand promo block must be absent on My Cards');
  assert.equal(myCards.hasMigrationCopy, false, 'migration intro copy must be removed');
  assert.equal(myCards.reconCardPresent, true, 'reconCard add-hand entry must remain');
  assert.match(myCards.titleText, /МОИ.*КАРТЫ/i, 'title must remain');

  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/screenshot_my_cards_cleaned.png`, fullPage: false });

  // Recon flow still opens
  await page.click('.reconCard');
  await page.waitForTimeout(800);
  const reconOpen = await page.evaluate(() => !!document.querySelector('#myArea .recon18, #myArea .hr22, #myArea .tool18'));
  assert.equal(reconOpen, true, 'recon/add-hand flow must open from reconCard');

  // Bottom nav on My Cards
  const navMy = await inspectNav(page);
  for (const label of EXPECTED_LABELS) {
    assert.equal(navMy.expectedCounts[label], 1, `${label} must appear exactly once`);
  }
  assert.equal(navMy.duplicateStale.length, 0, `stale nav labels found: ${navMy.duplicateStale.join(', ')}`);
  assert.equal(navMy.duplicateLabelSpans, 0, 'duplicate label spans in nav buttons');
  assert.equal(navMy.strayTextNodes, 0, 'stray text-node nav labels must be removed');

  await page.screenshot({ path: `${OUT}/screenshot_bottom_nav_cleaned.png`, fullPage: false });

  // Nav labels on home too
  await page.click('[data-nav="home"]');
  await page.waitForTimeout(900);
  const navHome = await inspectNav(page);
  for (const label of EXPECTED_LABELS) {
    assert.equal(navHome.expectedCounts[label], 1, `home nav: ${label} must appear exactly once`);
  }

  const filteredErrors = errors.filter((e) => !/myGo18|only has a getter|leaflet|favicon/i.test(e));
  assert.equal(filteredErrors.length, 0, filteredErrors.join('; '));

  console.log(JSON.stringify({
    pass: true,
    myCards,
    navMy,
    navHome,
    runtimeErrors: filteredErrors
  }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
