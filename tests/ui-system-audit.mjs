import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '393x852', width: 393, height: 852 },
  { name: '430x932', width: 430, height: 932 },
];

const SCREENS = [
  { id: 'home', nav: 'home', label: 'HOME' },
  { id: 'daily', nav: 'daily', label: 'DAILY', extraNav: null },
  { id: 'swipe', nav: 'swipe', label: 'SWIPE', viaHome: true },
  { id: 'sizing', nav: 'sizing', label: 'SIZING' },
  { id: 'myhands', nav: 'myhands', label: 'MY HANDS' },
  { id: 'ranges', nav: null, label: 'MY RANGES', open: async (page) => {
      await page.evaluate(() => { if (typeof show === 'function') show('ranges'); });
    }},
  { id: 'profile', nav: 'profile', label: 'PROFILE' },
  { id: 'polyana', nav: 'polyana', label: 'POLYANA' },
  { id: 'mytournaments', nav: 'mytournaments', label: 'TOURNAMENTS' },
];

async function auditScreen(page, screen, vp) {
  const errors = [];
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  page.on('pageerror', (e) => errors.push(`page:${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console:${msg.text()}`); });

  try {
    if (screen.open) await screen.open(page);
    else if (screen.viaHome) {
      await page.click('.nav [data-nav="home"]');
      await page.waitForTimeout(200);
      await page.click('#v36Swipe, [data-nav="swipe"], .nav [data-nav="swipe"]').catch(() => page.click('.nav [data-nav="home"]'));
      if (screen.nav) await page.click(`.nav [data-nav="${screen.nav}"]`).catch(() => {});
    } else if (screen.nav) {
      const btn = page.locator(`.nav [data-nav="${screen.nav}"]`);
      if (await btn.count()) await btn.click();
      else await page.evaluate((id) => show(id), screen.id);
    }
    await page.waitForTimeout(500);
  } catch (e) {
    return { screen: screen.label, viewport: vp.name, runtime: 'NAV_FAIL', issues: [String(e.message)] };
  }

  const metrics = await page.evaluate((screenId) => {
    const el = document.getElementById(screenId) || document.querySelector('.screen.active');
    const root = el || document.body;
    const header = root.querySelector('h1, .pspHero h1, .impact, .v36Top h1');
    const card = root.querySelector('.psCard, .panel, .pspAd, .v36Tile, .psBlock, .v38Section');
    const btn = root.querySelector('button.primary, .v38Primary, .pspTab');
    const nav = document.querySelector('.nav');
    const docW = document.documentElement.scrollWidth;
    const viewW = window.innerWidth;
    const overflowX = docW > viewW + 2;
    const ff = header ? getComputedStyle(header).fontFamily : '';
    const bf = btn ? getComputedStyle(btn).fontFamily : '';
    const br = card ? getComputedStyle(card).borderRadius : '';
    return {
      active: el?.classList.contains('active'),
      visible: el ? getComputedStyle(el).display !== 'none' && getComputedStyle(el).opacity !== '0' : false,
      overflowX,
      headerFont: ff.slice(0, 60),
      buttonFont: bf.slice(0, 60),
      cardRadius: br,
      hasHeader: !!header,
      hasCard: !!card,
      navBottom: nav ? nav.getBoundingClientRect().bottom : null,
      contentBottom: root.getBoundingClientRect().bottom,
    };
  }, screen.id);

  const issues = [];
  if (!metrics.active && screen.id !== 'swipe') issues.push('screen not active');
  if (!metrics.visible) issues.push('screen not visible');
  if (metrics.overflowX) issues.push('horizontal overflow');
  if (errors.filter((e) => !/favicon/i.test(e)).length) issues.push(...errors.filter((e) => !/favicon/i.test(e)));

  return {
    screen: screen.label,
    viewport: vp.name,
    runtime: issues.length ? 'ISSUES' : 'OK',
    font: metrics.headerFont,
    header: metrics.hasHeader ? 'present' : 'missing',
    cardStyle: metrics.cardRadius || 'n/a',
    buttonStyle: metrics.buttonFont,
    spacing: 'audit-pending',
    animation: 'not measured',
    overflow: metrics.overflowX ? 'YES' : 'NO',
    nav: metrics.navBottom ? 'visible' : 'missing',
    issues: issues.join('; ') || '—',
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(2500);
    for (const s of SCREENS) {
      rows.push(await auditScreen(page, s, vp));
    }
    await page.close();
  }
  await browser.close();

  const md = [
    '# UI System Audit (baseline)',
    '',
    `Generated: ${new Date().toISOString()}`,
    `URL: ${URL}`,
    '',
    '| SCREEN | VIEWPORT | RUNTIME STATUS | FONT | HEADER | CARD STYLE | BUTTON STYLE | SPACING | ANIMATION | OVERFLOW | NAV | ISSUES |',
    '|--------|----------|----------------|------|--------|------------|--------------|---------|-----------|----------|-----|--------|',
    ...rows.map((r) =>
      `| ${r.screen} | ${r.viewport} | ${r.runtime} | ${r.font.replace(/\|/g, '/')} | ${r.header} | ${r.cardStyle} | ${r.buttonStyle.replace(/\|/g, '/')} | ${r.spacing} | ${r.animation} | ${r.overflow} | ${r.nav} | ${r.issues.replace(/\|/g, '/')} |`
    ),
    '',
  ].join('\n');

  writeFileSync('/workspace/UI_SYSTEM_AUDIT.md', md);
  console.log('Wrote UI_SYSTEM_AUDIT.md', rows.length, 'rows');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
