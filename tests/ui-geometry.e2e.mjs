import { chromium } from '@playwright/test';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
];

const ROUTES = [
  { id: 'home', nav: 'home' },
  { id: 'daily', show: 'daily' },
  { id: 'sizing', show: 'sizing' },
  { id: 'myhands', nav: 'myhands' },
  { id: 'ranges', show: 'ranges' },
  { id: 'profile', nav: 'profile' },
  { id: 'polyana', nav: 'polyana' },
  { id: 'mytournaments', nav: 'mytournaments' },
];

function rectsOverlap(a, b, pad = 0) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

async function navigate(page, route) {
  if (route.nav) await page.click(`.nav [data-nav="${route.nav}"]`);
  else await page.evaluate((id) => { if (typeof show === 'function') show(id); }, route.show);
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(2500);

    for (const route of ROUTES) {
      await navigate(page, route);
      const geom = await page.evaluate((screenId) => {
        const screen = document.getElementById(screenId);
        const nav = document.querySelector('.nav');
        const top = document.querySelector('.top, .creatorTop');
        const ps72 = document.getElementById('ps72TournamentScreen');
        const activeRoot = screenId === 'mytournaments' && ps72?.classList.contains('on') ? ps72 : screen;
        const main = activeRoot || document.querySelector('.screen.active');
        const header = main?.querySelector('h1, h2.impact, .pspHero, .v36Top, .psScreenHeader') || top;
        const card = main?.querySelector('.psCard, .panel, .tile, .pspAd, .v36Tile, .swipeCardV, .psBlock');
        const cta = main?.querySelector(
          'button.primary, .primary, .v38Primary, .psBtn--primary, [data-sa], .actions button, .pspTab.on'
        );
        const r = (el) => {
          if (!el) return null;
          const b = el.getBoundingClientRect();
          if (b.width < 2 && b.height < 2) return null;
          return { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height };
        };
        const navR = r(nav);
        const headerR = r(header);
        const cardR = r(card);
        const ctaR = r(cta);
        const overflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
        const viewH = window.innerHeight;
        const offBottom = main ? main.getBoundingClientRect().bottom > viewH + 80 : false;
        return {
          overflowX,
          offBottom,
          hasMain: !!main,
          navR,
          ctaR,
          cardR,
          headerR,
        };
      }, route.id);

      const ctaUnderNav = geom.ctaR && geom.navR && rectsOverlap(geom.ctaR, geom.navR);
      if (geom.overflowX) failures.push({ vp, route: route.id, issue: 'horizontal_overflow' });
      if (ctaUnderNav) failures.push({ vp, route: route.id, issue: 'cta_overlaps_nav', geom });
      if (!geom.hasMain && route.id !== 'ranges') failures.push({ vp, route: route.id, issue: 'missing_screen_root' });
    }
    await page.close();
  }

  await browser.close();
  if (failures.length) {
    console.log(JSON.stringify({ pass: false, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ pass: true, viewports: VIEWPORTS.length, routes: ROUTES.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
