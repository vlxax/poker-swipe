/**
 * Global premium polish QA — 390×844 screenshots + metrics
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'tests', 'screenshots', 'global_polish');
mkdirSync(OUT, { recursive: true });

const W = 390, H = 844;

async function qa(page) {
  return page.evaluate(() => {
    const nav = document.getElementById('bottomNav');
    const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    const vw = window.innerWidth;
    let hOverflow = 0, underNav = 0, blockedCta = 0, charColl = 0, textColl = 0;

    document.querySelectorAll('.screen.active, .screen.active *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (r.right > vw + 1 || r.left < -1) hOverflow++;
      const s = getComputedStyle(el);
      if (s.position === 'fixed' || el.id === 'bottomNav') return;
      if (r.bottom > navTop + 2 && r.top < navTop - 10) {
        const t = (el.textContent || '').trim();
        if (t.length > 0 || el.tagName === 'BUTTON' || el.classList.contains('btn')) underNav++;
      }
    });

    const ctas = document.querySelectorAll('.screen.active .btn, .screen.active button:not(.nav-item)');
    ctas.forEach(btn => {
      const br = btn.getBoundingClientRect();
      if (br.bottom > navTop - 4) blockedCta++;
      document.querySelectorAll('.screen.active .fl-scene, .screen.active .fl-scene__art, .screen.active .demon, .screen.active .companion').forEach(ch => {
        const cr = ch.getBoundingClientRect();
        if (br.left < cr.right - 8 && br.right > cr.left + 8 && br.top < cr.bottom - 8 && br.bottom > cr.top + 8) charColl++;
      });
    });

  const active = document.querySelector('.screen.active');
  if (active) {
    const texts = [...active.querySelectorAll('h1,h2,h3,p,.card-title,.section-title')].filter(e => (e.textContent||'').trim().length > 2);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].getBoundingClientRect(), b = texts[j].getBoundingClientRect();
        if (a.left < b.right - 4 && a.right > b.left + 4 && a.top < b.bottom - 4 && a.bottom > b.top + 4) textColl++;
      }
    }
  }

    return {
      HORIZONTAL_OVERFLOW: hOverflow,
      CONTENT_UNDER_NAV: underNav,
      BLOCKED_CTA: blockedCta,
      CHARACTER_COLLISIONS: charColl,
      TEXT_COLLISIONS: textColl,
      hasAtmosphere: !!document.querySelector('.psAtmosphere'),
      hasZone: !!document.querySelector('.app.ps-zone-active'),
      navPremium: nav?.classList.contains('ps-nav-premium'),
    };
  });
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}_390x844.png`), fullPage: false });
  const m = await qa(page);
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(m, null, 2));
  return m;
}

async function go(page, screenId) {
  await page.evaluate((id) => {
    if (typeof show === 'function') show(id);
    else document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const map = { homeScreen: 0, reviewScreen: 1, polyanaScreen: 2, myTournamentsScreen: 3, profileScreen: 4 };
    const idx = map[id];
    if (idx !== undefined) document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
  }, screenId);
  await page.waitForTimeout(900);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

const results = {};

await go(page, 'homeScreen');
results.home = await shot(page, '01_igray');

await go(page, 'reviewScreen');
results.review = await shot(page, '02_freak_lady_review');

await go(page, 'polyanaScreen');
results.polyana = await shot(page, '03_polyana');

await go(page, 'myTournamentsScreen');
results.tournaments = await shot(page, '04_moi_turniry');

await go(page, 'profileScreen');
results.profile = await shot(page, '05_profil');

await page.evaluate(() => {
  if (typeof show === 'function') show('swipeScreen');
});
await page.waitForTimeout(900);
results.swipe = await shot(page, '06_gameplay_swipe');

await browser.close();

const allPass = Object.values(results).every(r =>
  r.HORIZONTAL_OVERFLOW === 0 && r.CONTENT_UNDER_NAV === 0 && r.BLOCKED_CTA === 0
);
const polishPass = Object.values(results).every(r => r.hasAtmosphere && r.hasZone && r.navPremium);

console.log('\n========== GLOBAL POLISH QA ==========');
console.log('QA_METRICS_PASS:', allPass ? 'PASS' : 'FAIL');
console.log('POLISH_SYSTEM_PASS:', polishPass ? 'PASS' : 'FAIL');
console.log('Screens:', Object.keys(results).join(', '));
