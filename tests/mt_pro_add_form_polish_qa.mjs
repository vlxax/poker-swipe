/**
 * Add form visual polish QA — 7 screenshots @390×844
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/opt/cursor/artifacts/mt_add_form_polish_qa';
const PORT = 8812;
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

  // A OFFLINE top + active tab
  await openAdd();
  await page.screenshot({ path: `${OUT}/A_offline_active_tab.png`, fullPage: false });

  // B ONLINE
  await page.click('[data-mt="pick-type"][data-val="online"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/B_online_form.png`, fullPage: false });

  // C SPORT club + points
  await page.click('[data-mt="pick-type"][data-val="sport"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/C_sport_form.png`, fullPage: false });

  // D custom club dropdown open
  await page.click('[data-mt="picker-open"][data-target="mtFClubSelect"]');
  await page.waitForSelector('#mtProPickerOverlay.on');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/D_sport_club_picker.png`, fullPage: false });
  await page.click('[data-mt="picker-close"]');
  await page.waitForTimeout(200);

  // E add-on + bounty expanded
  await page.click('[data-mt="yn"][data-field="addon"][data-val="1"]');
  await page.waitForTimeout(220);
  await page.click('[data-mt="yn"][data-field="bounty"][data-val="1"]');
  await page.waitForTimeout(280);
  await page.screenshot({ path: `${OUT}/E_sport_addon_bounty.png`, fullPage: false });

  // F bottom CTA
  await page.evaluate(() => {
    const sheet = document.querySelector('.mt-pro-sheet');
    if (sheet) sheet.scrollTop = sheet.scrollHeight;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/F_bottom_cta.png`, fullPage: false });

  // G pressed state on primary CTA
  const cta = page.locator('.mt-pro-save-primary');
  await cta.dispatchEvent('pointerdown');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/G_cta_pressed_state.png`, fullPage: false });
  await cta.dispatchEvent('pointerup');

  console.log(JSON.stringify({ ok: true, out: OUT, files: fs.readdirSync(OUT).sort() }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
