import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const URL = process.env.PS_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.PS_VISUAL_OUT || '/opt/cursor/artifacts/ui-baseline';
const CYCLES = Number(process.env.PS_POLYANA_MAP_CYCLES || 5);

const VIEWPORTS = [
  { tag: '390x844', width: 390, height: 844 },
  { tag: '393x852', width: 393, height: 852 },
  { tag: '430x932', width: 430, height: 932 },
];

async function measureMap(page) {
  await page.click('.nav [data-nav="polyana"]');
  await page.waitForTimeout(800);
  await page.click('#polyana [data-psp-tab="map"]');
  await page.waitForTimeout(1200);

  return page.evaluate(() => {
    const area = document.getElementById('psPolyanaArea');
    const map = document.getElementById('pspMoscowMapFrame');
    const sk = document.getElementById('pspMapSkeleton');
    const panel = document.querySelector('#polyana .pspMapPanel');
    const vw = window.innerWidth;
    const areaRect = area?.getBoundingClientRect();
    const target = map && !map.hidden && map.getAttribute('src') ? map : sk || panel;
    const mapRect = target?.getBoundingClientRect();
    const contentW = areaRect?.width ?? 0;
    const mapW = mapRect?.width ?? 0;
    return {
      viewport: vw,
      contentWidth: contentW,
      mapWidth: mapW,
      mapRatio: vw ? mapW / vw : 0,
      expectedMinRatio: (vw - 32) / vw - 0.08,
      shellVisible: !!document.querySelector('#polyana .pspHero'),
      mapHasSrc: !!map?.getAttribute('src'),
      skeletonHidden: sk?.getAttribute('aria-hidden') === 'true' || map?.hidden === false,
      overflowX: document.documentElement.scrollWidth > vw + 2,
    };
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(2500);

    let resizeOk = true;
    for (let i = 0; i < CYCLES; i++) {
      await page.click('.nav [data-nav="home"]');
      await page.waitForTimeout(200);
      const m = await measureMap(page);
      if (m.mapRatio < m.expectedMinRatio || m.overflowX) {
        resizeOk = false;
        results.push({ viewport: vp.tag, cycle: i, ...m, resizeOk: false });
        break;
      }
    }
    if (resizeOk) {
      const m = await measureMap(page);
      const file = join(OUT, `polyana-map-${vp.tag}.png`);
      await page.screenshot({ path: file, fullPage: false });
      results.push({
        viewport: vp.tag,
        ...m,
        resizeOk: true,
        cycles: CYCLES,
        screenshot: file,
        pass: m.shellVisible && m.mapRatio >= m.expectedMinRatio && !m.overflowX,
      });
    }
    await page.close();
  }

  await browser.close();
  const pass = results.every((r) => r.pass && r.resizeOk);
  console.log(JSON.stringify({ pass, results }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
