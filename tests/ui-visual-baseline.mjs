import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.PS_VISUAL_OUT || '/opt/cursor/artifacts/ui-baseline';

const SHOTS = [
  { name: 'home', nav: 'home' },
  { name: 'daily', show: 'daily' },
  { name: 'swipe', show: 'swipe' },
  { name: 'sizing', show: 'sizing' },
  { name: 'myhands', nav: 'myhands' },
  { name: 'myranges', show: 'ranges' },
  { name: 'profile', nav: 'profile' },
  { name: 'polyana', nav: 'polyana' },
  { name: 'tournaments', nav: 'mytournaments' },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);

  const manifest = [];
  for (const s of SHOTS) {
    if (s.nav) await page.click(`.nav [data-nav="${s.nav}"]`);
    else await page.evaluate((id) => { if (typeof show === 'function') show(id); }, s.show);
    await page.waitForTimeout(600);
    const file = join(OUT, `${s.name}-390x844.png`);
    await page.screenshot({ path: file, fullPage: false });
    manifest.push({ screen: s.name, file });
  }

  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), shots: manifest }, null, 2));
  await browser.close();
  console.log(JSON.stringify({ pass: true, out: OUT, count: manifest.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
