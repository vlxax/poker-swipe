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

  // DAILY screen - check IFrame
  console.log('\n=== DAILY SCREEN WITH IFRAME INSPECTION ===');
  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('daily');
    }
  });
  await page.waitForTimeout(500);

  const iframeInfo = await page.evaluate(() => {
    const iframe = document.querySelector('#psHandDayFrame');
    return {
      iframeExists: !!iframe,
      iframeSrc: iframe?.src,
      iframeVisible: iframe?.offsetHeight > 0,
      overlayExists: !!document.querySelector('#psHandDayOverlay'),
      overlayVisible: document.querySelector('#psHandDayOverlay')?.offsetHeight > 0
    };
  });

  console.log('IFrame Info:', JSON.stringify(iframeInfo, null, 2));

  // Try to access iframe content
  try {
    const iframes = page.frames();
    console.log(`Total frames: ${iframes.length}`);

    for (let i = 0; i < iframes.length; i++) {
      const frame = iframes[i];
      const url = frame.url();
      console.log(`Frame ${i}: ${url}`);

      if (url.includes('hand-day') || url.includes('daily') || i > 0) {
        try {
          const frameContent = await frame.evaluate(() => {
            const m = {};

            const allElements = document.querySelectorAll('[id], [class*="history"], [class*="table"], [class*="decision"]');
            m['total_elements'] = allElements.length;

            const ids = new Set();
            document.querySelectorAll('[id]').forEach(el => {
              if (el.offsetHeight > 0) {
                ids.add(el.id);
              }
            });
            m['visible_ids'] = Array.from(ids);

            const mainPanel = document.querySelector('.panel, main, [role="main"]');
            if (mainPanel) {
              m['main_panel'] = {
                tag: mainPanel.tagName,
                class: mainPanel.className,
                children: Array.from(mainPanel.children).map(ch => ({
                  tag: ch.tagName,
                  class: ch.className.substring(0, 50),
                  text: ch.textContent.substring(0, 30)
                }))
              };
            }

            return m;
          });

          console.log(`Frame ${i} content:`, JSON.stringify(frameContent, null, 2));
        } catch (e) {
          console.log(`Frame ${i} - Could not evaluate (likely CORS): ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log('Error inspecting frames:', e.message);
  }

  // SIZING - try to measure actual card/board positions
  console.log('\n=== SIZING SCREEN - CARD/HERO POSITIONS ===');
  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('sizing');
    }
  });
  await page.waitForTimeout(500);

  const sizingCards = await page.evaluate(() => {
    const m = {};

    // Look for card containers
    const cardLike = document.querySelectorAll('[class*="card"], [class*="hero"], [class*="board"]');

    cardLike.forEach((el, i) => {
      if (el.offsetHeight > 0) {
        const r = el.getBoundingClientRect();
        m[`card_${i}_${el.className.split(' ')[0]}`] = {
          tag: el.tagName,
          class: el.className.substring(0, 40),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          height: Math.round(r.height),
          text: el.textContent.substring(0, 30)
        };
      }
    });

    // Measure sizeRead element
    const sizeRead = document.querySelector('[class*="sizeRead"], [class*="read"]');
    if (sizeRead && sizeRead.offsetHeight > 0) {
      const r = sizeRead.getBoundingClientRect();
      m['sizeRead_element'] = {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        text: sizeRead.textContent.substring(0, 30)
      };
    }

    return m;
  });

  console.log('SIZING cards found:', JSON.stringify(sizingCards, null, 2));

  // REVIEW - look for timeline
  console.log('\n=== REVIEW SCREEN - TIMELINE SEARCH ===');
  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('review');
    }
  });
  await page.waitForTimeout(500);

  const reviewTimeline = await page.evaluate(() => {
    const m = {};

    // Search for anything timeline-like
    const timelineLike = document.querySelectorAll('[class*="timeline"], [class*="node"], [class*="line"]');
    console.log(`Found ${timelineLike.length} timeline-like elements`);

    timelineLike.forEach((el, i) => {
      if (el.offsetHeight > 0 && i < 10) { // limit to first 10
        const r = el.getBoundingClientRect();
        m[`timeline_${i}_${el.className.split(' ')[0]}`] = {
          tag: el.tagName,
          class: el.className.substring(0, 40),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
          text: el.textContent.substring(0, 20)
        };
      }
    });

    return m;
  });

  console.log('REVIEW timeline elements:', JSON.stringify(reviewTimeline, null, 2));

  await context.close();
  await browser.close();
}

await runDiagnostic();
