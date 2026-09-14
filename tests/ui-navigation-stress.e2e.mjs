import { chromium } from '@playwright/test';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';
const CYCLES = Number(process.env.PS_NAV_CYCLES || 20);

const SCREENS = [
  { id: 'home', nav: 'home' },
  { id: 'daily', show: 'daily' },
  { id: 'swipe', show: 'swipe' },
  { id: 'sizing', show: 'sizing' },
  { id: 'myhands', nav: 'myhands' },
  { id: 'ranges', show: 'ranges' },
  { id: 'profile', nav: 'profile' },
  { id: 'polyana', nav: 'polyana' },
  { id: 'mytournaments', nav: 'mytournaments' },
];

async function go(page, s) {
  if (s.nav) await page.click(`.nav [data-nav="${s.nav}"]`);
  else await page.evaluate((id) => { if (typeof show === 'function') show(id); }, s.show);
  await page.waitForTimeout(280);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push(msg.text()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);

  const failures = [];

  for (const s of SCREENS) {
    let firstHeaderTop = null;
    for (let i = 0; i < CYCLES; i++) {
      await go(page, s);
      const st = await page.evaluate((screenId) => {
        const el = document.getElementById(screenId);
        const ps72 = document.getElementById('ps72TournamentScreen');
        const tour = screenId === 'mytournaments' && ps72?.classList.contains('on');
        const active = el?.classList.contains('active') || tour;
        const dup = document.querySelectorAll(`#${screenId}`).length;
        const overlay = document.querySelector('.pspFiltersOverlay.on, #mtProModal.on, .psHandDayOpen');
        const header = el?.querySelector('h1, .pspHero h1, .v36Top h1, .impact') || document.querySelector('.top');
        const hr = header?.getBoundingClientRect();
        const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
        const polyBlank = screenId === 'polyana'
          ? !(document.getElementById('psPolyanaArea')?.innerHTML.trim().length > 40)
          : false;
        return {
          active,
          dup,
          overlay: !!overlay,
          headerTop: hr ? Math.round(hr.top) : null,
          overflow,
          polyBlank,
        };
      }, s.id);

      if (!st.active || st.dup !== 1 || st.overlay || st.overflow || st.polyBlank) {
        failures.push({ screen: s.id, cycle: i, st });
        break;
      }
      if (st.headerTop != null) {
        if (firstHeaderTop == null) firstHeaderTop = st.headerTop;
        else if (Math.abs(st.headerTop - firstHeaderTop) > 6) {
          failures.push({ screen: s.id, cycle: i, issue: 'header_drift', firstHeaderTop, now: st.headerTop });
          break;
        }
      }
      await page.evaluate(() => { if (typeof show === 'function') show('home'); });
      await page.waitForTimeout(120);
    }
  }

  await browser.close();
  const filtered = pageErrors.filter((e) => !/favicon/i.test(e));
  if (filtered.length) failures.push({ console: filtered });

  if (failures.length) {
    console.log(JSON.stringify({ pass: false, failures, cycles: CYCLES }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ pass: true, screens: SCREENS.length, cycles: CYCLES }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
