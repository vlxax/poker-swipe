import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';
const CYCLES = Number(process.env.PS_PROFILE_CYCLES || 20);
const OUT = process.env.PS_VISUAL_OUT || '/opt/cursor/artifacts/ui-baseline';

const VIEWPORTS = [
  { tag: '390x844', width: 390, height: 844 },
  { tag: '393x852', width: 393, height: 852 },
  { tag: '430x932', width: 430, height: 932 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const consoleErrors = [];

  const report = { ownership: null, styles: null, stress: null, screenshots: [] };

  // Ownership + computed styles @ 390
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.click('.nav [data-nav="profile"]');
  await page.waitForTimeout(600);

  report.ownership = await page.evaluate(() => {
    const render = window.renderProfile;
    const src = render ? String(render) : '';
    return {
      hasPokerSwipeProfile: typeof window.PokerSwipeProfile?.render === 'function',
      renderIsPid: src.includes('pid') || src.includes('profile-build'),
      renderName: render?.name || null,
      psYouCount: document.querySelectorAll('#profileArea .psYou, .psYouRoot').length,
      pidCount: document.querySelectorAll('#profileArea .pid').length,
      v38Count: document.querySelectorAll('#profileArea .v38You').length,
      profileAreaDup: document.querySelectorAll('#profileArea').length,
      profileScreenDup: document.querySelectorAll('#profile').length,
      build: document.querySelector('#profileArea [data-profile-build]')?.getAttribute('data-profile-build') || null,
    };
  });

  await page.click('.nav [data-nav="home"]');
  await page.waitForTimeout(400);
  await page.click('.nav [data-nav="profile"]');
  await page.waitForTimeout(400);

  report.styles = await page.evaluate(() => {
    const homeH1 = document.querySelector('#home .v36Top h1, #home h1');
    const profH1 = document.querySelector('#profileArea .pid-intro h1');
    const profEy = document.querySelector('#profileArea .pid-ey');
    const profAxis = document.querySelector('#profileArea .pid-axis');
    const profBtn = document.querySelector('#profileArea .pid-tools button');
    const screen = document.getElementById('profile');
    const cs = (el) => el ? getComputedStyle(el) : null;
    const ff = (el) => cs(el)?.fontFamily?.slice(0, 80) || null;
    const anim = screen ? cs(screen).animationName : null;
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      homeTitleFont: ff(homeH1),
      profileTitleFont: ff(profH1),
      profileEyFont: ff(profEy),
      titleSize: profH1 ? cs(profH1).fontSize : null,
      titleWeight: profH1 ? cs(profH1).fontWeight : null,
      axisRadius: profAxis ? cs(profAxis).borderRadius : null,
      axisBg: profAxis ? cs(profAxis).backgroundColor : null,
      axisBorder: profAxis ? cs(profAxis).borderWidth : null,
      btnMinHeight: profBtn ? cs(profBtn).height : null,
      btnRadius: profBtn ? cs(profBtn).borderRadius : null,
      profileAreaPadL: document.getElementById('profileArea') ? cs(document.getElementById('profileArea')).paddingLeft : null,
      screenAnimation: anim,
      fontsMatch: ff(homeH1) && ff(profH1) ? ff(homeH1).slice(0, 40) === ff(profH1).slice(0, 40) : null,
    };
  });

  // Stress home <-> profile
  let stressFail = null;
  let firstChildCount = null;
  for (let i = 0; i < CYCLES; i++) {
    await page.click('.nav [data-nav="profile"]');
    await page.waitForTimeout(200);
    const st = await page.evaluate(() => ({
      pid: document.querySelectorAll('#profileArea .pid').length,
      psYou: document.querySelectorAll('#profileArea .psYou').length,
      dup: document.querySelectorAll('#profileArea').length,
      children: document.getElementById('profileArea')?.childElementCount ?? 0,
      overlay: !!document.querySelector('.pspFiltersOverlay.on, #mtProModal.on'),
    }));
    if (st.dup !== 1 || st.psYou > 0 || st.pid !== 1 || st.overlay) {
      stressFail = { cycle: i, phase: 'profile', st };
      break;
    }
    if (firstChildCount == null) firstChildCount = st.children;
    else if (st.children !== firstChildCount) {
      stressFail = { cycle: i, phase: 'profile', issue: 'child_count_drift', firstChildCount, now: st.children };
      break;
    }
    await page.click('.nav [data-nav="home"]');
    await page.waitForTimeout(150);
  }
  report.stress = stressFail ? { pass: false, ...stressFail, cycles: CYCLES } : { pass: true, cycles: CYCLES, childCount: firstChildCount };

  await page.close();

  // Profile screenshots all viewports
  mkdirSync(OUT, { recursive: true });
  for (const vp of VIEWPORTS) {
    const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await p.goto(URL, { waitUntil: 'load', timeout: 120000 });
    await p.waitForTimeout(2500);
    await p.click('.nav [data-nav="profile"]');
    await p.waitForTimeout(600);
    const file = join(OUT, `profile-${vp.tag}.png`);
    await p.screenshot({ path: file, fullPage: false });
    report.screenshots.push(file);
    await p.close();
  }

  // Update manifest profile entries
  const manifestPath = join(OUT, 'manifest.json');
  let manifest = { shots: [] };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (_) { /* new */ }
  const shots = (manifest.shots || []).filter((s) => s.screen !== 'profile');
  for (const vp of VIEWPORTS) {
    shots.push({ screen: 'profile', viewport: vp.tag, file: join(OUT, `profile-${vp.tag}.png`) });
  }
  manifest.capturedAt = new Date().toISOString();
  manifest.shots = shots;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  await browser.close();

  const filtered = [...pageErrors, ...consoleErrors].filter((e) => !/favicon/i.test(e));
  const ownOk =
    report.ownership?.hasPokerSwipeProfile &&
    report.ownership?.pidCount === 1 &&
    report.ownership?.psYouCount === 0 &&
    report.ownership?.v38Count === 0 &&
    report.ownership?.profileAreaDup === 1;

  const styleOk =
    report.styles &&
    !report.styles.overflowX &&
    report.styles.fontsMatch &&
    report.styles.profileTitleFont;

  const pass = ownOk && styleOk && report.stress.pass && filtered.length === 0;

  console.log(JSON.stringify({ pass, report, console: filtered }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
