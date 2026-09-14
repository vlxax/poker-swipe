import { chromium } from '@playwright/test';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';

const ROUTES = [
  { nav: 'home', screenId: 'home' },
  { show: 'daily', screenId: 'daily' },
  { show: 'sizing', screenId: 'sizing' },
  { nav: 'myhands', screenId: 'myhands' },
  { show: 'ranges', screenId: 'ranges' },
  { nav: 'profile', screenId: 'profile' },
  { nav: 'polyana', screenId: 'polyana' },
  { nav: 'mytournaments', screenId: 'mytournaments' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);

  for (const r of ROUTES) {
    if (r.nav) await page.click(`.nav [data-nav="${r.nav}"]`);
    else await page.evaluate((id) => { if (typeof show === 'function') show(id); }, r.show);
    await page.waitForTimeout(450);
    const st = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
      const dup = document.querySelectorAll(`#${id}`).length;
      const ps72 = document.getElementById('ps72TournamentScreen');
      const tourOpen = id === 'mytournaments' && ps72 && (ps72.classList.contains('on') || getComputedStyle(ps72).display !== 'none');
      return {
        active: el?.classList.contains('active') || tourOpen,
        visible: (el && getComputedStyle(el).display !== 'none') || tourOpen,
        overflow,
        dup,
        polyContent: id === 'polyana' ? (document.getElementById('psPolyanaArea')?.innerHTML.length || 0) : null,
      };
    }, r.screenId);
    if (!st.active || !st.visible || st.overflow || st.dup !== 1) {
      console.log(JSON.stringify({ fail: r, st, errors }, null, 2));
      await browser.close();
      process.exit(1);
    }
    if (r.screenId === 'polyana' && (st.polyContent || 0) < 80) {
      console.log(JSON.stringify({ fail: 'polyana empty', st, errors }, null, 2));
      await browser.close();
      process.exit(1);
    }
    await page.evaluate(() => { if (typeof show === 'function') show('home'); });
    await page.waitForTimeout(200);
  }

  await browser.close();
  const filtered = errors.filter((e) => !/favicon/i.test(e));
  if (filtered.length) {
    console.log(JSON.stringify({ fail: 'console', filtered }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ pass: true, routes: ROUTES.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
