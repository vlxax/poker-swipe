/**
 * Duplicate global brand header verification @ 390×844
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts';
const PORT = 8794;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

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

async function countBrandHeaders(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    };

    const globalHeader = document.querySelector('#mainApp > header.creatorTop');
    const globalBrand = globalHeader?.querySelector('.brand');
    const globalBy = globalHeader?.querySelector('.topRightMark24');

    const localBlocks = [
      ...document.querySelectorAll('#polyana .pspTop, #home .v31HomeTop, #ps72TournamentScreen .ps72brand')
    ].filter(visible);

    const brandTextHits = [...document.querySelectorAll('#mainApp main *')]
      .filter(visible)
      .filter((el) => {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/POKER\s*SWIPE/i.test(t)) return false;
        if (!/Фриковая\s*Дама|ФРИКОВАЯ\s*ДАМА/i.test(t)) return false;
        if (globalHeader?.contains(el)) return false;
        return true;
      });

    return {
      globalBrandVisible: visible(globalBrand),
      globalByVisible: visible(globalBy),
      localBrandBlocks: localBlocks.length,
      extraBrandTextBlocks: brandTextHits.length,
      polyanaBrandBlocks: document.querySelectorAll('#polyana .pspTop').length,
      totalDuplicate: localBlocks.length + brandTextHits.length
    };
  });
}

const server = startServer();
await waitForServer();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

const screens = [
  { nav: 'home', label: 'Играть' },
  { nav: 'myhands', label: 'Мои' },
  { nav: 'polyana', label: 'Поляна' },
  { nav: 'profile', label: 'Профиль' },
  { nav: 'mytournaments', label: 'Мои турниры' }
];

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)', { timeout: 30000 });
  await page.waitForSelector('[data-nav="polyana"]', { timeout: 15000 });

  const results = {};
  for (const { nav, label } of screens) {
    await page.click(`[data-nav="${nav}"]`);
    await page.waitForTimeout(900);
    results[nav] = await countBrandHeaders(page);
    assert.equal(results[nav].totalDuplicate, 0, `${label}: duplicate brand header detected`);
    assert.equal(results[nav].polyanaBrandBlocks, 0, `${label}: polyana local brand block must not exist`);
    assert.equal(results[nav].globalBrandVisible, true, `${label}: global brand header missing`);
  }

  // Polyana screenshot
  await page.click('[data-nav="polyana"]');
  await page.waitForTimeout(800);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/screenshot_polyana_single_header.png`, fullPage: false });

  const filteredErrors = errors.filter((e) => !/myGo18|only has a getter|leaflet|favicon/i.test(e));
  assert.equal(filteredErrors.length, 0, filteredErrors.join('; '));

  console.log(JSON.stringify({ pass: true, results }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
