#!/usr/bin/env node
import playwright from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = '/home/user/poker-swipe';
const PORT = 9876;
const SCREENSHOT_DIR = './smoke-test-screenshots';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const report = {
  boot: { pageerror: 0, console_error: 0 },
  apis: {},
  desktop_tests: {},
  mobile_tests: {},
  sizing_deepdive: {},
  screenshots: []
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = req.url.split('?')[0];
      let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
      };

      if (fs.existsSync(filePath)) {
        res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(`✓ Server started on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function screenshot(page, name) {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  report.screenshots.push(filename);
  return filepath;
}

async function testScreen(page, screenName, navigationFn) {
  console.log(`  ${screenName}...`);

  // Execute navigation
  try {
    await navigationFn(page);
    await page.waitForTimeout(800);
  } catch (e) {
    console.log(`    Navigation error: ${e.message}`);
  }

  // Check if main container has content
  const hasContent = await page.evaluate(() => {
    const mainContainer = document.querySelector('#main') ||
                         document.querySelector('.main-container') ||
                         document.querySelector('[role="main"]') ||
                         document.querySelector('main');
    if (!mainContainer) return false;
    const html = mainContainer.innerHTML.trim();
    return html.length > 50;
  });

  // Check visibility
  const isVisible = await page.evaluate(() => {
    const body = document.body;
    if (!body) return false;
    const rect = body.getBoundingClientRect();
    return rect.height > 0 && rect.width > 0;
  });

  await screenshot(page, `desktop-${screenName}`);

  const result = {
    status: hasContent && isVisible ? 'PASS' : 'FAIL',
    has_content: hasContent,
    is_visible: isVisible
  };

  report.desktop_tests[screenName] = result;
  console.log(`    ${result.status}`);

  return result;
}

async function testMobileViewport(page, viewport) {
  const viewportName = `${viewport.width}x${viewport.height}`;
  console.log(`  Mobile ${viewportName}...`);

  await page.setViewportSize(viewport);
  await page.reload();
  await page.waitForTimeout(800);

  const results = { viewport: viewportName, screens: {} };
  const screens = ['Swipe', 'Sizing'];

  for (const screen of screens) {
    try {
      await page.evaluate((screenName) => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.toLowerCase().includes(screenName.toLowerCase())
        );
        if (btn) btn.click();
      }, screen);

      await page.waitForTimeout(600);

      const hasContent = await page.evaluate(() => {
        const main = document.querySelector('#main') ||
                    document.querySelector('main');
        return main && main.innerHTML.trim().length > 50;
      });

      results.screens[screen] = hasContent ? 'PASS' : 'FAIL';
    } catch (e) {
      results.screens[screen] = 'ERROR';
    }
  }

  await screenshot(page, `mobile-${viewportName}`);

  report.mobile_tests[viewportName] = results;
  console.log(`    ${JSON.stringify(results.screens)}`);
}

async function runSmokeTest() {
  let browser;
  let server;
  try {
    server = await startServer();
    console.log('\nLaunching browser...\n');

    const browserType = playwright.chromium;
    browser = await browserType.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ?
        path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => {
      pageErrors.push(err.toString());
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ===== BOOT TEST =====
    console.log('=== BOOT TEST ===');
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    report.boot.pageerror = pageErrors.length;
    report.boot.console_error = consoleErrors.length;
    console.log(`  pageerror: ${report.boot.pageerror}`);
    console.log(`  console.error: ${report.boot.console_error}`);

    await screenshot(page, 'boot-baseline');

    // ===== API CHECK =====
    console.log('\n=== API AVAILABILITY ===');
    const apis = await page.evaluate(() => {
      return {
        S: typeof window.S,
        PokerSwipeCore: typeof window.PokerSwipeCore,
        renderSizing: typeof window.renderSizing,
        show: typeof window.show,
        showScreen: typeof window.showScreen
      };
    });
    report.apis = apis;

    Object.entries(apis).forEach(([api, type]) => {
      const status = type === 'function' || type === 'object' ? 'PASS' : 'FAIL';
      console.log(`  ${api}: ${status}`);
    });

    // ===== DESKTOP SCREENS =====
    console.log('\n=== DESKTOP SCREENS (1280x720) ===');
    await page.setViewportSize({ width: 1280, height: 720 });

    // Home
    await testScreen(page, 'Home', async (p) => {
      await p.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    });

    // Swipe
    await testScreen(page, 'Swipe', async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Swipe')
        );
        if (btn) btn.click();
      });
    });

    // Sizing
    await testScreen(page, 'Sizing', async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Sizing')
        );
        if (btn) btn.click();
      });
    });

    // Daily
    await testScreen(page, 'Daily', async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Daily')
        );
        if (btn) btn.click();
      });
    });

    // My Hands
    await testScreen(page, 'My Hands', async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('My Hands')
        );
        if (btn) btn.click();
      });
    });

    // Polyana
    await testScreen(page, 'Polyana', async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Polyana')
        );
        if (btn) btn.click();
      });
    });

    // My Tournaments
    await testScreen(page, 'My Tournaments', async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('My Tournaments')
        );
        if (btn) btn.click();
      });
    });

    // Profile
    await testScreen(page, 'Profile', async (p) => {
      await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Profile')
        );
        if (btn) btn.click();
      });
    });

    // ===== MOBILE TESTS =====
    console.log('\n=== MOBILE TESTS ===');
    const viewports = [
      { width: 320, height: 844 },
      { width: 390, height: 844 },
      { width: 430, height: 932 }
    ];

    for (const viewport of viewports) {
      await testMobileViewport(page, viewport);
    }

    // ===== SIZING DEEP DIVE =====
    console.log('\n=== SIZING DEEP DIVE ===');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.includes('Sizing')
      );
      if (btn) btn.click();
    });
    await page.waitForTimeout(800);

    const sizingState = await page.evaluate(() => {
      return {
        window_renderSizing_type: typeof window.renderSizing,
        window_renderSizing_is_function: typeof window.renderSizing === 'function',
        renders_content: !!document.querySelector('#main')?.innerHTML.trim(),
        main_html_length: document.querySelector('#main')?.innerHTML.trim().length || 0
      };
    });

    console.log('  Sizing State:');
    Object.entries(sizingState).forEach(([key, val]) => {
      console.log(`    ${key}: ${val}`);
    });
    report.sizing_deepdive = sizingState;
    await screenshot(page, 'sizing-deepdive');

    await context.close();
    await browser.close();
    server.close();

    // ===== GENERATE REPORT =====
    console.log('\n\n========== SMOKE TEST REPORT ==========\n');
    console.log('BOOT');
    console.log(`  pageerror: ${report.boot.pageerror}`);
    console.log(`  console.error: ${report.boot.console_error}`);

    console.log('\nAPIS');
    for (const [api, type] of Object.entries(report.apis)) {
      const status = type === 'function' || type === 'object' ? 'PASS' : 'FAIL';
      console.log(`  ${api}: ${status}`);
    }

    console.log('\nDESKTOP');
    for (const [screen, result] of Object.entries(report.desktop_tests)) {
      console.log(`  ${screen}: ${result.status}`);
    }

    console.log('\nMOBILE');
    for (const [viewport, result] of Object.entries(report.mobile_tests)) {
      console.log(`  ${viewport}: ${JSON.stringify(result.screens)}`);
    }

    console.log('\nSCREENSHOTS:');
    report.screenshots.forEach(s => {
      console.log(`  ${s}`);
    });

    // Save report to file
    fs.writeFileSync('smoke-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n✓ Report saved to smoke-test-report.json');
    console.log(`✓ Screenshots saved to ${SCREENSHOT_DIR}/`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (server) server.close();
    if (browser) await browser.close();
    process.exit(1);
  }
}

await runSmokeTest();
