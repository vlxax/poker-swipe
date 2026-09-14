import { chromium } from '@playwright/test';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';
const CYCLES = Number(process.env.PS_POLYANA_CYCLES || 10);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3000);

  const navPolyana = page.locator('.nav [data-nav="polyana"]');
  await navPolyana.waitFor({ state: 'visible', timeout: 15000 });

  for (let i = 0; i < CYCLES; i++) {
    await page.click('.nav [data-nav="polyana"]');
    await page.waitForTimeout(400);

    const state = await page.evaluate(() => {
      const poly = document.getElementById('polyana');
      const tour = document.getElementById('tournaments');
      const area = document.getElementById('psPolyanaArea');
      return {
        polyActive: poly?.classList.contains('active'),
        tourActive: tour?.classList.contains('active'),
        areaLen: area?.innerHTML.trim().length || 0,
        hasPspShell: !!area?.querySelector('.pspTop, .pspHero, .pspTabs'),
        pidProfile: document.querySelectorAll('#profileArea .pid').length,
        v38You: document.querySelectorAll('#polyana .v38You, #tournamentsArea .v38You').length,
        polyDisplay: poly ? getComputedStyle(poly).display : null,
        polyOpacity: poly ? getComputedStyle(poly).opacity : null,
      };
    });

    if (!state.polyActive || state.areaLen < 80 || !state.hasPspShell) {
      console.log(JSON.stringify({ failCycle: i, state, pageErrors, consoleErrors: consoleErrors.filter((x) => !/favicon/i.test(x)) }, null, 2));
      await browser.close();
      process.exit(1);
    }

    // interact with one real control
    const tab = page.locator('#polyana .pspTab').first();
    if (await tab.count()) await tab.click();

    await page.click('.nav [data-nav="home"]');
    await page.waitForTimeout(200);
  }

  const dup = await page.evaluate(() => ({
    polyRoots: document.querySelectorAll('#polyana #psPolyanaArea').length,
    pspHero: document.querySelectorAll('#polyana .pspHero').length,
  }));

  await browser.close();

  const errs = [...pageErrors, ...consoleErrors].filter((x) => !/favicon/i.test(x));
  const pass = dup.polyRoots === 1 && errs.length === 0;
  console.log(JSON.stringify({ pass, cycles: CYCLES, dup, errors: errs }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
