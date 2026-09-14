import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.PS_VISUAL_OUT || '/opt/cursor/artifacts/ui-baseline';

const VIEWPORTS = [
  { tag: '390x844', width: 390, height: 844 },
  { tag: '393x852', width: 393, height: 852 },
  { tag: '430x932', width: 430, height: 932 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.click('.nav [data-nav="profile"]');
    await page.waitForTimeout(600);

    const check = await page.evaluate(() => {
      const h1 = document.querySelector('#profileArea .pid-intro h1');
      const headerText = document.querySelector('#profileArea .pid-intro')?.innerText || '';
      const duplicateHeadingBrand = /poker\s*swipe/i.test(headerText);
      const homeH1 = document.querySelector('#home .v36Top h1, #home h1.impact, #home h1');
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const ff = (el) => cs(el)?.fontFamily?.slice(0, 60) || '';
      const rect = h1?.getBoundingClientRect();
      return {
        duplicateHeadingBrand,
        hasPidBrand: !!document.querySelector('#profileArea .pid-brand'),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        titleFits: rect ? rect.right <= window.innerWidth + 1 && rect.width <= window.innerWidth : false,
        fontsMatch: ff(homeH1) && ff(h1) ? ff(homeH1).slice(0, 35) === ff(h1).slice(0, 35) : false,
        titleSize: h1 ? cs(h1).fontSize : null,
      };
    });

    const file = join(OUT, `profile-visual-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: false });
    results.push({ viewport: vp.tag, ...check, screenshot: file });
    await page.close();
  }

  await browser.close();

  const pass = results.every(
    (r) =>
      !r.duplicateHeadingBrand &&
      !r.hasPidBrand &&
      !r.overflowX &&
      r.titleFits &&
      r.fontsMatch
  );

  console.log(JSON.stringify({ pass, results }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
