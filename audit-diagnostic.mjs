import { chromium } from 'playwright';

async function runDiagnostic() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium'
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // SIZING screen diagnostic
  console.log('\n=== SIZING SCREEN DOM STRUCTURE ===');
  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('sizing');
    }
  });
  await page.waitForTimeout(500);

  const sizingDom = await page.evaluate(() => {
    const m = {};

    // Find all elements with IDs starting with 'size'
    const sizeIds = document.querySelectorAll('[id*="size"]');
    sizeIds.forEach(el => {
      m[el.id] = {
        tag: el.tagName,
        text: el.textContent.substring(0, 50),
        visible: el.offsetHeight > 0
      };
    });

    // Check for elements with specific classes
    const hasCard = document.querySelector('.card, [class*="card"]');
    const hasHero = document.querySelector('[class*="hero"]');
    const hasBoard = document.querySelector('[class*="board"]');

    if (hasCard) m['card_element'] = { exists: true, tag: hasCard.tagName };
    if (hasHero) m['hero_element'] = { exists: true, tag: hasHero.tagName };
    if (hasBoard) m['board_element'] = { exists: true, tag: hasBoard.tagName };

    // Get full structure of sizing area
    const sizingArea = document.querySelector('#sizingArea');
    if (sizingArea) {
      m['sizingArea_children'] = Array.from(sizingArea.children).map(ch => ({
        tag: ch.tagName,
        id: ch.id,
        class: ch.className,
        text: ch.textContent.substring(0, 30)
      }));
    }

    return m;
  });

  console.log(JSON.stringify(sizingDom, null, 2));

  // REVIEW screen diagnostic
  console.log('\n=== REVIEW SCREEN DOM STRUCTURE ===');
  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('review');
    }
  });
  await page.waitForTimeout(500);

  const reviewDom = await page.evaluate(() => {
    const m = {};

    const reviewIds = document.querySelectorAll('[id*="rv"], [id*="review"]');
    reviewIds.forEach(el => {
      m[el.id] = {
        tag: el.tagName,
        text: el.textContent.substring(0, 50),
        visible: el.offsetHeight > 0
      };
    });

    const timeline = document.querySelector('.timeline, [class*="timeline"]');
    if (timeline) {
      m['timeline_found'] = true;
      m['timeline_nodes'] = timeline.querySelectorAll('[class*="node"]').length;
    }

    const reviewArea = document.querySelector('#reviewArea');
    if (reviewArea) {
      m['reviewArea_children'] = Array.from(reviewArea.children).map(ch => ({
        tag: ch.tagName,
        id: ch.id,
        class: ch.className.substring(0, 50),
        text: ch.textContent.substring(0, 30)
      }));
    }

    return m;
  });

  console.log(JSON.stringify(reviewDom, null, 2));

  // DAILY screen diagnostic
  console.log('\n=== DAILY SCREEN DOM STRUCTURE ===');
  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('daily');
    }
  });
  await page.waitForTimeout(500);

  const dailyDom = await page.evaluate(() => {
    const m = {};

    const dailyIds = document.querySelectorAll('[id*="daily"], [id*="d"]');
    dailyIds.forEach(el => {
      if (el.id) {
        m[el.id] = {
          tag: el.tagName,
          text: el.textContent.substring(0, 50),
          visible: el.offsetHeight > 0
        };
      }
    });

    const dailyArea = document.querySelector('#dailyArea');
    if (dailyArea) {
      m['dailyArea_children'] = Array.from(dailyArea.children).map(ch => ({
        tag: ch.tagName,
        id: ch.id,
        class: ch.className.substring(0, 50),
        text: ch.textContent.substring(0, 30)
      }));
    }

    const panels = document.querySelectorAll('.panel');
    m['panel_count'] = panels.length;

    return m;
  });

  console.log(JSON.stringify(dailyDom, null, 2));

  await context.close();
  await browser.close();
}

await runDiagnostic();
