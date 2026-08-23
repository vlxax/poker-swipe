/**
 * Add tournament form visual QA — 7 screenshots @390×844
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/mt_add_form_qa';
const PORT = 8811;
const BASE = `http://127.0.0.1:${PORT}/tests/bubble_ui_bootstrap.html`;

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

async function openAdd() {
  await page.click('[data-mt="add"]');
  await page.waitForSelector('#mtProModal.on');
  await page.waitForTimeout(500);
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#mainApp:not(.hidden)');
  await page.evaluate(() => { window.S.tournaments = []; });
  await page.click('[data-nav="mytournaments"]');
  await page.waitForSelector('#ps72TournamentScreen.on');

  // 1 OFFLINE
  await openAdd();
  await page.click('[data-mt="pick-type"][data-val="offline"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/01_offline_form.png`, fullPage: false });

  // 2 ONLINE
  await page.click('[data-mt="pick-type"][data-val="online"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/02_online_form.png`, fullPage: false });

  // 3 SPORT
  await page.click('[data-mt="pick-type"][data-val="sport"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/03_sport_form.png`, fullPage: false });

  // 4 SPORT club dropdown open
  await page.click('#mtFClubSelect');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/04_sport_club_dropdown.png`, fullPage: false });

  // 5 SPORT add-on + bounty
  await page.click('[data-mt="yn"][data-field="addon"][data-val="1"]');
  await page.waitForTimeout(200);
  await page.click('[data-mt="yn"][data-field="bounty"][data-val="1"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/05_sport_addon_bounty.png`, fullPage: false });

  // 6 bottom CTA
  await page.evaluate(() => {
    const sheet = document.querySelector('.mt-pro-sheet');
    if (sheet) sheet.scrollTop = sheet.scrollHeight;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/06_form_bottom_cta.png`, fullPage: false });

  // 7 saved sport in history
  const clubVal = await page.evaluate(() => {
    const sel = document.getElementById('mtFClubSelect');
    for (const o of sel.options) if (o.value && o.value !== '__custom__') return o.value;
    return sel.options[1]?.value || '';
  });
  await page.selectOption('#mtFClubSelect', clubVal);
  await page.fill('#mtFName', 'Sunday Main');
  await page.fill('#mtFPoints', '125');
  await page.fill('#mtFPlace', '3');
  await page.fill('#mtFField', '48');
  await page.click('[data-mt="save"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/07_saved_sport_card.png`, fullPage: false });

  console.log(JSON.stringify({ ok: true, out: OUT, files: fs.readdirSync(OUT).sort() }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
